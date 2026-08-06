# Pulse Recruit

The recruitment agency operating system, by [RecruiterGTM](https://recruitergtm.com).

An ATS and GTM platform built around one idea: a recruiter should not have to
go looking for what needs them today. Five pillars in one shell.

| Pillar | What it does |
| --- | --- |
| **Market** | The BD Strategist. Researches your market with live web search, remembers your strategy, and names the one move worth making, with sources under every claim. |
| **Ops** | The morning brief and the task list. Reads your own pipeline and says what moved, what stalled, and what needs you. |
| **Outbound** | Signals, sequences and mailboxes. |
| **Talent** | The ATS. Roles, a drag-and-drop pipeline, candidates, companies, shortlists, public application links. |
| **Content** | A planner that writes LinkedIn posts in your voice and publishes them on schedule. |

## Stack

Next.js 16 (App Router, React 19, TypeScript) · Tailwind v4 · Supabase
(Postgres, Auth, Storage, Vault) · OpenAI · Exa · Unipile · Vercel.

Two rules explain most of the architecture:

- **Every tenant table has `org_id` and RLS from its first migration.** RLS is
  the security boundary, not the application code. A missing policy shows up as
  empty data, never as another agency's rows.
- **Any write touching two or more tables is a Postgres function called via
  RPC.** supabase-js has no transactions, so sequential client-side writes are
  a bug even when they appear to work.

AI spend is metered rather than estimated: one credit is one US cent of
provider spend, reserved before a provider is called and settled at the real
cost after. A run that finds nothing fails and refunds rather than inventing an
answer.

## The docs are the spec

These are binding, not background reading:

| File | Governs |
| --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Tenancy, the ten data-layer laws, module map, env vars |
| [`DESIGN.md`](DESIGN.md) | The UI contract: tokens, type, spacing, motion, the enforceable rules |
| [`AI.md`](AI.md) | Every model call, research call and credit |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Branch, PR, gates, migration order, deploy, rollback |
| [`DEPLOY.md`](DEPLOY.md) | The deploy runbook and the publisher |
| [`CLAUDE.md`](CLAUDE.md) | Operating manual and the hard rules |
| [`TICKETS.md`](TICKETS.md) | What shipped, and what was learned shipping it |

## Local setup

```bash
npm ci
cp .env.example .env.local     # fill in the publishable Supabase pair
npm run dev
```

```bash
npm run typecheck    # types only
npm run lint         # eslint
npm run build        # production build, the real pre-merge gate
npm run test:e2e     # Playwright
npm run verify:ai    # one real call to each AI provider, priced with the live rates
```

Every env var, what it is for and whether it is optional, is in the table in
`ARCHITECTURE.md`. Secrets live in Vercel, never in a tracked file.

## Deploying

`main` is production and deploys automatically on merge. Every PR gets a Vercel
preview. Migrations are applied to Supabase **before** the code that needs them.
The full contract is in `CONTRIBUTING.md`.
