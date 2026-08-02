# Pulse Design Contract

Every screen is judged against this file by the design-review skill. A screen that violates it does not merge, whatever else it does well.

References: the app interior follows the deep-green multi-panel ATS reference Daniyal supplied. The marketing site follows gethirex.com structurally, not in palette. Captures live in `.design-shots/hirex/`.

## The problem this file exists to solve

Version one of this contract produced a screen that was clean and completely characterless: grey chrome, initials in grey circles, one flat accent, boxes in a row. It read as generated. Density without personality is not the bar. Pulse should feel like a product a specific team built with a specific opinion, warm enough to sit in all day and sharp enough to trust with a placement worth thousands.

Personality here comes from four decisions, applied consistently:

1. **Deep green chrome.** The top bar and rail are near-black forest green, not grey. The product has a color identity the moment it loads.
2. **People look like people.** Photo avatars wherever a person appears, with a colored initials fallback. Never a grey circle.
3. **Every card earns its space.** A candidate card carries the person, their contact, their activity counts, and their match score. Not a name and a chip.
4. **A controlled multi-hue palette.** Six identity hues used for categorization (pipelines, stages, sources, chart series). Color carries meaning and makes the product memorable. It is never decoration.

## Two surfaces

| | Marketing (`(marketing)` routes) | Product (`(app)` routes) |
| --- | --- | --- |
| Job | Convince | Operate |
| Density | Generous, centered, one idea per section | Dense, multi-panel, information first |
| Display type | Bricolage Grotesque, large, tight | Plus Jakarta Sans, restrained |
| Gradients | Allowed, on headline accent words and section washes | Forbidden except inside data visualization |
| Chrome | Light, airy | Deep forest green |

Both surfaces share the same tokens, radii, and component primitives. A user should not feel they changed products when they sign in.

## Color tokens

Defined once in `src/app/globals.css` under `@theme`. Components never use raw hex.

### Brand

| Token | Hex | Use |
| --- | --- | --- |
| `forest-900` | `#0C3225` | Top bar, deep chrome, dark CTA band |
| `forest-800` | `#10402F` | Chrome hover, rail active background |
| `forest-700` | `#14543C` | Chrome borders, muted dark surfaces |
| `emerald-600` | `#12A150` | Primary action, active tab, brand accent |
| `emerald-700` | `#0E8543` | Primary hover and pressed |
| `emerald-500` | `#22C55E` | Live pulse dot, positive match score |
| `emerald-50` | `#E9F8EF` | Selected row, active chip, tint |

### Identity palette

Six hues for categorization only: pipeline and workspace squares, stage identity, source tags, chart series, avatar fallbacks. Assigned deterministically from a stable key so the same pipeline is always the same color. Never picked for visual variety.

| Token | Hex |
| --- | --- |
| `hue-coral` | `#FF6B5A` |
| `hue-amber` | `#F5A524` |
| `hue-indigo` | `#5B5BD6` |
| `hue-violet` | `#8B5CF6` |
| `hue-sky` | `#2E90FA` |
| `hue-pink` | `#EE46BC` |

Each is used at full strength for icons and dots, and at 10 percent on white for tinted backgrounds.

### Neutrals and semantic

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#F6F7F8` | Page background |
| `surface` | `#FFFFFF` | Cards, panels, table |
| `ink-900` | `#111827` | Primary text |
| `ink-600` | `#5B6472` | Secondary text |
| `ink-400` | `#98A1AE` | Muted, placeholder, timestamp |
| `line` | `#E5E7EB` | Borders |
| `line-soft` | `#F0F1F3` | Row dividers |
| `warn-500` | `#B45309` | Warning, cold state |
| `danger-500` | `#D92D20` | Destructive |

## Typography

Three faces, all self-hosted through `next/font`, zero external requests.

- **Bricolage Grotesque**: marketing display and product page titles. Characterful by design; this is where the personality lives. Never below 18px, never for body copy.
- **Plus Jakarta Sans**: all product UI. Friendly geometric, holds up at 12 and 13px.
- **JetBrains Mono**: data literals only. Counts, dates, salaries, IDs, emails, percentages.

| Role | Size / line height | Face, weight | Notes |
| --- | --- | --- | --- |
| Marketing hero | 60 / 62 | Bricolage 700 | Tracking -0.03em. Two-tone, see below |
| Marketing section | 40 / 46 | Bricolage 700 | Tracking -0.02em |
| Page title | 22 / 28 | Bricolage 600 | One per screen |
| Section title | 16 / 22 | Jakarta 600 | |
| Card title | 15 / 20 | Jakarta 600 | Card and empty-state headings |
| Metric | 24 / 30 | JetBrains 600 | Dashboard and stat-tile numbers only |
| Body | 14 / 20 | Jakarta 450 | Default |
| Dense body | 13 / 18 | Jakarta 450 | Cards, table cells |
| Caption | 12 / 16 | Jakarta 500 | Card metadata, helper text |
| Micro label | 11 / 14 | Jakarta 600 | Uppercase, tracking +0.05em |
| Data literal | 13 / 18 | JetBrains 450 | Tabular numbers |

No sizes outside this scale. No italic except the marketing accent word.

### The two-tone headline (marketing signature)

Marketing headlines are black except one word or short phrase, which carries a gradient and may be italic. One accent per headline, never two. Two gradients only:

- `grad-fresh`: `linear-gradient(96deg, #12A150, #22C55E 45%, #A3E635)`
- `grad-warm`: `linear-gradient(96deg, #F5A524, #FF6B5A 55%, #EE46BC)`

Applied with `background-clip: text`. Gradients appear nowhere else on marketing except a soft section wash behind product frames, and nowhere at all in the product.

### Eyebrow pill

Above every marketing section title: a small rounded-full pill, `surface` background, 1px `line` border, containing a 12px identity-hue icon and 11px uppercase micro label. This is the structural device carried from the reference, and it earns its place by naming the section, not decorating it.

## Spacing, radius, elevation

- 4px grid. Allowed: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96.
- Control height 34px, compact 28px. Table rows 44px. Candidate card padding 12px.
- Page gutter 24px, marketing gutter 24px with content capped at 1200px.
- Radius: 8px controls, 12px cards and panels, 16px marketing frames and modals, 999px pills, avatars, and primary buttons.
- Elevation, two levels only:
  - `shadow-card`: `0 1px 2px rgb(17 24 39 / 0.06)` on cards.
  - `shadow-pop`: `0 8px 28px rgb(17 24 39 / 0.14)` on floating layers and the bulk action bar.
- Flat panels use borders, not shadows.

## App shell anatomy

Three vertical zones, left to right, under one full-width top bar.

1. **Top bar**, 52px, `forest-900`. Logo mark, workspace switcher with chevron, then right-aligned: help link, notifications with count badge, user avatar. All text and icons white or white at 70 percent.
2. **Icon rail**, 56px, `surface`, right border. Top: workspace squares, 32px rounded-8 tiles in identity hues carrying the workspace initial, active one ringed. Then a 32px add tile. Below a divider: primary navigation as 20px icons, active one on an `emerald-50` tile. Bottom-anchored: settings and help.
3. **List panel**, 264px, `surface`, right border, collapsible. Panel title with icon and collapse control, search field, then the scoped list. Every list row carries a 6px status dot in its identity hue, a title, and a mono code.
4. **Main**, `canvas`. Breadcrumb, page title, meta row, tabs, then content.

The meta row sits under the title as label-and-value pairs separated by 24px: label in `ink-600` caption, value in `ink-900`. Assignee avatars overlap at -8px with an add button at the end.

## Component inventory

Primitives in `src/components/ui/`, composites in `src/components/`. Build only when a ticket needs them.

**Primitives**: Button (primary, secondary, ghost, danger, all pill radius), IconButton, Input, SearchInput, Select, Checkbox, Textarea, Badge, Chip, Avatar, AvatarStack, Tooltip, DropdownMenu, Dialog, Drawer, Tabs, Toast, Kbd, StatusDot, PulseDot, EyebrowPill, CopyField, EmptyState, Breadcrumb.

**Composites**: TopBar, IconRail, ListPanel, PageHeader, MetaRow, DataTable, Board, BoardColumn, CandidateCard, MatchScore, MetricRow, CandidateDrawer, BulkActionBar, FilterBar.

### Avatar

Photo when the record has one, at 999px radius. No photo means a tinted circle in the identity hue derived from the person's id, carrying two-letter initials in that hue at 600 weight. Never grey. Sizes 24, 32, 40.

### MatchScore

Thumbs-up icon plus a mono percentage. Above 85 is `emerald-600`, 60 to 85 is `ink-600`, below 60 is `ink-400`. It is a score, never a progress bar, and never shown without a value.

### MetricRow

The bottom row of a candidate card: up to four 12px icons each followed by a mono count, for emails, notes, documents, and interviews. A zero count renders as a mono double-dash, never as `0`, so the eye skips it.

### PulseDot

The activity signature, retained from version one because it is the one thing that shows a pipeline going cold. 6px, on candidate cards and rows, beside a mono relative time.

- Live, under 48h: `emerald-500`, breathing 2.4s ease-in-out.
- Warm, 2 to 7 days: `ink-400`, static.
- Cold, over 7 days: hollow 1.5px `warn-500` ring.

With `prefers-reduced-motion`, live renders static with an `emerald-50` ring. This is the only ambient animation in the product.

### BulkActionBar

On selection, a `forest-900` pill floats 24px above the bottom edge, centered on the content area, `shadow-pop`. It shows the selection count, then the actions as icon-and-label pairs, destructive ones in a lighter red, then a right-aligned `esc to deselect` hint in mono. It slides up 200ms and never covers the last row: the board pads its bottom while active.

## Motion

- Transitions 150ms ease-out, opacity and transform only. Drawer and bulk bar 200ms.
- Optimistic board drags: the card moves instantly, reconciles behind, snaps back with a toast on failure.
- Marketing sections reveal once on scroll, 400ms, 12px rise, never on repeat.
- No skeleton shimmer. Real data fast beats a fake loading state.
- `prefers-reduced-motion` respected everywhere.

## Interaction rules

- Click-to-copy on every email, phone, and LinkedIn URL. Hover reveals the affordance, click swaps to `Copied` inline for 900ms. No toast.
- Hover prefetch on internal links. Board drag at 60fps.
- Visible focus ring, 2px `emerald-600` at 2px offset, on every interactive element.
- Esc closes the topmost layer and clears selection. Enter submits. `/` focuses search.
- Destructive dialogs name the object: `Delete Sarah Chen?`, never `Are you sure?`.
- Buttons say what they do: `Add candidate`, `Move to Interview`. Never `Submit` or `OK`.
- Empty states are invitations: one line of direction plus the primary action.
- Errors say what happened and what to do. No apologies, no vagueness.
- Sentence case everywhere except micro labels. No filler, no exclamation marks, no em dashes anywhere.

## Review checklist

The design-review skill walks these in order.

1. Token colors and scale sizes only. No raw hex, no off-scale type or spacing.
2. Chrome is `forest-900`, primary action is `emerald-600`. Identity hues appear only where they categorize.
3. No grey initials circles. Avatars are photos or hue-tinted initials.
4. Cards carry real substance: person, contact, metrics, score. No thin cards.
5. Product surfaces have zero gradients. Marketing has at most one accent word per headline.
6. Micro labels uppercase 11px. Data literals in JetBrains Mono with tabular numbers.
7. Bricolage appears on display and page titles only, never in body or dense UI.
8. Focus visible everywhere. Esc, Enter, and `/` behave.
9. Pulse dot states correct wherever candidates render.
10. Feels fast: no layout shift, no uninvited motion, optimistic where it matters.
11. No emoji anywhere in the UI.
