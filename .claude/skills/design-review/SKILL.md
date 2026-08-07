---
name: design-review
description: Screenshot changed screens with Playwright and judge them against DESIGN.md. Use before merging any ticket that adds or changes a screen, component, or style. Outputs an explicit APPROVED verdict or a numbered fix list. No screen merges without APPROVED.
---

# Design review

The enforcement gate for DESIGN.md. A screen that has not been through this
skill does not merge, whatever else it does well.

**This skill does not restate the design rules.** It did until PLS-109, and it
went stale: it was still judging Rev C screens against Rev A, asking for
`forest-900` chrome, `emerald-600` actions and Bricolage headings, none of
which have existed in `src/` since the violet rebrand. The rules live in
`DESIGN.md` section 11 and are maintained alongside the code. This file is the
method: what to photograph, what a photograph uniquely shows, and the
mechanical checks that are cheaper in text than in pixels.

## When to run

Any ticket that adds or changes a route, a component, a token, or a style. If
the diff touches `src/app/**`, `src/components/**`, or `src/app/globals.css`,
this skill runs before the merge.

## Steps

### 1. Identify changed screens

```bash
git add -N .   # see the note below before removing this line
git diff --name-only main -- src/app src/components src/app/globals.css
```

**Both halves of that first command matter.** `git diff main...HEAD` reads
committed work only, so a review run before the commit reports a clean diff and
every mechanical check in step 5 passes on nothing. `git diff main` includes the
working tree, and `git add -N .` (intent to add, which stages no content) is
what makes **untracked files visible to diff at all**. A new component file is
exactly what a new feature adds, and without that line it is invisible to every
check in this skill while appearing to pass them.

Map each changed file to the routes that render it. A changed primitive means
every route using it is in scope. If a token in `globals.css` changed, the
design sheet at `/design` is always in scope.

Then decide, per route, whether it is public or behind the session gate. That
decision picks the script in step 3 and getting it wrong is how a review ends
up judging `/signin` five times.

### 2. Build and serve

Screenshot the production build, never the dev server. Dev-only layout shift
and slow fonts produce false verdicts.

```bash
npm run build
npx next start -p 4310 &
```

### 3. Screenshot each route

Five scripts, and picking the wrong one is the most common way this skill
produces a worthless verdict.

| Script | Use for | Signature |
| --- | --- | --- |
| `shot.mjs` | Public routes only: marketing, `/signin`, `/signup`, `/apply` | `<url> <out.png> [width] [height]` |
| `shot-auth.mjs` | One signed-in route | `<baseUrl> <route> <out.png> [width] [height]` |
| `shot-app.mjs` | Several signed-in routes in one session | `<outDir> <baseUrl> <path> [path...]` |
| `shot-theme.mjs` | Signed-in routes in a chosen theme | `<outDir> <baseUrl> <light\|dark> <path> [path...]` |
| `shot-dialog.mjs` | A layer open over its page, to check the scrim | `<url> <out.png>` |
| `shot-viewport.mjs` | A specific scroll position rather than the full page | `<url> <out.png> [width] [height] [scrollY]` |

**`shot.mjs` cannot photograph anything inside the product.** Every app route
is behind the session middleware, so it lands on `/signin` and the review
judges the wrong screen while reporting a load time that looks fine. Signed-in
routes go through `shot-auth.mjs`, `shot-app.mjs` or `shot-theme.mjs`, which
sign in first with `PULSE_DEMO_EMAIL` and `PULSE_DEMO_PASSWORD` (falling back
to the seeded demo account in `supabase/README.md`).

Every changed screen is photographed **in both themes**:

```bash
node scripts/shot-theme.mjs .design-shots http://localhost:4310 light /market
node scripts/shot-theme.mjs .design-shots http://localhost:4310 dark  /market
```

This is not optional and it is not a nicety. Dark mode shipped in PLS-104, and
two of the four defects in the PLS-104 to PLS-108 block were visible in one
theme only: the top bar inverted to white because it was `bg-ink text-sheet`
and both tokens flip, and "Sign out" went near-black on near-black. Light-only
review passes both of those.

Then a narrow pass on anything with columns:

```bash
node scripts/shot-auth.mjs http://localhost:4310 /market .design-shots/market-narrow.png 900 1000
```

**Public routes are also photographed signed out**, in a clean context.
PLS-107 shipped four marketing pages that were missing from `PUBLIC_PATHS`, so
the entire marketing site redirected logged-out prospects to sign-in. Typecheck,
lint and build all passed, and a review that only ever looks at signed-in
sessions never sees it.

Read every PNG back with the Read tool. Judging from the code instead of the
image is the failure mode this skill exists to prevent: look at the screenshot.

Note the load time each script prints. Over 300 ms on a static route is a
finding, not a footnote (ARCHITECTURE.md speed budget).

### 4. Judge against DESIGN.md

Read `DESIGN.md` fresh each run. It evolves, and it is the contract; this file
is not a copy of it.

Walk **the eleven numbered rules in section 11, The contract**, in order, for
each screenshot. Cite the rule number in every finding. Section 11 is the
enforceable list; sections 1 to 10 are what each rule means and why, so read
the referenced section when a rule is close to the line.

Two rules in section 11 currently describe the product as it was, not as it
is. Do not file findings against either until DESIGN.md is corrected:

- **Rule 4 (grain on the page ground).** PLS-101 removed the grain entirely;
  `globals.css` says so and the Rev C table at the top of DESIGN.md agrees.
  Section 6d and rule 4 were not updated with it. Nothing should have grain.
- **Section 9's toggle group** specifies a teal active cap. PLS-108 overruled
  that: teal means on or running, and a selected tab is not a running thing.
  A selected segmented cap painted teal is a finding under rule 5, not
  compliance with section 9.

Both are DESIGN.md corrections owed, not licence to improvise.

#### What only a screenshot shows

The contract is necessary and not sufficient. These have all shipped green
through typecheck, lint and build, and were caught in an image:

1. **Both themes, same element.** Any token that flips (`ink`, `sheet`, `well`,
   `paper`) inverts in dark mode. Chrome that must stay dark in both themes
   uses `bar` and `on-bar`.
2. **Text that vanishes into its own background.** Check every control that
   carries a colour override, especially with `!`.
3. **Order.** A transcript, a list, a timeline: confirm the rendered order is
   the order things happened. PLS-99 shipped every answer above the question
   that produced it, twice, because `created_at` ties and because `chat_role`
   is an enum that sorts by definition order rather than alphabetically.
4. **Column count at 1440.** Count the vertical strips including the 264px
   module rail. Four is too many, and the transcript must not be the narrowest.
5. **Dead space carrying no load.** A rail that is mostly blank, a header
   repeating what the rail already says, an empty state spending 172px to say
   nothing is waiting.
6. **Empty and populated both.** An intake card and a full memory stack are
   different screens.
7. **Signed out, for anything public.**

### 5. Mechanical checks

Cheaper in text than in pixels. Run these over the diff, not the whole tree.

```bash
# Working tree, not main...HEAD, and only after the `git add -N .` in step 1.
# See the note there: without both, new and uncommitted files pass by absence.
d() { git diff main -- src "$@"; }

# Rule 1, raw hex. globals.css is the token source; content-skills.ts is the
# one other sanctioned home for colour (DESIGN.md section 3, skill accents).
d ':!src/app/globals.css' ':!src/config/content-skills.ts' | grep -nE '^\+.*#[0-9a-fA-F]{6}\b'

# Rule 1, off-scale radius. The scale is shell/panel/card/control/chip.
d | grep -nE '^\+.*rounded-\['

# Rule 2, stock Tailwind shadows. Exactly three depth treatments exist, and
# they are the .cap, .well and .floating classes in globals.css.
d | grep -nE '^\+.*shadow-(sm|md|lg|xl|2xl|inner)\b'

# Rule 6, blur anywhere but the scrim.
d | grep -nE '^\+.*backdrop-blur'

# No gradients on product surfaces.
d | grep -nE '^\+.*(bg-gradient|linear-gradient)'

# Rule 10, weight below 400 and body text below 11px. 10px is mono legend
# territory and belongs to .legend, .meta or .record-id, never a raw size.
d | grep -nE '^\+.*font-(thin|extralight|light)\b'
d | grep -nE '^\+.*text-\[([0-9]|10)px\]'

# CLAUDE.md: no em dashes in code, copy, or comments.
d | grep -n '^+.*—'

# No emoji in the UI. The (*UTF) prefix is required: without it PCRE is not in
# UTF-8 mode and rejects the astral-plane range with "code point value too
# large" rather than matching nothing, which reads as a passing check.
d | grep -nP '(*UTF)^\+.*[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}]'
```

Any hit is a finding. `rounded-full` deserves its own look rather than a grep:
DESIGN.md section 5 bans pills and fully-rounded shapes, and the one standing
exception is a status dot a few pixels across (`PulseDot`).

Note what these do **not** catch, so they are never mistaken for the review
itself: `text-[12px]` and `text-[13px]` are the correct type scale and appear
throughout; the old version of this skill flagged both and buried real findings
under dozens of false ones.

### 6. Output the verdict

Exactly one of these two forms. There is no third option, no "APPROVED with
minor notes".

**APPROVED**

```
APPROVED
Routes reviewed: /market (1440 light, 1440 dark, 900 light), /ats/pipeline (1440 light, 1440 dark)
Load times: 180ms, 176ms, 190ms, 210ms, 205ms
Contract: 11/11
```

**Fix list**

```
NOT APPROVED
Routes reviewed: /market (1440 light, 1440 dark)

1. [rule 5] Selected segmented cap is teal at strategist-workspace.tsx:214.
   Teal means running. Use the ink outline treatment.
2. [rule 2] `shadow-lg` on the status chip, panel-toggle.tsx:31. Only .cap,
   .well and .floating exist.
3. [dark] "Ready" label is ink-3 on well and disappears in dark mode.
   agent-status.tsx:44. Screenshot: .design-shots/market-dark.png
```

Every finding cites the rule (or `[dark]`, `[order]`, `[speed]` for the
screenshot-only classes in step 4), the file, and the line. A finding without a
file and line is not actionable and does not belong in the list.

Re-run the whole skill after fixes. A partial re-check is not a verdict.
