# Provenance of every committed prediction

Decision D-07 in one sentence: a prediction file in this tree says how it was obtained, or it is a
defect. `system/backend/app/infer/provenance.py` enforces it and
`system/backend/tests/test_registry.py` runs the rule over this tree on every CI pass.

Two rules, and they differ in what they demand:

| `provenance.fidelity` | What it asserts | What this file must carry |
|---|---|---|
| `measured` | A model produced this, on a machine, on a date | A section below naming the model, the checkpoint, the hardware, the commit and the date |
| `reconstructed` | This reproduces a published *behaviour* without being that model's output | `provenance.note` on the file itself, naming the behaviour and saying whose output it is not |

A `measured` file whose `provenance.model` appears nowhere below fails CI. That is the whole
mechanism: the audit trail is not documentation about the data, it is a precondition of the data
being allowed to exist.

**`reconstructed` is never described as a model's output.** It renders unverified and in the
reconstructed style (NFR-2), and the note travels with the graph rather than living here, so it
survives the file being read on its own.

---

## Status, 2026-09-18

**Committed: 30 reconstructed files.** Five models over the six frames of the `placeholder` slice,
which is the one slice every clone has, so the labs work on a bare checkout (NFR-1).

**Committed: no measured file.** None of the five models above has been run. The three reasons are below and none
of them is "nobody got round to it".

**Recorded, not committed: ten measured files (2026-09-29).** `data/demos/m0/traditional/` holds the M0 demonstration's
traditional pipeline over ten IndustReal frames, model `fasterrcnn-r50fpn-coco+freq-vg150sgb`, accounted for in the
section of that name below. They are the only measured files in this tree.

---

## Licences, which decided most of this

| Project | Licence | Consequence here |
|---|---|---|
| **RelTR** (`yrcong/RelTR`) | **None.** The GitHub API reports `license: null` and the repository holds no LICENSE file | Default copyright: no right to copy, modify or redistribute was granted. Its source is **not vendored**, and `system/backend/tests/test_reltr.py::test_no_reltr_source_is_vendored_into_this_repository` fails the moment any of it appears here. The operator clones it and sets `SGS_RELTR_PATH`. |
| **EGTR** (`naver-ai/egtr`) | Apache-2.0 | Could be vendored with attribution. Not vendored yet; nothing needs it until a measured tier exists. |
| Checkpoints, both projects | Distributed via Google Drive | Not fetchable with a hash, not redistributable from here. They go in `data/checkpoints/<model>/`, which this track's `.gitignore` excludes. |

RelTR was named in plan 01 as the one live-capable model before anyone read its licence. That is
the same gap D13 found for the PSG images, one layer up: an assumption about what may be
distributed, made while looking at the code rather than at the terms.

---

## Per-model sections

*(The audit's lookup: a `measured` file's `provenance.model` must appear in the text of this
file. The sections for `reltr`, `egtr`, `motifs`, `vctree` and `psgformer` are statements that nothing was run;
the last section, `fasterrcnn-r50fpn-coco+freq-vg150sgb`, is a statement that something was.)*

### reltr

Not run. Three gates, all shut on this machine: `torch` is present, but there is no checkpoint in
`data/checkpoints/reltr/` and `SGS_RELTR_PATH` is unset. `system/backend/app/infer/reltr_cpu.py`
carries the conversion from decoded output to `SceneGraph` — tested against synthetic detections,
because that part needs no weights — and leaves the decode step unimplemented rather than guessing
at a class list and box convention that live in code this project may not read into itself.

`estimated_seconds_per_image` is therefore `null`, not a plausible constant. NFR-8 asks for a
measurement; a number nobody measured would be believed.

### egtr

Not run. Apache-2.0, so the path is open when someone wants it; no checkpoint is on this machine.

### motifs

Not run. Blocked from live inference by `maskrcnn-benchmark`, which is unmaintained and pinned to
a PyTorch and CUDA generation this project does not install.

### vctree

Not run. Blocked for the same reason as `motifs`.

### psgformer

Not run. Blocked by `detectron2`, which does not build here — twice, with two distinct failures.
The spike log below is the evidence.

### fasterrcnn-r50fpn-coco+freq-vg150sgb

Run. The traditional scene-graph pipeline of the M0 demonstration D-T (detect, enumerate ordered pairs, classify
each pair's predicate), over the ten frames `m0-demo-088` to `m0-demo-106` of IndustReal clip `01_assy_0_1.mp4`.
Written by `system/backend/scripts/record_demo_traditional.py` to `data/demos/m0/traditional/`, with the detection
scores in `data/demos/m0/detections.json` (the schema forbids a score on an object). Not under `data/predictions/`:
the audit test `test_the_demo_predictions_pass_the_same_audit` reads that directory against this file.

- **Detector.** torchvision `fasterrcnn_resnet50_fpn`, weights `FasterRCNN_ResNet50_FPN_Weights.COCO_V1`, file
  `fasterrcnn_resnet50_fpn_coco-258fb6c6.pth` (from the local torch hub cache, no download). No fine-tuning. Detections
  with score >= 0.5 (`THRESHOLD`). Labels are COCO's, kept verbatim as the object's name.
- **Predicate prior.** FREQ in form, computed over the vg150-sgb *slice* (80 frames, 892 relationship rows, 36
  distinct predicates), not over the VG150 training split. For an ordered pair, the predicate most frequent for that
  pair of classes (subject and object `names[0]`), ties broken by predicate name ascending. A pair never seen in the
  slice, or with a class that maps to no slice class, takes the fallback `on` (the slice's most frequent predicate,
  382 rows). The pair is classified from the labels alone, the boxes are not read. |P| = 50 is the VG150 predicate
  count; the slice realises 36 of them.
- **`CLASS_SYNONYMS`** (COCO label to slice class, where the names differ): `"dining table": "table"`,
  `"cell phone": "phone"`. A COCO label equal to a slice class maps to itself. The plan's third entry,
  `"tv": "screen"`, was dropped: the slice has no class `screen`, `tv` or `monitor`, and the test
  `test_every_synonym_target_is_a_class_of_the_slice` fails on it.
- **`O_ISG_COCO`** (the twelve mini-ISG classes to the COCO category naming the same kind of thing): only
  `"workbench": "dining table"` is non-null; `hand`, `beam`, `brace`, `block`, `wheel`, `axle`, `pin`, `nut`,
  `washer`, `assembly` and `instruction sheet` are `None`. `hand` is `None` because COCO's `person` is the whole
  body.
- **Detected labels, ten frames, 52 detections.** `person` 26, `remote` 19, `donut` 2, `book` 1, `cell phone` 1,
  `knife` 1, `tie` 1, `toothbrush` 1. `person`, `book`, `tie` and `cell phone` (as `phone`) map to a slice class;
  `remote`, `donut`, `knife` and `toothbrush` map to none, so every pair with one of them takes the fallback.
  No `dining table` was detected, so `O_ISG_COCO`'s one entry is not exercised by these frames.
- **Hardware and software.** NVIDIA GeForce RTX 3090 (the developer's workstation), `torch 2.10.0+cu128`,
  `torchvision 0.25.0+cu128`, py12.
- **Commit and date.** Script at commit `d21007a` on branch `feat/m0-demos`; run 2026-09-29.
- **What this is not.** These files are a demonstration of a pipeline's stages on ten frames. No metric is computed
  from them, and they are not compared with mini-ISG's reference annotations. Their `dataset` is `mini-isg` (D113).

---

## Spike log

### 2026-09-18 — `detectron2` does not build against a current torch on this machine

Run inside a throwaway virtual environment at
`…/scratchpad/spike/venv`, never the project environment, which keeps its CPU wheel so NFR-1
stays testable.

**Machine.** NVIDIA GeForce RTX 3090, 24 GB, driver 595.79. CUDA toolkits 11.7, 12.6 and 13.1
installed; 12.6 selected to match the torch wheel. Microsoft Visual Studio 2022 Community, MSVC
14.44.35207. Plan 03 Task 3 describes this machine as an **RTX 3070 Ti**; it is a 3090.

**Step 1 — CUDA torch. Succeeded.**

```
python -m pip install torch --index-url https://download.pytorch.org/whl/cu126
python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available())"
→ torch 2.14.0+cu126   cuda build 12.6   available True
```

So the GPU path itself is fine. Nothing that follows is about the hardware.

**Step 2 — first build attempt. Failed.**

```
set CUDA_HOME=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6
set TORCH_CUDA_ARCH_LIST=8.6
python -m pip install --no-build-isolation -e ./detectron2
```

> `torch/headeronly/macros/Macros.h(161): error C2429: language feature`
> `'nested-namespace-definition' requires compiler flag '/std:c++17'`
> `c10/util/StringUtil.h(76): error C2039: 'optional': is not a member of 'std'`
> `c10/util/StringUtil.h(171): error C7555: use of designated initializers requires at least '/std:c++20'`

detectron2's `setup.py` passes no `/std:` flag, so MSVC defaults to C++14 while torch 2.14's
headers require C++17 and, in places, C++20.

**Step 3 — second attempt with the standard forced. Failed differently.**

```
set CL=/std:c++20
python -m pip install --no-build-isolation -e ./detectron2
```

56 compiler errors, past the header problem and into the device code:

> `error C2065: 'blockIdx': undeclared identifier`  ·  `error C3861: identifier not found` (×27)
> `error C2672: 'safe_max': no matching overloaded function found`

`blockIdx` is CUDA device state, so the `.cu` sources are reaching `cl.exe` as host code. That is
a build-system fault in detectron2's Windows path, not a missing dependency, and fixing it means
patching a third-party build.

**Decision.** Stopped well inside the four-hour timebox: two attempts, two distinct and definitive
failures, and the second is not the sort that a flag fixes. `detectron2` stays listed as blocked
with that reason in `system/backend/app/infer/registry.py`, Motifs and PSGFormer stay unrun, and
the labs are served by the reconstructed tier below. Nothing was carried into the repository; the
venv and the clone are throwaway.

---

## The reconstructed tier

Written by `system/backend/scripts/reconstruct_predictions.py`, deterministic under seed
`20260918`, and regenerable by anyone: `python backend/scripts/reconstruct_predictions.py`.
`test_the_committed_files_match_what_the_script_regenerates` fails if the committed files and the
script ever disagree, so the sentence you are reading stays true of the data.

**What a profile claims is narrow.** Plan 03 Task 4 describes this as taking "a target recall
profile". Targeting a published figure would invite the reading that the file reproduces it,
which on six placeholder frames it cannot. So a profile states two checkable things instead:
whether this style of model emits several predictions at one ordered pair, and roughly how much
of the ground truth it recovers. The labs need one duplicating style and one non-duplicating
style; that is the entire requirement.

| Model | Style | Duplicates a pair | R@20 | mR@20 |
|---|---|---|---|---|
| `egtr` | one-stage | yes | 77.8 | 77.8 |
| `reltr` | one-stage | no | 66.7 | 66.7 |
| `vctree` | two-stage | no | 63.9 | 63.9 |
| `motifs` | two-stage | no | 61.1 | 61.1 |
| `psgformer` | one-stage panoptic | yes | 61.1 | 61.1 |

**Those figures are a sanity check on the reconstruction and nothing else.** They are SGDet under
the graph constraint at K = 20, averaged over six synthetic frames whose ground truth has three to
six relations each. What is being checked is that the engine runs end to end on committed files,
that the magnitudes are neither 0 nor 100, and that the protocol and constraint tags come through.
They are not a reproduction of anything, they rank nothing, and `R` equalling `mR` is an artefact
of a slice with roughly one relation per predicate class rather than a finding.
