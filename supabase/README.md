# Database

Project: `pulse`, ref `zlnctqlabowdaahnvheo`, region eu-west-2.

Migrations are applied through the Supabase MCP (`apply_migration`) and mirrored
into `migrations/` in the same commit, per ARCHITECTURE.md law 10. The applied
list is the source of truth; if this folder and the database disagree, the
database is right and this folder is stale.

Applied so far:

| Version | Name |
| --- | --- |
| 20260802162232 | tenancy_orgs_memberships_invitations |
| 20260802162300 | talent_ats_tables |
| 20260802162332 | module_tables_market_ops_outbound_content |
| 20260802162412 | rpcs_multi_table_writes |
| 20260802162448 | revoke_rpc_execute_from_anon |

## The rules these encode

1. Every tenant table carries `org_id` and has RLS enabled in the same
   migration that creates it. Policies go through `is_org_member` and
   `has_org_role`, never an inlined subquery.
2. Unique constraints are the race guards: `candidates (job_id, lower(email))`,
   `companies (org_id, lower(domain))`, `org_invitations` pending partial index,
   and `signals (dream_company_id, kind, headline)` so a re-run of the scanner
   cannot duplicate a detection.
3. Every write touching two or more tables is an RPC. There are nine, and the
   app is not permitted to reproduce any of them client side.
4. `is_org_member`, `has_org_role` and `next_ref` have EXECUTE revoked from both
   client roles. They are called by policies in the definer context only.

## Demo login

`daniyal@nortech.io` / `pulse-demo-2026`
