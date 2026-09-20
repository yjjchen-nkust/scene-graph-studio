# Playgrounds — design

A playground is an interactive step inside a module: a small set of knobs that move a quantity the
module has just defined. This document specifies the step contract, the three playgrounds that
complete M0, and the rules that keep the remaining twenty-five honest when they follow.

Governed by `…-decisions.md` (D-13, D-14), `…-contracts.md` §2.4, and the eight NFRs of
`docs/INDEX.md` §3. Where this document and those disagree, they win and this one is wrong.

---

## 1. Context

`data/content/kp.json` holds 93 knowledge points. **27 carry `status: 'live'`**, meaning a working
playground exists for them in `system/web/knowledge-map/`, the page frozen on 2026-09-15. The
other 66 carry `status: 'spec'`: knobs were specified and nothing was built. Every one of the 93
carries a `knobs` field naming its controls in prose, for example F1's
`toggle: labels / boxes / relations overlay · slider: annotation density`.

The React application has none of them. Its step kinds are `prose`, `math`, `lab` and
`checkpoint`, plus a `figure` kind declared in `ModuleStepMeta` and used by no module.

The frozen page is not the answer. D-13 permits correcting it and forbids extending it, and D-14
states that its `pg.js evaluate()` — a teaching toy over fifteen hard-coded rows — must never
become the evaluation engine. This work takes the *behaviour* the frozen page demonstrates into
the lecture, and none of its code.

### Decisions locked with the user, 2026-09-19

| Question | Answer |
|---|---|
| Purpose | Bring interaction into the lecture flow: a playground is a **step kind inside a module**, appearing where the idea is taught. The frozen page stays as it is. |
| Scope of this cycle | **M0 complete**, and the architecture proven on it. The remaining twenty-five follow in their own cycles against a tested pattern. |
| Playground against lab | **A playground demonstrates; a lab scores.** A playground may compute a quantity its own definition contains — a count, a bound, a set membership. Anything metric-shaped is a lab. |
| Approach | **One component per knowledge point, mounted by id** from a registry, over a shared control kit. Rejected: generating all 27 from the `knobs` field; inline JSX per MDX body. |
| M0's playgrounds | F1, F2, F8 — the three points M0 **owns** in `assignment.json`. Not F5, which M0 only cites and another module owns. |

The playground-against-lab rule resolves a collision that would otherwise have produced a second
L1. M0's anchor lab is L1 Triplet Builder — pick two boxes, choose a predicate, submit, read the
scored diff — and F2's specified knobs are `click two nodes to add an edge · dropdown: predicate ·
toggle: directed arrows`. Under the rule, L1 keeps the photograph, the ground truth and PredCls
scoring; F2 keeps the combinatorics, over an abstract graph.

### Why not the two rejected approaches

**Generating all 27 from `knobs`.** `knobs` is prose, not a schema, and the *visual* differs per
point: F1 needs an image with switchable overlays, F2 a node-link graph, F8 a subject-object swap.
A generic engine would have to contain every one of those renderers anyway, so the schema buys
only the control strip. The deeper objection is that a data-driven formula field is precisely the
shape of `pg.js evaluate()`, whose promotion D-14 forbids, and it would arrive wearing a different
name.

**Inline JSX per MDX body.** No registry, nothing for the lint to check, every playground free to
diverge. A module is two locale files, so each widget would be written twice in two languages and
drift — the failure NFR-6 and `content_lint.mjs` exist to prevent.

---

## 2. The step contract

### 2.1 Front matter

A step gains one kind and one field, spelled like the `lab` it sits beside:

```yaml
  - id: s2
    kind: playground
    kp: F1
    seconds_budget: 180
    presenter_notes_zh: "…"
```

`ModuleStepMeta.kind` gains `'playground'`; `kp?: string` joins `lab?: string`.

### 2.2 Body

The step's own block carries the mount. `Playground` is supplied through the MDX `components`
prop the way `Step` is at `content/registry.tsx:117`, not imported, so neither locale file holds
an import line that can drift from the other:

```mdx
<Step id="s2">
## 標註密度與關係數量
<Playground kp="F1" />
</Step>
```

### 2.3 Registry

`frontend/src/playgrounds/mounts.tsx` exports `PLAYGROUND_MOUNTS`, keyed by knowledge-point id,
as `labs/mounts.tsx` is keyed by lab id. `PLAYGROUND_IDS` derives from it, so a component without
an entry cannot appear and an entry without a component cannot hide. An unregistered `kp` renders
a named panel saying so, following `UnknownLab`: a silent empty box in a lecture is the failure
this codebase repeatedly legislates against.

### 2.4 What `content_lint.mjs` refuses

Each rule is watched failing before it is kept.

1. A `playground` step declares `kp`.
2. That `kp` exists in `kp.json`.
3. That `kp` is owned by this module in `assignment.json`, or cited in its `knowledge_points`.
4. A component is registered for it, read by scanning `playgrounds/mounts.tsx` for its keys, as
   the four-part contract is checked by scanning the MDX body.
5. The step's body contains exactly one `<Playground kp="…" />`, whose id equals the front
   matter's. The step's body ends at its own `</Step>`: content after it belongs to no step, and
   `registry.tsx` renders it on **every** slide of the module.
6. No `<Playground>` anywhere in the body names a `kp` that no step declares.
7. Both locales mark the same steps as playgrounds, with the same `kp`.
8. No `kp` is used by two playground steps, **anywhere in the corpus** — not merely within one
   module, since two modules may each cite the same point.

And over `data/content/playground_golden.json`, which is the same contract applied to the file
that pins the arithmetic:

9. Every case has a unique `id`, and carries `kp`, `image_id`, `knobs` and a non-empty `expect`.
10. Every case's `why` writes out the arithmetic a reader would check.
11. Every case names a `kp` with a registered component.

Rules 5 (the `</Step>` bound), 6 and 8 were added on 2026-09-20 after review found each of them
passing a defect that reaches the projector; `tools/test/content_lint.test.mjs` exercises all
eleven against fixture corpora, which is what makes deleting one fail the gate rather than only
the prose.

### 2.5 One change outside the contract

`PresenterWindow` prints `step.id · step.kind` and appends `step.lab`. It appends `kp` the same
way, so the professor's second screen reads `s2 · playground · F1` rather than leaving them to
guess which widget is on the projector.

`kind: 'figure'` stays as it is. Adding `'playground'` beside a dead union member invites a third;
noting it is in scope, removing it is not.

---

## 3. The three playgrounds that complete M0

All three run on the committed `placeholder` slice, which `labs/mounts.tsx` already uses as
`DEFAULT_DS` for the same reason: it is the one slice a fresh clone has. Measured from
`data/slices/placeholder/annotations.json`: **6 frames, each |V| = 6 and |E| = 6, over a
16-predicate vocabulary.**

### 3.1 F1 — 從標籤到結構

Knobs: three independent overlays (labels, boxes, relations) and a density slider that withdraws
edges from E.

Computes, and computes nothing else: |V|, |E| at the current density, the bound
|E| ≤ |V|(|V|−1)|𝒫|, and the ratio between them. On `ph-001` at full density that is
6 × 5 × 16 = **480 candidates against 6 annotated edges, 1.25%**.

|𝒫| is a control with two presets — **16**, counted from this slice, and **50**, VG-150's
predicate count. Both are needed: M0's worked example computes with |𝒫| = 50, and a playground
silently using 16 would contradict the page above it. Each preset is labelled on screen with its
origin.

Turning every overlay off returns the bare photograph, which is the module's opening claim that
labels alone lose the scene.

### 3.2 F2 — 三元組與 G=(V,E,T)

The abstract node-link graph, not the image. This is where the boundary against L1 falls.

Six named nodes; click or key two of them to propose an edge; choose the predicate; the counter
reads the edges built against |V|(|V|−1)|𝒫| candidates.

The directed-arrows toggle is the substantive control. Turning direction off collapses ⟨s,p,o⟩
with ⟨o,p,s⟩, halves the candidate space, and names which of the student's own edges have become
indistinguishable from each other. That is M0's second implication — 方向承載語意，對稱化會使其消失 —
made operable.

Nothing is scored and nothing is compared against ground truth.

### 3.3 F8 — 有向邊與不對稱性

The frame's own triplets, with one control: swap. The sentence changes, the arrow reverses, and
the status changes.

**The wording is the whole design.** M0's third implication states 已標註者不等於為真者, so this
playground reports 「此邊收錄於 E」 against 「此邊未收錄於 E」, never 真 against 偽. A playground
printing "false" would contradict the module three paragraphs above it.

The teaching moment is `person —near→ table` on `ph-001`: reversed, it is absent from E although
the relation reads as symmetric. The annotation-versus-truth distinction arrives as a fact rather
than as a caution.

F8 is `status: spec` in `kp.json` and has never been built anywhere. It needs no new data:
membership in the frame's own E is a fact of the committed annotation, so nothing is authored and
nothing is asserted.

None of the three computes a metric.

---

## 4. The two shells, and the keys

### 4.1 Study shell

Every step in one scrolling column at normal type. A playground is inline and always live, with no
clock. No special provision.

### 4.2 Lecture shell

One step at a time, ≥ 24 px base type, on a projector.

**No playground takes focus on mount.** A playground that autofocused a slider would take the
arrow keys for the remainder of that step, and the professor would find out in the room. The lint
cannot check this; a test asserts it.

**Every knob is operable from the keyboard.** Check 8 walks M0 to M14 on the keyboard alone, and a
professor at the podium has a remote rather than a mouse. F2's "click two nodes" is served by
nodes that are real `<button>` elements. Controls are real form controls, never styled `div`s,
which is what makes the existing policy sufficient without amendment:

* `isTextEntry` (`useStepper.ts`) returns true for `INPUT` of **every** type, so a focused range
  slider or checkbox keeps its arrows.
* `consumesSpace` gives Space to a focused `BUTTON`, so activating a node does not also advance
  the slide.

**A playground fits the panel at XGA.** D71 records 25 of 92 slides running past the bottom of a
1024×768 panel, accepted by the author on 2026-09-18; adding widgets is how that list grows
without anyone deciding to grow it. Controls sit **above** the visual and the visual carries a max
height, so a short panel clips the picture and leaves the knobs reachable, rather than the
reverse.

### 4.3 Knob state

In the query string, through the existing `useLabParams`, namespaced by knowledge-point id:
`?F1.density=0.5&F1.P=50`. A knob setting therefore becomes a link, so a presenter note can name
the setting to open on, as L1 and L2 already do for their own state. The namespace stops one
playground's state leaking into another's when the professor advances. The position itself stays
in the route and nowhere else.

### 4.4 NFR-5

No special provision. F1's three overlays are labels, outlines and arrows — three different marks,
not three colours — so the no-colour-alone rule is satisfied by the shape of the thing.

---

## 5. Data, and what makes it offline

**Everything is bundled at build time.** `annotations.json` (6.4 KB) and the six PNGs (28 KB
total) are imported as `pages/papers.ts`, `pages/boards.ts` and `labs/L5/tables.ts` already import
from `data/content/`. Vite emits the images as fingerprinted assets on the frontend's own origin.
Nothing is fetched.

The placeholder images are committed deliberately: `.gitignore` ignores `data/slices/*/images/`
and then un-ignores `data/slices/placeholder/images/`. `MANIFEST.json` records each file's
sha256, `"source": "generated by backend/scripts/make_placeholders.py"` and
`"licence": "this project's own generated output"`, so NFR-7 is untouched and no new asset is
introduced.

**The consequence is the point.** A playground works with no backend running, no network, no
corpus unpacked and no torch installed — a stronger guarantee than the labs have, and deliberately
so, because it sits inside the lecture and a hall with nothing running is the case NFR-1 exists
for.

**Why this differs from the labs, principled rather than expedient.** A lab spans five datasets
and needs `/api/datasets/{ds}/images`, prediction files and the three model gates, so it fetches.
A playground is pinned to one committed slice and needs one annotation and one picture. Fetching
would buy nothing and spend the guarantee.

**One loader.** `playgrounds/slice.ts` imports the annotation once, types it as `SceneGraph` from
`sgg-metrics`, and exposes the six frames. Each playground receives a frame; none opens a file.
The same reason `MetricReadout` is the only component allowed to render a metric.

**NFR-2 falls out.** Every number a playground prints is computed in the browser from the
committed annotation, so its source is the file plus arithmetic the student can check. The three
M0 playgrounds contain exactly two literals, both |𝒫| presets, both labelled with their origin on
screen. A number whose origin is a developer's memory is the defect D54 recorded for a contrast
ratio.

---

## 6. Testing

### 6.1 What jsdom may assert: computation and structure

A unit test per playground for its arithmetic and markup — |V|, |E|, the bound, the ratio, the
E-membership verdict — plus one test that after a playground step renders, `document.activeElement`
is still `body`.

### 6.2 What jsdom may not assert: interaction

Stated in advance rather than learned again. Two defects in this project passed jsdom for the
wrong reason: D75, where a DOM test of "what does this click select" passed against a component
nothing could click, and D86, where the `BroadcastChannel` shim's macrotask delivery made a broken
build look correct.

**Every claim about operating a knob goes to Chromium.** `e2e/lecture.spec.ts` gains a test that
Tabs into the playground, works each control, asserts the displayed quantity changed, and asserts
the deck did **not** advance. The last clause is what catches a knob built from a styled `div`.

### 6.3 The offline claim, in the right file

`offline.spec.ts` asserts a module opens with nothing fetched from outside this origin — which a
playground fetching `/api` would satisfy, the proxy making that same-origin. The stronger claim
belongs in `lecture.spec.ts`, which runs with **no backend at all**: a playground step there must
not merely render, it must display its computed numbers.

### 6.4 The numbers need a golden file, not a literal

Asserting `480` hard-codes a value `make_placeholders.py` can change; recomputing the expectation
from the same annotation mirrors the implementation and proves nothing. The project has already
answered this: `build_golden.py` carries thirteen vectors each with a `why` writing out the
arithmetic, and `content_lint.mjs` refuses one whose `why` does not.

`data/content/playground_golden.json`: one entry per playground, each with the frame, the knob
settings, the expected output and the arithmetic spelled out, checked by the same rule.

### 6.5 Projector legibility

`e2e/projector.spec.ts` gains a playground step at XGA, WXGA and 1920×1080, so §4.2's clipping
rule is measured, and the next entry on D71's overflow list is a decision rather than a discovery.

### 6.6 The gate

`npm run ci` remains the one gate. The counts it prints will move, and every document quoting them
is updated in the same commit — three of them disagreed on 2026-09-19, which is why
`VERIFICATION.md` §14 exists.

---

## 7. Out of scope, stated so it is not assumed

* **The other twenty-five live playgrounds.** Their own cycles, against this pattern.
* **The 66 `spec` points.** Most are authoring rather than implementation. F8 is the exception,
  built here because M0 owns it.
* **Retiring the frozen page.** D-13 stands; it remains a separate reference artefact.
* **Scoring inside a playground.** The rule in §1 forbids it. A point needing a metric needs a lab.
* **Removing `kind: 'figure'`.**
* **Any change to the evaluation engine**, in either language.

## 8. Open items

None. Every question this design raised was settled with the user on 2026-09-19 and is recorded in
the table in §1.
