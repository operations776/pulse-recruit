# Working on Pulse Recruit

Repo: `operations776/pulse-recruit` (private)
Production: Vercel, `main` is the deployed branch

This file is the deploy contract. `CLAUDE.md` is the operating manual and
`ARCHITECTURE.md`, `DESIGN.md` and `AI.md` are the binding specs.

## The loop

```
branch  →  commit  →  push  →  PR  →  CI green  →  merge to main  →  Vercel deploys
```

1. **Branch off main.** One ticket, one branch: `git switch -c pls-104-whatever`.
2. **Commit small, with the ticket ID first.** `PLS-104: reskin the pipeline board`.
3. **Push.** `git push -u origin pls-104-whatever`.
4. **Open a PR.** `gh pr create --fill`.
5. **CI must be green.** Typecheck, lint, and a production build. A red tick is
   a blocked merge, not a suggestion.
6. **Merge.** Vercel deploys `main` to production automatically.

Never `git push origin main` directly. The PR is where the gates live and a
direct push skips them.

### Preview deploys

Every PR gets one. Vercel comments the URL on the PR:

```
https://pulse-git-<branch>-operations-3595s-projects.vercel.app
```

**They are behind Vercel SSO.** Opening one in a browser signed in to the
Vercel account works; `curl` gets a 302 to `vercel.com/sso-api`, which is
deployment protection doing its job, not a broken build. To share a preview
with somebody outside the team, turn off Deployment Protection for previews in
Project Settings, or send them a protection bypass link.

This only started working when the repo went public on 2026-08-06. While it
was private, Vercel refused every PR build: commits here are authored as
`i220753-bot <daniyalaziz184@gmail.com>`, which GitHub attributes to
`Daniyal1234-alt`, the Vercel team belongs to `operations776`, and previews on
a private repo need a Pro seat. If the repo ever goes private again, previews
stop and the fix is to either correct the commit identity or buy a Pro seat.

Production was never affected by any of that: `main` deploys, and a manual
`npx vercel deploy --prod` works because it authenticates as the account
rather than the commit author.

## What CI checks, and what it does not

| Gate | Where | Why |
| --- | --- | --- |
| `npm run typecheck` | CI | Types only, no emit |
| `npm run lint` | CI | ESLint |
| `npm run build` | CI | Production build, the real gate |
| New migrations | CI | Warns on the PR so law 10 is not missed |
| Playwright | **Not in CI** | Daniyal checks the browser himself. See below. |
| `design-review` skill | **Local, before merge** | Any PR touching a screen |

**Playwright is deliberately not in CI.** The specs are written and kept
honest, but running them needs a live app signed in as a seeded user against
the shared Supabase project. Putting those credentials into Actions to earn a
green tick would let any PR from any branch write to the real database. Run
them locally with `npm run test:e2e` when you want them.

**Any PR that adds or changes a screen goes through the `design-review` skill
first and needs an explicit APPROVED.** That gate is not automatable: it
screenshots the production build and judges the image. It has caught real bugs
that typecheck, lint and build all passed straight through, including a
transcript rendering every answer above its own question.

## Migrations ship before the code that needs them

Law 10. The order is fixed:

1. Apply the migration to Supabase (via the Supabase MCP, or the SQL editor).
2. Mirror the exact SQL into `supabase/migrations/` in the same PR.
3. Merge, which deploys the code that depends on it.

Deploying code first means production runs against a schema that does not have
the column yet. CI warns on any PR that adds a migration file so this is hard
to forget.

## Environment variables

Two places, and they must agree:

- **Vercel** → Project → Settings → Environment Variables. This is what
  production actually reads.
- **`ARCHITECTURE.md`** → the env table. This is what the next person reads.

A new env var lands in both in the same commit as the code that reads it. The
full list, what each one is for, and which are optional is in
`ARCHITECTURE.md`; the deploy runbook is in `DEPLOY.md`.

`.env.local` is gitignored and holds only the publishable Supabase pair for
local work. Secrets never go in a file that git can see.

CI needs the publishable pair as repo secrets (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) because `next build` reads them at
module scope. They are safe there: RLS is the boundary, not the key. **The
service role key is never a CI secret and never in a build.**

## Rolling back

Vercel keeps every deployment. Promote the last good one from the dashboard, or:

```bash
npx vercel rollback <deployment-url>
```

A rollback reverts code, never the database. If the bad deploy shipped a
migration, write a forward migration that undoes it; do not hand-edit the
schema.

## Local setup

```bash
npm ci
cp .env.example .env.local      # fill in the publishable Supabase pair
npm run dev
```

`npm run verify:ai` makes one small real call to OpenAI and Exa and prices it
with the same rates the product bills with. Run it after changing
`OPENAI_MODEL` or any rate in `pricing.ts`.
