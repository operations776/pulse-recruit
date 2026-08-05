-- PLS-92: visible BD Strategist memory and an honest, tenant-local Exa cache.
--
-- Both tables are exposed through Supabase's Data API, so they have explicit
-- authenticated grants and RLS. Memory is strategy context, never research
-- evidence. Cache rows stay inside the organisation that paid for the search.

create table bd_agent_memories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  scope text not null,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  source text not null default 'manual',
  answer_id uuid references chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bd_agent_memories_scope_owner check (
    (scope = 'agency' and user_id is null)
    or (scope = 'personal' and user_id is not null)
  ),
  constraint bd_agent_memories_kind check (
    kind in (
      'positioning', 'ideal_client', 'buyer', 'territory',
      'offer', 'qualification', 'preference', 'feedback'
    )
  ),
  constraint bd_agent_memories_source check (source in ('manual', 'feedback')),
  constraint bd_agent_memories_title_length check (char_length(trim(title)) between 1 and 80),
  constraint bd_agent_memories_body_length check (char_length(trim(body)) between 1 and 2000)
);

create index bd_agent_memories_org_scope_idx
  on bd_agent_memories (org_id, scope, updated_at desc);
create index bd_agent_memories_personal_idx
  on bd_agent_memories (org_id, user_id, updated_at desc)
  where scope = 'personal';
create unique index bd_agent_memories_feedback_once_idx
  on bd_agent_memories (org_id, user_id, answer_id)
  where source = 'feedback' and answer_id is not null;

create trigger bd_agent_memories_touch
  before update on bd_agent_memories
  for each row execute function touch_updated_at();

alter table bd_agent_memories enable row level security;
revoke all on table bd_agent_memories from anon;
grant select, insert, update, delete on table bd_agent_memories to authenticated;

create policy bd_agent_memories_select on bd_agent_memories
  for select to authenticated
  using (
    is_org_member(org_id)
    and (scope = 'agency' or user_id = (select auth.uid()))
  );

create policy bd_agent_memories_personal_insert on bd_agent_memories
  for insert to authenticated
  with check (
    scope = 'personal'
    and user_id = (select auth.uid())
    and is_org_member(org_id)
  );

create policy bd_agent_memories_personal_update on bd_agent_memories
  for update to authenticated
  using (
    scope = 'personal'
    and user_id = (select auth.uid())
    and is_org_member(org_id)
  )
  with check (
    scope = 'personal'
    and user_id = (select auth.uid())
    and is_org_member(org_id)
  );

create policy bd_agent_memories_personal_delete on bd_agent_memories
  for delete to authenticated
  using (
    scope = 'personal'
    and user_id = (select auth.uid())
    and is_org_member(org_id)
  );

create policy bd_agent_memories_agency_insert on bd_agent_memories
  for insert to authenticated
  with check (
    scope = 'agency'
    and user_id is null
    and (has_org_role(org_id, 'owner') or has_org_role(org_id, 'admin'))
  );

create policy bd_agent_memories_agency_update on bd_agent_memories
  for update to authenticated
  using (
    scope = 'agency'
    and (has_org_role(org_id, 'owner') or has_org_role(org_id, 'admin'))
  )
  with check (
    scope = 'agency'
    and user_id is null
    and (has_org_role(org_id, 'owner') or has_org_role(org_id, 'admin'))
  );

create policy bd_agent_memories_agency_delete on bd_agent_memories
  for delete to authenticated
  using (
    scope = 'agency'
    and (has_org_role(org_id, 'owner') or has_org_role(org_id, 'admin'))
  );

create table bd_research_cache (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  cache_key text not null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint bd_research_cache_kind check (kind in ('search', 'page')),
  constraint bd_research_cache_expiry check (expires_at > created_at),
  constraint bd_research_cache_org_key_unique unique (org_id, cache_key)
);

create index bd_research_cache_expiry_idx
  on bd_research_cache (org_id, expires_at);

alter table bd_research_cache enable row level security;
revoke all on table bd_research_cache from anon;
grant select, insert, update on table bd_research_cache to authenticated;

create policy bd_research_cache_member_access on bd_research_cache
  for select to authenticated
  using (is_org_member(org_id));

create policy bd_research_cache_member_insert on bd_research_cache
  for insert to authenticated
  with check (is_org_member(org_id));

create policy bd_research_cache_member_update on bd_research_cache
  for update to authenticated
  using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- A bounded in-org cleanup avoids a cron and keeps a caller from touching
-- another tenant's cache. It is intentionally security definer because the
-- client has no delete grant on the cache table.
create or replace function sweep_bd_research_cache(target_org uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  swept integer;
begin
  if not is_org_member(target_org) then raise exception 'forbidden'; end if;

  delete from bd_research_cache
   where org_id = target_org
     and expires_at <= now();

  get diagnostics swept = row_count;
  return swept;
end;
$$;

revoke execute on function sweep_bd_research_cache(uuid) from public, anon;
grant execute on function sweep_bd_research_cache(uuid) to authenticated;
