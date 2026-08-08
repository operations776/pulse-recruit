-- PLS-153. A disconnected LinkedIn is Needs attention, never Failed.
--
-- The spec frame is blunt about why: "Failed tells the user nothing they can
-- act on." Today every unhappy ending lands on `failed`, whether LinkedIn
-- refused the words or we never reached LinkedIn at all. Those are different
-- problems with different fixes, and only one of them is about the post.
--
-- Two behaviours change:
--
--   1. finish_publish learns WHY it failed. `refused` keeps today's `failed`.
--      `unreachable` lands `needs_attention` with the reason, and gives back
--      the attempt, because an attempt we never made must not burn one of the
--      three the retry budget allows.
--
--   2. flag_unpublishable_posts closes a silent hole. claim_due_posts joins to
--      a connected account, so a due post in an org with no connected account
--      is simply never selected. It sits in `scheduled`, past its date,
--      forever, and the only evidence is that it looks overdue on a calendar.
--
-- Law 1 note, so nobody thinks it is being invented here: both functions touch
-- one table each. They are RPCs because they are service-role-only publisher
-- internals, the same reason sweep_stuck_publishes is one, not because of the
-- two-table rule.
--
-- Known gap, deliberately not closed here: a scheduled post with an empty body
-- is excluded by claim_due_posts for the same structural reason and is stuck in
-- the same way. That is a different cause with a different message, and folding
-- it into this function would make one reason string cover two situations.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

-- 1. The reason, and a queue to find it in -------------------------------------

alter table content_posts add column attention_reason text;

-- The two states a human has to clear. Partial, because these are a handful of
-- rows in a table that is mostly published history.
create index content_posts_attention_idx on content_posts (org_id, status)
  where status in ('needs_review', 'needs_attention');

-- 2. finish_publish learns why ---------------------------------------------------
--
-- Every overload goes rather than one named signature. `drop function if
-- exists` with a signature that does not match exactly is a silent no-op, and
-- the new five-argument version would then sit beside the old four-argument
-- one. The cron calls it with named arguments, both would match, and PostgREST
-- answers an ambiguous call with "could not choose the best candidate
-- function" rather than picking. That failure would land on a post going out,
-- not here. Same lesson as create_task in PLS-132.
do $$
declare
  sig text;
begin
  for sig in
    select p.oid::regprocedure::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'finish_publish'
  loop
    execute 'drop function ' || sig;
  end loop;
end;
$$;

create function finish_publish(
  target_post      uuid,
  post_id_external text default null,
  url              text default null,
  failure          text default null,
  failure_kind     text default 'refused'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if failure_kind not in ('refused', 'unreachable') then
    raise exception 'unknown failure kind: %', failure_kind;
  end if;

  if failure is null then
    update content_posts
       set status = 'published',
           published_at = now(),
           unipile_post_id = post_id_external,
           post_url = url,
           publish_error = null,
           attention_reason = null,
           claimed_at = null
     where id = target_post and status = 'publishing';

  elsif failure_kind = 'unreachable' then
    -- We never got to ask LinkedIn, so this is about the account, and the
    -- attempt goes back. greatest(...,0) because a hand-run of this function
    -- outside the claim path would otherwise push the counter negative.
    update content_posts
       set status = 'needs_attention',
           attention_reason = failure,
           publish_error = null,
           publish_attempts = greatest(publish_attempts - 1, 0),
           claimed_at = null
     where id = target_post and status = 'publishing';

  else
    update content_posts
       set status = 'failed',
           publish_error = failure,
           attention_reason = null,
           claimed_at = null
     where id = target_post and status = 'publishing';
  end if;
end;
$$;

-- 3. The posts the claim query can never see -------------------------------------

/**
 * Move due posts that have nowhere to go into needs_attention.
 *
 * claim_due_posts inner joins linkedin_accounts on status = 'connected'. That
 * join is correct: there is no point claiming a post we cannot send. The
 * consequence is that a due post in an org whose account expired is invisible
 * to the publisher and stays `scheduled` past its date indefinitely.
 *
 * Called by the cron before claim_due_posts, so the queue is accurate before
 * anything is sent. Returns how many it moved, because a route that reports
 * counts should report honest ones.
 */
create function flag_unpublishable_posts()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  moved integer;
begin
  with stuck as (
    select p.id
      from content_posts p
     where p.status = 'scheduled'
       and p.auto_publish
       and p.scheduled_for <= now()
       and not exists (
         select 1 from linkedin_accounts a
          where a.org_id = p.org_id and a.status = 'connected'
       )
  )
  update content_posts p
     set status = 'needs_attention',
         attention_reason =
           'This was due to go out, but no LinkedIn account is connected for '
           || 'this workspace. Reconnect in Settings, Channels, then schedule it again.',
         claimed_at = null
    from stuck
   where p.id = stuck.id;

  get diagnostics moved = row_count;
  return moved;
end;
$$;

-- 4. Grants ----------------------------------------------------------------------
--
-- PLS-72 lesson: Supabase grants EXECUTE to anon EXPLICITLY, so anon is named
-- in every revoke rather than trusted to fall out of PUBLIC. Both of these are
-- publisher internals and stay service_role only, like claim_due_posts.

revoke execute on function finish_publish(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function finish_publish(uuid, text, text, text, text) to service_role;

revoke execute on function flag_unpublishable_posts()
  from public, anon, authenticated;
grant execute on function flag_unpublishable_posts() to service_role;
