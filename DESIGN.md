# Pulse Recruit

Design system for an all-in-one recruiting operations platform: applicant tracking, outbound, operations, and content engine.

**Rev C.** Rev A was a flat printed sheet with 2px corners and hard offset shadows. Rev B, "Panelboard Soft", kept the instrument logic and moved the personality into softer places: rounded shells, inset wells, keycap edges, and a cream ground with grain on it.

Rev C is the violet rebrand, ported in PLS-101 from a full static-HTML front end. What changed and what did not:

| | Rev B | Rev C |
|---|---|---|
| Ground | Cream `#F6F2E9`, grained | Violet-tinted `#F6F4FC`, flat |
| Verb | Vermilion `#E23D1F` | Violet `#7C3AED` |
| Display | Archivo Black, one weight | Archivo 600 to 900 |
| Body | IBM Plex Sans | Inter |
| Radius | 16 / 12 / 10 / 8 / 6 | 10 / 8 / 8 / 6 / 6 |
| Themes | Light only | Light and dark |

**The structural rules did not change.** Sections inside a shell still share a 1px rule with no gap. Status is still colour plus icon plus word. One primary verb per view. Nothing behind hover. Density is still the point. Rev C is a reskin, not a redesign, which is why it landed by re-pointing tokens rather than editing 73 component files.

The grain is gone. It made cream read as paper; on the violet ground it reads as compression artefacts.

---

## 1. The idea

The interface is a piece of well-made equipment. Not a document, not a dashboard. A warm panel with a legend printed on it and controls mounted into it.

Two structural rules carry the whole thing:

- **The panel is calm. The controls are physical.** Surfaces never have depth. Only things you press or throw have depth.
- **Panels share edges.** Inside a shell, sections meet on a 1px rule with no gap. Gaps exist only between shells.

Everything below is downstream of those two sentences.

---

## 2. Audience constraints

Primary users are recruiters aged roughly 20 to 40, working in the product all day. They are comfortable with dense software and do not need it zoomed in. Density is the point: more pipeline on screen beats larger text.

| Constraint | Value |
|---|---|
| Base body size | 13px, never below 11px |
| Line height | 1.5 body, 1.2 display |
| Body text contrast | 4.5:1 minimum |
| Minimum font weight | 400, no light or thin weights anywhere |
| Hit target | 28px minimum, 32px for primary actions |
| Mono minimum size | 10px, and only for legends, IDs, counts, metadata |

Additional rules:

- **Status is never encoded by colour alone.** Always colour plus icon plus word. This survives colour blindness and bad monitors, and it stays legible when a chip is small.
- **Nothing lives behind hover.** Row actions are visible or one deliberate click away. Hover-to-reveal is the pattern that fails this audience hardest.
- **Toasts persist until dismissed.** A state change nobody finished reading is an invisible state change.
- **Nothing moves between screens.** Memorability comes from spatial consistency, not clever navigation.
- **Uppercase is rationed.** Uppercase destroys word-shape recognition. It is allowed on the display face and on mono legends only. Buttons, body copy, and anything over three words are sentence case.

---

## 3. Colour

Token NAMES are semantic, which is why Rev C landed by re-pointing them rather than editing every component. Live values are in `src/app/globals.css`; this table is the contract, that file is the source.

```css
:root {
  /* ground and surfaces */
  --paper:      #F6F4FC;  /* page ground */
  --sheet:      #FFFFFF;  /* panel and card fill */
  --well:       #F5F2FC;  /* inset wells, control troughs, input beds */

  /* ink */
  --ink:        #1B1526;  /* primary text, strong borders, control bodies */
  --ink-2:      #585272;  /* secondary text, metadata */
  --ink-3:      #8B84A0;  /* placeholders, disabled labels */
  --rule:       #E7E1F4;  /* 1px hairlines */

  /* action. Still named `vermilion` in code: it is the ROLE, and renaming it
     inside the reskin would have buried the colour change in a rename diff.
     PLS-105 renames it to `violet`. */
  --vermilion:       #7C3AED;
  --vermilion-hover: #6D28D9;
  --vermilion-edge:  #5B21B6;  /* keycap underside */
  --on-vermilion:    #FFFFFF;

  /* state */
  --teal:       #0F7A5F;  /* on, running, engaged */
  --teal-edge:  #0A5240;
  --teal-bg:    #E3F6EF;
  --teal-text:  #085041;

  --amber:      #B8860B;  /* needs attention, paused, stalled */
  --amber-bg:   #FDF6EC;
  --amber-text: #9A7A20;

  --red:        #B02A37;  /* destructive and error only */
  --red-bg:     #FDECEE;
}
```

Dark mode overrides these on `html[data-theme="dark"]`. It is opt-in, never a bare `prefers-color-scheme`: a recruiter whose OS flips at sunset should not find the product changed underneath them mid-shift.

### Colour roles

This is the rule that keeps four products in one shell from turning into noise:

- **Violet is a verb.** If it is not clickable, it is not violet. One violet control per view, maximum. (The token is still spelled `vermilion` until PLS-105.)
- **Teal means on.** Running sequences, active states, thrown switches. Never a button.
- **Amber means look at this.** Stalled, paused, needs input. Never a button.
- **Red is destructive and error only.** It is not a general warning colour.
- **Ink is structure.** Secondary and tertiary buttons are ink outlines, not colour.

Modules are **not** colour-coded. Colour roles are fully spoken for. Module identity runs through the masthead and the record ID prefix instead (section 8).

### Content skill accents

One narrow exception, added in PLS-90. On the content calendar every card was the same cream, so a month told you how many posts you had and nothing about what they were. Each skill carries a hue, applied as a **3px left edge and a tinted icon only**, never as a card fill.

| Skill | Edge |
|---|---|
| Role post | `#2F6FB8` blue |
| Personal story | `#A8579B` magenta |
| Market insight | `#0F6E56` teal |
| Candidate story | `#BA7517` amber |
| Hiring advice | `#4A5BBF` indigo |
| Org-defined shapes | `--ink-3`, neutral |

Three constraints keep this from eroding the roles above:

- **Status always wins.** A failed post is red and a published one is spent, whatever shape it is. The skill accent applies only to posts still in play.
- **Accent, never fill.** A tinted card at calendar size is noise; a left edge is readable at a glance and stays out of the way.
- **Rule 9 still holds.** These hues carry a *category*, never a state. Every state also has an icon and a word.

The palette lives in `src/config/content-skills.ts` beside the icons. Colour for a skill is defined once, there.

---

## 4. Type

```css
--font-display: 'Archivo', system-ui, sans-serif;      /* 600 to 900 */
--font-body:    'Inter', system-ui, sans-serif;
--font-mono:    'IBM Plex Mono', ui-monospace, monospace;
```

Display moved off Archivo Black in Rev C. Archivo Black is a separate family locked to a single weight, so the rebrand's lighter headings were not expressible in it. Plex Mono stays: the rebrand uses JetBrains Mono, but at 10px caps the two are metrically close and Plex is already self-hosted, so swapping it would add a network font for a difference nobody can see.

| Role | Face | Size | Weight | Treatment |
|---|---|---|---|---|
| Page title | Archivo | 18px | 800 | Uppercase, tracking -0.01em |
| Section head | Archivo | 13px | 700 | Uppercase, tracking 0 |
| Metric number | Archivo | 21px | 700 | Tabular figures |
| Record name | Inter | 13px | 500 | Sentence case |
| Body | Inter | 13px | 400 | Line height 1.5 |
| Secondary | Inter | 12px | 400 | `--ink-2` |
| Button | Inter | 12px | 500 | Sentence case, never uppercase |
| Legend / eyebrow | IBM Plex Mono | 10px | 400 | Uppercase, tracking 0.12em |
| Record ID | IBM Plex Mono | 10px | 400 | Uppercase, tracking 0.08em |
| Count / metadata | IBM Plex Mono | 10px | 400 | Tabular figures |

Archivo is the personality and it works by being rare. It appears on page titles, section heads, metric numbers, and the masthead. Nowhere else.

---

## 5. Radius

Fixed scale. No arbitrary values.

```css
--r-shell:   10px;  /* outermost panel, dialog, drawer */
--r-panel:    8px;  /* board column, sidebar section */
--r-card:     8px;  /* record card, avatar */
--r-control:  6px;  /* button, input, toggle, select */
--r-chip:     6px;  /* status chip, tag, count badge */
```

Rev C compressed the scale. The rebrand is a flat 6px system; keeping five names meant no component had to change, they just tightened.

Avatars are rounded squares at `--r-card`, never circles. This is deliberate and it is a large part of what stops the layout reading as generic.

Pills and fully-rounded shapes do not exist in this system.

---

## 6. Depth and texture

Exactly three depth treatments exist. Anything else is a bug.

### 6a. Keycap edge (mounted controls)

Buttons, toggles, and steppers sit proud of the panel with a solid colour edge underneath, like a keycap. Pressing translates the cap down into its own edge.

```css
.control {
  border-radius: var(--r-control);
  box-shadow: 0 2px 0 var(--edge), 0 3px 8px rgba(23, 22, 15, 0.10);
  transition: transform 90ms ease-out, box-shadow 90ms ease-out;
}
.control:active {
  transform: translateY(2px);
  box-shadow: 0 0 0 var(--edge), 0 1px 3px rgba(23, 22, 15, 0.08);
}
```

`--edge` is the darker tone of whatever the cap is: `--vermilion-edge`, `--teal-edge`, or `--ink` for outline controls.

### 6b. Inset well (control beds and inputs)

Toggle groups, segmented controls, search fields, and text inputs are recessed into the panel.

```css
.well {
  background: var(--well);
  border-radius: var(--r-control);
  box-shadow: inset 0 1px 2px rgba(23, 22, 15, 0.10),
              inset 0 -1px 0 rgba(255, 253, 247, 0.60);
}
```

### 6c. Floating layer

Dialog, drawer, toast, and bulk-action bar. **Opaque, always.** Elevation comes from the shadow; the panel itself never lets the page through.

This rule was the opposite until PLS-90. The layer was 86% over an 18px blur, and on the deployed build Daniyal called it out: a calendar full of post cards showed through every dialog and every toast. Text over moving content is harder to read and buys nothing, and the shadow was already doing the work of saying "in front".

Blur survives in exactly one place, the scrim, because there is no text to read through it.

```css
.floating {
  border-radius: var(--r-shell);
  background: var(--sheet); /* opaque */
  box-shadow: 0 16px 40px rgba(23, 22, 15, 0.22),
              0 4px 10px rgba(23, 22, 15, 0.12),
              0 0 0 1px rgba(23, 22, 15, 0.06);
}

.scrim {
  background: rgba(23, 22, 15, 0.46);
  backdrop-filter: blur(10px) saturate(0.9);
}
```

### 6d. Grain

A single soft grain sits on the page ground. It never appears on sheets, cards, or controls.

```css
body {
  background-color: var(--paper);
  background-image: url("data:image/svg+xml,...");
}
```

Respect `prefers-reduced-transparency` by dropping the scrim's blur to a flat dim. The floating layer is already opaque for everyone, so there is nothing left there to reduce.

---

## 7. Structure

### Shells and shared edges

A shell is a rounded container with `--r-shell`, a 1px `--rule` border, and `--sheet` fill. Sections inside a shell meet on a 1px `--rule` divider with **no gap and no radius**. Only the shell's outer corners are rounded.

Board columns are ruled columns inside one shell, not a row of detached cards. Use `-ml-px` on adjacent columns so shared edges render as a single hairline.

```
+-----------------------------------------+  <- --r-shell, 1px --rule
| SOURCED     | SCREENING   | SUBMITTED   |  <- mono legend row
+-------------+-------------+-------------+  <- shared 1px rules
|  [ ] card   |  [ ] card   |  [ ] card   |
|  [ ] card   |  [ ] card   |             |
+-----------------------------------------+
```

Gaps between shells: 20px. Gaps inside a shell: zero.

### Spacing

4px base. Use 8, 12, 16, 20, 24, 32, 48. Nothing else.

---

## 8. Module wayfinding

Four products behind one nav is the hardest problem in this product. A user needs to know which room they are in before reading a word.

Since colour is reserved for roles, identity runs through two channels:

1. **Masthead lockup.** Each module has its own Archivo uppercase wordmark, fixed in the same position, always visible.
2. **Record ID prefix.** Every object in the system carries a mono ID in the top-right of its card.

One module per RecruiterGTM pillar, so the shell and the offer tell the same story.

| Pillar | Module | Wordmark | Prefix |
|---|---|---|---|
| 1. Offer productization | BD engine, market intelligence | MARKET | `BD-0044` |
| 2. AI operations manager | Morning brief and tasks | OPS | `TASK-1180` |
| 3. Multichannel outbound | Signals, sequences, mailboxes | OUTBOUND | `SEQ-0092` |
| 4. ATS | Pipeline, candidates, companies | TALENT | `CAND-0417` |
| 5. Content | Planner and skills | CONTENT | `POST-0031` |

The masthead names the pillar as well as the module, so an unbuilt area is
visibly unbuilt rather than hidden.

The prefix does the wayfinding that colour tabs would have done, and it survives being exported, printed, and pasted into an email. That is why it beats colour here.

---

## 9. Component anatomy

**Primary button.** Vermilion cap, `--vermilion-edge` keycap edge, `--on-vermilion` label, sentence case, 48px tall, `--r-control`. One per view.

**Secondary button.** Transparent fill, 1px `--ink` border, `--ink` label, keycap edge in `--ink`, 48px tall.

**Ghost button.** No border, no edge, `--ink-2` label, hover fills `--well`.

**Toggle group.** Inset well containing caps. Active cap is teal with `--teal-edge`, inactive caps are transparent with `--ink-2` mono labels.

**Status chip.** `--r-chip`, tinted background, 1px border in the state colour, text in the state's dark text token, mono uppercase 13px, always accompanied by an icon.

**Record card.** `--sheet` fill, 1px `--rule` border, `--r-card`, rounded-square avatar, name at 17px/500, secondary line at 15px in `--ink-2`, mono ID pinned top-right.

**Input.** Inset well, no outer border, 48px tall, `--r-control`, 17px text, focus ring `0 0 0 2px var(--vermilion)` inset.

**Dialog and drawer.** Floating layer treatment, `--r-shell`, backdrop `rgba(23,22,15,0.35)`.

---

## 10. Motion

Revised in PLS-90. Daniyal, on the deployed build: "I need more animations, I need more smoothness." The old rule was 90/160ms `ease-out` on transform and opacity only, which is why the product felt like it snapped between states rather than moving between them. Widened deliberately, and still bounded.

- **Duration:** 90ms control feedback, 140ms state settle, 180ms layer entry, 220ms toast entry. Nothing over 220ms; past that an interface feels slow rather than smooth.
- **Easing:** `ease-out` for feedback and fades. `cubic-bezier(0.16, 1, 0.3, 1)` for anything entering or lifting: it decelerates hard, which is what reads as weight rather than as bounce. No overshoot, no springs that pass their target.
- **Properties:** `transform` and `opacity` freely, both compositor-cheap. `background-color`, `border-color` and `box-shadow` are allowed **only** on the 140ms settle, and only on solid fills.
- **Movement is small.** 8px rise for a dialog, 10px for a toast, 24px slide for a drawer, 1px lift on hover. Motion that travels far reads as an effect.
- **Still no decorative animation.** Everything here is tied to a state change: a layer opening, a row responding, a value changing. The one ambient exception remains the live pulse dot.
- **`prefers-reduced-motion` collapses all of it.** Durations to 0, opacity instant. The global rule at the bottom of `globals.css` handles this, so a new animation is covered automatically.

---

## 11. The contract

Enforceable rules. If a component violates one of these, it is wrong regardless of how it looks.

1. The radius scale is fixed. No arbitrary radius values.
2. Exactly three depth treatments exist: keycap edge, inset well, floating layer. No other shadows.
3. Panels inside a shell share 1px rules. Writing `gap` between two sections of one shell breaks the sheet.
4. Grain lives on the page ground only. Never on sheets, cards, or controls.
5. Vermilion is a verb. If it is not clickable, it is not vermilion.
6. Backdrop blur only on the scrim. Floating layers are opaque.
7. Archivo appears on titles, section heads, metric numbers, and the masthead. Nowhere else.
8. Uppercase appears on the display face and mono legends only.
9. Status is colour plus icon plus word, always all three. A hue that carries a category rather than a state (content skill accents, section 3) is an accent edge, never a fill, and never the only thing saying what a state is.
10. No body text below 11px, no font weight below 400, no hit target below 28px.
11. Motion is bounded: nothing over 220ms, nothing travelling more than 24px, and every animation tied to a state change.
