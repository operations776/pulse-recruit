# BD Strategist design

## Outcome

Pillar 1 becomes a persistent business-development strategist for a recruitment agency. It researches with Exa, reasons with a frontier GPT model, remembers the agency's stated strategy and coaching feedback, and turns research into a ranked, evidence-backed next move. It is not a general chatbot and it never pretends a cached or unsupported fact is current.

## Problem

The existing `/market` screen is a correctly metered research chat, but it has four product gaps:

1. It defaults to `gpt-4o`, despite the task needing frontier reasoning across research results.
2. It reads only a short chat history. It has no durable, visible strategy memory or feedback loop.
3. It renders a generic chat transcript, so a recruiter cannot see their commercial priorities, research method, or a clear next move in one place.
4. It loads the entire transcript and repeats live research for identical recent queries, which makes an already long research workflow feel slower than it needs to.

The existing pieces that must remain are strong: Exa is the grounding provider, sources are exposed under every answer, an empty research result is a failed run, and the `begin_ask` then `finish_ask` lifecycle protects the credit ledger.

## Product model

The page is named **BD Strategist** and has three simultaneous jobs.

1. **Coach.** It knows the agency's niche, territory, buyers, offer, qualification bar, and feedback. It makes the recommended move explicit rather than responding with a generic list.
2. **Research analyst.** It uses Exa before making market claims, records live evidence, makes recency visible, and groups results around opportunities rather than around raw links.
3. **Learning system.** A recruiter can add, edit, or remove the context that informs the agent. They can mark an answer useful or off-target and explain why. The feedback is stored visibly and is supplied to future runs.

There are two explicit memory layers:

| Layer | Owner | Examples | Agent access |
| --- | --- | --- | --- |
| Agency strategy | The organisation | Core niche, priority clients, buyer personas, differentiation, qualification bar | Every member in the organisation |
| Personal coaching | One recruiter | Territory, style preference, feedback on previous coaching, active focus | Only the author, plus their own BD Strategist runs |

This is deliberately not hidden model memory. Every memory has a label, source, owner, edit control, and delete control. A recruiter decides what the agent knows.

## Interaction and visual design

The view is a dense, single workspace with three ruled regions inside one responsive shell. It replaces the existing large page header and standalone chat panel.

### Strategy rail

The left rail is the agent's working brief. It shows a compact `BD STRATEGIST` lockup, the current market focus, the weekly credit meter, and a visible strategy-memory stack. Empty strategy context is an intentional intake card that asks for niche, target buyer, geography, and advantage. It does not leave a decorative blank panel.

The rail includes an `Add context` control that opens an opaque dialog. Members can edit or delete records they own, and can edit agency records when their role already permits organisation-wide settings. Personal records never appear in another member's surface.

### Coach workspace

The centre is the working conversation, recast as a research briefing rather than message bubbles. A prompt starts a run with a named research intention. During work it shows the concrete plan, searches, page reads, and sources as live evidence. When settled, the answer has four labelled parts:

- **What changed**: the grounded market finding.
- **Why it matters**: the commercial implication for this agency.
- **Best next move**: one specific action, written as advice rather than a vague conclusion.
- **Evidence**: linked sources, host and published date where available.

The model may write concise plain text within those labelled sections. The interface renders the sections, evidence, cost, and feedback controls as a briefing card. It does not ask a model to output fragile client-rendered JSON.

Suggestions become role-based starting moves such as finding hiring triggers, funding events, leadership gaps, and dormant Dream 100 accounts. They disappear once there is a transcript.

### Intelligence rail

The right rail makes the agent feel present without inventing a human persona. It shows the current run state, the latest coaching preference, research freshness, recent saved context, and the current next-move recommendation. After a run, this becomes a compact evidence ledger rather than dead whitespace.

The colour system remains semantically safe. Vermilion remains the single primary action. Teal means an active research run, amber means attention or stale evidence, and red is only an error. Additional blue, indigo, and magenta accents are category accents for research themes and evidence cards, never status. All status displays retain colour, icon, and word.

Motion is meaningful only: a 180ms workspace entry, 140ms card state settle, live run log progression, and 220ms toast entry. It uses opacity and small transforms, respects `prefers-reduced-motion`, and never delays research or controls.

Dialogs, toasts, and the briefing layer are opaque. Their shadow and the scrim establish depth, never translucency.

## Research and agent behaviour

### Model choice

The engine changes from the `gpt-4o` default to `gpt-5`, overridable through the existing server-only `OPENAI_MODEL`. GPT-5 supports the existing Chat Completions, streaming, and custom-tool path. The current public GPT-5 price is $1.25 per million input tokens and $10 per million output tokens, so `pricing.ts` changes in the same implementation to retain honest credit settlement. A configurable model is necessary because a later frontier model may offer a better cost-quality tradeoff, but the default for this deployment is GPT-5 rather than a stale hard-coded model.

The agent is prompted with selected visible memory before the recent conversation. Memory is a source of strategy and preference, not a source of market facts. It must still use Exa for every claim about a company, person, role, funding event, or date.

The system prompt makes every answer a recruiter-ready briefing: lead with the specific opportunity, then the commercial reason, one best next move, and the evidence. It forbids invented confidence, vague advice, unsupported named claims, and generic motivational language.

### Feedback loop

Each completed BD answer exposes `Useful` and `Off target` actions. Either action can include a short explanation. The feedback is saved to the personal coaching layer with a link to the answer that caused it. It is included in future prompts after explicit strategy records. Duplicate feedback from one user on one answer updates the existing row instead of adding contradictory copies.

A user can also save explicit strategy memory without an answer. This is the preferred path for stable facts such as specialism and market focus. The agent does not silently turn an answer into organisational truth.

### Freshness-aware caching

Exa search results are cached per organisation and exact normalized search request for 24 hours. Full page reads are cached per organisation and URL for 12 hours. A valid cache result is returned as evidence but the live run log states `Using recent research` with its age. Searches requesting a date later than the cache entry bypass the cache. Cache hits cost no Exa search or read credit because no provider call occurred.

The cache exists only to accelerate repeat research within an agency and to avoid charging twice for the same current information. It never crosses organisation boundaries. Cached evidence retains its source URL and original published date, and it is not described as a live search.

## Data model and access control

Two new tenant-scoped tables support the work.

### `bd_agent_memories`

Stores visible durable context.

| Column | Meaning |
| --- | --- |
| `id`, `org_id`, `created_at`, `updated_at` | Standard tenant identity and timestamps |
| `scope` | `agency` or `personal` |
| `user_id` | Required for `personal`, null for `agency` |
| `kind` | `positioning`, `ideal_client`, `buyer`, `territory`, `offer`, `qualification`, `preference`, or `feedback` |
| `title`, `body` | Human-readable label and the durable fact |
| `source` | `manual` or `feedback` |
| `answer_id` | Optional assistant chat-message reference for feedback provenance |

RLS allows all organisation members to read agency records and their own personal records. It allows personal records to be changed only by their owner. Agency strategy uses the existing organisation-admin policy. A check constraint enforces valid scope, kind, source, and user ownership. A unique partial index prevents multiple feedback records from one user for one answer.

### `bd_research_cache`

Stores per-organisation Exa response material. It has `org_id`, a normalized `cache_key`, `kind` (`search` or `page`), `payload`, `created_at`, and `expires_at`. Unique `(org_id, cache_key)` is the race guard. RLS allows members to read their organisation cache. All writes run under the user session, so a cache cannot bypass tenant scope. Expired rows are ignored and may be cleaned by a bounded sweep.

No existing chat, credit, or source table is replaced. `chat_messages` continues to be the authoritative record of every paid run, answer, source list, metadata, failure, and actual credit settlement.

## Performance rules

1. The workspace loads the latest 60 messages, not the unbounded history. The agent still receives only the latest six non-failed turns, plus durable memory.
2. Chat messages, credit ledger, strategy memory, and cache summary are requested in parallel under the already-cached session resolver.
3. Repeat exact research uses the cache before a provider call. Cache hits do not decrement the per-run Exa budget or add Exa cost.
4. The model agent loop keeps its bounded step and page-read ceiling. It may parallelize independent same-turn tool calls only after reserving the total budget before starting them.
5. Every response remains server streamed. No client polling, no artificial wait, and no optimistic statement that research completed before settlement.

## Error handling and truth rules

- Missing OpenAI or Exa key disables the composer with a concrete setup message. Nothing is reserved.
- An empty Exa result remains a failed BD answer and the full reservation is refunded.
- A cache read error falls back to a live provider call. A cache write error never prevents a live answer or silently changes credits.
- Invalid, overlong, or stale memory is excluded from the prompt. The UI reports failed saves and keeps user input intact.
- A feedback or memory write does not use an AI model, does not consume credits, and never revalidates an open dialog before it closes.
- The visible freshness label says `Live research`, `Recent research`, or `Evidence dated <date>` rather than implying all sources are current.

## Verification

The implementation adds focused unit and Playwright specifications for memory access, feedback replacement, cache expiry and bypass, credit accounting on cache hits, structured briefing rendering, and reduced-motion behaviour. Per Daniyal's standing instruction, Playwright specs are written but not executed. Typecheck, lint, production build, schema advisor checks, and a deployment smoke test remain required gates.

## Out of scope

- Autonomous scheduled monitoring and outbound alerts. Those are a later phase once the strategist is trusted.
- Sending messages, creating campaigns, or writing to an ATS from a research answer.
- Cross-agency research caching.
- Hidden behavioural profiling or implicit memory extracted from recruiter activity.
- Replacing Exa with a provider-owned web search tool. Exa remains the required research source for Pillar 1.
