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
| PLS-60 | Mirror the already-applied migrations into `supabase/migrations/`. Law 10 says the folder is the mirror and it started out empty | PLS-37 | partly: everything from PLS-61 on is mirrored except `20260807122952_bd_commitments_and_debriefs`, and the nine from before PLS-37 are not |
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

## The tasks redesign

Figma, `Pulse Recruit — BD Strategist redesign`, page `02 — Tasks`. Four
frames: the screen itself, and three behaviour specs (completion states, the
completed list, comments and activity). The shipped `/ops/tasks` was a single
sortable table with five dropdowns on every row; the redesign is a three region
workspace with one typed line as the only way to add anything.

| ID | Ticket | Status |
| --- | --- | --- |
| PLS-111 | The tasks workspace: view rail, grouped list, task panel, natural-language quick add, the four-frame completion choreography, the paged completed list, and the comment stream with mentions, watchers, inline edit and the no-modal delete | review: schema applied and verified against the live database, but no build has run. See below |

**Four things the schema could not say, so PLS-111 is a migration first.**
`tasks` knew when something was finished and never who, so "completed by you"
was unsayable; `candidate_id` was the only link, so "CLIENT Halden Group" was
unsayable; there was no comment table at all; and "notifies watchers and the
assignee, never the whole workspace" needs a watcher set to notify.
`20260808120000_task_workspace_comments_watchers.sql` adds `tasks.done_by`,
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

**PLS-111 has still not been built or photographed.** This environment has no
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

## Later weeks (placeholders, not yet specced)

Week 2: enrichment credits end to end (waterfall email and phone, per-plan caps), signals feed v1 (open jobs).
Week 3: Claude in Pulse (chat, tasks, morning workflow), scheduling port with routing questions.
Week 4 (phase C): publishing through Unipile is built, see PLS-87 to PLS-89
above. What is left of this line is billing on at the $50 founding price.
