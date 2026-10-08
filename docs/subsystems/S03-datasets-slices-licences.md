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

DRAFT

## 6. Traps

DRAFT

## 7. History

DRAFT

## 8. Open items

DRAFT
