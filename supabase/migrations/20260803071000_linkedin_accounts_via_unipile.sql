-- PLS-68. Pillar 5 phase B: the LinkedIn profiles an org has connected.
--
-- Unipile is not a per-org API key like Apollo or Exa. RecruiterGTM holds one
-- Unipile tenant, and each recruiter connects their own LinkedIn through
-- Unipile's hosted wizard, which makes their profile an account under that
-- tenant. So what an org owns is a set of account ids, not a credential, and
-- the integrations table is the wrong home for it.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

create type linkedin_account_status as enum (
  'connected',    -- usable
  'credentials',  -- Unipile says the session expired, needs a reconnect
  'disconnected'  -- removed by us, kept for the audit trail until purged
);

create table linkedin_accounts (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  -- Unipile's id for the connected profile. Globally unique on their side, so
  -- unique here too: the same profile cannot belong to two orgs at once.
  unipile_account_id text not null,
  display_name       text not null default '',
  status             linkedin_account_status not null default 'connected',
  connected_by       uuid references auth.users(id) on delete set null,
  last_error         text not null default '',
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Law 2: the race guard is the constraint, not a read followed by an insert.
-- The webhook can fire more than once for one connection, and Unipile's own
-- docs describe retries, so the second delivery must collide rather than
-- create a duplicate.
create unique index linkedin_accounts_unipile_uniq
    on linkedin_accounts (unipile_account_id);
create index linkedin_accounts_org_idx on linkedin_accounts (org_id);

create trigger linkedin_accounts_touch
  before update on linkedin_accounts
  for each row execute function touch_updated_at();

alter table linkedin_accounts enable row level security;

-- Everyone in the org can see which profiles are connected, because the
-- planner has to say who a post would go out as. Removing one is an admin
-- action, or your own account.
create policy linkedin_accounts_select on linkedin_accounts
  for select using (is_org_member(org_id));

create policy linkedin_accounts_delete on linkedin_accounts
  for delete using (
    has_org_role(org_id, 'admin') or connected_by = auth.uid()
  );

-- No insert or update policy on purpose. Rows arrive from Unipile's webhook,
-- which has no user session, so that write goes through the server-only admin
-- client in src/lib/server/. A browser cannot claim an account id it was never
-- given, which is the whole point.
