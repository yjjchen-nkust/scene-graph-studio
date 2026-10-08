# S3 Datasets, slices and licences

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/backend/app/datasets/` | Dataset adapters, licence gates and the slice loader |
| `system/backend/scripts/cut_slice.py` | Cuts a teaching slice from a corpus the author downloaded |
| `system/backend/scripts/bundle_slices.py` | Packs slice images into the class bundle |
| `system/backend/scripts/verify_bundle.py` | Checks an unpacked bundle against the manifests |
| `system/backend/scripts/make_placeholders.py` | Generates the synthetic placeholder slice |
| `system/backend/scripts/cut_mini_isg.py` | Cuts the mini-ISG frames from IndustReal |
| `system/backend/scripts/build_mini_isg.py` | Builds the mini-ISG artefacts from one authored file |
| `system/backend/scripts/fetch_images.py` | Fetches images by identifier for datasets that may not be redistributed |
| `system/backend/scripts/make_adapter_fixture.py` | Builds the synthetic COCO-parquet adapter fixture |
| `system/backend/scripts/make_psg_fixture.py` | Builds the synthetic PSG adapter fixture |
| `system/backend/tests/fixtures/` | Synthetic adapter fixtures |
| `system/backend/tests/test_adapters.py` | Tests of the COCO-parquet adapters |
| `system/backend/tests/test_psg_adapter.py` | Tests of the PSG adapter |
| `system/backend/tests/test_slices.py` | Tests of the slices |
| `system/backend/tests/test_mini_isg.py` | Tests of the mini-ISG artefacts |
| `data/slices/` | Slice annotations, manifests and images (NAS) |
| `data/LICENCES.md` | The licence gates per dataset (NAS) |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §9, VERIFICATION §14.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** D-08, D-09, D-10, D-18.

**Specs and plans:** `2026-09-15-01-skeleton-and-eval-engine.md`, `2026-09-15-04-labs-shells-hardening.md`.

| Deviation | Effect | Role |
|---|---|---|
| D6 | the five corpus adapters are deliberately not written | primary |
| D13 | the licence check ran, and PSG cannot be bundled | primary |
| D17 | `cut_slice.py` gets images from the adapter, not only from disk | primary |
| D18 | `pyarrow` enters the backend, outside the evaluation engine | primary |
| D19 | two slice tests encoded a state rather than a rule | primary |
| D21 | PSG annotations describe a corpus larger than the one on disk | primary |
| D25 | the image endpoint served the one slice that was synthetic | primary |
| D45 | the mini-ISG gate: one source cleared, one shut | primary |
| D46 | the manifest was written where the application does not look | primary |
| D47 | D-10's tail condition cannot be met by a seven-word dictionary | primary |
| D48 | `bundle_slices.py` has no cleared set to add mini-ISG to | primary |
| D49 | one model drafted the mini-ISG set and the same model corrected it | primary |
| D51 | what the review of D46–D50 found | primary |
| D84 | the suite was red in the configuration where the adapters are actually tested | primary |
| D91 | the instrument rewritten to stop skipping silently, which still did | secondary |
| D93 | M1's three playgrounds, and the premise X1 could not be built on | secondary |
| D99 | the graph constraint was keyed on class pairs; the reference keys it on object pairs | secondary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D109 | all of `data/` on the NAS, and none of it in git | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | secondary |

## 8. Open items

DRAFT
