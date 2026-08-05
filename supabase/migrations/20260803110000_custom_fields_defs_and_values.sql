-- PLS-77. Admin-defined custom columns on candidates, without migrations.
--
-- The defs live in a table, the values live in a jsonb column, and adding a
-- field is a row insert rather than DDL. The values column exists on BOTH
-- candidates and people: the board still reads candidates while the person and
-- candidacy cutover is in flight, and a column on both sides means the defs
-- and the data survive that migration instead of being keyed to the loser.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

create type custom_field_type as enum ('text', 'long_text', 'select', 'url');

create table person_field_defs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  key        text not null,
  label      text not null,
  field_type custom_field_type not null default 'text',
  options    jsonb not null default '[]',
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

-- The key is how values point at defs, so it cannot repeat inside an org.
create unique index person_field_defs_key_uniq on person_field_defs (org_id, key);

alter table person_field_defs enable row level security;

create policy field_defs_select on person_field_defs
  for select using (is_org_member(org_id));
create policy field_defs_admin on person_field_defs
  for all using (has_org_role(org_id, 'admin'))
  with check (has_org_role(org_id, 'admin'));

alter table candidates add column custom_fields jsonb not null default '{}';
alter table people     add column custom_fields jsonb not null default '{}';

-- Patching one key client-side is read-modify-write, and two people editing
-- two different fields on the same person would eat each other's writes. The
-- merge happens in SQL, atomically, one key at a time.
create function set_candidate_field(
  target_candidate uuid,
  field_key text,
  field_value text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  owner_org uuid;
begin
  select org_id into owner_org from candidates where id = target_candidate;
  if owner_org is null then raise exception 'that candidate no longer exists'; end if;
  if not is_org_member(owner_org) then raise exception 'forbidden'; end if;

  -- Only defined fields can hold values, or deleted defs leave orphan data
  -- invisible to every screen.
  if not exists (
    select 1 from person_field_defs
    where org_id = owner_org and key = field_key
  ) then
    raise exception 'no such field: %', field_key;
  end if;

  update candidates
     set custom_fields = case
       when field_value is null or field_value = ''
       then custom_fields - field_key
       else jsonb_set(custom_fields, array[field_key], to_jsonb(field_value))
     end
   where id = target_candidate;
end;
$$;

revoke execute on function set_candidate_field(uuid, text, text) from public, anon;
grant execute on function set_candidate_field(uuid, text, text) to authenticated, service_role;
