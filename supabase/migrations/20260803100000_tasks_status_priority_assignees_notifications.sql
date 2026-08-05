-- PLS-73. Tasks grow up: lifecycle, priority, multi-assignee, notifications.
--
-- Ported from the retainer dashboard spec (outputs/module-specs). The one
-- load-bearing lesson from its post-mortem: replacing an assignee set is a
-- delete plus an insert plus a sync, and as three client calls a failure after
-- the delete silently wipes every assignee while the action still returns
-- success. So set-replacement is a Postgres function, and the join table is
-- the only truth for who owns a task.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

-- 1. Lifecycle and priority ---------------------------------------------------

create type task_status as enum
  ('todo', 'in_progress', 'pending', 'blocked', 'completed');
create type task_priority as enum ('low', 'normal', 'high', 'urgent');

alter table tasks
  add column status   task_status   not null default 'todo',
  add column priority task_priority not null default 'normal';

-- done_at predates status and the ops brief reads it, so the two stay one
-- fact: completed means a completion time exists, and nothing else does.
update tasks set status = 'completed' where done_at is not null;

alter table tasks
  add constraint tasks_completed_has_time
    check ((status = 'completed') = (done_at is not null));

-- 2. Assignees: the join table is the only truth ------------------------------

create table task_assignees (
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on task_assignees (user_id, org_id);

alter table task_assignees enable row level security;

create policy task_assignees_select on task_assignees
  for select using (is_org_member(org_id));
-- No insert, update or delete policy. Writes go through the RPC below, which
-- is the point of this migration.

-- 3. Notifications ------------------------------------------------------------

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'task_assigned',
  title      text not null,
  body       text not null default '',
  href       text not null default '',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_unread_idx
    on notifications (user_id, created_at desc)
 where read_at is null;

alter table notifications enable row level security;

-- You see your own, you mark your own read. Nothing else. Rows are only ever
-- written by SECURITY DEFINER functions, so there is no insert policy.
create policy notifications_select on notifications
  for select using (user_id = auth.uid() and is_org_member(org_id));
create policy notifications_update on notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. The set-replacement RPC --------------------------------------------------

create function replace_task_assignees(target_task uuid, new_users uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  task_row  tasks%rowtype;
  added     uuid[];
  recipient uuid;
begin
  select * into task_row from tasks where id = target_task;
  if not found then raise exception 'that task no longer exists'; end if;
  if not is_org_member(task_row.org_id) then raise exception 'forbidden'; end if;

  -- Refuse a user outside the org before touching anything. Without this, an
  -- assignee list is a way to attach a stranger's uuid to your org's task and
  -- leak the title into their notifications.
  if exists (
    select 1 from unnest(coalesce(new_users, '{}')) as u
    where not exists (
      select 1 from org_memberships m
      where m.org_id = task_row.org_id and m.user_id = u
    )
  ) then
    raise exception 'every assignee must be a member of this workspace';
  end if;

  -- Who is new, before the delete makes the question unanswerable.
  select coalesce(array_agg(u), '{}') into added
    from unnest(coalesce(new_users, '{}')) as u
   where not exists (
     select 1 from task_assignees a
     where a.task_id = target_task and a.user_id = u
   );

  delete from task_assignees where task_id = target_task;

  if array_length(new_users, 1) >= 1 then
    insert into task_assignees (task_id, user_id, org_id)
    select distinct target_task, u, task_row.org_id
      from unnest(new_users) as u;
  end if;

  -- Newly added people hear about it. The actor never hears about their own
  -- action, and there is no fallback recipient: route to the assigned person
  -- or to nobody, because a fallback becomes the routing.
  foreach recipient in array added loop
    if recipient <> auth.uid() then
      insert into notifications (org_id, user_id, kind, title, body, href)
      values (task_row.org_id, recipient, 'task_assigned',
              'You were assigned ' || task_row.ref,
              task_row.title, '/ops/tasks');
    end if;
  end loop;

  return coalesce(array_length(added, 1), 0);
end;
$$;

-- 5. Member directory ---------------------------------------------------------

-- The app has nowhere to learn a teammate's name: memberships carry only ids,
-- and auth.users is not client-readable. This is the one sanctioned window,
-- scoped to orgs the caller belongs to.
create function org_members(target_org uuid)
returns table (user_id uuid, email text, display_name text, role org_role)
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.user_id,
         u.email::text,
         coalesce(
           nullif(u.raw_user_meta_data->>'full_name', ''),
           nullif(u.raw_user_meta_data->>'name', ''),
           split_part(u.email::text, '@', 1)
         ) as display_name,
         m.role
    from org_memberships m
    join auth.users u on u.id = m.user_id
   where m.org_id = target_org
     and is_org_member(target_org)
   order by u.email;
$$;

-- 6. create_task learns assignees, so task plus assignees plus notifications
--    is one transaction rather than a write and a follow-up that can strand it.
drop function if exists create_task(uuid, text, text, timestamptz, uuid, text);

create function create_task(
  target_org uuid,
  task_title text,
  task_detail text default '',
  task_due timestamptz default now(),
  linked_candidate uuid default null,
  task_origin text default 'manual',
  task_priority_in task_priority default 'normal',
  assignee_ids uuid[] default null
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

  insert into tasks (org_id, ref, title, detail, due, origin, candidate_id, priority)
  values (target_org, next_ref(target_org, 'TASK'), trim(task_title),
          coalesce(task_detail, ''), task_due, task_origin, linked_candidate,
          task_priority_in)
  returning id into new_id;

  if assignee_ids is not null and array_length(assignee_ids, 1) >= 1 then
    perform replace_task_assignees(new_id, assignee_ids);
  end if;

  return new_id;
end;
$$;

-- Grants. PLS-72 lesson: Supabase's default privileges grant EXECUTE to anon
-- EXPLICITLY, so anon is named in every revoke rather than trusted to fall out
-- of PUBLIC.
revoke execute on function replace_task_assignees(uuid, uuid[]) from public, anon;
grant execute on function replace_task_assignees(uuid, uuid[]) to authenticated, service_role;

revoke execute on function org_members(uuid) from public, anon;
grant execute on function org_members(uuid) to authenticated, service_role;

revoke execute on function create_task(uuid, text, text, timestamptz, uuid, text, task_priority, uuid[])
  from public, anon;
grant execute on function create_task(uuid, text, text, timestamptz, uuid, text, task_priority, uuid[])
  to authenticated, service_role;
