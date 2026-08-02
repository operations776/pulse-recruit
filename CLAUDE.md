@AGENTS.md

# Pulse

Standalone ATS SaaS for recruitment agencies. Detail lives in `ARCHITECTURE.md` (system), `DESIGN.md` (UI contract), and `AI.md` (every model call, research call, and credit). This file is the operating manual only; keep it small, it is paid for in every session.

## Workflow

1. Pick a ticket from `TICKETS.md`. One ticket, one branch, small commits.
2. Every commit message starts with the ticket ID: `PLS-12: add candidate drawer`.
3. Before merge: `npm run build` must pass (production build, not dev), typecheck clean, Playwright green.
4. Any ticket touching a screen goes through the `design-review` skill and needs an explicit APPROVED.
5. Update `TICKETS.md` status in the same commit that finishes the ticket.

## Hard rules

- **RPC rule.** Any write touching two or more tables is a Postgres function called via RPC. No exceptions. supabase-js has no transactions, and sequential client-side writes are a bug even when they pass.
- **Race guards are unique constraints.** Insert with conflict handling. Never check-then-insert.
- **Claim before side effects.** Row first, then the email, calendar event, or paid API call.
- **Env var rule.** A new env var lands in the ARCHITECTURE.md table AND the Vercel config in the same commit as the code that reads it.
- **Claim before a paid call.** A model or research call spends RecruiterGTM's money, so `begin_ask` reserves credits before it and `finish_ask` settles at the metered cost after it. Never call a provider on a run that has not reserved.
- **Never fabricate an answer.** A MARKET run with no sources fails. A provider error fails and refunds. A missing key disables the composer and says so. See AI.md section 4.
- **Rates live in `pricing.ts` only.** Changing `OPENAI_MODEL` means changing `MODEL_RATES` in the same commit, or the credit meter lies.
- **RLS from birth.** A table's migration enables RLS and adds policies in that same migration, using `is_org_member` / `has_org_role`. Every tenant table carries `org_id`.
- **Migrations first.** Apply via the Supabase MCP, mirror the SQL into `supabase/migrations/`, deploy migrations before the code that needs them.
- **Branding lives in `src/config/brand.ts` only.** Never hardcode the product name anywhere else.
- **No em dashes** in code, copy, comments, or commit messages. Commas, colons, periods.
- **No emoji in UI.** Icons are Lucide, 16px, stroke 1.5.
- **Pin dependencies.** Test after any bump.

## Known bug classes, do not reintroduce

- **revalidatePath inside an open dialog.** Revalidating while a dialog or drawer is open remounts the tree under it and drops the user's input. Close the layer first, or use router.refresh scoped to the list, or update local state optimistically and reconcile.
- **Silent partial success.** Batch actions return honest counts. No fallback recipients, no swallowed errors.
- **Optional-feature coupling.** Core records are never created as a side effect of an optional flow.

## Commands

| Command | Use |
| --- | --- |
| `npm run dev` | Local dev |
| `npm run build` | Production build, the pre-merge gate |
| `npm run typecheck` | Types only |
| `npm run test:e2e` | Playwright |
| `node scripts/shot.mjs <url> <out.png>` | Screenshot for design review |

## Reference implementations

- `retainer-dashboard/` (outside this repo): domain logic only, never code or styling. Booking engine with routing questions, candidate board interactions, MCP server pattern, claim-before-send, insert-before-calendar.
- The old Pulse Recruit codebase is rejected. Do not open it.
- `saasroo/build-saas`: Firebase and Fireact stack, incompatible with ours. Read for the team-as-subscription-boundary and plans-as-one-config-file ideas only.
