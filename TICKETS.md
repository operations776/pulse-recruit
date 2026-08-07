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

## Module specs port (outputs/module-specs-talent-content-tasks.md)

The retainer dashboard's three module specs, rebuilt on Pulse's schema. What
the spec calls candidates/candidacies already landed as people/candidacies in
PLS-45, so the port is the parts Pulse did not have yet.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-73 | Tasks: status and priority enums, task_assignees join table, replace_task_assignees RPC with in-transaction notifications, org_members directory, Mine and Everyone views, always-mounted add row, inline dropdowns, sortable columns, due colouring, a truthful bell | done |
| PLS-74 | Content: author filter (Mine, Everyone, per teammate), quick-add row on the backlog, Ideas and All-posts tabs with due and A-Z sort | done |
| PLS-75 | Talent: pools as stageless rosters, one-way job-into-pool filing, Add-to-job bulk action | blocked: the board still renders the old candidates table while the person and candidacy cutover is in flight in the AI session's branch. A roster UI built on a table scheduled for deletion is orphaned work. Build pools on candidacies once the cutover lands |
| PLS-76 | Talent: CSV export, whole job or the selection, Excel formula defusal and a UTF-8 BOM | done |
| PLS-77 | Talent: custom fields, defs table plus jsonb values on both candidates and people, atomic per-key merge in SQL, inline editors in the drawer, admin manage dialog | done |
| PLS-78 | Talent: public application link per job. Slug as the capability, anon-granted RPC as the boundary, idempotent repeat applications, revocation kills every shared copy | done |

Flagged out of scope until their infrastructure exists: stage emails (no send
transport wired), interview scheduling and add-to-Google-Calendar (no per-user
Google OAuth in Pulse).

## Content redesign (persona, generation, one screen)

Daniyal's read of the shipped planner: Skills is a second room for reference
material, the post opens in a drawer too narrow for long-form copy, New post
hands back an empty box, and skills are fixed with nothing capturing how a
given recruiter sounds.

Decisions taken before planning: persona and shape are two things (one persona
per user, many shapes); no LinkedIn scraping, because Exa reads cache-first
public pages truncated to 2400 chars and would quietly build a weak persona;
generation is credit-metered as a third `content` surface, per AI.md's rule
that nothing calls a paid provider without reserving first; voice input via the
Web Speech API with the mic hidden where unsupported; the persona learns from
edits and shows what it learned.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-80 | One screen: Skills becomes a popup and leaves the rail, the post moves from a 480px drawer to a centred 900px dialog with the body left and schedule plus media right. Dialog gains a size scale, a focus trap, and the toast-shift that used to be drawer-only | done |
| PLS-81 | Migration: `content_personas`, `persona_lessons`, `content_shapes`, the `content` enum value in its own migration because Postgres will not let one be added and used in a single transaction, plus its `SURFACE_LIMITS` entry | done |
| PLS-82 | The persona intake: headline and About pasted, three proud posts, three flops, then a review step showing the distilled voice back in plain sentences before it saves | done |
| PLS-83 | Generation: describe an idea (typed or spoken), pick a shape, stream a draft in the user's voice, set a date, add it. New `/api/content/generate` modelled on `/api/ask`, reusing begin_ask and finish_ask unchanged | done |
| PLS-84 | Navigation was 1.4 to 3.6 seconds. `requireSession` did two Supabase round trips and every data function called it, so a page resolved the same identity up to six times in sequence. React `cache` dedupes per request; the middleware matcher stopped catching RSC payload requests; the pipeline index stopped fetching a whole workspace to read one id; the bell streams behind Suspense; the rail prefetches | done |

`ChatSurface` stayed `market | ops` and a separate `CreditSurface` adds
`content`. Widening the first would have handed `runAsk`, the tool dispatcher
and the run log a case they can never serve, and the compiler said so
immediately.

Flagged: the persona can only learn from what happens inside Pulse. Once
Unipile posting is live, published posts become a better training signal than
pasted samples and the intake can shrink.

## Dense planner, skill builder, and posts that actually go out

Daniyal, on the shipped product: "I hate empty space, every part of the app
should have a purpose." Measured, the complaint was exact. The 208px rail was
about 70% blank, held open by a marketing blurb pinned to the floor with
`mt-auto`; the header spent 180px on an eyebrow that repeated the rail; the
backlog spent 172px to say "Nothing waiting".

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-85 | The planner rebuilt. Three shells collapse into one continuous sheet on shared 1px rules, the header goes from ~180px to a 48px band, the shell stops scrolling and the body scrolls instead, the four status counts become a dense stat strip that answers the question a calendar exists to answer, and the rail's static blurb becomes live data: next posts, overdue, lessons waiting | done |
| PLS-86 | Describe a skill and Pulse builds it. `buildShape` returns name, blurb and a prompt in the same three-beat frame the five built-ins use, metered on the content surface like every other generation. Generated then edited before saving, per Daniyal's call: the fields land filled, not locked | done |
| PLS-87 | Publishing schema. `publishing` and `failed` enum values in their own migration, then the columns, `claim_due_posts` with `FOR UPDATE SKIP LOCKED`, `finish_publish`, and `sweep_stuck_publishes`. Grandfather line: everything already dated is `auto_publish = false`, so switching the publisher on cannot fire a post scheduled during the build | done |
| PLS-88 | The publisher. `publishPost` on the existing `call<T>`, and `/api/cron/publish` claiming a batch, publishing each, settling each, returning honest counts. Second sanctioned caller of the service-role client, so `supabase-admin.ts`, `ARCHITECTURE.md` and `DEPLOY.md` all changed in this commit. `CRON_SECRET` is new and lands in the env table with it | done |
| PLS-89 | Connect a LinkedIn profile without leaving the app: hosted wizard, email and password, or the `li_at` cookie, with the 2FA checkpoint answered in place. Unipile holds a checkpoint open for five minutes, so the code screen says so rather than letting someone find out by timing out | done |

The publishing chain was verified against the live database inside a rolled
back transaction before any of it shipped: the claim flips a row to
`publishing` and stamps it before anything reaches LinkedIn, a second worker
claims nothing, a failure records the real reason, three attempts stops the
retry, and the sweep fails a stuck row rather than resending a post that may
already be up.

`publishing` and `failed` are the publisher's, not a person's. `PostStatus`
gained both, `MANUAL_STATUSES` is what a human may choose, and the two actions
that move a post carry `neq status publishing` as a race guard so an edit
cannot land on a post that is already on its way out.

**Not enabled yet, deliberately.** pg_cron is scheduled by hand, last, after a
real post has been watched going out. The steps are in DEPLOY.md. A scheduler
pointed at unproven code publishes mistakes once a minute.

Flagged, not built: media on published posts needs `multipart/form-data` and
`call<T>` is JSON only, so a post with images attached publishes its text. And
there is no per-post opt-out: everything scheduled sends, so the only brake is
unscheduling.

## Found by using it

Daniyal, on the deployed build: one control that alternates, opaque layers,
the edit should teach the persona, and "very bland, just orange, white, gray,
I need more color, more animations, more smoothness."

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-90 | Schedule and Unschedule become one alternating control, with Move kept as the third state because unscheduling would throw away a date just typed. Dialogs, drawers and toasts go fully opaque: they were 86% over an 18px blur, so a calendar showed through every one of them. Motion widened from the old 90/160ms transform-only rule to a bounded set, and colour arrives as a per-skill accent edge so a month of posts reads as a mix rather than 30 identical cream rectangles | done |
| PLS-91 | The persona never learned from an edit. `recordLesson` had exactly one caller, "Mark published", so editing a generated post and letting the publisher send it taught it nothing. Confirmed against the live database: one post with a real edit, a persona present, zero lessons ever stored. Closing the dialog now captures the lesson, once, deduped per post and replaced rather than duplicated on a later edit | done |

DESIGN.md changed with the code, not after it: section 6c (opaque layers),
section 10 (the motion envelope), section 3 (the skill accents and the three
constraints that stop them eroding the colour roles), and contract rules 9 and
11.

## Pillar 1: the BD Strategist

The `/market` screen was a correctly metered research chat with four product
gaps: it defaulted to `gpt-4o` for work that needs frontier reasoning, it had
no durable memory beyond a short chat history, it rendered a generic
transcript, and it repeated live research for identical recent queries.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-92 | `bd_agent_memories` and `bd_research_cache`, both tenant-scoped with RLS from birth. Agency strategy is owner-or-admin, personal coaching is gated on `user_id = auth.uid()`, and a partial unique index stops one recruiter filing two feedback records for one answer | done |
| PLS-93 | Memory actions: save, edit, delete, and feedback that replaces rather than contradicts. No model call, no credits: a row, not a run | done |
| PLS-94 | `gpt-5` replaces `gpt-4o`, with `MODEL_RATES` moved in the same change per the pricing rule. Confirmed against OpenAI's pricing page: 1.25 in, 10.00 out, so input is cheaper than gpt-4o. `streamCompletion` retries once without `temperature` if the model rejects it, because OpenAI documents that parameter support differs on reasoning models and one 400 must not take the surface down | done |
| PLS-95 | Freshness-aware Exa cache, 24h searches and 12h pages, per org. A hit costs no search or page-read unit and does not touch the run budget, the run log says "Using recent research" with an age rather than "Searching", and a search asking for results newer than the entry bypasses it | done |
| PLS-96 | The briefing. Four labelled sections (what changed, why it matters, best next move, evidence) parsed from plain text rather than requested as JSON, because a model that must close a JSON object truncates and renders nothing. An answer without the labels falls back to exactly what was written | done |
| PLS-97 | Coaching. Useful or off target under every settled answer, off target requiring a reason on both the client and the server, written to visible personal memory and read by the next run | done |
| PLS-98 | The three-region workspace: strategy rail (what it knows, editable and deletable), briefing centre, evidence rail (freshness, coaching taken, next move). The old 140px page header is gone; it repeated the module rail and explained the product to somebody already using it | done |
| PLS-99 | Design review fixes: two columns instead of four, the working brief absorbs the evidence panel, and the transcript renders in the order it happened. APPROVED on the second screenshot pass | done |

Verified against the live database before shipping: the RLS policies isolate a
personal memory from a teammate in the same org, and the advisor reports no new
anon-callable surface.

**Design review found four defects the code could not show.** PLS-99 fixes
them, and three were only visible in a screenshot:

1. The workspace put its own rail beside the 264px module rail, so two columns
   said "MARKET" and "BD Strategist" with a dead column between them. The
   module rail cannot carry BD content (the layout renders one shared aside for
   every route), so the workspace column stopped repeating the pillar name and
   became the working brief.
2. A third evidence column on the right made four vertical strips at 1440px and
   gave the transcript, the only part anyone reads, the least width of the lot.
   It folded into the bottom of the brief, which also filled the void under the
   intake card.
3. **Every answer rendered above the question that produced it.** `begin_ask`
   writes both rows in one transaction with an identical `created_at`, so
   ordering by time alone is a tie Postgres resolves by heap order. Same class
   as the `jobs[0]` bug: no total order.
4. The first fix for 3 did nothing, and the screenshot proved it. `chat_role`
   is an enum, so it sorts by DEFINITION order (`user` = 1, `assistant` = 2),
   not alphabetically. The check that produced the wrong direction used
   `role::text`, which sorts alphabetically and gives the opposite answer. The one new entry, `sweep_bd_research_cache`, is
authenticated-only and bounded to an org the caller belongs to.

**Memory is strategy, never evidence.** It shapes how the strategist advises
and may never support a claim about a company, person, role, funding event or
date. Those still require a tool result every time. AI.md section 5 states the
rule and the system prompt enforces it.

## The rebrand port

Daniyal's sister rebuilt the whole front end as 17 static HTML files. PLS-101
ported the token layer, which reskinned 73 components by editing one file.
Daniyal's correction was that this was a colour swap, not the system: the
folder is a complete product with surfaces we did not have.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-100 | Private repo goes public with real CI (typecheck, lint, production build, a migration warning), and DEPLOY.md documents the path. PR #1 | done |
| PLS-101 | The token layer ported: re-pointing `globals.css` reskinned 73 components without editing one of them. PR #2 | done |
| PLS-102 | The rename to Pulse Recruit, a one-file change through `src/config/brand.ts`. PR #2 | done |
| PLS-103 | DESIGN.md becomes Rev C: what the rebrand changed, and the structural rules it did not. PR #3 | done |
| PLS-104 | The shell: settings popover, working dark mode, workspace menu. Dark mode is persisted, unlike the rebrand's in-memory toggle, and applied by an inline script before paint rather than in an effect, which is a white flash on every navigation | done |
| PLS-105 | `chat_conversations`, so a chat surface has threads. `begin_ask` resolves the thread inside the function to keep the claim atomic. All 14 existing messages adopted into 3 threads titled from their own first questions | done |
| PLS-106 | The BD history panel: threads grouped Today / Yesterday / date, New conversation, author-only delete. The transcript is scoped to the open thread, and so is the history the model receives | done |
| PLS-107 | The marketing site: landing, features, pricing, FAQ, testimonials, sharing one layout. Copy in one config file. The FAQ moves from a runtime JS array into server-rendered `<details>` | done |
| PLS-108 | `vermilion` becomes `violet` across 29 files, and two hardcoded light-only washes become theme-aware tokens | done |

**Testimonials ships without quotes, deliberately.** The rebrand attributes six
five-star quotes by name to real RecruiterGTM clients praising a product none
of them runs, plus "40+ Agencies on Pulse" and "2x faster time to first touch".
The layout is built; the slots say they are waiting for real quotes.

Four bugs across this block that typecheck, lint and build all passed, and only
a screenshot caught:

1. The top bar was `bg-ink text-sheet`. Both flip with the theme, so dark mode
   inverted the bar to white while the app went dark.
2. Sign out kept a `text-sheet!` override and went near-black on near-black.
3. Every segmented control painted its selected cap teal, which DESIGN.md
   reserves for on/running. A selected tab is not a running thing.
4. **All four new marketing pages were missing from `PUBLIC_PATHS`**, so a
   logged-out prospect reading the pricing page was redirected to sign-in. The
   entire marketing site was unreachable to exactly the people it is for.

Checked rather than assumed: the Ops morning brief already had its four tiles
and the sequences page already had Enrolled / Replied / Booked / Reply rate
from real columns. Both were on the plan as gaps; neither was one.

## Found on the production deploy

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-72 | The anon revoke never worked in either session's migrations. Supabase's default privileges grant EXECUTE to `anon` explicitly, so `revoke ... from public` removed only the PUBLIC entry and left it. The advisor reported ten functions callable over `/rest/v1/rpc` without a session; `roll_credit_week` was the one with no membership check of its own | done |

Down to three anon-callable functions, all deliberate: `is_org_member` and
`has_org_role` are policy predicates, and `public_shortlist` is the
token-addressed page that is meant to work without a session.

Still open, and Daniyal's call because it is an Auth setting rather than
schema: leaked password protection is disabled on the Supabase project.

## The gate, and the rest of the BD Strategist

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-109 | The `design-review` skill was judging Rev C screens against Rev A. It asked for `forest-900` chrome, `emerald-600` actions, Bricolage headings, JetBrains data literals, 11px micro labels, hue-tinted initials and `hueByIndex`: seven rules, zero occurrences of any of them in `src/`. It sent every route through `shot.mjs`, which cannot get past the session gate, and never opened dark mode at all. Rewritten to reference DESIGN.md section 11 rather than restate it, which is how it went stale in the first place | done |
| PLS-110 | BD Strategist: the Ready/Thinking run-state indicator and the rail panel toggles | review: typecheck, lint and production build are green, and the mechanical checks are clean. The screenshot pass has not run, see below |

**The gate was the thing checking everything else.** It named a "Review
checklist section" of DESIGN.md that does not exist, said "all ten checklist
items" over a list of eleven, and its mechanical grep flagged `text-[1[0-9]px]`,
which matches `text-[12px]` and `text-[13px]`, the correct Rev C type scale.
`strategy-rail.tsx` alone would have returned a dozen false findings, which is
how a reviewer learns to skim the list.

**PLS-110 has not had its screenshot pass.** `/market` is behind the session
gate, so photographing it needs a sign-in against the shared Supabase project,
and this session has the publishable pair only as a build-gate placeholder.
Judging the change from the diff is the one thing the skill exists to forbid,
so it stays at `review` rather than being called done. The commands are in the
skill; running them needs `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Two DESIGN.md corrections are owed and are Daniyal's call, because it is the
binding spec rather than a helper file. The skill documents both as carve-outs
so nobody files a finding against them meanwhile:

1. **Section 6d and contract rule 4 still describe the grain.** PLS-101 removed
   it, `globals.css` says so, and the Rev C table at the top of the same file
   says so. Rule 4 now governs something that does not exist.
2. **Section 9's toggle group still specifies a teal active cap.** PLS-108
   overruled that when it found every segmented control painting its selected
   cap teal: teal means on or running, and a selected tab is not a running
   thing. The anatomy and the lesson disagree in one document.

## Rev D: the BD Strategist redesign

Source: Figma file `JNQb065A0l98R0chZVy0B6`, "Pulse Recruit, BD Strategist
redesign", four frames. Daniyal's call on 2026-08-07 was to adopt it in full
rather than cherry-pick the parts that fit.

**This is not a reskin, and it should not be planned like one.** Rev C was a
colour and type change that landed by re-pointing tokens, without editing 73
component files. This changes what the product is. Five things in the file
contradict specs that are binding today, so each one changes the spec first,
in the commit before the code, per the PLS-103 lesson: a stale spec means the
next screen gets measured with the wrong ruler.

**It also supersedes most of PLS-110, which shipped hours earlier.** The
Ready/Thinking indicator becomes the two-state ancestor of Mara's five-state
avatar, and the Pillars/Context/Read rail toggles have no equivalent at all:
the redesign puts advisory domains and context in a persona panel with no
switching. PLS-110 is still at `review` and never had its screenshot pass. It
now likely never will, because the screen it changed is being replaced.

### The five decisions this adopts

1. **Mara.** The agent gets a name, a face, five states (idle, listening,
   thinking, speaking, stumped), a 4s breathe loop and an in-character error
   voice. The BD Strategist spec currently says the rail "makes the agent feel
   present without inventing a human persona". That line is reversed.
2. **Sessions replace credits.** The top bar reads "23 sessions left". AI.md
   section 2 says "1 credit = 1 US cent of provider spend. That is the whole
   definition, and it is what makes the meter honest." A session needs a
   definition that exact before a screen prints one.
3. **A five-room rail** (Coach, Patch, Accounts, Signals, Notes) replaces the
   one-module-per-pillar wayfinding in DESIGN.md section 8. That section calls
   four products behind one nav "the hardest problem in this product", so this
   reaches all five modules, not just `/market`.
4. **A new motion envelope.** Easing moves from `cubic-bezier(0.16, 1, 0.3, 1)`
   to `cubic-bezier(0.2, 0, 0, 1)`, and the avatar breathe is a second ambient
   animation where section 10 allows exactly one, the pulse dot. The rest
   agrees with what we have: 160 to 220ms, translateY 8px plus opacity,
   reduced motion collapsing to opacity only.
5. **Four surfaces that do not exist yet:** the commitments ledger, the 5pm
   evening debrief, the disagreement treatment, and the context gap list.
6. **Three colour roles move.** The palette is unchanged, Rev C violet
   throughout, so nothing is re-pointed in `globals.css`. What changes is what
   the colours are allowed to mean, and each of these breaks a rule that holds
   today:
   - The **Act now** severity dot is violet, and it is not clickable. Rule 5
     says violet is a verb.
   - The **Watch** dot is teal, which currently means on, running, engaged. A
     signal being watched is not a running thing.
   - **Your offer** carries a red dot for "no price anchor". Section 3 says red
     is destructive and error only, never a general warning colour.

   Adopting these means section 3 gains a fourth category, a severity ramp,
   alongside the content skill accents. The constraint that stopped those
   accents eroding the roles applies here too: they carry a category and each
   state still needs its icon and word.

### Tickets

| ID | Ticket | Depends on | Status |
| --- | --- | --- | --- |
| PLS-111 | DESIGN.md becomes Rev D. Section 8 rewritten for the five-room rail, section 10 takes the new easing and widens the ambient exception to the avatar, and section 3 gains the severity and domain hues as a named role set. The palette itself does not change | | todo |
| PLS-112 | AI.md section 2: the billing unit becomes a session, defined as exactly as a credit is today. Nothing prints a session count until this lands | | todo |
| PLS-113 | The BD Strategist spec gains Mara: the five states, the error voice, and the concede-on-second-push rule. The no-persona line is reversed on the record rather than quietly deleted | | todo |
| PLS-114 | Migration: the sessions ledger. `begin_ask` reserves and `finish_ask` settles in sessions, and the meter stays exact across the change | PLS-112 | todo |
| PLS-115 | Migration: `commitments`. A promise, when it was made, and whether it closed | | todo |
| PLS-116 | Migration: `context_gaps`, the questions Mara knows she cannot answer yet | | todo |
| PLS-117 | The five-room rail replaces the pillar rail, across all five modules | PLS-111 | todo |
| PLS-118 | `MetricCard` and the metrics strip. Nodes `4:2`, `4:3`, `4:8`, `4:13`, `4:18` | PLS-111 | done: composed on the `/design` component sheet and APPROVED at 1440 light, 1440 dark and 900 |
| PLS-119 | `SignalRow` and the signals feed. Nodes `4:23`, `4:27`, `4:33`, `4:39` | PLS-111 | done: APPROVED on `/design`. The name collision with the Postgres row type stands, they are in different modules and nothing imports both, so a file needing both must alias one |
| PLS-120 | `AdvisoryDomain`. Nodes `4:51`, `4:53`, `4:58`, `4:63`, `4:68`, `4:73` | PLS-111 | done: APPROVED on `/design`. The design's per-domain hue became a `status` prop, because those colours are readings that change with the data rather than domain identities |
| PLS-121 | `PersonaPanel` and the avatar states. Node `1:7`, states from spec frame `2:44` | PLS-113, PLS-120 | todo |
| PLS-122 | The commitments ledger. Node `9:2` | PLS-115 | todo |
| PLS-123 | Tell Mara something: the drawer and the gap list. Nodes `5:8`, `5:19` to `5:40` | PLS-116 | todo |
| PLS-124 | The evening debrief, 5pm local, only on days with an open commitment | PLS-122 | blocked: needs a scheduler, and pg_cron is still deliberately unscheduled per PLS-88 |
| PLS-125 | The disagreement treatment, amber rule on the left, one objection and not a debate. Node `10:23` | PLS-113 | todo |

### Blocked on the Figma read budget

The account is on a Starter plan with a View seat, which is **six MCP read
calls per month**, not per day, shared across everyone using it. One
`get_metadata` call bought the full node tree, every ID, name, size and string,
which is what the table above is built from. The next call was refused.

A PNG export then covered most of the gap. The palette reads as Rev C violet
throughout, so no token work is needed and the components can be built against
the 58 in `globals.css` today.

**What is still missing is exact values and assets.** Hex codes, type sizes,
radii and the exported icon set cannot be read off a screenshot to the
precision this system needs, and DESIGN.md rule 1 forbids off-scale values.
The working assumption is that every value maps to an existing token, and the
first design review will catch where it does not. The five rail icons render as
plain circles in the export, so those are unidentified and will come from
Lucide until somebody says otherwise.

### The palette does not change, and here is the proof

Read off the real nodes with a Full seat, not eyedropped from the export. Every
Figma value is a near-miss of a token we already ship, all within a few
percent, which is what a designer working from a screenshot produces rather
than what a new ramp looks like. So nothing is re-pointed in `globals.css` and
`src/components/bd/tone.ts` maps to tokens instead:

| Role | Figma | Our token | Value |
| --- | --- | --- | --- |
| Body text | `#17151f` | `--color-ink` | `#1b1526` |
| Secondary | `#9a96a8` | `--color-ink-3` | `#8b84a0` |
| Meta, severity word | `#6b6779` | `--color-ink-2` | `#585272` |
| Hairline | `#e5e3ec` | `--color-rule` | `#e7e1f4` |
| Positive delta | `#10916b` | `--color-teal` | `#0f7a5f` |
| Attention delta | `#da961b` | `--color-amber` | `#b8860b` |
| Negative delta | `#cd4b4a` | `--color-red` | `#b02a37` |
| Card fill | `#ffffff` | `--color-sheet` | `#ffffff` |

The deciding argument is not fidelity, it is dark mode. A raw hex cannot flip,
so pasting these would leave the BD screen in permanent light mode while every
other screen follows the theme. That is the same class of bug as the top bar
in PLS-104, which is the one a screenshot caught and three automated gates did
not.

### Six numeric deltas, snapped rather than adopted

The components ship on the existing scale, and each of these is where the
design and the scale disagree. None is a guess: the design value is on the
left. PLS-111 decides whether DESIGN.md widens to meet any of them.

| Where | Figma | Shipped | Why |
| --- | --- | --- | --- |
| Metric card radius | 12px | `--r-shell` 10px | Rule 1, the scale has no 12 |
| Metric strip gap | 10px | 12px | 4px scale has no 10 |
| Metric value size | 19px mono | 19px mono | Kept, but section 4 says metric numbers are Archivo 21px/700 |
| Signal row padding | 9px | 12px | 4px scale has no 9 |
| Domain row padding | 11px | 12px | 4px scale has no 11 |
| Legend tracking | 0.04em | 0.12em | `.legend` is the shipped mono treatment |

Secondary text is 11px throughout the design where section 4's table says
12px. 11px is shipped, because section 2 sets the floor at 11px and the design
is consistent about it, but it is a table change PLS-111 should record.

### The export and the live file disagree

The PNG and the `get_metadata` read, taken minutes apart, do not describe the
same screen. Neither is obviously stale, so this needs settling before
PLS-118 and PLS-122 are built:

| | PNG export | Live file |
| --- | --- | --- |
| Commitments ledger | absent | present, node `9:2`, between the subtitle and Today's play |
| Signal rows | four, ending in a grey **Note** | three, ending at WATCH |

The four-severity version resolves the earlier question in favour of the
original brief: `act | recover | watch | note` is right, and `note` is grey
rather than a state colour. That is the version PLS-119 builds.

### The component sheet exists now

`/design` was referenced by the design-review skill and recorded as shipped in
PLS-4, and did not exist. It does now, holding the Rev D components with the
Figma file's own sample copy.

It sits outside the `(app)` group on purpose: a route added inside it with no
entry in `modules.ts` falls through `moduleForPath` to TALENT, which is the
defect the `SETTINGS_MODULE` comment records. And it is public on purpose,
because it holds no tenant data and being reachable without a session is the
only reason the gate could photograph it at all. It carries `noindex`.

That unblocked the first real screenshot pass of the session, which found two
defects the mechanical checks passed clean:

1. The advisory shell stretched to the page while its content was 320px, so
   most of a panel sat empty. The width belonged on the shell, not inside it.
2. The first advisory row drew a rule the design does not have. Figma `4:53`
   carries no top border and `4:58` onward do.

Both fixed and re-reviewed. APPROVED at 1440 light, 1440 dark, and 900.

### Open questions

- Which of the two versions above is current. If the ledger was cut, PLS-115
  and PLS-122 come off the list entirely.
- The gap list says one row is "Synced from RecruiterFlow". That integration is
  not in the ARCHITECTURE.md provider table and has never been connected.
- "Nothing charged against your sessions" appears in the error copy, which
  confirms sessions as the unit but not what one is. PLS-112 still needs the
  definition before anything prints a count.

## Rev D delivered: Mara is the live BD screen

Built from the Figma alone, on Daniyal's instruction to ignore DESIGN.md for
this screen and follow the file. The redesign turns pillar 1 from a research
chat into a coach: the screen opens with what you promised, not with metrics.

This is the implementation of the Rev D plan above, built in a parallel session
and renumbered onto the block that plan reserved. The two do not collide in
code: `src/components/bd/` is the reviewed primitive set, reachable only from
`/design`, and `src/components/mara/` is what `/market` actually renders. The
open question above, whether the ledger survived the cut, is answered here: it
did, and it is the first thing on the screen.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-126 | `bd_commitments` and `bd_debriefs`, RLS from birth, `settle_commitment` RPC writing both tables. `asked_on` is a stored column because `created_at::date` cannot be indexed | done |
| PLS-127 | Mara tokens and motion keyframes, avatar with five states from the extracted geometry | done |
| PLS-128 | Persona panel: identity, advisory domains, context chips | done |
| PLS-129 | The stage: greeting, ledger, today's play, metrics, signals feed, conversation | done |
| PLS-130 | "Tell Mara something" drawer, gap list driven by which memory kinds are missing | done |
| PLS-131 | "I'd push back" briefing section and the evening debrief card | done |

Three metrics come from rows that already exist. **BD time has no source
anywhere in Pulse**, so its tile shows `--` behind a "soon" badge. It stays
that way until something measures hours; a plausible number there would end up
in a screenshot and then in a pitch.

Today's play is derived from the freshest signal rather than generated. A model
call on every page render would spend credits outside the `begin_ask` lifecycle
AI.md requires.

### Caught by screenshots, passed by every gate

1. `/market` auto-opened the most recent thread, so the entire redesigned stage
   was invisible to anyone who had ever asked a question.
2. The stage and the transcript were both `flex-1`, splitting the height and
   burying the signals feed under its own scrollbar.
3. An empty transcript still claimed `flex-1`, reserving a blank region the
   size of a conversation above the composer.
4. "+8 this week" against a patch of 8 is the whole list restating itself.

The section rail also went for MARKET, by rule rather than by name: a module
with one destination has no sections to navigate between. A second section
brings it back automatically.

## The tasks redesign

Figma, `Pulse Recruit — BD Strategist redesign`, page `02 — Tasks`. Four
frames: the screen itself, and three behaviour specs (completion states, the
completed list, comments and activity). The shipped `/ops/tasks` was a single
sortable table with five dropdowns on every row; the redesign is a three region
workspace with one typed line as the only way to add anything.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-132 | The tasks workspace: view rail, grouped list, task panel, natural-language quick add, the four-frame completion choreography, the paged completed list, and the comment stream with mentions, watchers, inline edit and the no-modal delete | review: schema applied and verified against the live database, but no build has run. See below |

**Four things the schema could not say, so PLS-132 is a migration first.**
`tasks` knew when something was finished and never who, so "completed by you"
was unsayable; `candidate_id` was the only link, so "CLIENT Halden Group" was
unsayable; there was no comment table at all; and "notifies watchers and the
assignee, never the whole workspace" needs a watcher set to notify.
`20260807130215_task_workspace_comments_watchers.sql` adds `tasks.done_by`,
`tasks.company_id`, `task_watchers`, `task_comments`, and five functions.
Completing is now an RPC because it writes the task row and the activity entry,
which is law 1, and the old client-side `toggleTask` update is gone.

**The quick add parses the same sentence twice, on purpose.** The browser parse
draws the reads-as row under the input; the server parse is what gets written.
A client that posts the due date, the priority and the assignee ids it decided
on is a client the server has taken at its word. `src/lib/task-parse.ts` is
pure and both call it.

**Three deliberate departures from the Figma frames**, each one a DESIGN.md
rule the frames did not know about:

1. The frames put Reply, Edit and Delete behind hover on a comment. Section 2
   says nothing lives behind hover and names it as the pattern that fails this
   audience hardest. The actions are always mounted, quiet, in mono at `ink-3`.
2. The frames draw circular checkboxes and hue-tinted avatar tiles. Section 5
   says fully-rounded shapes do not exist in this system, and `src/lib/hue.ts`
   says avatars are neutral because the colour roles are fully spoken for.
   Rounded squares, neutral tiles.
3. The frames put an "ON CALENDAR" chip beside the due date. There is no
   calendar integration in Pulse, so the chip would be decoration asserting a
   fact. Omitted rather than faked.

Also not built, and for the same reason: the frames show a `CONTACT Patrick
Henn` link. There is no contacts table. Candidate and company links are what
the schema can honestly express, and those are what the chip prints.

**The priority ring collides with PLS-111 by design.** DESIGN.md section 3
gains the task priority ring as a second narrow exception to the colour roles,
constrained the same way the content skill accents are. PLS-111 rewrites that
same section to add "the severity and domain hues as a named role set". The
ring is a third candidate for that set and should be folded into it rather than
left standing as its own exception. Whoever takes PLS-111 should absorb it.
The amendment itself is still Daniyal's call, because DESIGN.md is the binding
spec rather than a helper file.

**The screenshot pass has a route now that it did not when this was written.**
PLS-118 to PLS-120 were APPROVED on the `/design` component sheet rather than
against a signed-in screen, which is what made the gate reachable at all. The
task row, the priority ring and the activity entries can go the same way.

**The schema is applied and was proved against the live database**, in a rolled
back transaction, the same way the publishing chain was in PLS-87: create with
a company link, complete, complete again, reopen, comment, edit, reply, delete
the answered parent, delete the unanswered reply. The tombstone/removal split
is right, `done_by` is stamped and cleared with the status, a system entry
refuses to be edited, the check constraint refuses `done_by` on an open task,
and a mention of a uuid outside the org is refused. The advisor reports no new
anon-callable surface: the list is still the five deliberate ones.

**The stream had no total order, and only running it could show that.**
`create_task` writes "Created this" and, through `replace_task_assignees`,
"Assigned to X". Both are one transaction, `now()` is the transaction start
time, so every entry on a new task carries an IDENTICAL `created_at` — measured
at five entries with one distinct timestamp between them. `order by created_at`
was a five-way tie that Postgres settles by heap order, so the assignment
rendered above the creation and the order was not stable between reads. This is
the third instance of the class: PLS-99's transcript rendering every answer
above its own question, and the `jobs[0]` bug before it. **A timestamp is not an
ordering.** `20260807130504` adds `task_comments.seq` as an identity column,
moves the creation entry ahead of the assignment, and `data.ts` orders by `seq`.

**PLS-132 has still not been built or photographed.** This environment has no
Node and no `node_modules`, so `npm run build`, `npm run typecheck`, `npm run
lint` and Playwright have not run against it, and the design-review screenshot
pass needs the app running behind a session. It stays at `review` until both
happen; calling it done from a diff is the one thing the gate exists to forbid.

**Migration filenames match the recorded versions, not the wall clock.** The
MCP stamps `schema_migrations` with the server's own timestamp, which was a day
behind the filenames first written here, so both files were renamed to
`20260807130215` and `20260807130504`. A mirror whose names disagree with
`schema_migrations` is a folder that will try to re-apply itself.

**The migration drops every `create_task` overload rather than one named
signature.** `drop function if exists` with a signature that does not match
exactly is a silent no-op, and the new nine-argument version would then sit
beside the old eight-argument one. PostgREST resolves an RPC by argument names,
both would match a call carrying `target_org` / `task_title` / `task_detail`,
and it answers that with "could not choose the best candidate function". The AI
tool in `src/lib/server/ai/tools.ts` calls it exactly that way, so the failure
would have landed on Claude writing a task rather than on the migration.

## OPS is the task list

Daniyal, on the shipped tasks workspace: the operations module should discard
the morning brief and show the task page and nothing else.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-133 | The morning brief goes. OPS has one destination, so the section rail stops rendering for it by the existing rule, and `/ops` redirects to `/ops/tasks` | review: CI green, no screenshot pass |

**The section column disappears for free.** `module-rail.tsx` already gates the
second nav column on `nav.length <= 1`, the rule PR #7 introduced for MARKET:
a module with one destination has no sections to navigate between. Dropping the
Morning brief entry leaves OPS with one, so the 208px column stops rendering
without a line of layout code. That also answers the width worry filed against
PLS-132, where the tasks workspace put its own 224px view rail beside the
module rail and left the list about 620px at 1440. It now gets about 830.

**A redirect, not a 404.** PLS-80 let `/content/skills` 404 on purpose, because
that feature moved into a popup on another screen and a stale bookmark had
somewhere wrong to land. Here there is exactly one right answer, `/ops` is the
module's front door, and notification rows written before today point at it.

**What this costs, and it is not nothing.** The morning brief was the only UI
for the `ops` chat surface: four pipeline tiles over a credit-metered assistant
that reads the org's own rows, has no web search by design, and can write
follow-ups as tasks. That surface is now unreachable from inside the product.
It is NOT deleted: `ChatSurface` still carries `ops`, the tool dispatcher in
`src/lib/server/ai/tools.ts` still serves it, and the MCP server still exposes
it, so Claude can still work the pipeline through it from outside. Only the
screen is gone. `getOpsTiles` went with it rather than staying as an export
nothing reaches.

If the assistant is wanted back later, the cheaper move is a composer on the
task list rather than restoring a second room: the tiles it carried were four
counts, and the tasks header already answers the one that mattered.

## Content rebuilt from Figma, page 02 (PLS-152 onward)

**Renumbered from 134 after the fact, and the first four were already in
production when the collision was found.** This block was planned when 133 was
the highest ID in the file. A parallel session landed PLS-134 to PLS-151 in the
meantime, so the four tickets shipped here duplicated four that already existed:
the gpt-4.1 model change, composer dictation, the Reyhan rename, and the
Impeccable install. Their IDs stand, because theirs merged first and the whole
workflow keys on these numbers; the migration files, code comments and DEPLOY.md
were renumbered to 152 to 155 in the same pass as this line.

The lesson is the one PLS-111 already taught and this session failed to apply
twice: **re-read TICKETS.md immediately before claiming an ID, not at plan
time.** A plan written an hour before it ships is a plan holding stale numbers.

Figma page `32:2` holds six frames that replace the whole content module: a
"This week" planner with two rails, a full-screen post editor, a five-column
pipeline board, a month view, a Skills screen, and a spec frame for the
schedule, draft and dismiss behaviours. Daniyal asked for an exact copy.

It is not a restyle. Four capabilities the schema could not express: real
LinkedIn engagement metrics, suggestions grounded in the recruiter's own
pipeline, skills as editable rules that learn from edits, and slot advice
ranked by what has actually performed. Group A below is all schema and server
capability, so it lands and is verified before a pixel moves.

Decisions taken before planning: build the real analytics ingestion rather than
seed numbers, build all four systems rather than a subset, and match Figma where
it conflicts with DESIGN.md, amending the spec in the same commit.

Verified during planning rather than assumed: Unipile's post endpoint really
does return `reaction_counter`, `comment_counter`, `repost_counter` and
`impressions_counter`, plus a fuller `analytics` object on accounts that have
it. That is what makes PLS-154 and PLS-155 buildable at all.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-152 | `post_status` gains `needs_review` and `needs_attention`, alone in its own migration | done |
| PLS-153 | A disconnected LinkedIn becomes Needs attention, never Failed. `finish_publish` learns a failure kind, and `flag_unpublishable_posts` surfaces due posts the claim query structurally cannot see | done |
| PLS-154 | `post_metrics`, every counter nullable | done |
| PLS-155 | Unipile `getPostStats` and the six-hourly refresher at `/api/cron/post-metrics` | done |
| PLS-157 | The pricing page was promising a founding rate for life. Corrected to three months, and the founding margin recorded in AI.md | done |
| PLS-158 | The planner shell from the Figma: content rail, week strip, "This week" header | done |
| PLS-159 | The board becomes the Figma pipeline: five columns, per-column add, and a card that still names its own status inside a grouped column | done |
| PLS-160 | Waiting on you: what is blocked, why, and the one verb that clears it | done |
| PLS-161 | Suggestions schema. Every suggestion traces to a row in this workspace, and each dismissal reason writes the exact suppression the spec frame documents | done |
| PLS-162 | The suggestion engine and its metered route. Grounded at insert, not in the prompt, and `org_members` stops swallowing an empty directory | done |
| PLS-163 to PLS-170 | The right rail, the post editor route, provenance, the rewrite bar, skills as rules, the skills screen, the action states | todo |
| PLS-163 | DESIGN.md amended for the two Figma conflicts, plus the shared primitives onto `/design` | todo |
| PLS-164 to PLS-170 | The six screens, then retire the dialogs | todo |

## PLS-156: the first screenshot of the tasks workspace

Node was installed on 2026-08-07, which finally made the gate runnable. The
tasks workspace had shipped to production two hours earlier having never been
photographed, and the first image found three things typecheck, lint and a
production build had all passed over.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-156 | The tasks list is capped, the header aligns with it, your own avatar stops saying "Y", and `PRODUCT.md` records the product truth Impeccable reads | done |

**`PRODUCT.md` landed in the same pass**, because Impeccable's `init` blocks
every other command until it exists and its own guidance is that the floor is
meaningfully higher with context. It records only confirmed facts and marks the
rest.

Two things it deliberately does not settle. **Price**: AI.md's cost model is
written against 299 USD a month and the roadmap names a 50 USD founding price,
and those two numbers disagree in the repository today, so neither is quoted as
settled. **Evidence**: there are no customer quotes, no verified agency count,
no case studies and no benchmarks. The file says so in as many words, because
the ported marketing site once carried six invented five-star testimonials
attributed to real RecruiterGTM clients plus "40+ Agencies on Pulse", and the
point of writing the absence down is that nothing reintroduces it.

Init does **not** write DESIGN.md, contrary to how the choice was framed when it
was offered: its playbook says so explicitly and leaves an incumbent one
untouched. Only `document` and `new-work` replace the visual world, so Rev C
still stands and that decision is still live for whenever one of those runs.

1. **The list stretched to 1550px.** With a task open the panel takes 340px and
   the centre lands near the Figma's 816px on its own, so nothing had ever
   pinned it. With nothing open, a row's record ID sat most of a screen away
   from its own title. Capped at 900px: past that, scanning one short column
   turns into a horizontal saccade on every row.
2. **Your own avatar rendered "Y".** `nameOf` returns "You" for prose and was
   feeding the avatar too, so `initials("You")` was a single letter. An avatar
   is an identity, not a pronoun. `tileNameOf` never returns a pronoun.
3. **Capping the list broke the header**, which is the loop working. The title
   sat at one x and the first row at another, reading as two panels rather than
   one screen. The rule still spans the full width; only its contents are
   capped, because a divider stopping short of its own edges is a worse
   artefact than the misalignment it fixes.

**Open, found in the same pass, not fixed here.** In the dark-mode capture the
By person rail is empty and the assignee avatar reads `T` for "Teammate", where
the light capture of the same route and the same data reads `DA` and lists one
person. `members` came back empty on that render, so `org_members` returns
nothing intermittently. It is a data bug rather than a theming one and it wants
its own ticket, because a directory that is sometimes empty also silently
empties the assignee picker.

**The dark-mode tool has the flaw PLS-109 documented in `shot.mjs`.**
`shot-theme.mjs` does sign in, but three of eight runs in this session landed on
`/signin` and photographed it anyway while reporting success, the same way
`shot.mjs` used to. It looks like auth rate limiting under repeated sign-ins.
The script should assert it is not on `/signin` before writing the file, exactly
as `shot-app.mjs` already does.

**Null is the load-bearing decision in this whole block.** Every counter in
`post_metrics` is nullable, and a figure LinkedIn did not report is written as
null, never 0. Zero is a measurement: it says nobody engaged. Null says we do
not know. Defaulting a missing figure to 0 would turn "we have no data" into a
claim, on the one screen whose entire job is telling a recruiter what worked.
That is the never-fabricate rule applied to arithmetic rather than prose, and it
is why nothing may substitute reactions for views: impressions come from
LinkedIn's own analytics and a personal profile may never expose them.

**Failed and Needs attention are different facts.** The spec frame is blunt
about why: "Failed tells the user nothing they can act on." `failed` means
LinkedIn refused the words and the post needs rewriting. `needs_attention` means
Pulse never got to ask, almost always a disconnected account, and the fix is
reconnecting. An attempt we never made does not burn one of the three retries,
so `unreachable` gives the attempt back. `needs_attention` is publisher-owned
and deliberately absent from `MANUAL_STATUSES`: a human choosing it from a
dropdown would be asserting an attempt that never happened.

**`flag_unpublishable_posts` closes a silent hole that predates this work.**
`claim_due_posts` inner joins a connected account, correctly, because there is
no point claiming a post we cannot send. The consequence was that a due post in
a workspace whose LinkedIn had expired was never selected, sat in `scheduled`
past its date indefinitely, and showed up only as something that looked overdue
on a calendar. Known gap left open on purpose: a scheduled post with an empty
body is stuck the same way for the same structural reason, but it is a different
cause needing a different message, and folding it in would make one reason
string cover two situations.

Verified against the live database in a rolled back transaction before any of
it shipped: `unreachable` lands `needs_attention` and returns the attempt to 0,
`refused` lands `failed` and keeps it at 1, an unknown failure kind is refused
outright, `flag_unpublishable_posts` moves a due post with no connected account
and leaves a future-dated one alone, and exactly one `finish_publish` overload
survives the replace. The advisor reports no new anon-callable surface;
`post_metrics` raises no RLS finding.

## Later weeks (placeholders, not yet specced)

Week 2: enrichment credits end to end (waterfall email and phone, per-plan caps), signals feed v1 (open jobs).
Week 3: Claude in Pulse (chat, tasks, morning workflow), scheduling port with routing questions.
Week 4 (phase C): publishing through Unipile is built, see PLS-87 to PLS-89
above. What is left of this line is billing on at the $50 founding price.

## PLS-133: the landing state is one scroll, not two

Daniyal's screenshot after the Rev D deploy: the stage squeezed into a short
box with its own scrollbar, ~400px of chrome pinned beneath it, and the signals
feed unreachable on a normal window.

The earlier fix was half of one. Collapsing the empty transcript stopped the
blank region but left the stage as `flex-1 overflow-y-auto` with the whole
ChatPanel shell, banner, suggestions and composer, unshrinkable below it. Two
competing scroll regions again, just a different pair.

`ChatPanel` takes a `chromeless` flag. Chromeless it drops the card shell and
renders only the composer, because anything it stacks while pinned to the
bottom costs the stage that height on every screen. The banner and the
suggestion chips move into the stage's own scroll region: they are content, not
furniture. `ask` owns the run lifecycle so it cannot leave ChatPanel, and is
published through `onReady` into a ref so a chip the stage renders fires a real
run without re-rendering the stage.

Checked at 1440x820, the height that showed the bug, in both themes. The
conversation view was photographed separately because it uses the other branch
of every layout switch this touched, so a landing-state shot proves nothing
about it.

`shot-mara-thread.mjs` goes to the thread by id. Clicking through the history
drawer picked whichever button was second in the DOM, which was not a
conversation row, and the shot came back as the landing state while reporting
success.

## PLS-134, PLS-135: the chat actually answers, and it has a name

**The BD chat had been dead for two days and the error copy hid it.** Every run
since the model default moved to gpt-5 failed with "The model returned nothing.
Nothing was charged. Try again in a moment." Both keys were set on production
the whole time, so this was never configuration in the way it looked.

gpt-5 is a reasoning model, and its reasoning tokens are billed and counted
inside `max_completion_tokens`. On this surface's budget it spent the entire
allowance thinking and streamed no text: HTTP 200, a valid stream, empty
content. Nothing in the error path fires on a successful empty response, so it
fell through to the generic message, which told people to try again. Retrying
produced the same empty response every time.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-134 | Model to `gpt-4.1`, `MODEL_RATES` to $2.00 in / $8.00 out in the same commit. An empty response with output tokens spent now names the model and the knob instead of saying "try again" | done |
| PLS-135 | Dictation: a mic on the composer, browser SpeechRecognition, no key and no per-call cost | done |
| PLS-136 | The strategist is Reyhan, not Mara. Name, role and pronoun live in `config/brand.ts` beside the product name | done |

**Rates changed with the model, in the same commit**, per the hard rule. Input
is dearer than gpt-5 ($1.25 to $2.00), output is cheaper ($10.00 to $8.00), and
output dominates a briefing, so a typical run lands slightly cheaper. The
direction that matters is that it lands at all.

**The prompt now carries how a recruitment agency earns.** The model knows what
recruiting is; it did not know that a fee arrives on a hire, that a role with
six agencies on it is worth less than a quiet one, or that a signal only counts
when it implies hiring. Without that, "a company raised money" reads as news
rather than as a role worth working.

**Reyhan is RecruiterGTM's CEO**, used deliberately as branding on Daniyal's
call. The copy said "she" throughout about an invented persona; a real person's
name carries real pronouns, so it now says he and his.

Caught by the screenshot after the sweep looked clean: "Ask Mara how" on the
play card and one line of empty-state copy. A find-and-replace over strings
missed both because they are JSX text nodes, not string literals.

**Voice is half built.** Speaking to it works. Having it speak back was scoped
out for now: browser synthesis is free but sounds robotic, and an OpenAI voice
needs a credit rule before anything bills for it.

## PLS-137: impeccable, design anti-pattern detection

`npx impeccable install`, Daniyal's call. Apache-2.0, published by Paul Bakaus,
six dependencies, no network calls in the hook. 24 commands (`/critique`,
`/polish`, `/audit`, `/harden`, `/typeset`, `/layout`) plus a `detect` CLI that
scans for UI anti-patterns.

Installed at **project scope**, into `.claude` and `.github`, and committed so
the whole team gets the same skills rather than each machine having its own.
`.claude/settings.local.json` is gitignored: it carries the hook wiring with
machine-specific paths, so each person runs the installer once.

**Verified it actually detects rather than trusting the README.** Against a
deliberately bad fixture it found low contrast with the real ratio (1.2:1
against a 4.5:1 requirement), cramped padding, and 9px functional text, each
with the reasoning behind the rule. Against `src/components/mara/` it found
nothing, which is the answer we wanted and now know is meaningful.

**No collision with our own `design-review` skill.** That one is untouched and
still the version from PR #7; impeccable lives beside it under
`.claude/skills/impeccable/`.

The 300 vendored files are excluded from eslint. Linting somebody else's
source produced 302 warnings from files we do not maintain, which is precisely
how a warning list stops being read. Zero came from our code.

## PLS-138: what the detector found, and the six tokens behind it

**First, a correction to PLS-137.** That ticket recorded the detector finding
nothing in `src/components/mara/`. That result was worthless: `detect` reads
rendered HTML and CSS, not React source, so it returns silence on any `.tsx`
file whatever is in it. Proved by feeding it a deliberately broken component
and getting exit 0. **The detector only means anything against a URL.**

`scripts/detect-app.mjs` closes that gap for signed-in screens: it signs in,
inlines the computed styles the rules actually read, and writes HTML the
detector can scan. Its first version hung forever, because awaiting
`getAnimations()` includes the pulse dot and the avatar breathe, whose
`finished` promise never settles. It now awaits only finite animations.

### The real numbers

| | Before | After |
| --- | --- | --- |
| App screens (market, tasks, content, signals) | 213 | 112 |
| Marketing (/, pricing, features, faq) | 111 | not yet addressed |

**Two rules were 79% of it, and both were one token each.**

`.meta` was **10px**, used in 44 files: 129 undersized-text findings from a
single declaration. It carries "SAID 3 DAYS", "ACT NOW", credit counts and
source labels, none of which are decorative. Now 11px.

Contrast, all measured rather than eyeballed:

| Token | Was | Measured | Now | Now measures |
| --- | --- | --- | --- | --- |
| `ink-3` light | `#8b84a0` | 3.26:1 | `#736d84` | 4.53 worst case |
| `violet` dark | `#8b5cf6` | 4.23:1 white on it | `#8558ec` | 4.56 |
| `mara-ink-3` light | `#9a96a8` | 2.70:1 | `#706d7b` | 4.53 worst case |

`mara-ink-3` was mine, added for the Reyhan screen, and worse than the token it
was modelled on.

New `-deep` variants for the status colours. A base status colour is tuned for
a 7px dot, where contrast is not the binding constraint; the same value as text
measured 2.5:1. The metric deltas use the deep variants, the dots keep the
base. In dark mode both are the same value, because the base already measures
10:1 there.

### Still open

112 findings remain on the app screens: 27 `nested-cards`, 66 undersized text
at genuine per-component sizes rather than one shared class, 13 contrast, plus
`overused-font` (Inter) and two `flat-type-hierarchy`. The marketing site has
its own 111, including `ai-color-palette` and `radial-spotlight-glow` on the
landing hero, which are judgement calls about the rebrand rather than defects.

## PLS-139 to PLS-141: the critique, and the motion it earned

`/critique` run properly: two isolated sub-agents, design judgement and
detector evidence, neither seeing the other until synthesis. Both found things
the other could not have.

### What the design review caught

| | |
| --- | --- |
| **Pronouns broken in shipped copy** | "Stays open. **She** will ask again" sat next to "Dropped, and **he** stops suggesting it" in the same four-button group. `tell-mara.tsx` said "**He** uses this on every answer. The more **she** knows" in one sentence. The agent is named after a real, identifiable man, so this reads as a female AI find-and-replaced badly, which is exactly what happened. Fixed by routing every pronoun through `agent.pronoun`, so one cannot be hand-written wrong again. |
| **Two CTAs navigated nowhere** | "Ask Reyhan how" pushed `?q=` and "Manage" pushed `?memory=1`. The page typed its searchParams as `{ c?: string }` and read neither. The secondary verb on the primary card did nothing at all. |
| **`Done` recorded an outcome nobody gave** | See PLS-140 below. |

### PLS-140: the ledger was lying to the coaching data

`Done` called `settleCommitment(row.id, "went_well")`. Clicking Done means
"take this off my list"; it does not say the outreach landed. That value went
into the same column the debrief card fills, so every coaching signal derived
from `bd_debriefs.outcome` was contaminated by clicks that meant something
else. The debrief exists *because* a binary done/not-done makes people lie, and
the ledger shipped exactly that binary, mislabelled.

A fifth outcome, `closed_by_user`, with the check constraint and
`settle_commitment` updated in one migration. It closes the commitment like
`went_well` does but claims nothing about how it went, and analytics can
exclude it. Verified in the database: the new row records `closed_by_user` with
status `done`.

### PLS-141: the same violet, missed twice

The detector found white-on-violet at 4.23:1 in dark mode, on "I'll do this".
PLS-138 had already fixed that exact value on `--color-violet` and left
`--color-mara-violet` holding it, 22 lines below a comment warning about it.
Fixing one violet and leaving its twin is what a duplicated palette costs.
Also raised the "soon" chip from 9px and the metric delta from 10px.

Dark mode went 20 findings to 17.

### PLS-139: motion, and only where it means something

Thesis written before the code, in `src/components/mara/MOTION.md`. Operate
mode: nothing animates because an area was static.

**The focal moment is a promise being crossed off**, which was a
`router.refresh()`: the row vanished after a round trip with no
acknowledgement, the same nothing a failed request gives you. The single
emotional peak in the product read as a page reload, while the most decorated
object on screen was the card that *adds* work.

The row now strikes through, desaturates and collapses its own height over
260ms, on the click rather than the server's answer. Collapsing rather than
fading moves the rows below up, so the list visibly shortens: a fade leaves a
hole where the payoff should be. If the write fails the row springs back and
says why, so the optimism is never a lie. The header count drops with it.

**The metric strip deliberately does not animate.** Numbers counting up delay
the one thing a tile exists to say, and four counting at once is worse.

Verified with `scripts/verify-settle.mjs`, which drives a real click: the class
lands on the click, the row genuinely collapses, and the promise is still
settled after a reload. A class-name assertion alone would pass on an animation
that moves nothing.

### Not done, and deliberately

The review raised the persona risk hardest: there is **no disclosure anywhere
that Reyhan is an AI**, while the name, role and breathing face all point the
other way. It also flagged that the model will render "I'd push back" over a
real CEO's name, on advice no human reviewed. Both are Daniyal's calls, not
mine, and are raised rather than silently resolved.

Also open: no undo on any write, the duplicated `--color-mara-*` palette, and
what the ledger does at 22 open promises.

## PLS-171 to PLS-175: "it looks like AI slop"

Daniyal, on the deployed build. He was right, and the detector agreed in
specifics: the landing page carried 25 findings including a purple radial
spotlight, coloured glow shadows, and two kickers.

**The diagnosis was inheritance, not decoration.** DESIGN.md commits to a
specific world, *"the interface is a piece of well-made equipment"*, with
keycap controls and panels meeting on 1px rules. The app expresses it. The
marketing site used none of it: it was the category's default page, and every
finding traced to fewer than eight lines, most of them copied into two files.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-171 | Section 10 scoped to the app; 10a gives marketing one authored entrance up to 800ms; 10b bans kickers and coloured left borders above 1px product-wide | done |
| PLS-172 | The radial glow, the violet glow shadows, every kicker, and the uniform card grid. **25 detector findings to 2** | done |
| PLS-173 | The focal entrance, sentence-case headlines, and a reduced-motion bug | done |
| PLS-174 | Real product screenshots, generated by script, both themes | done |
| PLS-175 | Tasks says what is slipping and where the load sits | done |

### The bug that mattered most

`prefers-reduced-motion` collapsed `animation-duration` and **never touched
`animation-delay`**. Anything staggered using `both` sat in its start state for
the length of its delay, so the landing hero was invisible at opacity 0 for a
reduced-motion visitor, and `.mara-in` in the app had the same hole.

A screenshot taken after the delay looks perfect, which is why it survived.
`scripts/verify-entrance.mjs` caught it, and also caught the entrance running
to 860ms against the 800ms cap written into DESIGN.md twenty minutes earlier.
Tightened to 740ms rather than amending a rule to fit the code.

### Screenshots, and why they are allowed back

They were rejected once for going stale. `scripts/shot-marketing.mjs` makes
freshness a command: it signs in, waits for entry animations, and writes both
themes to fixed paths. CSS picks between them on `data-theme`, which the
pre-paint script sets, so the right one is correct on the first frame.

**`/market` is deliberately not photographed.** The demo workspace has no model
key, so it renders with a large amber NOT AVAILABLE banner as its most
prominent element. It goes back in when the demo can answer.

Two junk rows were deleted from the seeded workspace first: tasks titled
"Daniyal" and "piss" from my own testing, both of which would have shipped onto
the marketing site.

### Tasks needed no model at all

Every input was already in memory: `overdueCount`, `personCounts`, `dueBucket`,
and the 30 days of completed tasks `getTaskWorkspace` already loads. A derived
sentence is instant, free, and cannot fabricate. Load is framed as unowned work
or capacity, never a league table, and it stays silent unless the imbalance is
both double and three tasks.

### Still open

- **The suggestions rail has an engine and no UI.** A parallel session shipped
  `suggestions.ts`, its schema and its route, with the grounding filter done
  properly. Nothing under `src/app/(app)/content/` reads it yet.
- **`recordLesson` calls `distilLesson` with no `begin_ask`** — the one model
  call in the product outside the reservation lifecycle, against AI.md section
  3's "there is no variant of it".
- `overused-font` (Inter) is the one real finding left on the landing page. A
  display face is a brand decision, not a defect.
