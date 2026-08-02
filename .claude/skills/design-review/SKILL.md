---
name: design-review
description: Screenshot changed screens with Playwright and judge them against DESIGN.md. Use before merging any ticket that adds or changes a screen, component, or style. Outputs an explicit APPROVED verdict or a numbered fix list. No screen merges without APPROVED.
---

# Design review

The enforcement gate for DESIGN.md. A screen that has not been through this skill does not merge, whatever else it does well.

## When to run

Any ticket that adds or changes a route, a component, a token, or a style. If the diff touches `src/app/**`, `src/components/**`, or `globals.css`, this skill runs before the merge.

## Steps

### 1. Identify changed screens

```bash
git diff --name-only main...HEAD -- src/app src/components src/app/globals.css
```

Map each changed file to the routes that render it. A changed primitive means every route using it is in scope. If a token in `globals.css` changed, the design sheet at `/design` is always in scope.

### 2. Build and serve

Screenshot the production build, never the dev server. Dev-only layout shift and slow fonts produce false verdicts.

```bash
npm run build
npx next start -p 4310 &
```

### 3. Screenshot each route

```bash
node scripts/shot.mjs http://localhost:4310/<route> .design-shots/<name>.png
node scripts/shot.mjs http://localhost:4310/<route> .design-shots/<name>-narrow.png 900 1000
```

Read every PNG back with the Read tool. Judging from the code instead of the image is the failure mode this skill exists to prevent: look at the screenshot.

Note the load time the script prints. Over 300 ms on a static route is a finding, not a footnote (ARCHITECTURE.md speed budget).

### 4. Judge against the DESIGN.md checklist

Read `DESIGN.md` fresh each run; it evolves. Walk all ten checklist items in its Review checklist section, in order, for each screenshot:

1. Token colors and scale sizes only. No raw hex, no off-scale type or spacing
2. Chrome is `forest-900`, primary action is `emerald-600`. Identity hues only where they categorize
3. No grey initials circles. Avatars are photos or hue-tinted initials
4. Cards carry real substance: person, contact, metrics, score. No thin cards
5. Product surfaces have zero gradients. Marketing has at most one accent word per headline
6. Micro labels uppercase 11px. Data literals in JetBrains Mono with tabular numbers
7. Bricolage appears on display and page titles only, never in body or dense UI
8. Focus visible everywhere. Esc, Enter, and `/` behave
9. Pulse dot states correct wherever candidates render
10. Feels fast: no layout shift, no uninvited motion, optimistic where it matters
11. No emoji anywhere in the UI

Ordered collections (pipeline stages, workspace tiles) must use `hueByIndex`, never `hueFor`. Hashing lets neighbours collide, which reads as a bug.

Then grep the diff for the mechanical violations, which are cheaper to catch in text than in pixels:

```bash
git diff main...HEAD -- src | grep -nE "#[0-9a-fA-F]{6}|text-\[1[0-9]px\]|shadow-(sm|md|lg|xl)|gradient"
```

Any hit outside `globals.css` is a finding.

### 5. Output the verdict

Exactly one of these two forms. There is no third option, no "APPROVED with minor notes".

**APPROVED**

```
APPROVED
Routes reviewed: /ats/pipeline (1440, 900), /ats/candidates (1440)
Load times: 180ms, 210ms
Checklist: 10/10
```

**Fix list**

```
NOT APPROVED
Routes reviewed: /ats/pipeline (1440, 900)

1. [rule 1] Stage chip uses #6D5BD0 inline at CandidateCard.tsx:42. Use the stage-violet token.
2. [rule 3] Page gutter is 16px, DESIGN.md says 24px. src/app/(app)/layout.tsx:11
3. [rule 6] Salary renders in Geist Sans. Apply .data-literal.
```

Every finding cites the checklist rule, the file, and the line. A finding without a file and line is not actionable and does not belong in the list.

Re-run the whole skill after fixes. A partial re-check is not a verdict.
