# The AI engine

Binding companions: `ARCHITECTURE.md` (system), `DESIGN.md` (UI contract), `../ROADMAP.md` (what we build). This file governs every model call, every research call, and every credit.

Two surfaces run on one engine.

| Surface | Reads | Costs credits | Pillar |
| --- | --- | --- | --- |
| MARKET, the BD engine | The open web, via Exa | Yes | 1 |
| OPS, the ops manager | The org's own Postgres rows | Yes, at a much lower rate | 2 |

The difference between them is the tool set, not the component. Nothing else about them may diverge.

## 1. Keys are platform keys

Decided 2026-08-02 by Daniyal, and it overrides the earlier per-org wording in ARCHITECTURE.md.

One central RecruiterGTM OpenAI key and one central Exa key live in Vercel env. Every org spends against them. A recruiter never sees a key and never signs up with a provider. The product works the minute they sign in, which is the whole point for a non-tech-savvy agency founder.

The consequence is that **we pay for every question**, so credits are not a display meter. They are the cost control, and the ledger has to be exact.

Per-org keys stay in Supabase Vault for the tools that are genuinely the customer's own account and cannot be pooled: Instantly, HeyReach, Unipile, Beehiiv, and their own SMTP. Those keep the `set_integration_key` path already built. OpenAI and Exa are removed from that screen.

| Key | Kind | Where |
| --- | --- | --- |
| `OPENAI_API_KEY` | Platform | Vercel env, server only |
| `EXA_API_KEY` | Platform | Vercel env, server only |
| `PERPLEXITY_API_KEY` | Platform, later | Vercel env, server only |
| Instantly, HeyReach, Unipile, Beehiiv, SMTP | Per org | Supabase Vault via `set_integration_key` |

Neither platform key is ever prefixed `NEXT_PUBLIC_`. Both are read only from `src/lib/server/ai/`, which carries `import "server-only"`.

## 2. A credit is a unit of our money

**1 credit = 1 US cent of provider spend.** That is the whole definition, and it is what makes the meter honest: a recruiter spending 250 credits in a week has cost us about 2.50 USD against a 299 USD monthly price.

Rates live in exactly one file, `src/lib/server/ai/pricing.ts`. They are configured defaults, not gospel: confirm them against the current OpenAI and Exa pricing pages before the pilot takes real money, and change them in that one file when the providers move.

Cost is metered from what actually happened, never estimated after the fact:

- Model spend from the `usage` block the provider returns on the final chunk, input and output priced separately.
- Exa spend counted per search issued and per page read.
- Total rounded up to the next whole credit, so we never undercharge ourselves into a loss.

## 3. Claim before the call, settle after it

ARCHITECTURE.md law 3 applied to a paid API. The sequence is fixed and there is no variant of it:

1. **Reserve.** `begin_ask` runs before any provider call. In one transaction it inserts the user message, inserts the assistant message with `status = 'running'`, writes a `credit_events` reservation row, and adds the reservation to `credit_ledger.reserved_this_week`. If the org cannot afford the reservation it returns null and no provider call is ever made.
2. **Run.** The engine calls OpenAI and Exa. The reservation is already banked, so a crash here costs the org their reservation and not our margin, and step 4 gives it back.
3. **Settle.** `finish_ask` writes the answer body and sources, converts the reservation into real spend at the metered cost, refunds the difference, and sets `status = 'complete'`.
4. **Sweep.** `sweep_stalled_asks` finds any message still `running` after 10 minutes, marks it `failed`, and refunds the whole reservation. This is law 6, and it is the only thing standing between a Vercel timeout and a customer permanently losing credits they did not spend.

Reservation ceilings are per surface and live in `pricing.ts`. A run that would exceed its ceiling stops and answers with what it has, rather than billing past the reservation.

Available credits are `weekly_allowance - used_this_week - reserved_this_week`. A screen that shows anything else is wrong.

## 4. Failure is reported, never invented

Law 9, restated for a model:

- No provider key configured: the surface says so plainly and the composer is disabled. It does not accept a question, reserve credits, and then apologise.
- A provider error: the assistant message is marked `failed`, carries the real reason, the reservation is refunded in full, and the transcript shows the failure instead of a fabricated answer.
- Allowance spent: refused before the run, the question stays in the box, and the toast names the reset date.
- An answer that found nothing says it found nothing. A MARKET answer with no sources is a failed answer, not a confident one.

The model is never the last word on whether something happened. Tool results are.

## 5. Grounding

**MARKET may not state a fact it did not read.** The system prompt requires every claim to trace to a tool result, and the answer carries the sources it used. An answer built from zero searches is refused at the engine level, not asked for politely in the prompt.

**OPS may not read the open web.** It has no search tool at all, so the boundary is structural rather than instructed. Its tools are scoped reads against the caller's own Supabase session, so RLS is the backstop: a tool cannot return another org's rows even if the model asks for them.

Both surfaces run with the user's session client, never a service role. There is no service-role key in this codebase and the AI engine does not introduce one.

## 6. OPS can act, within one boundary

The ops manager may create tasks. `tasks.origin` already distinguishes `claude` from `manual` and the task list already renders the difference, so this closes a loop the schema was built for.

It may not move a candidate, send anything, or write to any other table. Every other tool is a read. When the model wants a change it does not own, it writes a task saying so and the recruiter decides.

## 7. Streaming is a correctness feature, not a flourish

A research run takes 20 to 60 seconds. A screen that shows nothing for a minute reads as broken, and a user who reloads mid-run is why step 4 exists.

`POST /api/ask` streams server-sent events: `status` for the phase, `source` as each one is found, `delta` for answer text, `done` with the settled credit cost, `error` with a real reason. The transcript shows the searches as they are issued, so the work is visible while it happens and auditable after it.

## 8. Adding a provider

Perplexity is next, and the shape is fixed so it stays a small change: a provider module under `src/lib/server/ai/providers/` exposing the same search interface as `exa.ts`, a rate added to `pricing.ts`, and a line in the table in section 1. No screen changes, no schema changes. If adding a provider needs anything else, the boundary is wrong.
