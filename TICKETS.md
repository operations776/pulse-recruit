# Pulse tickets

One ticket, one branch, small commits, ticket ID in every commit message. Update status in the same commit that finishes the ticket. Seeded from ROADMAP.md Week 1: ATS core at demo quality.

Status: `todo` · `doing` · `review` (needs design-review APPROVED) · `done`

## Day zero: foundation

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-1 | Scaffold Next.js 16 + TypeScript + Tailwind v4, fresh git repo | done |
| PLS-2 | ARCHITECTURE.md: tenancy, data-layer laws, module map, env table | done |
| PLS-3 | DESIGN.md: tokens, type scale, spacing, component inventory, interaction rules | done |
| PLS-4 | Design tokens in globals.css, brand config, design sheet at /design | done |
| PLS-5 | design-review skill with explicit APPROVED verdict | done |
| PLS-6 | CLAUDE.md, CI (build, typecheck, lint, Playwright), speed budget spec, Supabase project | done |

## Status, 2026-08-02

Daniyal directed a UI-first build: every screen and interaction first, backend
second. That phase is over. PLS-33 through PLS-37 landed the real Postgres
schema, RLS, the RPCs and auth, and deleted the in-memory store, so every screen
below now reads and writes Supabase. The five module shells (PLS-30 to PLS-32)
cover all five pillars.

Built and on Postgres: app shell, pipeline board (drag, multi select, bulk move,
archive, delete), candidate drawer (profile, click to copy, notes, activity),
add candidate with duplicate guard, candidates table with composing filters,
companies with add dialog, signals feed, sequences, mailboxes, reports, market
and ops chat surfaces, tasks, content board, integrations with vault-backed
keys, settings, sign in, sign up, marketing page at the root.

## Week 1: ATS core

### Foundation

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-7 | Supabase clients: browser (anon), server (cookies), and a server-only admin module. Env vars into ARCHITECTURE.md table in the same commit | PLS-6 | done |
| PLS-8 | Migration: `orgs`, `org_memberships`, `org_invitations`, plus `is_org_member` and `has_org_role` helpers. RLS enabled and policies in the same migration | PLS-7 | done |
| PLS-9 | Auth: sign in, sign up, sign out, session middleware. First sign-up creates an org and an owner membership in ONE RPC (rule 1) | PLS-8 | done |
| PLS-10 | App shell: sidebar 240px, topbar 48px, page header, empty states. Judged against DESIGN.md | PLS-9 | done |

### Data model

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-11 | Migration: `companies` (clients and buyers, `org_id`, type, domain unique per org). RLS in the same migration | PLS-8 | done |
| PLS-12 | Migration: `candidates` (`org_id`, name, email, phone, role, salary, linkedin_url, owner, last_activity_at). Unique index on (org_id, lower(email)) as the race guard, not a check-then-insert | PLS-8 | done |
| PLS-13 | Migration: `pipelines`, `stages`, `candidate_stage_events`. Stage moves write the candidate row and the event row, so the move is an RPC (rule 1) | PLS-12 | done |
| PLS-14 | Migration: `notes` polymorphic on candidate and company, with `org_id` and RLS | PLS-12 | done |
| PLS-15 | Seed script: one demo org, 2 users, 12 companies, 60 candidates spread across stages and freshness bands. Needed for demo quality and for Playwright | PLS-13 | done |

### UI primitives

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-16 | Primitives: Button, IconButton, Input, Select, Checkbox, Textarea, Badge, Avatar, Kbd | PLS-10 | done |
| PLS-17 | Primitives: PulseDot with live, warm, and cold states plus reduced-motion fallback; CopyField with the 900ms inline confirmation | PLS-16 | done |
| PLS-18 | Layers: Dialog, Drawer (right, 480px), DropdownMenu, Tooltip, Toast. One elevation style, Esc closes topmost | PLS-16 | done |
| PLS-19 | DataTable: 40px rows, sticky header, micro-label columns, virtualized past 200 rows | PLS-16 | done |

### Screens

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-20 | Candidates list: DataTable, search, filters, click-to-copy on email, phone, and LinkedIn | PLS-19, PLS-12 | done |
| PLS-21 | Companies list: clients and buyers split, candidate counts | PLS-19, PLS-11 | done |
| PLS-22 | Pipeline board: columns, cards, WIP counts, pulse dots. Renders 500 candidates without jank | PLS-17, PLS-13 | done |
| PLS-23 | Drag to move stage: optimistic UI, RPC-backed, snaps back with a toast on failure. Never a sequential two-table write | PLS-22 | done |
| PLS-24 | Candidate drawer: profile, contact with click-to-copy, stage history, notes. Adding a note must not remount the drawer (no revalidatePath in an open layer) | PLS-18, PLS-14 | done |
| PLS-25 | Add candidate and add company forms with duplicate handling via the unique index | PLS-20, PLS-21 | done |

### Quality gates

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-26 | Playwright: sign in, create candidate, move stage, open drawer, add note | PLS-25 | todo |
| PLS-27 | Speed pass: prefetch on hover, virtualization check, every ATS route inside the 300ms budget in CI | PLS-22 | done |
| PLS-28 | RLS proof test: user in org A cannot read, update, or delete any row of org B, asserted per table | PLS-13 | todo |
| PLS-29 | Dev-access doc: Supabase access, GitHub, local setup, the Claude workflow. Reyhan asked for this explicitly | PLS-15 | todo |

Note on PLS-26 and PLS-28: `e2e/smoke.spec.ts` proves navigation and that every
module renders real seeded data, but it does not yet exercise the ATS write path
or assert tenant isolation per table. Both stay open until they do.

## Modules and data layer

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-30 | Module shell for all five pillars, roles panel, DESIGN.md section 8 wayfinding | done |
| PLS-31 | OUTBOUND and OPS modules | done |
| PLS-32 | CONTENT module: skills catalogue and the status board | done |
| PLS-33 | Real Postgres schema, RLS, RPCs and a seeded org | done |
| PLS-34 | Integrations with vault-backed keys, data layer and server actions | done |
| PLS-35 | `create_task` and `create_post` RPCs, fix the anon revoke | done |
| PLS-36 | Restore policy predicate grants, prove tenant isolation | done |
| PLS-37 | Whole app on Postgres, mock store deleted, auth fixed | done |

## Pillar 5, phase A: the content calendar

Ported from the retainer dashboard's content calendar, which is the proven
interaction: a month grid with an ideas backlog underneath, and you drag an idea
onto a day to schedule it. Domain logic only. None of its code or styling comes
across, per CLAUDE.md.

Numbered from 60 on purpose. The AI engine session was running in parallel and
spent PLS-38 through PLS-46 on its own work, so this block moved out of its way
rather than leaving two meanings for one ID.

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-60 | Mirror the already-applied migrations into `supabase/migrations/`. Law 10 says the folder is the mirror and it started out empty | PLS-37 | partly: everything from PLS-61 on is mirrored, the nine from before PLS-37 are not |
| PLS-61 | Migration: `content_assets`, `content_posts` gains `published_at` and `updated_at`, org-prefixed `content-media` storage bucket with policies, `delete_post` RPC returning storage paths so DB rows die before blobs (law 4) | PLS-37 | done |
| PLS-62 | Calendar month grid: Mon to Sun, today marked, per-day add, posts on their day. Board and Calendar are a segmented toggle so nothing moves between screens | PLS-61 | done |
| PLS-63 | Ideas backlog under the grid, drag an idea onto a day to schedule it at 09:00, plus a visible non-drag date control because drag alone fails the audience | PLS-62 | done |
| PLS-64 | Composer drawer: the skill frame beside the body, hook, schedule, copy to clipboard, mark published, delete | PLS-62 | done |
| PLS-65 | Media: upload to the org-prefixed bucket, signed URLs, inline preview, remove an asset (row then blob) | PLS-61, PLS-64 | done |
| PLS-66 | Playwright: add an idea, schedule it, open it, copy it, delete it | PLS-64 | done |

An org now carries a `timezone`, because a day only exists inside one and a
calendar built on the machine clock disagrees with itself between the server
render and the browser. Both sides format against that one value.

## Pillar 5, phase B: Unipile LinkedIn connection

Centralised model. RecruiterGTM holds one Unipile tenant, and each recruiter
connects their own LinkedIn through Unipile's hosted auth wizard. Their profile
becomes an account under our tenant. This is why Unipile is not a per-org API
key like Apollo or Exa.

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-67 | Unipile moves out of the per-org `integrations` table and becomes platform env vars: `UNIPILE_API_KEY`, `UNIPILE_DSN`, `UNIPILE_WEBHOOK_SECRET`. ARCHITECTURE.md table and DEPLOY.md updated in the same commit (law 7) | PLS-37 | done |
| PLS-68 | Migration: `linkedin_accounts` (`org_id`, `unipile_account_id` unique, name, status, connected_by, last_error). RLS in the same migration, insert with conflict handling, never check-then-insert (law 2) | PLS-67 | done |
| PLS-69 | Settings, Channels screen: connect, connected state, reconnect when credentials expire, disconnect. Says plainly when Unipile is not configured rather than offering a button that cannot work | PLS-68 | done |
| PLS-70 | Webhook `POST /api/unipile/accounts`: shared-secret verified in constant time, handles `CREATION_SUCCESS`, `RECONNECTED` and `CREDENTIALS` | PLS-68 | done |
| PLS-71 | Playwright: the Channels screen renders, an unverified webhook call is rejected, and the publishable key cannot write the table | PLS-69, PLS-70 | done |

Two decisions in here are worth remembering, both written up in ARCHITECTURE.md.

The `link_linkedin_account` RPC in the original PLS-68 wording was dropped. An
RPC has to be callable, the webhook has no session so it would call as `anon`,
and granting that RPC to `anon` would let anyone on the internet attach an
account id to any org. The write goes through the service-role client instead,
which now exists for exactly this one caller, and `linkedin_accounts` has no
insert or update policy at all.

Unipile is a third kind of credential. Not a platform key, not a per-org Vault
key, but an account broker: the key is RecruiterGTM's and the accounts are per
org. That is why LinkedIn is not on the API keys screen.

## Found on the production deploy

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-72 | The anon revoke never worked in either session's migrations. Supabase's default privileges grant EXECUTE to `anon` explicitly, so `revoke ... from public` removed only the PUBLIC entry and left it. The advisor reported ten functions callable over `/rest/v1/rpc` without a session; `roll_credit_week` was the one with no membership check of its own | done |

Down to three anon-callable functions, all deliberate: `is_org_member` and
`has_org_role` are policy predicates, and `public_shortlist` is the
token-addressed page that is meant to work without a session.

Still open, and Daniyal's call because it is an Auth setting rather than
schema: leaked password protection is disabled on the Supabase project.

## Later weeks (placeholders, not yet specced)

Week 2: enrichment credits end to end (waterfall email and phone, per-plan caps), signals feed v1 (open jobs).
Week 3: Claude in Pulse (chat, tasks, morning workflow), scheduling port with routing questions.
Week 4 (phase C): actual publishing through Unipile. `POST /api/v1/posts` publishes immediately and has no scheduling of its own, so every scheduled post is our scheduler holding it: a `claim_due_posts` RPC using `FOR UPDATE SKIP LOCKED` that flips state before the call (law 3), pg_cron every minute, a reconciliation sweep (law 6), and billing on at the $50 founding price.
