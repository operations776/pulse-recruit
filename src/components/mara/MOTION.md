# Motion thesis: the Reyhan screen

Written before the code, per the `/animate` method. Operate mode: this is a
screen somebody works in every morning, so motion serves feedback, state and
continuity. Nothing here animates because an area was static.

## Focal moment: a promise closing

The product's thesis is that an agent which only ever adds to your list is a
worse colleague than one that closes things. The single most meaningful state
change on the screen is therefore a commitment being settled: something you
told Reyhan you would do, and did.

Today that moment is a `router.refresh()`. The row disappears on a server round
trip with no acknowledgement, which is the same nothing you get from a failed
request. The one emotional peak in the product reads as a page reload.

The row now **strikes through, desaturates and collapses its own height** over
260ms before the refresh lands. Three properties, one idea: the promise is
crossed off, it stops being live, and it leaves. The strike-through is the
literal gesture of crossing something off a list, which is what a recruiter is
actually doing, and it is specific to a ledger in a way a fade is not.

Collapsing height rather than fading in place matters: it moves the rows below
up, so the list visibly shortens. That is the payoff. A fade leaves a hole.

## Continuity

**Optimistic settle.** The row animates out immediately on click, before the
server answers, and the count in the header drops with it. If the write fails
the row springs back and the toast says why. Waiting 400ms to acknowledge a
click makes the product feel like it is thinking about whether to believe you.

**The metric strip does not animate.** Numbers that count up are the most
requested and least useful animation in software: they delay the one thing the
tile exists to say. Four tiles counting up simultaneously is worse.

## Feedback

**The play card committing.** Pressing "I'll do this" turns a suggestion into a
promise. The button settles into its done state and the card's violet rule
travels down to the ledger, which is the spatial truth: the play became the
thing at the top of your list.

**The composer, while Reyhan works.** The avatar already has a thinking state
and the pulse dot already exists. What was missing is that the transcript gives
no sense of progress during a research run that can take thirty seconds. The
run log fades its steps in as they arrive, which it has the data for already.

## Budget

Everything is transform, opacity, colour and a bounded height transition. No
layout thrash in a loop, no blur, no filter on a scroll handler, nothing
running while the tab is idle except the two ambient loops that already exist
(the pulse dot and the avatar breathe), both of which are opacity and transform
only.

The global `prefers-reduced-motion` rule collapses every duration to 0.01ms, so
each of these degrades to an instant state change rather than needing its own
carve-out. The strike-through and the colour change survive that collapse,
which is correct: they carry meaning, the movement carries polish.
