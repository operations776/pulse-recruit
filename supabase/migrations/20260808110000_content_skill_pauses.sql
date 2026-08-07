-- PLS-188: the Skills screen's pause toggle. A paused skill stays on the
-- screen with its history but is not offered when composing a new post.
-- Keyed by the shape's stable key so the five built-ins, which have no row
-- in content_shapes, can be paused too.
create table content_skill_pauses (
  org_id uuid not null references orgs(id) on delete cascade,
  skill_key text not null,
  paused_at timestamptz not null default now(),
  paused_by uuid references auth.users(id) on delete set null,
  primary key (org_id, skill_key)
);

alter table content_skill_pauses enable row level security;

grant select, insert, delete on content_skill_pauses to authenticated;

create policy content_skill_pauses_select on content_skill_pauses
  for select using (is_org_member(org_id));
create policy content_skill_pauses_insert on content_skill_pauses
  for insert with check (is_org_member(org_id));
create policy content_skill_pauses_delete on content_skill_pauses
  for delete using (is_org_member(org_id));
