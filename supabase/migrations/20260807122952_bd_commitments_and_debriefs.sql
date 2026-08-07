-- PLS-109. Mara keeps you to your word.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.
--
-- The BD Strategist redesign turns a research chat into a coach. The thing
-- that makes it a coach rather than a chat box is that it remembers what you
-- said you would do and asks how it went. Neither had anywhere to live.
--
-- Two tables, deliberately separate: a commitment is a promise with a
-- lifecycle, a debrief is one answer about one commitment on one day. Folding
-- the answer into the commitment row would lose the history of a promise you
-- chased three times before it landed.

create table bd_commitments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  -- Personal. A commitment is something YOU said, not something the agency
  -- owes, so a teammate never sees your promises in their ledger.
  user_id uuid not null references auth.users(id) on delete cascade,

  body text not null,
  -- Where it came from: 'said' in conversation, 'play' from Today's play,
  -- or 'manual' if typed straight into the ledger.
  source text not null default 'said',
  message_id uuid references chat_messages(id) on delete set null,

  status text not null default 'open',
  created_at timestamptz not null default now(),
  -- When you said it. Separate from created_at because Mara can record a
  -- promise made earlier in a thread than the moment the row is written.
  said_at timestamptz not null default now(),
  settled_at timestamptz,

  constraint bd_commitments_status check (status in ('open', 'done', 'dropped')),
  constraint bd_commitments_source check (source in ('said', 'play', 'manual')),
  constraint bd_commitments_body check (length(trim(body)) between 1 and 400),
  -- A settled commitment has a settle time and an open one does not. Without
  -- this the ledger can show a "done" row with no date, which reads as a bug.
  constraint bd_commitments_settled check (
    (status = 'open' and settled_at is null) or
    (status <> 'open' and settled_at is not null)
  )
);

-- The ledger query: my open promises, oldest first, because the one you have
-- been avoiding longest is the one that needs saying out loud.
create index bd_commitments_open_idx
    on bd_commitments (org_id, user_id, said_at)
 where status = 'open';

create table bd_debriefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid not null references bd_commitments(id) on delete cascade,

  -- The four answers from the design, plus 'skipped'. Skip is recorded rather
  -- than ignored: "I did not want to answer" is itself information, and
  -- without it the evening prompt would ask again the same day.
  outcome text not null,
  note text not null default '',

  -- The day this answer belongs to, stored rather than derived. A unique
  -- index cannot be built on created_at::date because the cast depends on
  -- the session timezone and is therefore not immutable.
  asked_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),

  constraint bd_debriefs_outcome check (
    outcome in ('went_well', 'still_chasing', 'dead_end', 'skipped')
  ),
  constraint bd_debriefs_note check (length(note) <= 2000)
);

-- One debrief per commitment per day. The evening prompt fires once; asking
-- twice about the same promise on the same evening is nagging, not coaching.
create unique index bd_debriefs_daily_uniq
    on bd_debriefs (commitment_id, asked_on);

create index bd_debriefs_recent_idx
    on bd_debriefs (org_id, user_id, created_at desc);

alter table bd_commitments enable row level security;
alter table bd_debriefs enable row level security;

revoke all on table bd_commitments from anon;
revoke all on table bd_debriefs from anon;
grant select, insert, update, delete on table bd_commitments to authenticated;
grant select, insert, update, delete on table bd_debriefs to authenticated;

-- Yours only, on every verb. Same shape as a personal BD memory: an admin has
-- no business reading, closing or deleting a teammate's promises, and "did
-- you do the thing you said" is not a management report.
create policy bd_commitments_select on bd_commitments
  for select to authenticated
  using (is_org_member(org_id) and user_id = (select auth.uid()));

create policy bd_commitments_insert on bd_commitments
  for insert to authenticated
  with check (is_org_member(org_id) and user_id = (select auth.uid()));

create policy bd_commitments_update on bd_commitments
  for update to authenticated
  using (is_org_member(org_id) and user_id = (select auth.uid()))
  with check (is_org_member(org_id) and user_id = (select auth.uid()));

create policy bd_commitments_delete on bd_commitments
  for delete to authenticated
  using (is_org_member(org_id) and user_id = (select auth.uid()));

create policy bd_debriefs_select on bd_debriefs
  for select to authenticated
  using (is_org_member(org_id) and user_id = (select auth.uid()));

create policy bd_debriefs_insert on bd_debriefs
  for insert to authenticated
  with check (is_org_member(org_id) and user_id = (select auth.uid()));

create policy bd_debriefs_update on bd_debriefs
  for update to authenticated
  using (is_org_member(org_id) and user_id = (select auth.uid()))
  with check (is_org_member(org_id) and user_id = (select auth.uid()));

/**
 * Settle a commitment and record how it went, in one transaction.
 *
 * Two tables, so law 1 says RPC. A client doing this as two writes could mark
 * a promise done and then fail to record the debrief, losing exactly the
 * thing the debrief exists to capture.
 *
 * 'still_chasing' deliberately leaves the commitment OPEN. Saying "not yet"
 * is not completing it, and a coach that quietly closed the promise because
 * you answered the question would be letting you off.
 */
create function settle_commitment(
  target_commitment uuid,
  debrief_outcome text,
  debrief_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  row_org uuid;
  row_user uuid;
  next_status text;
begin
  select org_id, user_id into row_org, row_user
    from bd_commitments
   where id = target_commitment;

  if row_org is null then
    raise exception 'that commitment no longer exists';
  end if;
  -- RLS already scopes reads, but this function is SECURITY DEFINER so it
  -- checks ownership itself rather than inheriting it.
  if row_user <> auth.uid() or not is_org_member(row_org) then
    raise exception 'forbidden';
  end if;

  next_status := case debrief_outcome
    when 'went_well' then 'done'
    when 'dead_end' then 'dropped'
    else 'open'
  end;

  insert into bd_debriefs (org_id, user_id, commitment_id, outcome, note)
  values (row_org, row_user, target_commitment, debrief_outcome, coalesce(debrief_note, ''))
  on conflict (commitment_id, asked_on)
  -- Asked and answered twice in one evening: the later answer wins rather
  -- than raising, because a person correcting themselves is not an error.
  do update set outcome = excluded.outcome, note = excluded.note;

  update bd_commitments
     set status = next_status,
         settled_at = case when next_status = 'open' then null else now() end
   where id = target_commitment;

  return jsonb_build_object('status', next_status);
end;
$$;

-- PLS-72's lesson: Supabase grants EXECUTE to anon explicitly, so anon is
-- named in the revoke rather than trusted to fall out of PUBLIC.
revoke execute on function settle_commitment(uuid, text, text) from public, anon;
grant execute on function settle_commitment(uuid, text, text) to authenticated;
