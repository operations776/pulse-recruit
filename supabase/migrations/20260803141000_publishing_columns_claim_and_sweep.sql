-- PLS-87, part two. The columns, the claim, and the sweep.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

alter table content_posts
  -- Daniyal's rule: a date means it goes out. This column exists so the rule
  -- can be true from now on WITHOUT every post already sitting on the calendar
  -- firing the minute the cron starts. See the grandfather update below.
  add column auto_publish         boolean not null default true,
  add column linkedin_account_id  uuid references linkedin_accounts(id) on delete set null,
  add column unipile_post_id      text,
  add column post_url             text,
  add column publish_attempts     integer not null default 0,
  add column publish_error        text,
  add column claimed_at           timestamptz;

-- Grandfather, one time. Everything already dated keeps its plan and stays put;
-- everything scheduled from now on auto-publishes. Without this line, test
-- posts dated during the build would reach a real LinkedIn audience within a
-- minute of the scheduler starting.
update content_posts set auto_publish = false where scheduled_for is not null;

-- content_posts_month_idx leads with org_id, so a cross-org "what is due"
-- sweep cannot use it. This one is built for exactly that question.
create index content_posts_due_idx
    on content_posts (scheduled_for)
 where status = 'scheduled' and auto_publish;

create index content_posts_claimed_idx
    on content_posts (claimed_at)
 where status = 'publishing';

/**
 * Claim the posts that are due, atomically.
 *
 * FOR UPDATE SKIP LOCKED is what makes a second worker safe: it takes the rows
 * this one did not, rather than blocking on them or, worse, publishing them
 * again. The status flip happens BEFORE the caller talks to Unipile, so a
 * crash mid-publish leaves a row in 'publishing' for the sweep to find, never
 * a row that gets sent twice.
 */
create function claim_due_posts(batch integer default 20)
returns table (
  post_id            uuid,
  org_id             uuid,
  body               text,
  unipile_account_id text
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  with due as (
    select p.id
      from content_posts p
      join linkedin_accounts a
        on a.org_id = p.org_id
       and a.status = 'connected'
     where p.status = 'scheduled'
       and p.auto_publish
       and p.scheduled_for <= now()
       -- Three strikes. A post that has failed repeatedly is a post with a
       -- problem the scheduler cannot fix by trying harder.
       and p.publish_attempts < 3
       -- Nothing to say is not worth a LinkedIn API call.
       and length(trim(p.body)) > 0
     order by p.scheduled_for
     limit batch
     for update of p skip locked
  )
  update content_posts p
     set status = 'publishing',
         claimed_at = now(),
         publish_attempts = p.publish_attempts + 1,
         -- Pin the account at claim time so the row records which profile it
         -- was sent as, even if the org connects another one later.
         linkedin_account_id = coalesce(
           p.linkedin_account_id,
           (select a.id from linkedin_accounts a
             where a.org_id = p.org_id and a.status = 'connected'
             order by a.connected_at limit 1)
         )
    from due
   where p.id = due.id
  returning
    p.id,
    p.org_id,
    p.body,
    (select a.unipile_account_id from linkedin_accounts a
      where a.id = p.linkedin_account_id);
end;
$$;

/**
 * Settle a claimed post. Success stamps published_at, which the existing check
 * constraint requires; failure records the real reason so the calendar can
 * show it rather than leaving a post mysteriously stuck.
 */
create function finish_publish(
  target_post uuid,
  post_id_external text default null,
  url text default null,
  failure text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if failure is null then
    update content_posts
       set status = 'published',
           published_at = now(),
           unipile_post_id = post_id_external,
           post_url = url,
           publish_error = null,
           claimed_at = null
     where id = target_post and status = 'publishing';
  else
    update content_posts
       set status = 'failed',
           publish_error = failure,
           claimed_at = null
     where id = target_post and status = 'publishing';
  end if;
end;
$$;

/**
 * Law 6: every async external effect gets a reconciliation sweep.
 *
 * A worker killed by a timeout leaves a row in 'publishing' forever, which is
 * invisible on the calendar and never retried. After ten minutes the row is
 * failed honestly. It is NOT returned to 'scheduled': the post may well have
 * reached LinkedIn before the process died, and quietly resending it is worse
 * than telling someone to check.
 */
create function sweep_stuck_publishes()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  swept integer;
begin
  update content_posts
     set status = 'failed',
         publish_error = 'This post was still sending when the publisher stopped. Check LinkedIn before retrying: it may already be up.',
         claimed_at = null
   where status = 'publishing'
     and claimed_at < now() - interval '10 minutes';
  get diagnostics swept = row_count;
  return swept;
end;
$$;

-- Grants. PLS-72's lesson: Supabase's default privileges grant EXECUTE to anon
-- explicitly, so anon is named in every revoke rather than trusted to fall out
-- of PUBLIC. These three are the publisher's, and the publisher runs as
-- service_role. No client role has any business calling them.
revoke execute on function claim_due_posts(integer) from public, anon, authenticated;
grant execute on function claim_due_posts(integer) to service_role;

revoke execute on function finish_publish(uuid, text, text, text) from public, anon, authenticated;
grant execute on function finish_publish(uuid, text, text, text) to service_role;

revoke execute on function sweep_stuck_publishes() from public, anon, authenticated;
grant execute on function sweep_stuck_publishes() to service_role;
