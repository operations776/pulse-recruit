-- PLS-105. begin_ask writes into a conversation.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.
--
-- The conversation is resolved INSIDE this function, not by the caller, for
-- the same reason the two message rows are: the claim has to be atomic. A
-- caller that created the thread first and then reserved could crash between
-- the two and leave an empty conversation in the history panel.
--
-- `target_conversation` null means "start a new thread", which is what the
-- New conversation button sends.

create or replace function begin_ask(
  target_org uuid,
  target_surface chat_surface,
  question text,
  reserve integer,
  target_conversation uuid default null
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
  convo_id uuid;
begin
  if not is_org_member(target_org) then raise exception 'forbidden'; end if;
  if length(trim(question)) = 0 then raise exception 'a question cannot be empty'; end if;
  if reserve < 0 then raise exception 'a reservation cannot be negative'; end if;

  perform sweep_stalled_asks(target_org);

  select * into ledger from credit_ledger where org_id = target_org for update;
  if not found then raise exception 'no credit ledger for org'; end if;

  perform roll_credit_week(target_org);
  select * into ledger from credit_ledger where org_id = target_org;

  available := ledger.weekly_allowance - ledger.used_this_week - ledger.reserved_this_week;
  if reserve > available then
    return null;
  end if;

  -- Resolve the thread before anything is written to it.
  if target_conversation is not null then
    select id into convo_id
      from chat_conversations
     where id = target_conversation
       and org_id = target_org
       and surface = target_surface;
    -- A thread that does not exist, or belongs to another org or surface, is
    -- not an error worth failing a paid run over: start a fresh one rather
    -- than lose the question.
  end if;

  if convo_id is null then
    insert into chat_conversations (org_id, surface, title, author_id)
    values (target_org, target_surface, left(trim(question), 60), auth.uid())
    returning id into convo_id;
  else
    -- An existing thread rises to the top of the history panel, and takes its
    -- title from the first question if it never got one.
    update chat_conversations
       set last_message_at = now(),
           title = case
             when title = 'New conversation' then left(trim(question), 60)
             else title
           end
     where id = convo_id;
  end if;

  insert into chat_messages (org_id, surface, role, body, author_id, status, conversation_id)
  values (target_org, target_surface, 'user', trim(question), auth.uid(), 'complete', convo_id);

  insert into chat_messages (org_id, surface, role, body, author_id, status, reserved_credits, conversation_id)
  values (target_org, target_surface, 'assistant', '', auth.uid(), 'running', reserve, convo_id)
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
    'conversation_id', convo_id,
    'reserved', reserve,
    'available_after', available - reserve
  );
end;
$$;

-- PLS-72's lesson: Supabase grants EXECUTE to anon explicitly, so anon is
-- named in the revoke rather than trusted to fall out of PUBLIC.
revoke execute on function begin_ask(uuid, chat_surface, text, integer, uuid) from public, anon;
grant execute on function begin_ask(uuid, chat_surface, text, integer, uuid) to authenticated;

-- The four-argument version is gone: leaving it would let a caller silently
-- write an unthreaded message that never appears in the history panel.
drop function if exists begin_ask(uuid, chat_surface, text, integer);
