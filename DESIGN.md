# Panelboard Soft

Design system for an all-in-one recruiting operations platform: applicant tracking, outbound, operations, and content engine.

**Rev B.** Rev A was a flat printed sheet with 2px corners and hard offset shadows. Rev B keeps the instrument logic and moves the personality into softer places: rounded shells, inset wells, keycap edges, and a grained ground.

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

```css
:root {
  /* ground and surfaces */
  --paper:      #F6F2E9;  /* page ground, carries the grain */
  --sheet:      #FFFDF7;  /* panel and card fill */
  --well:       #EDE7DA;  /* inset wells, control troughs, input beds */

  /* ink */
  --ink:        #17160F;  /* primary text, strong borders, control bodies */
  --ink-2:      #6E675A;  /* secondary text, metadata */
  --ink-3:      #9A9284;  /* placeholders, disabled labels */
  --rule:       #D8D1C0;  /* 1px hairlines */

  /* action */
  --vermilion:       #E23D1F;
  --vermilion-hover: #C7331A;
  --vermilion-edge:  #A8290F;  /* keycap underside */
  --on-vermilion:    #FFFDF7;

  /* state */
  --teal:       #0F6E56;  /* on, running, engaged */
  --teal-edge:  #0A5240;
  --teal-bg:    #E1F5EE;
  --teal-text:  #085041;

  --amber:      #BA7517;  /* needs attention, paused, stalled */
  --amber-bg:   #FAEEDA;
  --amber-text: #854F0B;

  --red:        #A32D2D;  /* destructive and error only */
  --red-bg:     #FCEBEB;
}
```

### Colour roles

This is the rule that keeps four products in one shell from turning into noise:

- **Vermilion is a verb.** If it is not clickable, it is not vermilion. One vermilion control per view, maximum.
- **Teal means on.** Running sequences, active states, thrown switches. Never a button.
- **Amber means look at this.** Stalled, paused, needs input. Never a button.
- **Red is destructive and error only.** It is not a general warning colour.
- **Ink is structure.** Secondary and tertiary buttons are ink outlines, not colour.

Modules are **not** colour-coded. Colour roles are fully spoken for. Module identity runs through the masthead and the record ID prefix instead (section 8).

---

## 4. Type

```css
--font-display: 'Archivo Black', system-ui, sans-serif;
--font-body:    'IBM Plex Sans', system-ui, sans-serif;
--font-mono:    'IBM Plex Mono', ui-monospace, monospace;
```

| Role | Face | Size | Weight | Treatment |
|---|---|---|---|---|
| Page title | Archivo Black | 18px | 400 | Uppercase, tracking -0.01em |
| Section head | Archivo Black | 13px | 400 | Uppercase, tracking 0 |
| Metric number | Archivo Black | 21px | 400 | Tabular figures |
| Record name | IBM Plex Sans | 13px | 500 | Sentence case |
| Body | IBM Plex Sans | 13px | 400 | Line height 1.5 |
| Secondary | IBM Plex Sans | 12px | 400 | `--ink-2` |
| Button | IBM Plex Sans | 12px | 500 | Sentence case, never uppercase |
| Legend / eyebrow | IBM Plex Mono | 10px | 400 | Uppercase, tracking 0.12em |
| Record ID | IBM Plex Mono | 10px | 400 | Uppercase, tracking 0.08em |
| Count / metadata | IBM Plex Mono | 10px | 400 | Tabular figures |

Archivo Black is the personality and it works by being rare. It appears on page titles, section heads, metric numbers, and the masthead. Nowhere else.

---

## 5. Radius

Fixed scale. No arbitrary values.

```css
--r-shell:   16px;  /* outermost panel, dialog, drawer */
--r-panel:   12px;  /* board column, sidebar section */
--r-card:    10px;  /* record card, avatar */
--r-control:  8px;  /* button, input, toggle, select */
--r-chip:     6px;  /* status chip, tag, count badge */
```

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

Dialog, drawer, and bulk-action bar. These are the only elements permitted backdrop blur, because glass on a flat surface is decoration.

```css
.floating {
  border-radius: var(--r-shell);
  background: rgba(255, 253, 247, 0.86);
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow: 0 12px 32px rgba(23, 22, 15, 0.16),
              0 2px 6px rgba(23, 22, 15, 0.08);
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

Respect `prefers-reduced-transparency` by dropping backdrop blur to a solid `--sheet` fill.

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

1. **Masthead lockup.** Each module has its own Archivo Black uppercase wordmark, fixed in the same position, always visible.
2. **Record ID prefix.** Every object in the system carries a mono ID in the top-right of its card.

| Module | Wordmark | Prefix |
|---|---|---|
| Applicant tracking | TALENT | `CAND-0417` |
| Outbound | OUTBOUND | `SEQ-0092` |
| Operations | OPS | `TASK-1180` |
| Content engine | CONTENT | `POST-0031` |

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

- Duration: 90ms for control feedback, 160ms for layer entry.
- Easing: `ease-out` only.
- Properties: `transform` and `opacity` only.
- No decorative animation anywhere. Respect `prefers-reduced-motion` by reducing all durations to 0 and keeping opacity changes instant.

---

## 11. The contract

Enforceable rules. If a component violates one of these, it is wrong regardless of how it looks.

1. The radius scale is fixed. No arbitrary radius values.
2. Exactly three depth treatments exist: keycap edge, inset well, floating layer. No other shadows.
3. Panels inside a shell share 1px rules. Writing `gap` between two sections of one shell breaks the sheet.
4. Grain lives on the page ground only. Never on sheets, cards, or controls.
5. Vermilion is a verb. If it is not clickable, it is not vermilion.
6. Backdrop blur only on dialog, drawer, and bulk bar.
7. Archivo Black appears on titles, section heads, metric numbers, and the masthead. Nowhere else.
8. Uppercase appears on the display face and mono legends only.
9. Status is colour plus icon plus word, always all three.
10. No body text below 11px, no font weight below 400, no hit target below 28px.
