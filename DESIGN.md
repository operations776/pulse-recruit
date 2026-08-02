# Pulse Design Contract

Every screen is judged against this file by the design-review skill. A screen that violates it does not merge, whatever else it does well. Bar: Linear and Attio class. Clean, dense, fast, premium. Light mode first.

## Direction

Pulse is the place a recruitment agency founder checks the vital signs of their business every morning. The UI language follows that: calm clinical surfaces, precise typography, and one living element, the pulse dot, that shows where the pipeline is alive and where it has gone cold. Everything else stays quiet so that signal reads instantly.

Three non-negotiables inherited from the kickoff brief:

- No emoji in the UI. Icons are Lucide, 16px, stroke 1.5.
- No gradients as decoration. A gradient may only appear if it encodes data.
- Generous whitespace discipline: dense INSIDE data surfaces (tables, board cards), generous AROUND them (page gutters, section gaps). Density is for data, not for chrome.

## Color tokens

Defined once in `src/app/globals.css` under `@theme`. Components never use raw hex.

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#F7F7F8` | Page background behind surfaces |
| `surface` | `#FFFFFF` | Cards, tables, board columns, drawer |
| `ink-900` | `#16181D` | Primary text, headings |
| `ink-600` | `#5A6070` | Secondary text, labels |
| `ink-400` | `#9AA0AE` | Muted text, placeholders, timestamps |
| `line` | `#E4E6EB` | Standard 1px borders |
| `line-soft` | `#EEF0F3` | Row dividers, subtle separation |
| `pulse-600` | `#0C8A66` | Accent: primary buttons, active nav, live pulse dot |
| `pulse-700` | `#0A6F53` | Accent hover and pressed |
| `pulse-50` | `#EAF7F2` | Accent tint: selected rows, active chips |
| `amber-500` | `#B45309` | Warning, the stale (cold) state |
| `red-500` | `#D92D20` | Destructive, errors |
| `blue-500` | `#3B6FE0` | Informational only |

Rules: one accent. `pulse-600` is the only saturated color allowed in chrome. Semantic colors appear only when they mean something (state, warning, destruction), never for variety. Borders do the separation work; shadows are reserved for floating layers (popover, drawer, dialog) with a single elevation style.

## Typography

Geist Sans for UI, Geist Mono for data literals (counts, dates, salaries, IDs, emails). Both load via `next/font`, zero external requests. Personality comes from weight contrast and micro-labels, not from a display face: this is an instrument panel, not a poster.

| Role | Size / line height | Weight | Notes |
| --- | --- | --- | --- |
| Page title | 20 / 28 | 590 | One per screen, tracking -0.01em |
| Section title | 16 / 24 | 590 | |
| Body | 14 / 20 | 450 | Default UI text |
| Dense body | 13 / 18 | 450 | Table cells, board cards |
| Micro label | 11 / 16 | 550 | Uppercase, tracking +0.06em, ink-600. Used for column headers, stage names, field labels |
| Data literal | 13 / 18 | 450 | Geist Mono, tabular numbers, ink-600 |
| Metric | 24 / 30 | 590 | Geist Mono, dashboard numbers only |

No font sizes outside this scale. No italic. No text over 20px inside the app shell.

## Spacing, radius, elevation

- 4px grid. Allowed spacings: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Control height 32px (buttons, inputs, selects). Compact controls 28px. Table rows 40px. Board cards: content-sized, 12px padding.
- Page gutter 24px (32px above 1440px viewport). Gap between major sections 24px. Gap inside data surfaces 8px or 12px.
- Radius: 6px controls and chips, 8px cards, 10px drawer and dialog, 999px pills and avatars.
- Elevation: `shadow-pop` `0 4px 16px rgb(22 24 29 / 0.08), 0 0 0 1px rgb(22 24 29 / 0.04)` for floating layers only. Flat surfaces get borders, not shadows.

## The signature: pulse dot

The one memorable element. A 6px dot on every candidate card, row, and org header encoding activity freshness:

- **Live** (activity within 48h): solid `pulse-600`, breathing animation (scale 1 to 1.35, 2.4s ease-in-out loop). With `prefers-reduced-motion`: static with a 2px `pulse-50` ring.
- **Warm** (2 to 7 days): solid `ink-400`, no animation.
- **Cold** (over 7 days): hollow, 1.5px `amber-500` ring. This is the state the product exists to eliminate.

Next to the dot, time since last activity in Geist Mono (`3h`, `2d`, `12d`). The pulse dot is the ONLY ambient animation in the product. Nothing else moves uninvited.

## Motion

- Transitions: 150ms ease-out, opacity and transform only. Drawer slides 200ms.
- Optimistic UI on board drags: the card moves instantly, reconciles in the background, snaps back with a toast on failure.
- No skeleton shimmer theater. Target real data fast (see speed budget in ARCHITECTURE.md); use plain muted placeholders only past 300ms.
- Respect `prefers-reduced-motion` everywhere.

## Interaction rules

- Click-to-copy on every email, phone, and LinkedIn URL: hover reveals a copy affordance, click copies, confirmation is a 900ms inline "Copied" swap, not a toast.
- Hover prefetch on all internal links. Board drag at 60fps.
- Keyboard: visible focus ring (`2px pulse-600 offset 2px`) on every interactive element. Esc closes topmost layer. Enter submits. `/` focuses search.
- Destructive actions confirm with a dialog naming the object ("Delete Sarah Chen?"), never a bare "Are you sure?".
- Buttons state exactly what they do: "Add candidate", "Move to Interview", never "Submit", "OK".
- Empty states are invitations: one sentence of direction plus the primary action. Errors say what happened and what to do, no apologies, no vagueness.
- Copy: sentence case everywhere except micro labels. Plain verbs. No filler, no exclamation marks, no em dashes.

## Stage colors (pipeline)

Muted chip per stage: 11px micro label on a tinted background. Sourced `ink` neutral, Contacted `blue` tint, Replied `violet #6D5BD0` tint, Interview `pulse` tint, Offer `amber` tint, Placed solid `pulse-600` with white text, Rejected neutral strikethrough. Tints are 8% opacity of the hue on white. Placed is the only solid chip: it is the paycheck.

## Component inventory

Primitives in `src/components/ui/`, composites in `src/components/`. Build only when a ticket needs them.

Primitives: Button (primary, secondary, ghost, danger; md 32 and sm 28), IconButton, Input, Select, Checkbox, Textarea, Badge (stage and generic), Avatar (initials), Tooltip, DropdownMenu, Dialog, Drawer (right, 480px), Tabs, Toast, Kbd, PulseDot, CopyField, EmptyState.

Composites: AppShell (sidebar 240px + topbar 48px), PageHeader (title, count in mono, actions right), DataTable (40px rows, sticky header, micro-label columns), Board (columns 280px, wip count in header), CandidateCard, CandidateDrawer, FilterBar, SearchInput.

## Review checklist (what design-review judges)

1. Only token colors and scale sizes used, no raw hex, no off-scale font sizes or spacing.
2. One accent color on screen; semantic color only with meaning.
3. Density right way around: dense data, quiet chrome, gutters intact.
4. No emoji, no decorative gradients, no shadow on flat surfaces.
5. Micro labels uppercase 11px on tables, columns, and field groups.
6. Data literals in mono with tabular numbers.
7. Focus visible on every interactive element; Esc and Enter behave.
8. Copy follows the interaction rules: exact verbs, sentence case, no filler.
9. Pulse dot states correct where candidates render.
10. Feels fast: no layout shift, no uninvited motion, optimistic where it matters.
