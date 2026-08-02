-- AI engine: credit reservations.
--
-- AI.md section 3. The old `ask` RPC took a finished answer and a made-up cost,
-- which only worked because nothing was actually called. Now that a question
-- spends our money at a provider, the money has to be claimed before the call
-- and settled after it (ARCHITECTURE.md law 3), with a sweep that gives back
-- reservations belonging to runs that died (law 6).
--
-- Available credits are weekly_allowance - used_this_week - reserved_this_week.

-- 1. The ledger learns about money that is promised but not yet spent.
alter table credit_ledger
  add column if not exists reserved_this_week integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'credit_ledger_reserved_nonneg'
  ) then
    alter table credit_ledger
      add constraint credit_ledger_reserved_nonneg check (reserved_this_week >= 0);
  end if;
end $$;

-- 2. A message is now a run with a lifecycle, not a finished record.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_status') then
    create type chat_status as enum ('running', 'complete', 'failed');
  end if;
end $$;

alter table chat_messages
  add column if not exists status chat_status not null default 'complete',
  add column if not exists reserved_credits integer not null default 0,
  add column if not exists error text,
  -- What the answer cost and how it was built, so a credit charge can be audited
  -- rather than trusted: model, token counts, searches issued, pages read.
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Finding the runs to sweep must not scan the table.
create index if not exists chat_messages_running_idx
  on chat_messages (org_id, created_at)
  where status = 'running';

-- 3. Every credit movement leaves a row. This is the audit trail behind the
--    meter, and the thing to read when a customer disputes a charge.
create table if not exists credit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  message_id uuid references chat_messages(id) on delete set null,
  kind text not null check (kind in ('reserve', 'settle', 'refund')),
  amount integer not null check (amount >= 0),
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists credit_events_org_idx
  on credit_events (org_id, created_at desc);

alter table credit_events enable row level security;

-- Read only, and only your own org. Every write goes through the RPCs below,
-- which run as definer, so no insert policy exists on purpose.
drop policy if exists credit_events_select on credit_events;
create policy credit_events_select on credit_events
  for select using (is_org_member(org_id));

-- 4. Roll the week forward if it is due. Called with the ledger row already
--    locked by the caller, never on its own.
create or replace function roll_credit_week(target_org uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update credit_ledger
     set used_this_week = 0,
         reserved_this_week = 0,
         resets_at = now() + interval '7 days'
   where org_id = target_org
     and resets_at <= now();
end;
$$;

-- 5. Give back reservations held by runs that never finished. A Vercel timeout
--    or a crashed process must not cost a customer credits they did not spend.
create or replace function sweep_stalled_asks(target_org uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  stalled record;
  swept integer := 0;
begin
  if not is_org_member(target_org) then raise exception 'forbidden'; end if;

  for stalled in
    select id, reserved_credits
      from chat_messages
     where org_id = target_org
       and status = 'running'
       and created_at < now() - interval '10 minutes'
     for update
  loop
    update chat_messages
       set status = 'failed',
           error = 'This run stopped before it finished. The credits it reserved have been given back.',
           reserved_credits = 0
     where id = stalled.id;

    if stalled.reserved_credits > 0 then
      update credit_ledger
         set reserved_this_week = greatest(0, reserved_this_week - stalled.reserved_credits)
       where org_id = target_org;

      insert into credit_events (org_id, message_id, kind, amount, detail)
      values (target_org, stalled.id, 'refund', stalled.reserved_credits, 'stalled run swept');
    end if;

    swept := swept + 1;
  end loop;

  return swept;
end;
$$;

-- 6. Claim. Runs before any provider call. Four tables in one transaction, so
--    it is an RPC by law 1, and it returns null rather than raising when the
--    org simply cannot afford the question.
create or replace function begin_ask(
  target_org uuid,
  target_surface chat_surface,
  question text,
  reserve integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ledger credit_ledger%rowtype;
  answer_id uuid;
  available integer;
begin
  if not is_org_member(target_org) then raise exception 'forbidden'; end if;
  if length(trim(question)) = 0 then raise exception 'a question cannot be empty'; end if;
  if reserve < 0 then raise exception 'a reservation cannot be negative'; end if;

  -- Sweep first: a previous dead run may be holding the very credits this
  -- question needs, and refusing over credits we already owe back is a bug.
  perform sweep_stalled_asks(target_org);

  select * into ledger from credit_ledger where org_id = target_org for update;
  if not found then raise exception 'no credit ledger for org'; end if;

  perform roll_credit_week(target_org);
  select * into ledger from credit_ledger where org_id = target_org;

  available := ledger.weekly_allowance - ledger.used_this_week - ledger.reserved_this_week;
  if reserve > available then
    return null;
  end if;

  insert into chat_messages (org_id, surface, role, body, author_id, status)
  values (target_org, target_surface, 'user', trim(question), auth.uid(), 'complete');

  insert into chat_messages (org_id, surface, role, body, author_id, status, reserved_credits)
  values (target_org, target_surface, 'assistant', '', auth.uid(), 'running', reserve)
  returning id into answer_id;

  update credit_ledger
     set reserved_this_week = reserved_this_week + reserve
   where org_id = target_org;

  if reserve > 0 then
    insert into credit_events (org_id, message_id, kind, amount, detail)
    values (target_org, answer_id, 'reserve', reserve, target_surface::text);
  end if;

  return jsonb_build_object(
    'message_id', answer_id,
    'reserved', reserve,
    'available_after', available - reserve
  );
end;
$$;

-- 7. Settle. Converts the reservation into real spend at the metered cost and
--    hands back the difference. A failed run spends nothing.
create or replace function finish_ask(
  message uuid,
  answer_body text,
  answer_sources jsonb,
  actual_cost integer,
  run_status chat_status,
  answer_meta jsonb default '{}'::jsonb,
  error_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  msg chat_messages%rowtype;
  spend integer;
  refund integer;
begin
  select * into msg from chat_messages where id = message for update;
  if not found then raise exception 'no such message'; end if;
  if not is_org_member(msg.org_id) then raise exception 'forbidden'; end if;

  -- Settling twice would double-charge. The sweep may have got here first.
  if msg.status <> 'running' then
    return jsonb_build_object('settled', false, 'reason', 'already settled');
  end if;

  -- Never bill past the reservation. A run that would cost more stops at the
  -- ceiling, and the engine is responsible for not getting there.
  spend := case when run_status = 'complete'
                then least(greatest(coalesce(actual_cost, 0), 0), msg.reserved_credits)
                else 0 end;
  refund := msg.reserved_credits - spend;

  update chat_messages
     set body = coalesce(answer_body, ''),
         sources = coalesce(answer_sources, '[]'::jsonb),
         credits_spent = spend,
         reserved_credits = 0,
         status = run_status,
         meta = coalesce(answer_meta, '{}'::jsonb),
         error = error_text
   where id = message;

  update credit_ledger
     set reserved_this_week = greatest(0, reserved_this_week - msg.reserved_credits),
         used_this_week = used_this_week + spend
   where org_id = msg.org_id;

  if spend > 0 then
    insert into credit_events (org_id, message_id, kind, amount, detail)
    values (msg.org_id, message, 'settle', spend, msg.surface::text);
  end if;

  if refund > 0 then
    insert into credit_events (org_id, message_id, kind, amount, detail)
    values (msg.org_id, message, 'refund', refund,
            case when run_status = 'failed' then 'run failed' else 'unspent reservation' end);
  end if;

  return jsonb_build_object('settled', true, 'spent', spend, 'refunded', refund);
end;
$$;

-- 8. The ops manager writes tasks, and a task it wrote is labelled as such.
--    The old signature hardcoded 'manual', so it is dropped rather than
--    overloaded: two candidate functions is an ambiguity waiting to happen.
drop function if exists create_task(uuid, text, text, timestamptz, uuid);

create function create_task(
  target_org uuid,
  task_title text,
  task_detail text default '',
  task_due timestamptz default now(),
  linked_candidate uuid default null,
  task_origin text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_id uuid;
begin
  if not is_org_member(target_org) then raise exception 'forbidden'; end if;
  if length(trim(task_title)) = 0 then raise exception 'a task needs a title'; end if;
  if task_origin not in ('manual', 'claude') then raise exception 'unknown task origin'; end if;

  insert into tasks (org_id, ref, title, detail, due, origin, candidate_id)
  values (target_org, next_ref(target_org, 'TASK'), trim(task_title),
          coalesce(task_detail, ''), task_due, task_origin, linked_candidate)
  returning id into new_id;

  return new_id;
end;
$$;

-- 9. The old one-shot ask is gone. Nothing may write an answer without having
--    reserved for it first.
drop function if exists ask(uuid, chat_surface, text, text, jsonb, integer);

-- 10. Client roles never call the helpers directly (migration 5 established
--     this). Grant the new callable surface, revoke the internals.
revoke execute on function roll_credit_week(uuid) from anon, authenticated;
revoke execute on function sweep_stalled_asks(uuid) from anon;
grant execute on function sweep_stalled_asks(uuid) to authenticated;
revoke execute on function begin_ask(uuid, chat_surface, text, integer) from anon;
grant execute on function begin_ask(uuid, chat_surface, text, integer) to authenticated;
revoke execute on function finish_ask(uuid, text, jsonb, integer, chat_status, jsonb, text) from anon;
grant execute on function finish_ask(uuid, text, jsonb, integer, chat_status, jsonb, text) to authenticated;
revoke execute on function create_task(uuid, text, text, timestamptz, uuid, text) from anon;
grant execute on function create_task(uuid, text, text, timestamptz, uuid, text) to authenticated;
