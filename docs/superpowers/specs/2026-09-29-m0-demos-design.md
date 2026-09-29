# M0 demonstrations: the traditional pipeline and IndVisSGG on one clip (design)

Two motivating demonstrations for M0, placed between s6 and the L1 lab. Both run on the same
IndustReal clip. The first, **D-T**, shows the traditional detect, enumerate and classify pipeline
and four of its shortcomings. The second, **D-V**, shows the anchor paper's method end to end on the
same frames, one stage per step. This design adds a step kind, `demo`, and amends contracts §2.4 to
admit it.

Governed by `…-decisions.md`, `…-contracts.md` §2.4, the eight NFRs of `docs/INDEX.md` §3, and the
playground designs before this one. Where this document and those disagree, they win and this one is
wrong.

---

## 1. Context

M0 teaches why a scene graph is needed (F1, F2, F5, F8) in eight steps: s1 prose, s2 and s3 F1's two
parts, s4 the multigraph definition, s5 F2, s6 F8, s7 the L1 lab, s8 the checkpoint. Nothing in M0
shows a scene graph being *produced*, and nothing before M11 shows the anchor paper's method at
work. The demonstrations give M0 that motivation: a clip of real assembly work, what the pipeline
of M5 does to it, and what IndVisSGG does to it.

### Decisions taken with the author, 2026-09-29

| Question | Answer |
|---|---|
| Reference video | **An IndustReal clip** already on the NAS (`_raw/industreal/all_rgb_videos.zip`). Rejected: a staged rebuild of the paper's Figure 6, which exists as no video; a clip supplied later, which has no licence finding. |
| Form | **In-app M0 steps**, bilingual, offline, driven by the presenter's keys. Rejected: rendered MP4s, and both. |
| Provenance | **Measured where feasible.** The detector is run; the VLM is called; both are recorded once and replayed offline. Rejected: authored reconstructions throughout, and a mixed arrangement. |
| Shortcomings shown | **All four:** closed vocabulary, pair explosion, generic predicates, no temporal coherence. D-V answers each one that it can, and §2 states the one it cannot. |
| Placement | **After s6, before the L1 lab.** G = (V, E), the candidate count and direction are defined by then, and s1's rule that the room names the scene graph first stays intact. Rejected: the module's opening, and a split across s1 and s6. |
| Mechanism | **A new `demo` step kind** (§5). Rejected: registering the demonstrations as playgrounds, which D111's rule excludes because a playground computes a count, a bound, a set membership or a value of its rule and never replays a pipeline; and a sequence of `figure` steps, which carries no video and no interaction. |

---

## 2. What the sources say

Read on 2026-09-29.

**The method is per frame.** Equations (2) and (3) of the paper take the frame V_t, the dictionaries
O and P, the examples E and, in (3), the step-1 output for the same t. Equation (4) takes the
experts' revisions and analyses. No equation takes the graph or the frame at t − 1. The temporal
scene graph of §5.2.4 and Figure 6 is the per-frame outputs set side by side, "the dotted lines
indicate disappeared edges and nodes, while the blue lines represent newly added edges and nodes".
**D-V may therefore show a measured edge churn beside D-T's, and may not claim that the method
enforces temporal coherence.** What the closed vocabulary does provide is naming: an entity is
called by the same word in every frame, so a change between two frames is a change of relation and
not of wording.

**The paper's case against the prior art** is §2.2's four points (reading notes §2): loose boxes,
unbounded regions, junk annotation, and the long tail of panoptic SGG. The supervision argument, that
relation classifiers need relationship-level annotation industrial footage does not have, is §1.

**The live VLM path is blind.** `system/backend/app/vlm/claude.py:39-43` sends the prompt text as
the whole message and never attaches the frame; `image_ref` is accepted and unused. Every exchange
recorded through it describes a frame the model did not see. §3.3 fixes this before anything is
recorded.

**The vocabularies.** `O_ISG` holds twelve classes and `P_ISG` seven predicates
(`system/backend/app/vlm/prompts.py:44-58`). The vg150-sgb slice, 80 VG150 frames, carries 892
relationship rows over 36 of VG150's 50 predicates; `on` is 382 of them. Of `P_ISG`, `holding` (13),
`attached to` (12), `on` (382) and `near` (59) occur in the slice, and `assembling`, `inserted into`
and `reaching for` do not. Computed from `data/slices/vg150-sgb/annotations.json` on 2026-09-29.

**The detector.** torchvision's Faster R-CNN ResNet-50 FPN with COCO weights
(`fasterrcnn_resnet50_fpn_coco-258fb6c6.pth`) is cached on the author's machine, and py12 carries
`torch 2.10.0+cu128` with the RTX 3090 exercised (VERIFICATION §13). COCO's 80 classes are generic;
none of them is a construction-toy part.

---

## 3. Data and provenance

### 3.1 The clip and the frames

**Source.** IndustReal `01_assy_0_1.mp4`, participant 01, the video isg-001 and isg-002 were cut
from: MPEG-4 Part 2, 1280×720, 10 fps, 184.5 s. **Segment: 88.0 to 106.0 s.** In it a hand reaches
for the axle, holds the wheel and the axle, inserts the axle into the wheel, and attaches the wheel
to the assembly.

**Clip.** Transcoded to H.264, 1280×720, no audio track, to `data/demos/m0/clip.mp4`. Its size is
measured and recorded; the budget is 5 MB.

**Frames.** Ten JPEGs at 2.0 s spacing, 88.0 s to 106.0 s, to `data/demos/m0/frames/`. Three are
the keyframes t1 = 90.0 s, t2 = 96.0 s and t3 = 102.0 s, laid out in D-V's last part as Figure 6 is.
Both pipelines run on all ten, so the churn of §4 is compared over the same inputs.

**Manifest.** `data/demos/m0/MANIFEST.json` gives, per file: source video, timestamp, SHA-256,
bytes, dimensions, the IndustReal DOI, and the licence finding.

**Licence.** IndustReal is Apache-2.0 for the data (`data/mini-isg/LICENCE.md`). A row for
`demos/m0` is added to `data/LICENCES.md` **before** the clip or any frame is written, as D-18
requires.

### 3.2 D-T: the traditional pipeline

`system/backend/scripts/record_demo_traditional.py`, run once on the author's machine, CUDA.

1. **Detect.** Faster R-CNN R50-FPN, COCO weights, score threshold 0.5. Boxes, COCO labels and
   scores per frame. This is the model's output.
2. **Enumerate.** Every ordered pair of detections: n(n − 1) pairs, and n(n − 1)·|P| candidate
   triplets with |P| = 50, VG150's count.
3. **Classify.** Each ordered pair receives argmax_p f(p | c_s, c_o), where f counts the
   predicate over the slice's 892 rows for the subject and object classes, after a stated COCO to
   VG150 class map (for instance `dining table` to `table`). A class pair the slice never shows
   falls back to the slice's most frequent predicate, `on`. This is the FREQ baseline of Zellers et
   al. (2018) in form, counted over 80 frames rather than the training split, and the note says so.

Output: ten `SceneGraph` files under `data/demos/m0/traditional/`, `provenance.kind: 'model'`,
`fidelity: 'measured'`, `model: 'fasterrcnn-r50fpn-coco+freq-vg150sgb'`, and a section of that name
in `data/predictions/PROVENANCE.md` giving the checkpoint, the class map, the threshold, the
hardware, the torch build, the commit and the date. The audit of `app/infer/provenance.py`, which
`backend/tests/test_registry.py` runs over `data/predictions/`, is run over
`data/demos/m0/traditional/` in the same test, so a `measured` file here that PROVENANCE.md does not
account for fails CI as one there does.

### 3.3 D-V: IndVisSGG

**The provider fix first.** `ClaudeProvider.complete` attaches the frame named by `image_ref` as a
base64 JPEG image block before the prompt, and takes a `model` argument defaulting to its present
constant, so L5's live path is otherwise unchanged. A test with a fake client asserts the image block
is present and precedes the text. The recorder passes `claude-opus-5-5`, the most capable model
available on 2026-09-29, and the id is confirmed against the `claude-api` reference before the
first call.

[Amended 2026-09-29 (D114), sampling settings 2026-09-30: the recording model is `stamping-vlm`, the weights
`Qwen/Qwen3.8-27B` served by vLLM on the author's pro6000 over Tailscale, through the new OpenAI-compatible
provider (`app/vlm/openai_compat.py`) with thinking off and Qwen3's published non-thinking settings
(temperature 0.7, top_p 0.8, top_k 20, presence_penalty 1.5, max_tokens 2048; greedy decoding degenerated on
the first call), and not `claude-opus-5-5`. The seed is derived from each exchange's key, so a call is
reproducible from the transcript and the three experts sample independently; each completion is one seeded
sample. The recorder takes `--provider`. The `ClaudeProvider` fix above stands for L5.]
[Amended 2026-09-30 (D115): the expert prompt carries the criteria O, P and E, as Eq. (3) has them,
and asks for labelled `ANALYSIS_EN` and `ANALYSIS_ZH` sections, which `parse_analysis` reads; D-V is recorded again under it.]

`system/backend/scripts/record_demo_indvissgg.py` runs `indvissgg.step1`, `step2` with N = 3 and
`step3` on each of the ten frames under `O_ISG`, `P_ISG` and `EXAMPLES_ISG`: 50 calls. Every
exchange (prompt, `image_ref`, context, key, completion) is appended to
`data/vlm/transcripts/m0-demo.json`, whose provenance block reads `recorded: true` with the model
and the date. The frames are keyed `m0-demo-088` to `m0-demo-106`. **Prerequisites:**
`SGS_VLM_BASE_URL` (the pro6000 endpoint, `http://100.86.97.101:8001/v1`) and `SGS_VLM_MODEL`
(`stamping-vlm`) in the environment, no key. `ANTHROPIC_API_KEY` and the `anthropic` package on py12 are
needed only for `--provider claude`; nothing is committed.

Replayed, the graphs carry `fidelity: 'reconstructed'` and `vlm: 'transcript'`, as `to_graph`
requires of any replay; the demo shows the transcript's own provenance beside them, so the room
sees which model produced the text and when.

### 3.4 One source per artefact

`system/backend/scripts/build_demo_m0.py` derives `data/demos/m0/traditional.json` and
`data/demos/m0/indvissgg.json`, the two files the frontend reads, from the recorders' outputs. A
pytest rebuilds both and asserts they equal the files on disk, as `build_mini_isg.py`'s test does.
torch is imported inside functions only (NFR-1), and neither script is on the API's path.

### 3.5 What is not computed

No R@K, mR@K or other metric, and no comparison with mini-ISG's reference annotations. The demos
show counts, set memberships and set differences over what was recorded. Scoring belongs to L5 and
L8.

---

## 4. The demos

One stage per step, through D96's parts mechanism. The clip plays in part 1 of each demo, where the
presenter picks one of the ten frames; the choice carries to the later parts as a playground's knobs
do.

| Shortcoming | D-T part | D-V part | Computed |
|---|---|---|---|
| Closed vocabulary | **T1**: the frame with COCO boxes and labels; each `O_ISG` class marked with or without a COCO counterpart under the class map | **V1**: the TEC prompt for the same frame, its INFORMATION, O, P, E and FORMAT parts | n detections; `O_ISG` classes with no COCO class |
| Pair explosion | **T2**: the ordered pairs enumerated, n(n − 1)·50 | **V2**: the step-1 draft, triplets from one call; terms outside O or P flagged | candidates per frame; calls per frame (N + 2 = 5) and triplets emitted |
| Generic predicates | **T3**: each pair's argmax predicate; the predicate histogram, with `P_ISG`'s predicates marked present or absent | **V3**: each expert's revision as deletions, additions and rewrites, with its recorded analysis; **V4**: the summary graph, triplets only | the two predicate histograms |
| No temporal coherence | **T4**: the ten per-frame graphs as a strip | **V5**: t1, t2 and t3 in Figure 6's style, removed edges dotted and added edges blue | per step, \|E_t Δ E_{t+1}\| and \|E_t ∪ E_{t+1}\|, for both pipelines side by side |

**E_t for churn** is the set of distinct class-level triplets ⟨c_s, p, c_o⟩ at frame t. Neither
pipeline tracks identity across frames, so two detections of one class collapse, as F6 and F7 count
distinct triplets (D96).

**Rules the parts keep.**

- V4 and V5 draw graphs without boxes: the method emits no geometry (`indvissgg.py`,
  `NO_GEOMETRY_EN`).
- V5's caption states that each frame is generated independently, per §2. A lower churn, if
  measured, is a finding on this clip and not a property of the method.
- **Step prose and presenter notes are written after recording, from the recorded artefacts.** If
  an expert changes nothing, or the VLM names a part the frame does not show, the demo shows it.
  No figure in a step's text is fixed before the run.

**Budget.** D-T: four steps, 60 + 60 + 60 + 90 s. D-V: five steps, 60 + 60 + 120 + 60 + 120 s.
M0 grows from 8 steps to 17, and by 690 s.

---

## 5. The `demo` step kind

**Contract, §2.4 amended.** `kind: 'demo'` with `demo: 'DT' | 'DV'` and `part: n`. The body
carries exactly one `<Demo id="…" part="n"/>` naming the same demo and part, supplied through the
MDX `components` prop as `Playground` is, so no module imports it. `DEMO_PARTS = { DT: 4, DV: 5 }`
in `frontend/src/demos/mounts.tsx` registers the count. A demo replays recorded artefacts and
computes only counts, set memberships and set differences over them, never a metric; nothing in
`frontend/src/demos/` imports from `sgg-metrics` except its types.

**Lint.** Five rules in `system/tools/content_lint.mjs`, each watched failing in
`system/tools/test/content_lint.test.mjs`:

1. A `demo` step declares `demo` and `part`.
2. Its body carries exactly one `<Demo>` whose `id` and `part` equal the step's.
3. A demo's parts are 1 to N on consecutive steps of one module, in order, and N is its count in
   `DEMO_PARTS`.
4. Every artefact a demo registers exists under `data/demos/` and carries a provenance block.
5. A `demo` step declares `seconds_budget`.

The presenter-note rules (D76) and the locale rules apply to the new steps unchanged.

---

## 6. Units

**Frontend, `frontend/src/demos/`.**

| Unit | Purpose |
|---|---|
| `logic.ts` | pure functions: pair and candidate counts, vocabulary membership, predicate histograms, E_t and churn |
| `ClipPlayer.tsx` | HTML5 `<video>` with ten frame ticks and the three keyframes marked; Space yields to its controls, per §2.4 |
| `DemoFrame.tsx` | the panel, its provenance line, the `dense` layout where 1024×768 needs it |
| `DT/Part1.tsx` to `DT/Part4.tsx`, `DV/Part1.tsx` to `DV/Part5.tsx` | one component per part |
| `mounts.tsx` | the registry and `DEMO_PARTS` |

Boxes are drawn through `PhotoMarks` over the photograph's exact box (D75, D96, D97); graphs
through the §2.6 components. The artefacts and the clip are imported at build time from
`data/demos/m0/`, reached through the existing `fs.allow` and `data.dir.ts`. Every interface string
exists in both locales. The experts' `ANALYSIS_ZH` sections are model output and are shown
verbatim, labelled as such.

**Backend.** `app/vlm/claude.py` (§3.3), the three scripts of §3.2 to §3.4, and their tests.

**Content.** Nine new steps in `m00.en.mdx` and `m00.zh-TW.mdx`, s7 to s15; the lab and the
checkpoint become s16 and s17, and the M0 id list in `content/test/registry.test.tsx:58` changes
with them.

---

## 7. Testing

| Suite | What it holds |
|---|---|
| pytest | the provider's image block and its order; derive parity for both files; the class map covers every COCO label that appears in the ten frames |
| vitest | `logic.ts` on hand-computed cases; the registry and `DEMO_PARTS`; each part renders in both locales |
| content lint | the five rules, each watched failing |
| e2e projector | all nine parts fit 1024×768 in 繁體中文 in their longest state; the photographs are whole and on screen; the marks sit on their objects; the keyboard walkthrough passes through the clip's controls |
| `check:perf` | input-to-paint on the nine parts |
| `check:offline` | the demos make no outward request |
| `npm run ci` | green, eleven steps |

---

## 8. Records

- `DEVIATIONS.md`: D112 onward, the first being the provider fix of §3.3.
- `docs/VERIFICATION.md` §31: the recording runs, their dates, sizes and counts.
- `data/predictions/PROVENANCE.md`: the D-T section of §3.2.
- `data/LICENCES.md`: the `demos/m0` row, written before any file of §3.1.
- `docs/INDEX.md`, `CLAUDE.md` and `README.md`: the step kind, the counts, and M0's seventeen
  steps.
- Contracts §2.4: the amendment of §5, marked as such in place.

`data/` is one copy shared by every branch (D111). The branch adds files and changes none, and is
merged promptly after a fetch.

---

## 9. Risks

| Risk | Consequence | Handling |
|---|---|---|
| The recorded run does not show a shortcoming answered, for instance D-V's churn exceeds D-T's | the motivation is weaker than intended | the demo shows what was recorded; the prose is written afterwards (§4) |
| COCO detects hands as `person` and little else | T2 and T3 run over few objects | that is the closed-vocabulary shortcoming measured; the counts say so |
| The clip exceeds 5 MB | the bundle grows | lower the bitrate, then shorten the segment, and record the change |
| The provider fix changes L5's live answers | L5 live runs now see the frame | intended; recorded as a deviation |

---

## 10. Out of scope

Scoring either pipeline; MP4 exports of the demos; other clips; RelTR, EGTR or any two-stage model
beyond §3.2; changes to L5 beyond the image block; the knowledge map page and its harvest.
