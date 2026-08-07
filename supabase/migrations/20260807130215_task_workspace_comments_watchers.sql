-- PLS-111. The tasks workspace: comments, watchers, company links, and an
-- honest record of who completed what.
--
-- The Figma redesign asks for four things the schema could not say:
--
--   1. "COMPLETED BY YOU" under a finished row. `tasks` stamped done_at and
--      nothing else, so the row knew when but never who.
--   2. "CLIENT Halden Group" beside a task. `candidate_id` was the only link.
--   3. An activity stream mixing system events and human comments, with edit,
--      delete, reply and @mention.
--   4. Watchers, because "a new comment notifies watchers and the assignee,
--      never the whole workspace" needs a set to notify.
--
-- Law 1 shapes most of this file. A comment writes a comment row, watcher rows
-- for anyone mentioned, and a notification per recipient: three tables, so it
-- is a function. Completing writes the task row and an activity row: two
-- tables, so that is a function too.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

-- 1. What a task can point at, and who finished it -----------------------------

alter table tasks
  add column company_id uuid references companies(id) on delete set null,
  add column done_by    uuid references auth.users(id) on delete set null;

create index tasks_company_idx on tasks (org_id, company_id)
  where company_id is not null;

-- done_by is part of the same one fact as status and done_at. A reopened task
-- that kept the name of whoever closed it last week is a lie the UI would print.
alter table tasks
  add constraint tasks_done_by_only_when_completed
    check (done_by is null or status = 'completed');

-- 2. Watchers ------------------------------------------------------------------

create table task_watchers (
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_watchers_user_idx on task_watchers (user_id, org_id);

alter table task_watchers enable row level security;

create policy task_watchers_select on task_watchers
  for select using (is_org_member(org_id));

-- You may start and stop watching a task yourself. Adding somebody else is
-- what an @mention does, and that goes through the comment RPC below, because
-- a watcher added without the comment that explains it is noise nobody asked
-- for. The org_id cannot be forged: it has to match the task's own.
-- Both sides of the org check are qualified deliberately. Unqualified inside
-- the subquery, `org_id` resolves to the INNER scope, so `t.org_id = org_id`
-- reads as `t.org_id = t.org_id` and the guard is always true: the row could
-- then carry any org it liked. The table name is how a policy names its own row.
create policy task_watchers_insert on task_watchers
  for insert with check (
    user_id = auth.uid()
    and is_org_member(org_id)
    and exists (
      select 1 from tasks t
       where t.id = task_watchers.task_id
         and t.org_id = task_watchers.org_id
    )
  );

create policy task_watchers_delete on task_watchers
  for delete using (user_id = auth.uid() and is_org_member(org_id));

-- 3. One stream, two kinds of entry --------------------------------------------
--
-- System events are the audit trail and are never editable. Comments belong to
-- their author. `author_id` null means the entry has no human behind it, which
-- is how a task Claude created says so.

create table task_comments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  task_id    uuid not null references tasks(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  kind       text not null default 'comment' check (kind in ('comment', 'system')),
  body       text not null,
  reply_to   uuid references task_comments(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);

-- The stream is read oldest first, per task. That is the only access pattern.
create index task_comments_stream_idx on task_comments (task_id, created_at);

alter table task_comments enable row level security;

create policy task_comments_select on task_comments
  for select using (is_org_member(org_id));

-- No insert, update or delete policy. Every write goes through a function
-- below, because each one touches more than this table or has to stamp a field
-- the client must not choose.

-- 4. Writing to the stream ------------------------------------------------------

-- The internal one. Takes the org from the task so no caller can misfile an
-- entry, and is called by the task functions further down as well as by the
-- comment RPC.
create function append_task_event(
  target_task uuid,
  event_body  text,
  actor       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_id uuid;
begin
  insert into task_comments (org_id, task_id, author_id, kind, body)
  select t.org_id, t.id, actor, 'system', event_body
    from tasks t
   where t.id = target_task
  returning id into new_id;

  return new_id;
end;
$$;

/**
 * Post a comment, pull in anyone mentioned, and tell the people who care.
 *
 * Recipients are the mentioned users, the watchers, and the assignees, minus
 * the person typing. Never the whole workspace: a task with a comment on it is
 * not news to somebody who has never touched it.
 *
 * Law 3, claim before side effects: the comment row and the watcher rows land
 * before a single notification is written, and all of it is one transaction, so
 * a failure halfway cannot leave a notification pointing at a comment that does
 * not exist.
 */
create function add_task_comment(
  target_task   uuid,
  comment_body  text,
  mention_users uuid[] default null,
  parent        uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  task_row  tasks%rowtype;
  new_id    uuid;
  mentions  uuid[] := coalesce(mention_users, '{}');
  recipient uuid;
begin
  select * into task_row from tasks where id = target_task;
  if not found then raise exception 'that task no longer exists'; end if;
  if not is_org_member(task_row.org_id) then raise exception 'forbidden'; end if;
  -- The null case is spelled out: length(trim(null)) is null, not 0, so a bare
  -- "= 0" lets a null through to fail on the NOT NULL constraint instead, and
  -- the caller gets a Postgres error string rather than a sentence.
  if comment_body is null or length(trim(comment_body)) = 0 then
    raise exception 'a comment needs some words';
  end if;

  -- A mention is how somebody gets added as a watcher, so an id from outside
  -- the org is a way to attach a stranger to your workspace's task and leak the
  -- title into their notifications. Same guard as replace_task_assignees.
  if exists (
    select 1 from unnest(mentions) as u
    where not exists (
      select 1 from org_memberships m
      where m.org_id = task_row.org_id and m.user_id = u
    )
  ) then
    raise exception 'you can only mention people in this workspace';
  end if;

  -- A reply has to belong to the same task, or the thread is a lie.
  if parent is not null and not exists (
    select 1 from task_comments c where c.id = parent and c.task_id = target_task
  ) then
    raise exception 'that comment is not on this task';
  end if;

  insert into task_comments (org_id, task_id, author_id, kind, body, reply_to)
  values (task_row.org_id, target_task, auth.uid(), 'comment',
          trim(comment_body), parent)
  returning id into new_id;

  -- Law 2: the primary key is the race guard. Two people mentioning the same
  -- person at once is a conflict, not an error.
  insert into task_watchers (task_id, user_id, org_id)
  select target_task, u, task_row.org_id from unnest(mentions) as u
  on conflict (task_id, user_id) do nothing;

  -- The author is watching their own thread from the moment they speak in it.
  insert into task_watchers (task_id, user_id, org_id)
  values (target_task, auth.uid(), task_row.org_id)
  on conflict (task_id, user_id) do nothing;

  -- Mentioned first, and only once: somebody named in the comment gets the
  -- mention, not the mention plus a generic "new comment" for the same words.
  for recipient in
    select distinct u from unnest(mentions) as u where u <> auth.uid()
  loop
    insert into notifications (org_id, user_id, kind, title, body, href)
    values (task_row.org_id, recipient, 'task_mentioned',
            'You were mentioned on ' || task_row.ref,
            trim(comment_body), '/ops/tasks?task=' || target_task::text);
  end loop;

  for recipient in
    select distinct w.user_id
      from task_watchers w
     where w.task_id = target_task
       and w.user_id <> auth.uid()
       and w.user_id <> all (mentions)
    union
    select distinct a.user_id
      from task_assignees a
     where a.task_id = target_task
       and a.user_id <> auth.uid()
       and a.user_id <> all (mentions)
  loop
    insert into notifications (org_id, user_id, kind, title, body, href)
    values (task_row.org_id, recipient, 'task_comment',
            'New comment on ' || task_row.ref,
            trim(comment_body), '/ops/tasks?task=' || target_task::text);
  end loop;

  return new_id;
end;
$$;

/**
 * Edit your own words.
 *
 * Only the author, with no time limit. Admins can delete but never edit,
 * because editing someone else's comment is indistinguishable from forgery
 * once it is saved. System entries are immutable for everyone: if Claude got
 * something wrong, a human comments underneath and the record of what the
 * agent actually did stays intact.
 */
create function edit_task_comment(target_comment uuid, new_body text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  row_out task_comments%rowtype;
begin
  select * into row_out from task_comments where id = target_comment;
  if not found then raise exception 'that comment no longer exists'; end if;
  if not is_org_member(row_out.org_id) then raise exception 'forbidden'; end if;
  if row_out.kind <> 'comment' then raise exception 'a system entry cannot be edited'; end if;
  if row_out.deleted_at is not null then raise exception 'that comment was deleted'; end if;
  if row_out.author_id is distinct from auth.uid() then
    raise exception 'only the author can edit a comment';
  end if;
  if new_body is null or length(trim(new_body)) = 0 then
    raise exception 'a comment needs some words';
  end if;

  update task_comments
     set body = trim(new_body),
         edited_at = now()
   where id = target_comment;
end;
$$;

/**
 * Delete your own comment, or, as an admin, anybody's.
 *
 * A tombstone only where one is needed. If somebody replied underneath, the
 * row stays as "Comment deleted" so the reply is not left answering nothing.
 * Otherwise the row goes, because a tombstone on an unanswered comment is
 * clutter that says only that somebody changed their mind.
 */
create function delete_task_comment(target_comment uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  row_out  task_comments%rowtype;
  answered boolean;
begin
  select * into row_out from task_comments where id = target_comment;
  if not found then raise exception 'that comment no longer exists'; end if;
  if not is_org_member(row_out.org_id) then raise exception 'forbidden'; end if;
  if row_out.kind <> 'comment' then raise exception 'a system entry cannot be deleted'; end if;

  -- Owner is not a superset of admin in this schema: PLS-92 spells the pair out
  -- everywhere it means "runs the agency", and this is the same audience.
  if row_out.author_id is distinct from auth.uid()
     and not (has_org_role(row_out.org_id, 'owner')
              or has_org_role(row_out.org_id, 'admin')) then
    raise exception 'only the author or an admin can delete a comment';
  end if;

  select exists (
    select 1 from task_comments c
     where c.reply_to = target_comment and c.deleted_at is null
  ) into answered;

  if answered then
    update task_comments
       set deleted_at = now(), body = ''
     where id = target_comment;
    return 'tombstoned';
  end if;

  delete from task_comments where id = target_comment;
  return 'removed';
end;
$$;

-- 5. Completing a task ----------------------------------------------------------

/**
 * Complete or reopen, and say so in the stream.
 *
 * Two tables, so law 1 makes it a function rather than an update followed by an
 * insert that a crash can strand. Anyone in the workspace may complete any
 * task, which is why the activity feed records who: the permission is wide on
 * purpose and the audit trail is what makes that safe.
 *
 * Reopening puts the task back on its original due date and clears the name.
 */
create function complete_task(target_task uuid, done boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  task_row tasks%rowtype;
begin
  select * into task_row from tasks where id = target_task;
  if not found then raise exception 'that task no longer exists'; end if;
  if not is_org_member(task_row.org_id) then raise exception 'forbidden'; end if;

  -- Already in the requested state: nothing to write, and no second activity
  -- entry. Undo inside the grace window fires this twice by design.
  if (task_row.status = 'completed') = done then return; end if;

  update tasks
     set status  = case when done then 'completed'::task_status else 'todo'::task_status end,
         done_at = case when done then now() else null end,
         done_by = case when done then auth.uid() else null end
   where id = target_task;

  perform append_task_event(
    target_task,
    case when done then 'Completed this.' else 'Reopened this.' end,
    auth.uid()
  );
end;
$$;

-- 6. The existing task functions learn to keep the record ----------------------

-- create_task gains a company link and writes the first line of the stream.
--
-- Every overload goes, rather than one named signature. `drop function if
-- exists` with a signature that does not match exactly is a silent no-op, and
-- the new nine-argument version would then sit BESIDE the old eight-argument
-- one. PostgREST resolves an RPC by argument names, both would match a call
-- carrying target_org / task_title / task_detail, and it answers that with
-- "could not choose the best candidate function" rather than picking. The AI
-- tool in src/lib/server/ai/tools.ts calls it exactly that way, so the failure
-- would land on Claude writing a task, not here.
do $$
declare
  sig text;
begin
  for sig in
    select p.oid::regprocedure::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'create_task'
  loop
    execute 'drop function ' || sig;
  end loop;
end;
$$;

create function create_task(
  target_org uuid,
  task_title text,
  task_detail text default '',
  task_due timestamptz default now(),
  linked_candidate uuid default null,
  task_origin text default 'manual',
  task_priority_in task_priority default 'normal',
  assignee_ids uuid[] default null,
  linked_company uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_id uuid;
  link   text := '';
  who    uuid;
begin
  if not is_org_member(target_org) then raise exception 'forbidden'; end if;
  if length(trim(task_title)) = 0 then raise exception 'a task needs a title'; end if;
  if task_origin not in ('manual', 'claude') then raise exception 'unknown task origin'; end if;

  -- A link to somebody else's candidate or client would be a cross-tenant read
  -- dressed up as a foreign key, so both are checked against this org.
  if linked_candidate is not null and not exists (
    select 1 from candidates c where c.id = linked_candidate and c.org_id = target_org
  ) then
    raise exception 'that candidate is not in this workspace';
  end if;

  if linked_company is not null and not exists (
    select 1 from companies c where c.id = linked_company and c.org_id = target_org
  ) then
    raise exception 'that company is not in this workspace';
  end if;

  insert into tasks (org_id, ref, title, detail, due, origin, candidate_id,
                     company_id, priority)
  values (target_org, next_ref(target_org, 'TASK'), trim(task_title),
          coalesce(task_detail, ''), task_due, task_origin, linked_candidate,
          linked_company, task_priority_in)
  returning id into new_id;

  if assignee_ids is not null and array_length(assignee_ids, 1) >= 1 then
    perform replace_task_assignees(new_id, assignee_ids);
  end if;

  -- The opening entry names what it was linked to, because "Created this" on
  -- its own is the one line in the stream that tells you nothing.
  select coalesce(
           (select ' and linked it to ' || c.name from candidates c where c.id = linked_candidate),
           (select ' and linked it to ' || c.name from companies  c where c.id = linked_company),
           ''
         ) into link;

  -- A task Claude filed has no human behind its first entry, and the null
  -- author is what the stream reads as Claude.
  who := case when task_origin = 'claude' then null else auth.uid() end;
  perform append_task_event(new_id, 'Created this' || link || '.', who);

  return new_id;
end;
$$;

-- replace_task_assignees writes the same event it already notifies about.
create or replace function replace_task_assignees(target_task uuid, new_users uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  task_row  tasks%rowtype;
  added     uuid[];
  recipient uuid;
  names     text;
begin
  select * into task_row from tasks where id = target_task;
  if not found then raise exception 'that task no longer exists'; end if;
  if not is_org_member(task_row.org_id) then raise exception 'forbidden'; end if;

  if exists (
    select 1 from unnest(coalesce(new_users, '{}')) as u
    where not exists (
      select 1 from org_memberships m
      where m.org_id = task_row.org_id and m.user_id = u
    )
  ) then
    raise exception 'every assignee must be a member of this workspace';
  end if;

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

  foreach recipient in array added loop
    if recipient <> auth.uid() then
      insert into notifications (org_id, user_id, kind, title, body, href)
      values (task_row.org_id, recipient, 'task_assigned',
              'You were assigned ' || task_row.ref,
              task_row.title, '/ops/tasks?task=' || target_task::text);
    end if;
  end loop;

  -- One entry naming the new owners, not one per person. Only when the set
  -- actually changed: re-saving the same three people is not an event.
  if array_length(added, 1) >= 1 then
    select string_agg(m.display_name, ', ' order by m.display_name) into names
      from org_members(task_row.org_id) m
     where m.user_id = any (added);
    perform append_task_event(target_task, 'Assigned to ' || coalesce(names, 'somebody') || '.', auth.uid());
  end if;

  return coalesce(array_length(added, 1), 0);
end;
$$;

-- 7. Grants ---------------------------------------------------------------------
--
-- PLS-72 lesson: Supabase grants EXECUTE to anon EXPLICITLY, so anon is named
-- in every revoke rather than trusted to fall out of PUBLIC.

revoke execute on function append_task_event(uuid, text, uuid) from public, anon, authenticated;
grant execute on function append_task_event(uuid, text, uuid) to service_role;

revoke execute on function add_task_comment(uuid, text, uuid[], uuid) from public, anon;
grant execute on function add_task_comment(uuid, text, uuid[], uuid) to authenticated, service_role;

revoke execute on function edit_task_comment(uuid, text) from public, anon;
grant execute on function edit_task_comment(uuid, text) to authenticated, service_role;

revoke execute on function delete_task_comment(uuid) from public, anon;
grant execute on function delete_task_comment(uuid) to authenticated, service_role;

revoke execute on function complete_task(uuid, boolean) from public, anon;
grant execute on function complete_task(uuid, boolean) to authenticated, service_role;

revoke execute on function create_task(uuid, text, text, timestamptz, uuid, text, task_priority, uuid[], uuid)
  from public, anon;
grant execute on function create_task(uuid, text, text, timestamptz, uuid, text, task_priority, uuid[], uuid)
  to authenticated, service_role;

revoke execute on function replace_task_assignees(uuid, uuid[]) from public, anon;
grant execute on function replace_task_assignees(uuid, uuid[]) to authenticated, service_role;
