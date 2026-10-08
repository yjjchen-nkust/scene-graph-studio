# S11 Labs

## 1. Purpose and boundary

S11 is the eight interactive labs, L1 to L8, reached at `/lab/:labId`: the labs themselves, the frame they share, the containers that fetch what each needs, the API client, and the hook that keeps a lab's state in the URL. A lab is where the course computes a metric, in the browser through `sgg-metrics`, or replays the backend's recordings and published tables beside it. S11 is not the engine (S1), the endpoints it reads (S2 to S5), the drawing and readout components it composes (S9), nor the playgrounds and demonstrations, which compute no metric (S12, S13).

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/labs/` | The eight labs L1 to L8, their frame, registry, containers, API client and URL-state hook |

## 3. Interfaces

**Provides:**

- `LabRoute` and `LAB_IDS` (`system/frontend/src/labs/registry.tsx`), imported by S10 (`system/frontend/src/routes.tsx`, `system/frontend/src/pages/Home.tsx`).
- `useLabParams` (`system/frontend/src/labs/useLabParams.ts`), imported by S7 (`system/frontend/src/pages/FieldMap.tsx`, `system/frontend/src/pages/KnowledgeIndex.tsx`), by every playground of S12 and by both demos of S13 (`system/frontend/src/demos/DT/Traditional.tsx`, `system/frontend/src/demos/DV/IndVisSGG.tsx`).
- `API_BASE` (`system/frontend/src/labs/api.ts`), imported by S10 (`system/frontend/src/pages/Status.tsx`).
- L2's fixture `GT` (`system/frontend/src/labs/L2/fixture.ts`), imported by S10 (`system/frontend/src/shells/study/StudyShell.tsx` for the checkpoint graph, and `system/frontend/src/assess/test/quiz.test.tsx`).

**Consumes:**

- S1 (`evaluate` from `sgg-metrics` in L1, L2, L3, L4 and `system/frontend/src/labs/L6/forensics.ts`; `encodeCounts` in `system/frontend/src/labs/L6/fixture.ts`; types elsewhere).
- S9 (`system/frontend/src/labs/L1/TripletBuilder.tsx` imports `ImageOverlay`, `SceneGraphView`, `DiffLegend`, `MetricReadout` and `WarningList`; L2 imports `MetricReadout` and `WarningList`, L4 `MetricReadout`, L8 `ImageOverlay`; `system/frontend/src/labs/L2/curveStyle.ts` and `system/frontend/src/labs/L7/CaptionToGraph.tsx` import `VERDICT_STYLE`).
- S10 (every lab imports `useLocale`; L1 and L8 import `ExportButtons` from `system/frontend/src/export/ExportButtons.tsx`).
- S2 (`system/frontend/src/labs/api.ts` and `system/frontend/src/labs/mounts.tsx` request `/api/datasets`, `/api/datasets/{ds}/images`, `/api/datasets/{ds}/images/{image_id}`, `/api/models`, `/api/predictions/{ds}/{model}/{image_id}`, `/api/infer/{model}` and `/api/vlm/indvissgg`).
- S15 (`system/frontend/src/labs/L5/tables.ts` imports `data/content/indvissgg_tables.json` through the `data/` link, whose CI copy is `fixtures/data`).

## 4. Current rules

1. A lab takes its graphs as props and does not know where they came from; one container per lab in `mounts.tsx` does the fetching, and `registry.tsx` maps an id to its container. `LAB_IDS` is derived from the mount table, so a lab cannot be listed without a mount or mounted without being listed. [D60] [`system/frontend/src/labs/registry.tsx`]
2. An image-backed lab opens on the `placeholder` slice by default, the one slice every clone can produce, and on the slice's first frame when the URL names none; that fallback is not written into the URL. [D60] [`system/frontend/src/labs/mounts.tsx`]
3. A lab's shareable state lives in the URL query and nowhere else. A value equal to its default is an absent key, a value that will not parse falls back to the default, and a control replaces the history entry rather than adding one. [contracts §2.2] [D26] [`system/frontend/src/labs/useLabParams.ts`]
4. Picking another frame writes the lab's per-frame parameters back to their defaults in the same update, since every slice numbers its objects from 1 and an id left behind would resolve on the new frame; L8's annotator is keyed by frame. [D120] [`system/frontend/src/labs/mounts.tsx`]
5. `LabFrame` renders a lab in one of three states, pending, failed or ready, and carries `data-lab` for the tests. A failure shows the backend's own sentence in the locale on screen, never a stack trace, and an unknown lab id is named on a page of its own. [D60] [`system/frontend/src/labs/LabFrame.tsx`]
6. The API client prefixes every request with `API_BASE`, from `VITE_API_BASE`, and separates three failures: a backend that does not answer, a body that is not the error model, and a real refusal, which keeps its code, both sentences and its detail. [D60] [D127] [`system/frontend/src/labs/api.ts`]
7. L2, L3, L6 and L7 need no backend and render with every `fetch` failing; L1, L4 and L8 show the backend's sentence when it is down. [D60] [`system/frontend/src/labs/test/mounts.test.tsx`]
8. Server state goes through TanStack Query and is never refetched (`staleTime: Infinity`, no retry); L5's run and L4's live inference are mutations, so nothing runs before it is asked for. [contracts §2.3] [`system/frontend/src/labs/api.ts`] [`system/frontend/src/labs/mounts.tsx`]
9. L1 scores in the browser through `sgg-metrics`, not `/api/eval`, under PredCls, the graph constraint, τ = 0.5 and `single_mpo`, at K = 20 alone, so the matched count, the diff's colours and R@20 come from one assignment. [D122] [`system/frontend/src/labs/L1/triplets.ts`]
10. L1's query carries the committed triplets as `t` (`1-on-2,3-near-4`) and whether they were submitted as `sub`, beside `s`, `o` and `p` for the selection in progress; a triplet naming an object the frame lacks is dropped, and the triplets' order is the student's ranking. [D26] [`system/frontend/src/labs/L1/triplets.ts`]
11. L1 renders the four-colour diff on the overlay and the graph view with its legend, and the engine's warnings beside the readout. [D27] [`system/frontend/src/labs/L1/TripletBuilder.tsx`]
12. L1 and L8 render their own export, of the graph the student made: L1 the student's triplets over the frame's boxes as `kind: 'user'`, `fidelity: 'measured'`, submitted or not; L8 its working copy, under the draft's provenance until the first counted correction and under the provenance `corrections.ts` gives it from then on. [D122] [`system/frontend/src/labs/L1/TripletBuilder.tsx`] [`system/frontend/src/labs/L8/corrections.ts`]
13. L2 scores its own fixture, not a slice, and applies the protocol to the prediction before the engine sees it (`underProtocol`): SGDet keeps the model's boxes and labels, SGCls hands back the ground-truth boxes, PredCls the boxes and the labels, matched by `object_id`, since the engine does not read `protocol`. [D27] [`system/frontend/src/labs/L2/protocol.ts`]
14. L2's fixture is built so that each control moves something, and its test asserts each protocol step twice, as the inequality and as a strict one on the fixture: R@50 under the graph constraint at τ = 0.5 is 0.25, 0.50 and 0.75 for SGDet, SGCls and PredCls. The ordering is asserted of that fixture only, not as a law. [D27] [D98] [`system/frontend/src/labs/L2/fixture.ts`]
15. L2 exposes K, the protocol, the constraint mode (`graph`, `semi`, `none`), τ and the mask pairing, renders every metric through `MetricReadout`, and draws R@K and mR@K over K in {1, 2, 3, 5, 10, 20, 50, 100}. [`system/frontend/src/labs/L2/MetricExplorer.tsx`]
16. L3 fits a frequency prior to a synthetic Zipf corpus and blends it with a hand-written visual scorer that gets the tail right; at λ = 0 the visual scorer is never called. R beats the tail-aware model and mR loses to it, both asserted as strict inequalities, and the covariance gap equals R − mR to ten places. [D43] [D106] [VERIFICATION §4] [`system/frontend/src/labs/L3/freq.ts`]
17. L3 scores at K = 20 of 80 candidates, past the ties a flat conditional produces, and its tail relations sit on pairs the training corpus never shows, where FREQ falls back to the marginal. The blended score is affine in λ, and recall over its ranking is constant in λ except where two blended scores cross. [D43] [D106] [`system/frontend/src/labs/L3/LongTailLab.tsx`]
18. L4 scores each model's prediction against one frame's ground truth under SGDet, the graph constraint, τ = 0.5 and K = 20, and shows R and mR. A figure is `measured` only when the ground truth and the prediction both are, and `reconstructed` otherwise. [D122] [`system/frontend/src/labs/L4/MethodComparator.tsx`]
19. Every L4 column carries a provenance chip, a `reconstructed` column is drawn distinctly with its note on the page, and each model's per-image latency estimate, or the sentence that none was measured, is shown before its Run button. [D40] [VERIFICATION §10] [`system/frontend/src/labs/L4/MethodComparator.tsx`]
20. L4's live button follows the registry's `live`, not `/api/health`'s torch flag, and shows the registry's reason when a model is not live; on a hosted build, where `API_BASE` is set, it shows `l4.live_hosted` instead, which says the hosted demo offers no live inference. [D40] [D127] [`system/frontend/src/labs/L4/MethodComparator.tsx`]
21. L4 shows a live run's 503 under its button with the backend's reason, lists a prediction read that fails other than with a 404 `not_found` with its reason, and waits for the reads before saying there are no predictions. [D122] [`system/frontend/src/labs/mounts.tsx`]
22. L5 computes no metric. Its own panel shows the triplets a run produced and states that R@20 needs a ground truth the corpus does not hold for the Figure 2 frame; the published panel carries all five rows of Table 3, and no `[data-figure]` element holds figures of two fidelities. [D40] [`system/frontend/src/labs/L5/AblationReplay.tsx`]
23. L5's O, P and E are URL parameters, E validated on read; each editor field keeps its raw text while it has focus, an example whose analysis is blank draws a warning, and the "criteria supplied" label reads the run on screen. [D120] [`system/frontend/src/labs/L5/IndVisSGGReplica.tsx`] [`system/frontend/src/labs/L5/TECEditor.tsx`]
24. L6 scores the same fixture predictions under `single_mpo` and `multi_mpo` at SGDet, no constraint and R@20, and sets the two rankings side by side with the published direction in a panel of its own: one-stage 0.75 to 0.25, two-stage 0.50 under both. The lab uses `none` because under `graph` the correction moves R only where two predicted objects share a pair of masks. [D40] [D99] [VERIFICATION §5] [`system/frontend/src/labs/L6/forensics.ts`]
25. L7 turns a caption into a graph by rule over a closed vocabulary, with no language library, and keeps a predicate outside P, marked in the `spurious` style and counted, since `kp:L10` counts one such error twice. [`system/frontend/src/labs/L7/parse.ts`] [`system/frontend/src/labs/L7/CaptionToGraph.tsx`]
26. L8 shows the VLM draft beside its frame and counts four kinds of correction, deletions, additions, predicate rewrites and box adjustments; it counts work rather than distance, a no-op is not counted, and a rewrite is one correction. A box is adjusted by choosing it and drawing its replacement, and the choice clears after one adjustment. [D50] [`system/frontend/src/labs/L8/corrections.ts`]
27. L8 does not call the mini-ISG reference ground truth, never edits the draft, and presents its projection as arithmetic; its draft is IndVisSGG's step 1 from the authored transcript, fetched rather than run. [`system/frontend/src/labs/L8/MiniISGAnnotator.tsx`] [`system/frontend/src/labs/mounts.tsx`]
28. A box in L1 is selected through S9's `ImageOverlay`, by the smallest box containing the click; L8 passes no `onSelect` and chooses the box to adjust from a list, as rule 26 states. [D75] [`system/frontend/src/labs/L8/MiniISGAnnotator.tsx`]

## 5. Verification

**Records:** VERIFICATION §4, VERIFICATION §5, VERIFICATION §10, VERIFICATION §32.

**`npm run ci` steps:** 4 vitest, the `frontend` project (`system/frontend/src/labs/test/mounts.test.tsx`, `api.test.ts`, and each lab's `test/` directory under `system/frontend/src/labs/`); 7 i18n, over the `lab` and `l1` to `l8` keys; 11 frontend build.

**Outside `ci`:** `npm run test:e2e` renders every lab route (`system/e2e/lecture.spec.ts`). `npm run check:offline` (check 6) renders every lab on the placeholder slice alone (`system/e2e/offline.spec.ts`). `npm run check:perf` times an interaction in L1, L2, L3, L7 and L8 against NFR-8's 100 ms, requires L4's latency line before any inference, and clicks the centre of a box in L1 (`system/e2e/perf.spec.ts`).

**What the records measure.** §4 is L3's two strict inequalities and the covariance identity (check 4). §5 is L6's forensics in both pairing modes (check 5), which reproduces the published direction and not its magnitudes. §10 times five labs, 0.0 to 2.1 ms of work above the two-frame floor on 2026-09-19, and records why L4, L5 and L6 are not timed. §32 is the run of D122, which changed L1's K, L4's failures and fidelities, and where the labs' exports are rendered.

## 6. Traps

- A mutation run is a test of the tests, and one sharing a working tree with another process is not one: a backgrounded loop restored a file while the foreground run read it. [D61]
- A component test that never runs the real container is a test of the fixture: L5's run reached no panel while every test passed. [D40]
- An invariant that holds because both sides are equal for every input cannot fail: three calls to `evaluate` differing only in `protocol` return one number three times. [D27]
- Swapping the overlay's objects from the working copy to the draft left every L8 test green, so nothing observed the student's geometry until box adjustment was wired. [D50]
- A `.ts` test under `system/frontend/src/` was collected by no vitest project until the include admitted `.test.ts`, and would have passed by never running. [D43]
- An input-to-paint measurement that awaits two animation frames cannot report less than two frame intervals, so five labs all came back at the display's cadence. [D74]

## 7. History

**Binding decisions:** none.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`, `2026-09-15-03-models-and-vlm.md`, `2026-09-15-04-labs-shells-hardening.md`, `2026-09-15-scene-graph-studio-PRD.md`.

| Deviation | Effect | Role |
|---|---|---|
| D26 | the plan's lab URL cannot round-trip a built graph | primary |
| D27 | the engine does not read `protocol`, so the ordering invariant was untestable | primary |
| D40 | L5 has no ground truth to score against, and L4 has nothing to compare | primary |
| D43 | three of plan 04 Task 1's four assertions could not hold as written | primary |
| D50 | the box-adjustment category was inert until it was wired | primary |
| D60 | `/lab/:labId`, and the endpoint a standalone lab needed | primary |
| D61 | the mutation run that raced its own restore | primary |
| D66 | the export, and the two things it refuses to do | secondary |
| D74 | NFR-8 was the one requirement with no enforcer, and the instrument reported itself | secondary |
| D75 | a box is clickable on its outline only, and widening it has a cost | secondary |
| D98 | M3's playgrounds, E1 and E10, and four statements about matching and protocols | secondary |
| D99 | the graph constraint was keyed on class pairs; the reference keys it on object pairs | secondary |
| D106 | M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D127 | the frontend on GitHub Pages and the backend on Render | secondary |

## 8. Open items

1. L4's live-inference paths, the 503 shown under the button and a returned graph taking its column as `measured`, are held by stubbed tests only, since live inference cannot be reached on a real backend while `registry.WIRED` is empty. [D122]
2. One mutant of L8 survives deliberately: forcing the overlay into draw mode changes no counted behaviour, only the cursor, which no test can see. [D50]
3. PRD §6.2 names a shared four-colour scoring view for L1, L4, L5 and L8, and plan 03 Task 9 gives each L4 column a `SceneGraphView` in diff mode. Only L1 renders the diff: L4 shows R and mR per column, L5 has no ground truth to score against (D40), and L8 counts corrections; no record states the change for L4 or L8. [PRD §6.2] [`2026-09-15-03-models-and-vlm.md`] [`system/frontend/src/labs/L4/MethodComparator.tsx`]
4. Contracts §2.2 gives `/lab/L2?ds=vg150-sgb&img=2317469&…` as a URL that fully determines what L2 shows. L2 scores its committed fixture and reads no `ds` or `img`; the example was not amended. [contracts §2.2] [D60] [`system/frontend/src/labs/mounts.tsx`]
