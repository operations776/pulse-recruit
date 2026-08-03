-- PLS-64. create_post could only make a backlog idea, so the planner had to
-- write twice to add a post on a chosen day, and the second write needed the
-- new row's id that the RPC never returned. Taking the date as an argument
-- makes it one write and removes a match-the-row-by-its-text hack from the UI.
--
-- Dropped and recreated rather than replaced, because CREATE OR REPLACE cannot
-- add a parameter. Mirror of the migration applied via the Supabase MCP.
drop function if exists create_post(uuid, content_skill, text);

create function create_post(
  target_org uuid,
  post_skill content_skill,
  post_hook  text,
  post_when  timestamptz default null
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
  if length(trim(post_hook)) = 0 then raise exception 'a post needs a hook'; end if;

  insert into content_posts (org_id, ref, skill, hook, status, scheduled_for, author_id)
  values (target_org, next_ref(target_org, 'POST'), post_skill, trim(post_hook),
          case when post_when is null then 'idea' else 'scheduled' end,
          post_when, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function create_post(uuid, content_skill, text, timestamptz) from public;
grant execute on function create_post(uuid, content_skill, text, timestamptz)
  to authenticated, service_role;
