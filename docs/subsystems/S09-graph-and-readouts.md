# S9 Graph and readouts

## 1. Purpose and boundary

S9 draws a scene graph and the numbers scored on it: the SVG overlay that puts boxes, masks, edges and names over a photograph in the image's own pixels, the Cytoscape node-link view with its four-colour diff, the verdict palette and legend that both read, and the two components that render the engine's metrics and warnings. The labs, the reference pages and F1 compose these components. S9 is not the engine that produces the verdicts and the values (S1), not the labs that call it (S11), and not the playgrounds' own drawing over photographs, `PhotoMarks` and `PairPhoto` (S12).

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/graph/` | Cytoscape scene graph view with its elements and stylesheet, SVG image overlay, geometry, verdict palette and legend |
| `system/frontend/src/components/` | Metric readout and warning list |

## 3. Interfaces

**Provides:**

- `ImageOverlay` (`system/frontend/src/graph/ImageOverlay.tsx`), imported by S11 (`system/frontend/src/labs/L1/TripletBuilder.tsx`, `system/frontend/src/labs/L8/MiniISGAnnotator.tsx`) and S12 (`system/frontend/src/playgrounds/F1/LabelsToStructure.tsx`). S10's SVG export serialises the `<svg>` it renders (`system/frontend/src/export/ExportButtons.tsx`, `system/frontend/src/export/svg.ts`).
- `SceneGraphView` (`system/frontend/src/graph/SceneGraphView.tsx`), imported by S11 (`system/frontend/src/labs/L1/TripletBuilder.tsx`).
- `VERDICT_STYLE` and `VERDICT_ORDER` (`system/frontend/src/graph/palette.ts`); S11 imports `VERDICT_STYLE` (`system/frontend/src/labs/L2/curveStyle.ts`, `system/frontend/src/labs/L7/CaptionToGraph.tsx`), and `DiffLegend` (`system/frontend/src/graph/DiffLegend.tsx`) is imported by S11 (`system/frontend/src/labs/L1/TripletBuilder.tsx`).
- `MetricReadout` (`system/frontend/src/components/MetricReadout.tsx`), imported by S11 (`system/frontend/src/labs/L1/TripletBuilder.tsx`, `system/frontend/src/labs/L2/MetricExplorer.tsx`, `system/frontend/src/labs/L4/MethodComparator.tsx`) and S7 (`system/frontend/src/pages/Leaderboards.tsx`, `system/frontend/src/pages/PaperCard.tsx`).
- `WarningList` (`system/frontend/src/components/WarningList.tsx`), imported by S11 (`system/frontend/src/labs/L1/TripletBuilder.tsx`, `system/frontend/src/labs/L2/MetricExplorer.tsx`).

**Consumes:**

- S1 (every file imports its types from `sgg-metrics`; `system/frontend/src/graph/geometry.ts` imports `decodeCounts`, and `system/frontend/src/graph/test/ImageOverlay.test.tsx` imports `encodeCounts`).
- S10 (`ImageOverlay`, `DiffLegend`, `MetricReadout` and `WarningList` import `useLocale` from `system/frontend/src/i18n/useLocale.ts`, and the tests of the last two import `setLocale`).
- S12 (`system/frontend/src/components/MetricReadout.tsx` imports `decimals` from `system/frontend/src/playgrounds/logic.ts`).
- S7 (`system/frontend/src/components/test/MetricReadout.test.tsx` imports `BOARDS`, `Leaderboards`, `PaperCard` and `PAPERS` from `system/frontend/src/pages/`).
- S15 (the same test reads `data/content/leaderboards.json` and `data/content/papers.json` through the `data/` link, whose CI copy is `fixtures/data`).

## 4. Current rules

1. The image overlay is hand-rolled SVG with no library: one `<img>` and one absolutely positioned `<svg>` whose viewBox is `0 0 width height` with `preserveAspectRatio="xMidYMid meet"`; boxes are `<rect>`, masks are `<path>`, edges are `<path>` between box centroids, and every element is a real DOM node. [SRS §2.1] [contracts §2.6] [`system/frontend/src/graph/ImageOverlay.tsx`]
2. Every box, mask and edge is written in intrinsic image pixels, the units of the viewBox, so the overlay scales no box. A pointer position crosses into image pixels in one place, `clientToImage(event, svg, width, height)` in `geometry.ts`, which subtracts the `meet` letterbox and returns NaN when the element has no layout. [D22] [`system/frontend/src/graph/geometry.ts`]
3. In draw mode a drag reports a box, clamped to the image, only when both sides exceed one pixel, and the scene's click handler ignores a click, the drag owning the pointer; a drag in view mode draws nothing. [`2026-09-15-02-graph-labs-and-content.md`] [D22] [`system/frontend/src/graph/ImageOverlay.tsx`]
4. The draw-mode tests run on the `PointerEvent` that `system/frontend/test/setup.ts` polyfills over `MouseEvent`, since jsdom 26 implements none, and the zero-area test stubs the client rect, so it fails if the rule is removed. [D22] [`system/frontend/test/setup.ts`]
5. A click on the scene in view mode selects `geometry.pickObjectAt`'s answer: the smallest box containing the point, a tie on area broken by the lower object id so that one click gives one answer on every machine, the boundary counted as inside, and a point that is not a number selecting nothing. [D75] [`system/frontend/src/graph/geometry.ts`]
6. The rule exists because a `<rect fill="none">` is hit-tested on its outline only, so a click in the middle of a box reached no handler, and because `pointer-events: all`, applied and then reverted, hands the choice to paint order, which in nested boxes takes whichever later box covers the point. [D75]
7. What must not change: the click handler sits on the `<svg>`, not on the rects, and a click whose target is a box is left to that box's own handler, so one click never names a subject and clears it again; the pointer cursor is on the whole scene when it is selectable. Moving selection back onto the rects, or setting `pointer-events: all`, restores the defect or the ambiguity. [D75] [`CLAUDE.md`] [`system/frontend/src/graph/ImageOverlay.tsx`]
8. Selection is tested at two levels: `geometry.test.ts` holds the rule, `ImageOverlay.test.tsx` the wiring in jsdom with a stubbed client rect, and the real-browser half, which jsdom cannot reach, is the case in `system/e2e/perf.spec.ts` that clicks the centre of a box with `page.mouse`. [D75] [VERIFICATION §10]
9. The overlay draws three layers chosen by `layers`: boxes and relationships on and labels off by default, which is what every caller before F1 received, and F1 opts into labels. A test asserts the default. [D88] [`system/frontend/src/graph/test/ImageOverlay.test.tsx`]
10. `ImageOverlay` has no width of its own: its root sets the image's aspect ratio and its children are absolutely positioned, so the container that mounts it must give it a width, or the photograph renders 0×0 with no error. [D96] [`CLAUDE.md`] [`system/frontend/src/graph/ImageOverlay.tsx`]
11. An edge is styled by the verdict at its position in `relationships`. An edge no verdict names keeps a neutral stroke rather than a guessed verdict, a relationship naming an object the overlay was not given is not drawn, and a `missed` verdict, whose `pred_index` is -1, styles no edge on this overlay. [`system/frontend/src/graph/ImageOverlay.tsx`] [`system/frontend/src/graph/test/ImageOverlay.test.tsx`]
12. A mask is drawn as one rectangle per run of its COCO RLE, column-major, decoded with `sgg-metrics`'s `decodeCounts`, and masks are drawn before the boxes. [`system/frontend/src/graph/geometry.ts`] [`system/frontend/src/graph/ImageOverlay.tsx`]
13. Every colour, stroke width and dash the overlay draws is an SVG presentation attribute, not a class, which is why S10's SVG export strips `class` and inlines nothing from a stylesheet. [D66] [`system/frontend/src/graph/ImageOverlay.tsx`] [`system/frontend/src/export/svg.ts`]
14. `SceneGraphView` renders through Cytoscape with two layouts: `dagre`, by the graph's structure, and `preset`, which pins each node at its box centroid so the diagram stays in register with the photograph and under which nodes cannot be dragged. Clicks are reported by `relationship_id` and `object_id`, and the instance is destroyed on unmount. [contracts §2.6] [`system/frontend/src/graph/SceneGraphView.tsx`] [`system/frontend/src/graph/test/SceneGraphView.test.tsx`]
15. The view's props add `gt?: SceneGraph` to those of contracts §2.6: with verdicts, each `missed` verdict becomes a ghost edge drawn from the ground truth, an edge that exists in no `relationships` array. [D23] [contracts §2.6]
16. A ghost attaches to an existing node only when the id and the first name agree, and otherwise gets its own `gt<id>` node, drawn as a dashed outline, so a ground-truth edge never hangs off a predicted object. [D23] [`system/frontend/src/graph/elements.ts`] [`system/frontend/src/graph/cyStyle.ts`]
17. The elements are built by the pure function `buildElements` in `system/frontend/src/graph/elements.ts`, not exported beside the component, which would defeat Fast Refresh; the tests import it from there. [D23] [`system/frontend/src/graph/elements.ts`]
18. `SceneGraphView` paints onto a canvas, so its nodes are not DOM elements and cannot take keyboard focus; F2, which must be driven from the keyboard, draws its own graph of buttons rather than reuse it. [D88]
19. The four verdicts are styled once, in `VERDICT_STYLE`: `match` `#1b7f4b`, solid, width 2, filled marker; `spurious` `#b42318`, solid, width 4, open marker; `missed` `#667085`, dash `6 4`, width 2, open marker; `localization` `#b54708`, dash `2 3`, width 3, hollow marker. [contracts §2.6] [`system/frontend/src/graph/palette.ts`]
20. Hue is never the only channel: stroke width, dash and marker separate the four verdicts without it, and tests assert that the non-colour channels alone distinguish them, in the palette and in the Cytoscape stylesheet. [SRS §7] [contracts §2.6] [`system/frontend/src/graph/test/cyStyle.test.tsx`] [`system/frontend/src/components/test/MetricReadout.test.tsx`]
21. No S9 component holds a verdict colour of its own: the overlay, the Cytoscape stylesheet and `DiffLegend` all read `VERDICT_STYLE`, the legend drawing each swatch as an SVG line with the real stroke and dash, and tests hold the stylesheet and the legend to the palette. [`2026-09-15-02-graph-labs-and-content.md`] [`system/frontend/src/graph/test/cyStyle.test.tsx`] [`system/frontend/src/components/test/MetricReadout.test.tsx`]
22. The stylesheet test pushes every rule through `cytoscape.stylesheet()`, which reports the properties it kept, and fails naming any it dropped. Arrow shapes are typed `Css.ArrowShape`, so a misspelt shape is a compile error; other values remain unchecked. [D24] [`system/frontend/src/graph/test/cyStyle.test.tsx`]
23. `MetricReadout` is the only component that renders a metric. It takes a `MetricValue`, never a bare number, and prints the metric, k, protocol and constraint beside every figure. [contracts §1.0] [`2026-09-15-02-graph-labs-and-content.md`] [`system/frontend/src/components/MetricReadout.tsx`]
24. A null value renders as an em dash with its reason in the tooltip, never as 0. [contracts §1.0] [`system/frontend/src/components/MetricReadout.tsx`]
25. `verified` and `fidelity` reach the DOM as data attributes, so CSS applies the styles: a value with `verified: false` is dimmed and labelled unverified, and a `reconstructed` value is set in italic. [`system/frontend/src/components/MetricReadout.tsx`] [`system/frontend/src/components/test/MetricReadout.test.tsx`]
26. A figure prints as a percentage shifted in decimal rather than multiplied in binary: a `published` figure at every place its number carries and never fewer than one, a computed figure at one place, a tie rounded up. [D122] [`system/frontend/src/components/MetricReadout.tsx`]
27. A test renders every figure of `leaderboards.json` and `papers.json` through the pages and compares it with the literal in its file, 174 figures on 2026-10-01. [D122] [`system/frontend/src/components/test/MetricReadout.test.tsx`]
28. The protocol and constraint tags `predcls`, `sgcls`, `sgdet`, `graph`, `none` and `semi` stay verbatim in both languages, and `unstated` is translated, being a sentence about the source rather than a term of art. [D34] [`system/frontend/src/components/MetricReadout.tsx`]
29. `WarningList` renders the engine's warnings with the engine's own wording in the reader's locale, each carrying its code, and renders nothing when there are none. L1 and L2 render it beside their readouts, so neither lab shows a PredCls figure without `gt_boxes_not_pairs`. [D27] [`system/frontend/src/components/WarningList.tsx`]
30. Component tests live in a `test/` directory beside their component, and the frontend vitest project collects every `.test.ts` and `.test.tsx` file under `system/frontend/src/` as well as under `system/frontend/test/`. [D20] [`system/vitest.config.ts`]
31. The graph view renders on `cytoscape` 3.34.3 and `cytoscape-dagre` 4.0.1, pinned exactly; D-04 adopted 3.34.3 over the 3.34.2 of SRS §2.1. [D-04] [`system/frontend/package.json`]

## 5. Verification

**Records:** VERIFICATION §10, VERIFICATION §32.

**`npm run ci` steps:** 4 vitest, the `frontend` project (`system/frontend/src/graph/test/ImageOverlay.test.tsx`, `SceneGraphView.test.tsx`, `cyStyle.test.tsx`, `geometry.test.ts`, and `system/frontend/src/components/test/MetricReadout.test.tsx`, `WarningList.test.tsx`); 7 i18n, over the `overlay`, `diff`, `metric` and `warnings` keys the components read; 11 frontend build, whose `tsc -b` refuses an arrow shape outside `Css.ArrowShape`.

**Outside `ci`:** `npm run check:perf` clicks the centre of a box in L1 and asserts that a role was assigned (`selecting an object`, `system/e2e/perf.spec.ts`). `npm run test:e2e` measures that F1's photograph, drawn by `ImageOverlay`, has a size and lies within the panel at three projector sizes (`system/e2e/projector.spec.ts`).

**What the records measure.** §10 is NFR-8 measured on 2026-09-19, and it carries the one real-browser case of D75: detaching the svg click handler in view mode fails it and nothing else. §32 is the run of D122, which changed how `MetricReadout` prints a figure.

## 6. Traps

- `<rect fill="none">` is hit-tested on its outline only, and handing the interior to the browser hands the choice to paint order. [D75] [`docs/INDEX.md`]
- jsdom has no hit testing, so a DOM test of what a click selects passes against a component nothing can click. [D75] [`docs/INDEX.md`]
- `ImageOverlay` has no width of its own, so a container that does not give it one renders the photograph 0×0, with no error and a step that appears to fit the panel; F1 did so on every projector until D96. [D96] [`CLAUDE.md`]
- jsdom 26 has no `PointerEvent`, and the plain `Event` that replaces it carries no coordinates, so a test that no box was drawn passes for a reason unrelated to its rule. [D22]
- A headless Cytoscape instance is silent about a misspelt property, an invalid value, a malformed selector and an unparseable colour, so an assertion that it printed no warning cannot fail. [D24]
- `JSON.parse` turns a printed `16.0` into 16, so a published figure's places cannot be read back from the parsed number, and `0.1298 * 100` is `12.979999999999999` in binary. [D122] [`system/frontend/src/components/MetricReadout.tsx`]

## 7. History

**Binding decisions:** D-04, D-07.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`, `2026-09-15-scene-graph-studio-contracts.md`.

| Deviation | Effect | Role |
|---|---|---|
| D20 | component tests live beside the component | secondary |
| D22 | the plan's draw-mode tests could not run, and one of them passed anyway | primary |
| D23 | the graph view cannot draw a missed verdict from the props the contract gives it | primary |
| D24 | a test that could not fail, written the same night D22 was logged | primary |
| D27 | the engine does not read `protocol`, so the ordering invariant was untestable | secondary |
| D34 | eighty-two numbers carried a protocol their source never states | secondary |
| D66 | the export, and the two things it refuses to do | secondary |
| D75 | a box is clickable on its outline only, and widening it has a cost | primary |
| D88 | the three M0 playgrounds, and the four things building them decided | secondary |
| D96 | the long playgrounds split across steps, and triplets counted as a set | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |

## 8. Open items

1. Contracts §2.6 still lists `SceneGraphView`'s props without `gt`; D23 says the contract is the thing that should move, and no amendment followed. [D23] [contracts §2.6] [`system/frontend/src/graph/SceneGraphView.tsx`]
2. D-07 requires anything whose fidelity is not `measured` to render in the distinct unverified style. `MetricReadout` dims a value whose `verified` is false and sets a `reconstructed` value in italic, and gives a `published` value, every figure on the cards and boards, neither style; no record reconciles the two. [D-07] [`system/frontend/src/components/MetricReadout.tsx`]
3. SRS §7's NFR-2 asks that an unverified figure carry a tooltip explaining why. The readout labels it unverified and its tooltip names the source; no production caller passes `verified: false`, so the case is not reached today. [SRS §7] [`system/frontend/src/components/MetricReadout.tsx`]
4. The comment of `WarningList.tsx` says every surface that renders a `MetricValue` renders the list beside it. L4 renders the values `evaluate` returns through `MetricReadout` with no `WarningList`, and no record states which is intended. [`system/frontend/src/components/WarningList.tsx`] [`system/frontend/src/labs/L4/MethodComparator.tsx`]
