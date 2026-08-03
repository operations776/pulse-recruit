-- PLS-62. The calendar places a post on a day, and a day only exists inside a
-- timezone. Viewer-local would make the server and the client disagree during
-- hydration whenever they sit in different zones, which is every session
-- Daniyal runs from Pakistan against a London agency. One zone per org means
-- both sides format against the same value and always agree.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.
alter table orgs
  add column timezone text not null default 'Europe/London';

-- A check constraint cannot hold a subquery, so the guard is a trigger. It
-- rejects a zone Postgres does not know, which keeps a bad value from reaching
-- Intl and throwing on every render of the planner.
create or replace function assert_known_timezone()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'unknown timezone: %', new.timezone;
  end if;
  return new;
end;
$$;

create trigger orgs_timezone_known
  before insert or update of timezone on orgs
  for each row execute function assert_known_timezone();

revoke all on function assert_known_timezone() from public;
