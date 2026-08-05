# BD Strategist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Pillar 1's generic market chat with a fast, persistent, evidence-backed BD Strategist that learns visible agency strategy and recruiter feedback.

**Architecture:** Keep `chat_messages`, `begin_ask`, and `finish_ask` as the paid-run source of truth. Add tenant-scoped strategy memory and Exa response cache tables; pass selected memory into the existing server agent loop and resolve cache entries inside the existing MARKET tools. Replace the `/market` ChatPanel with a composed three-rail client workspace that consumes the same streamed endpoint and writes memory only through explicit server actions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase Postgres/RLS/RPC, OpenAI Chat Completions streaming with GPT-5, Exa REST API, Playwright specs written but not executed.

## Global Constraints

- Preserve the `begin_ask` reserve-before-provider and `finish_ask` meter-from-actual-cost contract in `AI.md` section 3.
- MARKET claims remain grounded in Exa. Visible memory informs strategy only and is never evidence for a market fact.
- `OPENAI_MODEL` remains server-only. The default changes from `gpt-4o` to `gpt-5`; update `pricing.ts` in the same task.
- One credit is one US cent. Cache hits have zero Exa cost because no provider call was made.
- RLS separates agency strategy from personal coaching. A recruiter can never read or mutate another recruiter's personal records.
- All dialogs, toasts, and the strategist surface use opaque sheets. No raw colour values outside `globals.css` or approved config tokens.
- Motion uses only transform and opacity plus solid colour, border, or shadow state-settle transitions. It is at most 220ms and respects `prefers-reduced-motion`.
- Do not run Playwright. Daniyal will check it himself. Write or update specs only.
- Run typecheck, lint, production build, `npm run verify:ai`, SQL advisor checks, and deployment smoke checks before claiming completion.
- Do not use em dashes in copy, comments, docs, or commit messages.

---

### Task 1: Add durable BD memory and per-org research cache

**Files:**
- Create: `supabase/migrations/20260805100000_bd_strategist_memory_and_cache.sql`
- Modify: `src/lib/supabase/types.ts`
- Test: `e2e/bd-strategist.spec.ts`

**Interfaces:**
- Produces `BDAgentMemoryRow`, `BDMemoryScope`, `BDMemoryKind`, `BDMemorySource`, and `BDResearchCacheRow`.
- Produces tables `bd_agent_memories` and `bd_research_cache`, both RLS-protected by `org_id`.
- Produces `sweep_bd_research_cache(uuid) returns integer` for bounded in-org expiry cleanup.

- [ ] **Step 1: Write the failing browser acceptance specification**

Create `e2e/bd-strategist.spec.ts` with a signed-in scenario that requires `Agency strategy`, `Your coaching context`, and `Add context`. It selects personal scope, saves `Focus on UK SaaS founders.`, and expects that text in the rail. Do not execute the test.

~~~ts
await page.getByRole("button", { name: "Add context" }).click();
await page.getByRole("dialog").getByLabel("Scope").selectOption("personal");
await page.getByRole("dialog").getByLabel("What should your strategist remember?").fill("Focus on UK SaaS founders.");
await page.getByRole("dialog").getByRole("button", { name: "Save context" }).click();
await expect(page.getByText("Focus on UK SaaS founders.")).toBeVisible();
~~~

- [ ] **Step 2: Apply the database migration before application code**

Create `bd_agent_memories` with UUID id, tenant id, `scope`, `user_id`, `kind`, title, body, source, optional `answer_id`, and timestamps. Use precise check constraints:

~~~sql
check ((scope = 'agency' and user_id is null) or (scope = 'personal' and user_id is not null)),
check (kind in ('positioning','ideal_client','buyer','territory','offer','qualification','preference','feedback')),
check (source in ('manual','feedback')),
check (char_length(trim(title)) between 1 and 80),
check (char_length(trim(body)) between 1 and 2000)
~~~

Enable RLS. Members can select agency rows and their own personal rows. Personal writes require `user_id = auth.uid()`; agency writes require `has_org_role(org_id, 'admin') or has_org_role(org_id, 'owner')`. Add a unique partial index on `(org_id, user_id, answer_id)` where `source = 'feedback' and answer_id is not null`.

Create `bd_research_cache` with `org_id`, opaque `cache_key`, `kind` of search or page, jsonb payload, creation and expiry timestamps, plus unique `(org_id, cache_key)` and an expiry index. Add member-only RLS policies and `sweep_bd_research_cache(target_org uuid)` that validates membership and deletes expired rows only in that org. Revoke direct anonymous execution; grant authenticated execution.

- [ ] **Step 3: Mirror the migration in TypeScript**

Add exact unions and rows in `src/lib/supabase/types.ts`:

~~~ts
export type BDMemoryScope = "agency" | "personal";
export type BDMemoryKind = "positioning" | "ideal_client" | "buyer" | "territory" | "offer" | "qualification" | "preference" | "feedback";
export type BDMemorySource = "manual" | "feedback";
export type BDAgentMemoryRow = { id: string; org_id: string; scope: BDMemoryScope; user_id: string | null; kind: BDMemoryKind; title: string; body: string; source: BDMemorySource; answer_id: string | null; created_at: string; updated_at: string; };
export type BDResearchCacheRow = { id: string; org_id: string; cache_key: string; kind: "search" | "page"; payload: unknown; created_at: string; expires_at: string; };
~~~

- [ ] **Step 4: Verify and commit the schema boundary**

Apply the migration through the configured Supabase migration path. Inspect table definitions, policies, and function privileges. Run schema advisor checks. Do not run Playwright.

~~~bash
git add supabase/migrations/20260805100000_bd_strategist_memory_and_cache.sql src/lib/supabase/types.ts e2e/bd-strategist.spec.ts
git commit -m "PLS-92: give the BD Strategist durable memory"
~~~

### Task 2: Read, mutate, and prompt with visible memory

**Files:**
- Create: `src/lib/server/ai/bd-memory.ts`
- Modify: `src/lib/data.ts`
- Modify: `src/lib/actions.ts`
- Modify: `src/app/api/ask/route.ts`
- Modify: `src/lib/server/ai/run.ts`
- Test: `e2e/bd-strategist.spec.ts`

**Interfaces:**
- Produces `getBDWorkspace()` returning `{ session, messages, credits, memories }`.
- Produces `memoryForPrompt(memories)` returning at most 18 safe visible memory records.
- Produces server actions `saveBDMemory`, `deleteBDMemory`, and `saveBDFeedback`.
- Extends `runAsk` with `agentMemory?: BDAgentMemoryRow[]`.

- [ ] **Step 1: Write failing acceptance flows for feedback**

Add an unexecuted completed-answer fixture scenario that opens `Off target`, saves `Prioritise healthcare buyers over general technology.`, and expects it under personal coaching. Verify a second feedback save replaces, rather than duplicates, the visible correction.

- [ ] **Step 2: Add bounded workspace reads and prompt selection**

Implement `getBDWorkspace`. Resolve session once, then in parallel fetch the latest 60 MARKET rows, credit ledger, agency memory, and the caller's personal memory. Preserve the existing stale-running display conversion. Never load another member's personal row.

Implement `memoryForPrompt`: agency first, then caller personal, max 18 rows, body truncated at 500 characters. Return labelled strings only, no database object or metadata. Discard empty or malformed values.

- [ ] **Step 3: Add validation-first mutation actions**

Implement these narrow inputs:

~~~ts
type SaveBDMemoryInput = { id?: string; scope: BDMemoryScope; kind: BDMemoryKind; title: string; body: string };
type SaveBDFeedbackInput = { answerId: string; rating: "useful" | "off_target"; note: string };
~~~

Validate title 1 to 80 and body 1 to 2000 after trimming. Agency writes reject non-admins. Update and delete fetch the record first and enforce the same ownership rule before writing.

`saveBDFeedback` verifies the target is a complete assistant MARKET message in the caller's org. It updates the existing `(org_id, auth.uid(), answer_id)` feedback record, inserts one otherwise, and re-reads then updates if the unique race guard fires. It saves the rating and explicit note in a personal `feedback` memory. It never invokes an AI provider.

- [ ] **Step 4: Provide strategic context to MARKET runs**

In `POST /api/ask`, read prompt memory before the credit claim. Pass it into `runAsk`. Extend the MARKET prompt with:

~~~text
This is agency strategy and recruiter coaching context. It tells you how to prioritise and advise. It is not evidence of market events and must never be cited as a source.

Write these plain-text sections:
WHAT CHANGED
WHY IT MATTERS
BEST NEXT MOVE
~~~

Keep every existing no-invention, source, and recency rule. Do not include hidden feedback, other-member personal records, or unpublished cache content as a source.

- [ ] **Step 5: Typecheck, lint, and commit**

~~~bash
npm run typecheck
npm run lint
git add src/lib/server/ai/bd-memory.ts src/lib/data.ts src/lib/actions.ts src/app/api/ask/route.ts src/lib/server/ai/run.ts e2e/bd-strategist.spec.ts
git commit -m "PLS-93: let the BD Strategist learn explicit context"
~~~

### Task 3: Cache Exa work without hiding freshness or cost

**Files:**
- Create: `src/lib/server/ai/research-cache.ts`
- Modify: `src/lib/server/ai/tools.ts`
- Modify: `src/lib/server/ai/run.ts`
- Test: `e2e/bd-strategist.spec.ts`

**Interfaces:**
- Produces `readResearchCache<T>`, `writeResearchCache<T>`, `makeSearchCacheKey`, and `makePageCacheKey`.
- Extends `ToolOutcome` with `cache: { searches: number; pageReads: number; newestAt: string | null }`.
- Stores `cached_searches`, `cached_page_reads`, and `research_freshness` in completed MARKET answer metadata.

- [ ] **Step 1: Write cache visibility specifications**

Add unexecuted scenarios that assert a seeded assistant answer with `cached_searches: 1` says `Recent research` and `No additional research credit used`; a normal answer says `Live research`.

- [ ] **Step 2: Implement the narrow cache adapter**

Use `node:crypto` SHA-256 for opaque cache keys. Search keys normalize lowercased trimmed query, category, and published-after filter. Page keys normalize canonical URL. `readResearchCache` returns null for absent, expired, malformed, or non-matching kind rows. `writeResearchCache` upserts payload, creation, and expiry with 24 hours for search and 12 hours for page reads. Cache read/write errors never become provider errors.

- [ ] **Step 3: Run Exa cache-first**

In `search_web`, return cached hits before `research.search`, add a `Recent research` step containing the cache age, subtract zero live search budget, and increment cache-search count. On a miss, call Exa exactly as today and attempt a cache write afterwards.

In `read_pages`, resolve cached URLs first, call Exa only for uncached URLs, merge results in request order, and charge only live pages. A date constraint newer than the cache entry bypasses that entry.

- [ ] **Step 4: Settle actual provider cost only**

Aggregate cache counts separately from `Usage` and include:

~~~ts
cached_searches: cached.searches,
cached_page_reads: cached.pageReads,
research_freshness: cached.searches + cached.pageReads > 0 ? "recent" : "live",
~~~

`creditCost(usage)` receives only live searches and page reads. The reservation ceiling remains unchanged and settlement refunds unused reservation honestly.

- [ ] **Step 5: Verify and commit**

~~~bash
npm run typecheck
npm run lint
npm run verify:ai
git add src/lib/server/ai/research-cache.ts src/lib/server/ai/tools.ts src/lib/server/ai/run.ts e2e/bd-strategist.spec.ts
git commit -m "PLS-94: reuse recent BD research honestly"
~~~

### Task 4: Move the engine to GPT-5 with truthful pricing

**Files:**
- Modify: `src/lib/server/ai/openai.ts`
- Modify: `src/lib/server/ai/pricing.ts`
- Modify: `AI.md`
- Modify: `ARCHITECTURE.md`
- Test: `e2e/bd-strategist.spec.ts`

**Interfaces:**
- `MODEL` defaults to `gpt-5` and remains overridable with `OPENAI_MODEL`.
- `MODEL_RATES.inputPerMillionUsd` is `1.25`; output remains `10`.

- [ ] **Step 1: Write the non-executed model-ready assertion**

Add a UI assertion that the engine labels its configured state `Frontier research model ready` without ever revealing a provider key or value.

- [ ] **Step 2: Change transport default and request shape**

Set `MODEL = process.env.OPENAI_MODEL ?? "gpt-5"`. Keep the streaming parser and 1,200 output-token ceiling. For models whose name begins `gpt-5`, add `reasoning_effort: "medium"`; omit it for legacy override models so configured fallbacks keep working.

- [ ] **Step 3: Update pricing and documentation in the same change**

Set input pricing to 1.25 and output pricing to 10. Update `AI.md` and `ARCHITECTURE.md` to name GPT-5 as the default, state that any env override requires a matching pricing update, and retain the platform-key boundary.

- [ ] **Step 4: Verify and commit**

~~~bash
npm run verify:ai
npm run typecheck
npm run lint
git add src/lib/server/ai/openai.ts src/lib/server/ai/pricing.ts AI.md ARCHITECTURE.md e2e/bd-strategist.spec.ts
git commit -m "PLS-95: put GPT-5 behind the BD Strategist"
~~~

### Task 5: Extract streamed-run state from the generic chat

**Files:**
- Create: `src/components/ai/use-ask-run.ts`
- Modify: `src/components/ai/chat-panel.tsx`
- Test: `e2e/bd-strategist.spec.ts`

**Interfaces:**
- Produces `useAskRun({ surface, onSettled })` returning `{ draft, setDraft, run, failure, ask, busy, composerRef }`.
- ChatPanel uses the hook without changing OPS behaviour.
- Strategist workspace reuses the same streaming, error, refresh, and focus semantics.

- [ ] **Step 1: Add a non-executed streamed-run scenario**

Ask a seeded suggestion and assert `Working out what to search` followed by a real source or a genuine failure. When refused, the query remains in the composer and no finished briefing appears.

- [ ] **Step 2: Extract, do not duplicate, the SSE lifecycle**

Move `LiveRun`, `EMPTY_RUN`, fetch, SSE decoding, failure mapping, router refresh, and focus restoration from ChatPanel into the hook. Preserve all current connection, refusal, dropped-stream, and settlement messages. `onSettled` runs only after the stream is settled.

- [ ] **Step 3: Keep OPS stable, then commit**

Make ChatPanel consume the hook with unchanged props and endpoint body.

~~~bash
npm run typecheck
npm run lint
git add src/components/ai/use-ask-run.ts src/components/ai/chat-panel.tsx e2e/bd-strategist.spec.ts
git commit -m "PLS-96: share the streamed research lifecycle"
~~~

### Task 6: Build the dense BD Strategist workspace and cosmetic overhaul

**Files:**
- Create: `src/components/bd/strategist-workspace.tsx`
- Create: `src/components/bd/strategy-rail.tsx`
- Create: `src/components/bd/coach-briefing.tsx`
- Create: `src/components/bd/intelligence-rail.tsx`
- Create: `src/components/bd/memory-dialog.tsx`
- Create: `src/lib/bd-briefing.ts`
- Modify: `src/app/(app)/market/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `DESIGN.md`
- Test: `e2e/bd-strategist.spec.ts`

**Interfaces:**
- `StrategistWorkspace` consumes messages, credits, memories, and configured state.
- `parseBDBriefing(body)` returns `{ changed, matters, nextMove, fallback }`.
- `MemoryDialog` accepts a memory, `allowAgency`, and explicit saved callback.

- [ ] **Step 1: Complete visual acceptance specifications**

Write non-executed assertions for visible `BD Strategist`, `Research brief`, `Agency strategy`, `Your coaching context`, `Intelligence`, `What changed`, `Best next move`, and `Useful`.

- [ ] **Step 2: Add resilient briefing parsing**

Split on exact case-insensitive lines `WHAT CHANGED`, `WHY IT MATTERS`, and `BEST NEXT MOVE`. Trim values. If any essential section is absent, render the original as `fallback` and never manufacture a conclusion. Existing SourceList remains responsible for linked citations.

- [ ] **Step 3: Compose the three ruled regions**

Change `/market/page.tsx` to call `getBDWorkspace()` and render StrategistWorkspace. StrategyRail shows compact wordmark, allowance, agency strategy, personal coaching, Add context, and deliberate empty intake cards. CoachBriefing shows suggestions, prompt, live RunLog, parsed finished briefs, sources, actual cost, and feedback. IntelligenceRail shows live or recent research, current next move, source count, current state, and fresh context instead of empty space.

Use one rounded outer shell with internal 1px rules. Stack regions on small screens without hiding content. Give every action an accessible name and a minimum 28px target.

- [ ] **Step 4: Implement opaque memory and feedback dialogs**

Use the existing Dialog. Scope, kind, title, and body are editable. Agency scope is disabled for non-admins. Close the dialog before calling an action, preserve input on error, and update local memory only on success. Off-target feedback requires an explanation; useful feedback accepts one optionally. Show success only after the server write succeeds.

- [ ] **Step 5: Add semantic colour and bounded motion**

In `globals.css`, define named research blue, indigo, and magenta tokens plus pale backgrounds. Add `.bd-workspace-enter`, `.bd-brief-card`, `.bd-signal-dot`, and `.bd-rail-accent`. Use 180ms entry and 140ms state settle only. Use category colours for edges, icons, and evidence surfaces, never statuses. Update DESIGN.md's category-accent rule to cover research themes.

- [ ] **Step 6: Run mechanical UI checks and commit**

~~~bash
npm run typecheck
npm run lint
rg -n "rounded-\[|#[0-9A-Fa-f]{3,8}|backdrop-filter|duration-\[[^]]*([3-9][0-9][0-9]|[1-9][0-9]{3,})" src/components/bd src/app/\(app\)/market src/app/globals.css
git add src/components/bd src/lib/bd-briefing.ts src/app/(app)/market/page.tsx src/app/globals.css DESIGN.md e2e/bd-strategist.spec.ts
git commit -m "PLS-97: give BD research a strategist workspace"
~~~

### Task 7: Final documentation, gates, and combined deployment

**Files:**
- Modify: `TICKETS.md`
- Modify: `AI.md`
- Modify: `ARCHITECTURE.md`
- Modify: `DEPLOY.md`
- Modify: `e2e/bd-strategist.spec.ts`

**Interfaces:**
- Documents PLS-92 through PLS-97 only after their gates pass.
- Documents default `OPENAI_MODEL=gpt-5` and no new public environment variable.

- [ ] **Step 1: Review browser specifications without running them**

Confirm coverage for memory create/edit/delete, agency access, feedback replacement, live and cached research labels, sources, configuration failure, and focus trap. Do not execute Playwright.

- [ ] **Step 2: Run application and schema gates**

~~~bash
npm run typecheck
npm run lint
npm run verify:ai
npm run build
~~~

Apply migration if needed. Run Supabase advisor checks. Repair every new security or performance finding. Confirm migration history matches the local migration folder.

- [ ] **Step 3: Deploy the combined pass**

Set production `OPENAI_MODEL=gpt-5` if absent. Do not log any secret. Deploy the committed branch. Verify `/market` answers, the unconfigured state is honest when a key is absent, and unauthenticated `/api/ask` returns 401. Do not send a paid research question and do not run Playwright.

- [ ] **Step 4: Record evidence and commit**

Update tickets and deployment docs with migration, gates, production URL, and the deliberate limitation that Daniyal must run one credited signed-in GPT-5 plus Exa research query to validate provider account access.

~~~bash
git add TICKETS.md AI.md ARCHITECTURE.md DEPLOY.md e2e/bd-strategist.spec.ts
git commit -m "PLS-98: verify and ship the BD Strategist"
~~~

## Plan self-review

- **Spec coverage:** Tasks 1 and 2 build visible durable memory and feedback. Task 3 makes repeated research fast without lying about freshness or cost. Task 4 upgrades the model with matching rates. Task 5 preserves one streaming transport. Task 6 delivers the full product and visual overhaul. Task 7 verifies and deploys it.
- **No-placeholder check:** Every task names files, interfaces, validation boundaries, concrete code shapes, and gates.
- **Type consistency:** Task 1 creates `BDAgentMemoryRow`; Task 2 exposes it to prompt and workspace reads; Task 3 writes cache metadata into existing `ChatRow.meta`; Task 5 shares streaming state; Task 6 consumes those interfaces.
