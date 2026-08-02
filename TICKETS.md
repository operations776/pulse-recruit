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

## UI-first status, 2026-08-02

Daniyal directed a UI-first build: every screen and interaction first, backend
second. The whole product UI now runs against the in-memory store in
`src/lib/store.tsx`, which is deliberately shaped like the Supabase schema, with
each multi-collection action written as a single reducer case so it maps one to
one onto a Postgres function.

Built and passing: app shell, pipeline board (drag, multi select, bulk move,
archive, delete), candidate drawer (profile, click to copy, notes, activity),
add candidate with duplicate guard, candidates table with composing filters,
companies with add dialog, signals feed, reports derived from the store,
settings (general, team, billing), sign in, sign up, marketing page at the root.

Still to do, and now the critical path: PLS-7 through PLS-15, the real Supabase
layer, auth, RLS, and the migrations behind these screens. The UI tickets below
stay open until they are wired to the database, because a screen backed by mock
state is not a shipped screen.

## Week 1: ATS core

### Foundation

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-7 | Supabase clients: browser (anon), server (cookies), and a server-only admin module. Env vars into ARCHITECTURE.md table in the same commit | PLS-6 | todo |
| PLS-8 | Migration: `orgs`, `org_memberships`, `org_invitations`, plus `is_org_member` and `has_org_role` helpers. RLS enabled and policies in the same migration | PLS-7 | todo |
| PLS-9 | Auth: sign in, sign up, sign out, session middleware. First sign-up creates an org and an owner membership in ONE RPC (rule 1) | PLS-8 | todo |
| PLS-10 | App shell: sidebar 240px, topbar 48px, page header, empty states. Judged against DESIGN.md | PLS-9 | todo |

### Data model

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-11 | Migration: `companies` (clients and buyers, `org_id`, type, domain unique per org). RLS in the same migration | PLS-8 | todo |
| PLS-12 | Migration: `candidates` (`org_id`, name, email, phone, role, salary, linkedin_url, owner, last_activity_at). Unique index on (org_id, lower(email)) as the race guard, not a check-then-insert | PLS-8 | todo |
| PLS-13 | Migration: `pipelines`, `stages`, `candidate_stage_events`. Stage moves write the candidate row and the event row, so the move is an RPC (rule 1) | PLS-12 | todo |
| PLS-14 | Migration: `notes` polymorphic on candidate and company, with `org_id` and RLS | PLS-12 | todo |
| PLS-15 | Seed script: one demo org, 2 users, 12 companies, 60 candidates spread across stages and freshness bands. Needed for demo quality and for Playwright | PLS-13 | todo |

### UI primitives

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-16 | Primitives: Button, IconButton, Input, Select, Checkbox, Textarea, Badge, Avatar, Kbd | PLS-10 | todo |
| PLS-17 | Primitives: PulseDot with live, warm, and cold states plus reduced-motion fallback; CopyField with the 900ms inline confirmation | PLS-16 | todo |
| PLS-18 | Layers: Dialog, Drawer (right, 480px), DropdownMenu, Tooltip, Toast. One elevation style, Esc closes topmost | PLS-16 | todo |
| PLS-19 | DataTable: 40px rows, sticky header, micro-label columns, virtualized past 200 rows | PLS-16 | todo |

### Screens

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-20 | Candidates list: DataTable, search, filters, click-to-copy on email, phone, and LinkedIn | PLS-19, PLS-12 | todo |
| PLS-21 | Companies list: clients and buyers split, candidate counts | PLS-19, PLS-11 | todo |
| PLS-22 | Pipeline board: columns, cards, WIP counts, pulse dots. Renders 500 candidates without jank | PLS-17, PLS-13 | todo |
| PLS-23 | Drag to move stage: optimistic UI, RPC-backed, snaps back with a toast on failure. Never a sequential two-table write | PLS-22 | todo |
| PLS-24 | Candidate drawer: profile, contact with click-to-copy, stage history, notes. Adding a note must not remount the drawer (no revalidatePath in an open layer) | PLS-18, PLS-14 | todo |
| PLS-25 | Add candidate and add company forms with duplicate handling via the unique index | PLS-20, PLS-21 | todo |

### Quality gates

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-26 | Playwright: sign in, create candidate, move stage, open drawer, add note | PLS-25 | todo |
| PLS-27 | Speed pass: prefetch on hover, virtualization check, every ATS route inside the 300ms budget in CI | PLS-22 | todo |
| PLS-28 | RLS proof test: user in org A cannot read, update, or delete any row of org B, asserted per table | PLS-13 | todo |
| PLS-29 | Dev-access doc: Supabase access, GitHub, local setup, the Claude workflow. Reyhan asked for this explicitly | PLS-15 | todo |

## Later weeks (placeholders, not yet specced)

Week 2: enrichment credits end to end (waterfall email and phone, per-plan caps), signals feed v1 (open jobs).
Week 3: Claude in Pulse (chat, tasks, morning workflow), scheduling port with routing questions.
Week 4: Unipile LinkedIn posting, billing on at the $50 founding price, onboard 8 to 10 pilot members.
