# Split playgrounds and distinct triplets — design

**Date:** 2026-09-26. **Branch:** `feat/sgs-split-distinct`, from `fix/sgs-m1-review`.
**Decisions by the author, 2026-09-26, on D95's open items:** split the long playground steps into
two steps with shared knobs; count distinct triplets; the runner logs are read once the author has
signed in to Gitea.

## 1. Why a step split alone does not suffice

At 1024×768 the step area is 561 px in 繁體中文 and 517 px in English. Measured over the
production build in each playground's longest state, the frames alone are:

| Playground | Frame, zh-TW / en | Text above the frame, zh-TW / en |
|---|---|---|
| F1 | 705 / 705 | 219 / 258 |
| F6, both merges | 730 / 786 | 141 / 182 |
| F7, overlay on | 577 / 716 | 148 / 187 |
| X1, v1 against v2 | 998 / 1193 | 141 / 180 |

Moving each step's text into a step of its own, which is what D71 meant by a split, leaves every
frame taller than the step. The playground itself is therefore divided.

## 2. The split

**A playground may span consecutive steps as numbered parts.** The first step declares
`part: 1`, the next `part: 2`, both with the same `kp`; the body tag carries the same number,
`<Playground kp="X1" part="2" />`. A playground not split declares no part, as before.

**The knobs are shared.** The state already lives in the URL (contracts §2.2). The stepper carries
the query string from one step to the next when both steps mount the same knowledge point, and
drops it otherwise, as it does today. A part shows the controls its own view reads, so every knob
that changes what is on the screen is on the screen.

**The parts.**

| kp | Part 1 | Part 2 |
|---|---|---|
| F1 | the picture and its three layers | the density, the vocabulary and the four readouts |
| F6 | the two merges and the three class readouts | the predicate merge and the membership of one edge |
| F7 | s, C and k with the model's readouts and bars | the slice's measured share and bars against the model |
| X1 | the counts of both releases and their differences | why they differ: the matched sentences, where validation comes from, zero-relation images; **three parts as built**, see §6 |

Each part lists the sources of the figures it shows. F2 and F8 run 24 and 27 px past XGA in
繁體中文 and stay one step each.

**The target.** Every part fits a 1024×768 panel in 繁體中文, the teaching locale the projector
suite seeds, in its longest state. English is measured and recorded, not held to it. Shrinking type
below the 18 px floor (D71, NFR-5) is not an option.

## 3. The contract

Contracts §2.4 and the lint rules of the M0 design §2.4 change as follows.

- **Rule 4** also requires a declared part to lie within the parts the mount table registers for
  that point (`PLAYGROUND_PARTS` in `mounts.tsx`).
- **Rule 5** also requires the tag's `part` to equal the step's.
- **Rule 7** compares `part` as well as `kind` and `kp` across the locales.
- **Rule 8** is amended: a knowledge point is mounted by one step, or by the steps of one module
  that carry parts 1 to N, consecutive and in order, where N is its registered part count. A split
  point mounted without parts, and a whole one mounted with them, are refused.

## 4. Distinct triplets

**E is a set** (contracts §2.4, F6's membership test). A frame that annotates the same
(subject, predicate, object) twice records one triplet. The slice's 892 relationship rows hold
**684** distinct triplets; 208 rows repeat another in the same frame.

**Counted per frame, after any merge.** Merging predicates can make two rows of one pair the same
triplet: in two pairs the slice annotates two members of the `on` group, so E′ holds **272** `on`
triplets where its members hold 248 + 11 + 5 + 10 = 274. F6 writes that subtraction out.

| Figure | Rows (before) | Distinct triplets |
|---|---|---|
| Triplets | 892 | 684 |
| `on` | 382 | 248 |
| Merged `on` group | 408 | 272 |
| Top three | on 382, has 68, near 59 = 509 | on 248, near 54, has 51 = 353 |
| Top-1 share | 42.83% | 36.26% |
| Top-3 share | 57.06% | 51.61% |
| Predicate classes, unmerged / merged | 36 / 33 | 36 / 33 |

Object names are counted per object, not per triplet, and do not change (115 → 113, 127).

## 5. Tests

Each rule change fails a fixture test before it is kept, and is disabled once to confirm the test
catches it. The golden cases for F6 and F7 are re-derived with the arithmetic written out. The
projector suite's playground lists name every part, each in its longest state, and a new test
asserts that every part fits the panel at 1024×768. A stepper test asserts the query string
crosses from part 1 to part 2 and does not cross into an unrelated step.

## 6. As built, 2026-09-26

**X1 is three parts, not two.** Its second part, as first built, held the sentences the differences
equal, the provenance rows, the two disjointness lines and their sources, and ran 387 px past the
panel in 繁體中文 with v1 against v2. The provenance moved to a third part: part 2 is the sentences,
part 3 is one line a release saying where validation is drawn from and what becomes of an image
with no relation. Xu's pool, a count, stands with the counts in part 1. The mechanism is unchanged:
parts 1 to N.

**F7's second part has no overlay toggle.** Part 2 is the comparison, so the slice is shown there
without being asked for, and part 1 shows the model alone. The toggle exists only when the
playground is mounted without a part, as its unit tests mount it; no step does.

**Layout, within the 18 px floor.** F6's three readouts stand in three columns from 1024 px, where
a wrapping row had put each on a line of its own. Sliders are 96 px wide, so F7's three share a
row. F7's note on s shares the key's line, and the line sending the room to L3 is left off the
parts, since the first part's sentence and the second part's notes say it. X1's two release choices
share a row, each capped at 20rem; its figures and differences do not wrap, its header is 0.875em,
its cells lose 2 px of padding, its "not stated" cells are set in the text face, and its sources
run as one line.

**Result.** Every part fits a 1024×768 panel in 繁體中文 in every state measured: F1 and F6 in every
combination of their toggles, F7 at 36 and 50 classes, X1 at all 16 ordered release pairs in each
of its three parts. The projector suite asserts it for each part's longest state at all three panel
sizes. English does not fit at 1024×768; D96 gives the figures. F2 and F8 stay one step each, 24
and 27 px past in 繁體中文.
