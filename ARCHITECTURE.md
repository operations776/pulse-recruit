# Pulse Architecture

Binding companions: `../ROADMAP.md` (what we build), `../PLAYBOOK.md` (how we build), `DESIGN.md` (what every screen is judged against). Every commit that touches schema, env, or module boundaries cites the section here it follows.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript | Server components by default, client components only for interaction |
| Styling | Tailwind CSS v4 | Tokens defined in `src/app/globals.css` per DESIGN.md, no inline hex values in components |
| Database, auth, storage | Supabase (Postgres, RLS, Auth, Storage) | New dedicated project, never shared with retainer dashboard or old Pulse Recruit |
| Multi-table writes | Postgres functions (RPC) | See Data layer rules, rule 1. No exceptions |
| Tests | Playwright (e2e) + typecheck | Runs in CI on every push from commit one |
| CI | GitHub Actions | build, typecheck, Playwright |
| Hosting | Vercel | Deploy is an explicit approval action |
| Branding | `src/config/brand.ts` | The ONLY place the product name, domain, and logo path live. Rename stays a one-file change |

## Multi-tenant model

Everything is multi-tenant from the first table. No single-tenant shortcuts, ever.

### Tables (identity layer)

- `orgs`: id, name, slug, created_at. One row per recruitment agency.
- `org_memberships`: org_id, user_id, role, unique (org_id, user_id). Roles: `owner`, `admin`, `member`. Role checks happen in Postgres (policies and RPCs), never only in the UI.
- `org_invitations`: org_id, email, role, token, status (pending, accepted, revoked), unique partial index on (org_id, lower(email)) where status = 'pending'. Invitation acceptance is an RPC: it flips the invitation row and inserts the membership in one transaction.

### Rules

1. Every tenant-scoped table carries `org_id uuid not null references orgs(id)`.
2. RLS is enabled on EVERY table in the same migration that creates it. A table without policies does not merge.
3. Policies go through two helper functions, defined once: `is_org_member(org_id)` and `has_org_role(org_id, role)`. Policies never inline membership subqueries.
4. The browser client uses the anon key only. The service-role key exists only in server-only modules (`src/lib/server/`), is never imported into a client component, and is used only where RLS genuinely cannot express the operation (webhooks, cross-org admin jobs).
5. Storage buckets are org-prefixed (`{org_id}/...`) with storage policies mirroring table RLS.

## Data layer rules (the ten laws)

These come from real incidents (our ACID audit of the retainer dashboard plus the OnboardingHub post-mortem in PLAYBOOK.md). They are not style preferences.

1. **Any write touching two or more tables is a Postgres function (RPC). No exceptions.** supabase-js has no transactions. Sequential client-side writes are a bug even when they work.
2. **Unique constraints are the race guards.** Check-then-insert is a bug; insert with conflict handling is the pattern.
3. **Claim before irreversible side effects.** Log row before the email, booking row before the calendar event, credit debit before the enrichment call.
4. **Delete DB rows before storage blobs.** An orphan blob is cheap; a dangling pointer is data loss.
5. **Never couple critical record creation to an optional feature.** Core rows are created by the core flow.
6. **Every async external effect gets a reconciliation sweep.** Stripe, calendar, enrichment providers: a scheduled job re-checks and repairs.
7. **Env vars land in the table below AND the deploy config in the same commit.** A missing env var in prod is a silent outage.
8. **Dependencies are pinned; test after bumps.**
9. **No fallback recipients, no silent partial success.** Every batch action returns honest counts.
10. **Deploy order: migrations before code that needs them.** Migrations are applied via the Supabase MCP (`apply_migration`), numbered, and mirrored in `supabase/migrations/` in the same commit.

## Module map (the 5 Pillars)

| Pillar | In-app module | Route group | Build week |
| --- | --- | --- | --- |
| 1. Offer productization | Not software. Referenced in onboarding and pricing copy only | (marketing) | 4 |
| 2. AI Ops Manager | Claude chat surface, task management, morning workflow view, MCP server at `src/app/api/[transport]/route.ts` | `(app)/ops` | 3 |
| 3. Multichannel outbound | Signals feed (open jobs, leadership changes, funding), one-click LinkedIn actions. Mass email stays external (Instantly, HeyReach via their MCPs) | `(app)/signals` | 2 |
| 4. ATS + newsletter | Candidates, companies (clients and buyers), pipeline board, candidate drawer, notes. Newsletter via Beehiiv later | `(app)/ats` | 1 |
| 5. Content | LinkedIn posting via Unipile | `(app)/content` | 4 |
| Cross-cutting | Scheduling (booking engine with custom routing questions, replaces Calendly) | `(app)/scheduling` | 3 |
| Cross-cutting | Enrichment credits (waterfall email and phone, per-plan caps, our API keys) | `(app)/enrich` + `credit_ledger` | 2 |
| Cross-cutting | Billing (Stripe, $50 founding price then $299 with credit bundle) | `(app)/settings/billing` | 4 |

Domain-logic lessons are ported from the retainer dashboard (drag stages, candidate drawer, click-to-copy, insert-before-calendar, claim-before-send, per-user Google connection). Its code and styling are not.

## Directory map

```
app/
  ARCHITECTURE.md        this file
  DESIGN.md              the UI contract
  CLAUDE.md              lean operating manual
  TICKETS.md             work queue, ticket IDs in every commit
  supabase/migrations/   numbered SQL, mirror of what MCP applied
  e2e/                   Playwright specs
  src/
    config/brand.ts      the only branding location
    app/                 routes: (app) product, (marketing) public, api/
    components/          per DESIGN.md inventory, ui/ primitives first
    lib/                 client-safe helpers
    lib/server/          server-only (service role, external APIs)
    modules/             domain logic per pillar (ats/, signals/, ops/, ...)
```

## Speed budget (speed is a feature)

"If you open Stardex or any ATS, it has to be fast."

- Server-rendered page response under 300 ms at the p75; measured in CI with a Playwright timing spec and in prod with Vercel analytics.
- Route transitions feel instant: prefetch on hover, optimistic UI on board drags, no full-page spinners inside the app shell.
- Lists virtualize past 200 rows. The pipeline board renders 500 candidates without jank.
- Every PR that regresses the timing spec fails CI.

## Production Environment Variables

Rule 7 above: every new env var is added to this table AND the Vercel project config in the same commit that introduces the code reading it. No exceptions, no "will add after deploy".

| Name | Purpose | Client-exposed | Added in |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL | Yes | PLS-6 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key, RLS-constrained | Yes | PLS-6 |

Supabase project: `pulse`, ref `zlnctqlabowdaahnvheo`, region eu-west-2. Dedicated to this product. The retainer dashboard (`hjwbguuqrwtmpkmgaxhc`) and the rejected Pulse Recruit project (`oyilzgfpaiusvqvmepny`) are never touched by this codebase.

The service-role key is deliberately absent until a server-only module needs it (PLS-7). It never appears in a `NEXT_PUBLIC_` var and never gets imported into a client component.
