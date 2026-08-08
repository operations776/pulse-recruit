# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Recruiters working inside recruitment agencies. The buyer is the agency; the
user is the recruiter, and they are usually the same small team.

They are in the product all day, roughly 20 to 40, comfortable with dense
software and not in need of it zoomed in. Density is the point: more pipeline on
screen beats larger text. A workspace is one agency, and everyone in it shares
the same rows.

Confirmed durable behaviours that shape every screen:

- They scan a list rather than read it, and they do it many times a day.
- They work across a pipeline, a task list, an outbound queue and a content
  calendar in the same hour, so nothing may move between screens.
- They act on partial information and need to know what is stale, not just what
  exists.

## Product Purpose

A standalone ATS for recruitment agencies, with the four things around it that
an agency otherwise buys separately: business development research, an
operations layer, multichannel outbound, and a content engine.

Success is an agency running its whole week inside Pulse rather than in an ATS
plus a spreadsheet plus a scheduler plus a notes app.

Five pillars, one shell:

| Pillar | Module |
|---|---|
| 1. Offer productization | MARKET, the BD strategist |
| 2. AI operations manager | OPS, the shared task list |
| 3. Multichannel outbound | OUTBOUND, signals and sequences |
| 4. ATS | TALENT, pipeline, people, companies |
| 5. Content | CONTENT, the planner and the voice |

## Positioning

The AI reads the agency's own rows through the caller's own session, so
row-level security is the boundary rather than a promise in a prompt. The OPS
surface has no web-search tool at all, which makes that boundary structural
instead of instructed.

The meter is the other half. Every model call reserves before the provider is
called and settles at the metered cost after, so a credit is a unit of real
money rather than a display number. A neighbouring product can copy the feature
list; it cannot copy an AI layer whose grounding and whose billing are both
enforced by the database.

## Operating Context

- One workspace is one agency. Every tenant table carries `org_id` and RLS is
  enabled in the same migration that creates the table.
- LinkedIn is connected per recruiter through a hosted wizard, under one central
  broker account, so a recruiter never sees or holds an API key.
- Model spend is bounded by a weekly allowance per workspace, visible to the
  user, and a run that dies is swept and refunded rather than silently charged.
- Publishing is scheduled inside Pulse and sent on a timer, because the
  transport has no scheduling of its own.

## Capabilities and Constraints

Confirmed and load-bearing:

- Any write touching two or more tables is a Postgres function called via RPC.
  The client library has no transactions, so sequential client-side writes are a
  bug even when they pass.
- Race guards are unique constraints with conflict handling, never
  check-then-insert.
- Migrations are applied before the code that reads them, and mirrored into the
  repository.
- A credit is one US cent of provider spend. Changing the model means changing
  the rate table in the same commit, or the meter lies.

Known absences that future work must not paper over:

- **LinkedIn publishing is text only.** A post with images attached publishes
  its text; media needs a different transport and is not built.
- **Engagement metrics only exist for posts Pulse sent**, and impressions are
  reported only for accounts that have LinkedIn analytics at all. A figure that
  was not reported is null, never zero.
- **Stage emails have no send transport**, and there is no per-user Google
  OAuth, so interview scheduling and calendar writes are not available.
- **The publisher's scheduler is deliberately not switched on** until a real
  post has been watched going out.

Undecided, and recorded rather than invented:

- **Price.** The AI cost model is written against a 299 USD monthly price; the
  roadmap names a 50 USD founding price. Those two numbers disagree in the
  repository today and nothing should quote either as settled.
- **The billing unit.** A change from credits to sessions is planned but not
  built, and nothing prints a session count until it is.

## Brand Commitments

- The product name is Pulse Recruit and it lives in exactly one file. A rename
  touches that file and nothing else.
- The BD strategist is named Reyhan, after RecruiterGTM's CEO, used deliberately
  as branding. He carries a real person's pronouns because he is a real person's
  name.
- No em dashes anywhere: in code, copy, comments or commit messages.
- No emoji in the interface. Icons are one library, 16px, stroke 1.5.

## Evidence on Hand

Real, and usable:

- A seeded demo workspace, Nortech Search, with a pipeline, tasks, companies and
  content that exercise every screen.
- A working LinkedIn publishing chain, verified against the live database inside
  a rolled back transaction before it shipped.

**Absent, and previously fabricated.** The ported marketing site carried six
five-star testimonials attributed by name to real RecruiterGTM clients, and the
claim "40+ Agencies on Pulse". None of it was true, and all of it was removed;
the testimonial layout ships with a slot that says it is waiting for real
quotes. There are no customer quotes, no verified agency count, no case studies
and no benchmark numbers. Nothing may reintroduce them, and no surface may imply
a customer base that has not been confirmed.

## Product Principles

1. **Never fabricate.** A research answer with no sources fails. A metric that
   was not reported renders as "not reported", never as zero. A missing provider
   key disables the surface and says so rather than accepting the question and
   apologising afterwards.
2. **Claim before the side effect.** The row lands before the email, the
   calendar event, or the paid call. Credits are reserved before the provider is
   called, and settled after.
3. **Density is the point.** These users scan. More on screen beats larger text,
   and empty space has to earn its place.
4. **Status is colour plus icon plus word, always all three.** It survives
   colour blindness, bad monitors, and a chip at 10px.
5. **Nothing lives behind hover, and nothing moves between screens.** Both fail
   this audience harder than they fail most.

## Accessibility & Inclusion

Established and enforced by the design contract rather than aspirational:

- Body text contrast 4.5:1 minimum.
- Base body 13px, never below 11px. No font weight below 400.
- Hit targets 28px minimum, 32px for primary actions.
- Status never encoded by colour alone.
- `prefers-reduced-motion` collapses every animation; the one ambient exception
  is the live pulse dot, and it reduces to a solid dot.
- Dark mode is opt-in and persisted, never a bare `prefers-color-scheme`,
  because a recruiter whose OS flips at sunset should not find the product
  changed underneath them mid-shift.
