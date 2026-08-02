# Pulse Design Contract

Every screen is judged against this file by the design-review skill. A screen that violates it does not merge, whatever else it does well.

## History, so the same mistake is not made a third time

Version one: grey chrome, grey initials circles, one flat accent, thin cards. Rejected as characterless.
Version two: green chrome, colored avatars, denser cards. Rejected again, and correctly. It was still the same species, soft rounded cards floating on a neutral background with one accent color. That silhouette is the default a machine reaches for, and no amount of palette tuning fixes it.

Version three changes the silhouette, not the paint. Two named directions, from Daniyal's reference: **minimal vintage** for the structure and **glassmorphism** for the layers above it.

## The direction

**Minimal vintage.** The base is a printed page, not a dashboard. Warm cream paper, a visible hairline grid where panels butt against each other and share rules, heavy uppercase display type, monospace for labels and data, vermilion as the single hot accent against deep navy blocks. Corners are effectively square. Nothing floats without reason. The reference is editorial print: a well set magazine spread, not a SaaS template.

**Glassmorphism, for layers only.** Anything that floats above the page (drawer, dialog, dropdown, toast, the bulk action bar) is frosted glass: translucent warm white, a real backdrop blur, a hairline border, and a soft shadow. This is the only place blur and translucency appear. Glass on a flat surface is decoration and is forbidden.

The tension between the two is the point. A crisp printed grid, with soft glass floating over it.

## Color tokens

Defined once in `src/app/globals.css` under `@theme`. Components never use raw hex.

### Surface and ink

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#F7EFE8` | Page background, the warm sheet everything sits on |
| `paper-deep` | `#EFE2D7` | Recessed areas, table header, section wash |
| `paper-white` | `#FFFBF7` | Raised cells and inputs, a warm white, never pure white |
| `ink` | `#1C1A2E` | Primary text, dark panels, structural hairlines |
| `ink-soft` | `#56526E` | Secondary text |
| `ink-mute` | `#8E8AA3` | Muted text, placeholders, timestamps |
| `rule` | `#DCCEC2` | Soft dividers inside a panel |
| `rule-strong` | `#1C1A2E` | The structural grid hairline, used at 1px, full strength |

### Accent and semantic

| Token | Hex | Use |
| --- | --- | --- |
| `vermilion` | `#E8481F` | The single hot accent: primary action, active state, live signal |
| `vermilion-deep` | `#C33A14` | Hover and pressed |
| `vermilion-wash` | `#FBE3DA` | Selected row, active chip |
| `sage` | `#4E7C62` | Positive, healthy, live |
| `mustard` | `#C08A2E` | Warning, at risk, going cold |
| `brick` | `#A9382A` | Destructive |

### Identity palette

Six muted vintage hues for categorization only: pipeline stages, workspace tiles, signal kinds, avatar fallbacks, chart series. Assigned by position for ordered collections and by hash for identity. Never chosen for variety.

| Token | Hex |
| --- | --- |
| `hue-vermilion` | `#E8481F` |
| `hue-mustard` | `#D9A441` |
| `hue-sage` | `#5C8A6E` |
| `hue-teal` | `#2F6F7E` |
| `hue-plum` | `#7A4E6E` |
| `hue-clay` | `#A9603F` |

### Glass

Floating layers only.

- `--glass-bg`: `rgb(255 251 247 / 0.72)`
- `--glass-blur`: `blur(20px) saturate(1.4)`
- `--glass-border`: `1px solid rgb(28 26 46 / 0.14)`
- `--shadow-glass`: `0 16px 40px rgb(28 26 46 / 0.18)`

Dark glass, for the bulk bar over content: `rgb(28 26 46 / 0.86)` with the same blur.

## Typography

Three faces, self-hosted through `next/font`, zero external requests.

- **Archivo Black**: display only. Uppercase, tight tracking. Page titles, marketing headlines, metric numbers. This carries the whole personality and must never appear below 18px or in body copy.
- **IBM Plex Sans**: reading text and dense UI. Warmer and more characterful than a neutral grotesque, still readable at 12px.
- **IBM Plex Mono**: labels, data literals, buttons, stage names, codes, counts, timestamps. The vintage voice. Mono carries far more of this interface than a normal product would, and that is deliberate.

| Role | Size / line height | Face, weight | Notes |
| --- | --- | --- | --- |
| Marketing hero | 72 / 68 | Archivo Black | Uppercase, tracking -0.02em |
| Marketing section | 44 / 44 | Archivo Black | Uppercase |
| Page title | 26 / 28 | Archivo Black | Uppercase, one per screen |
| Metric | 32 / 34 | Archivo Black | Dashboard numbers |
| Section title | 15 / 20 | Plex Sans 600 | |
| Body | 14 / 20 | Plex Sans 400 | |
| Dense body | 13 / 18 | Plex Sans 400 | Cards, table cells |
| Caption | 12 / 16 | Plex Sans 400 | |
| Micro label | 11 / 14 | Plex Mono 500 | Uppercase, tracking +0.12em. The signature label |
| Data literal | 12 / 16 | Plex Mono 400 | Tabular numbers |
| Button | 12 / 16 | Plex Mono 600 | Uppercase, tracking +0.08em |

Micro labels are wide-tracked uppercase mono, exactly as in the reference. This is the most recognisable single detail in the system and it appears on every column header, every field label, and every section eyebrow.

## Structure, the part that actually changed

- **Radius is 2px.** Panels, cards, inputs, buttons. The only exceptions are avatars and status dots, which are circles. No pills, no 12px cards.
- **Hairline grid.** Panels sit inside a 1px `rule-strong` border and share edges rather than floating apart with gaps. A screen should read as a divided sheet, not as a scatter of cards. Use `-ml-px` style overlap so shared edges stay 1px, never 2px.
- **No shadows on flat surfaces.** Shadow belongs to glass layers only.
- **Density.** 4px grid. Control height 32px, compact 26px. Table rows 40px. Page gutter 0: the content grid runs edge to edge and is divided by rules, with 20px padding inside each cell.
- **Ornament budget: one per screen, maximum.** The reference uses a starburst and a squiggle. Ours is a single small vermilion four-point star used to mark the one thing that needs attention, nothing else. It is never decorative filler.

## Component inventory

Primitives in `src/components/ui/`, composites in `src/components/`.

Primitives: Button (primary, secondary, ghost, danger, all square and uppercase mono), IconButton, Input, SearchInput, Select, Textarea, Checkbox, Badge, Chip, Avatar, AvatarStack, Tooltip, DropdownMenu, Dialog, Drawer, Tabs, Toast, Kbd, StatusDot, PulseDot, MicroLabel, CopyField, EmptyState, Breadcrumb, Star.

Composites: TopBar, IconRail, ListPanel, PageHeader, MetaRow, DataTable, Board, BoardColumn, CandidateCard, MatchScore, MetricRow, CandidateDrawer, BulkActionBar, FilterBar, SignalCard, DreamCompanyRow, ImportDialog.

### Avatar

Photo when we have one. Otherwise a square (2px radius, not a circle) tinted in the identity hue with wide-tracked mono initials. The square avatar is part of the print language.

### PulseDot

Kept. 6px, on candidates and companies, beside a mono relative time.
- Live, under 48h: `sage`, breathing 2.4s.
- Warm, 2 to 7 days: `ink-mute`, static.
- Cold, over 7 days: hollow 1.5px `mustard` ring.
Only ambient animation in the product. Reduced motion gets a static ring.

### Signal card

The Dream 100 payload. A hairline cell containing: a mono uppercase kind label in the kind's identity hue, the company name in Plex Sans 600, the headline, a mono detected timestamp, and the two actions. Funding, open role, promotion, and expansion each own a fixed hue so the eye learns them.

## Motion

- 140ms ease-out, opacity and transform only. Glass layers 200ms with the blur fading in.
- Optimistic board drags, reconciled behind, snap back with a toast on failure.
- No skeleton shimmer.
- `prefers-reduced-motion` respected everywhere.

## Interaction rules

- Click-to-copy on every email, phone, and LinkedIn URL. Inline `COPIED` swap in mono for 900ms, never a toast.
- Visible focus ring, 2px `vermilion` at 2px offset.
- Esc closes the topmost layer and clears selection. Enter submits. `/` focuses search.
- Destructive dialogs name the object. Never "Are you sure?".
- Buttons say what they do, in uppercase mono. Never "Submit" or "OK".
- Empty states are invitations: one line of direction plus the primary action.
- Sentence case in reading text, uppercase only in mono labels and buttons.
- No em dashes. No emoji.

## Review checklist

1. Tokens and scale only. No raw hex, no off-scale type or spacing.
2. Radius is 2px everywhere except avatars and dots. No pills, no soft cards.
3. Panels share hairline `rule-strong` edges and form a grid. Nothing floats without reason.
4. Blur and translucency appear ONLY on floating layers. No glass on a flat surface.
5. Micro labels are uppercase Plex Mono at 11px with +0.12em tracking.
6. Archivo Black appears only on page titles, marketing headlines and metrics, never in body or dense UI.
7. Buttons are uppercase mono.
8. Background is warm paper. Nothing is pure white or neutral grey.
9. At most one ornament per screen.
10. Focus visible everywhere. Esc, Enter and `/` behave.
11. Pulse dot states correct wherever candidates or companies render.
12. Feels fast: no layout shift, no uninvited motion, optimistic where it matters.
