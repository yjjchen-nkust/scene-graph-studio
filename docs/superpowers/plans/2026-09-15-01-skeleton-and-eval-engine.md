# Plan 01 — Skeleton and Evaluation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Both servers boot, the canonical schema validates, the 200-image slices load, and the evaluation engine computes R@K, mR@K, ng-R@K and zR@K identically in Python and TypeScript against hand-checked golden vectors.

**Architecture:** A FastAPI backend whose `app/eval/` package is pure Python standard library, mirrored by an `sgg-metrics` npm workspace package with no dependencies. Both read one shared golden-vector fixture; `system/tools/parity.mjs` diffs their outputs and fails CI on disagreement. Everything above them — labs, shells, content — is built in later plans against the API this one defines.

**Tech Stack:** Python 3.12 · FastAPI 0.136.1 · Pydantic v2 · pytest · Vite 8 · React 19 · TypeScript · Vitest · npm workspaces

**Spec:** `../specs/2026-09-15-scene-graph-studio-SRS.md` §2–§5, §8
**Decisions:** `../specs/2026-09-15-scene-graph-studio-decisions.md` — D-03, D-04, D-08 through D-12, D-15, D-16
**Contracts:** `../specs/2026-09-15-scene-graph-studio-contracts.md` — §1 API, §2.1 workspace, §4 conventions

## Global Constraints

See `2026-09-15-00-master.md` § Global constraints. The four that bite hardest in this plan:

- **Node ≥ 22.12 LTS before Task 1 completes.** `vite@8.3.0` declares `engines: ^20.19.0 || >=22.12.0`; the measured version is 20.16.0.
- **`system/backend/app/eval/` imports nothing outside the Python standard library.** No numpy, no scipy, no pycocotools.
- **Test-first without exception in Tasks 5–14.** Write the failing test, run it, watch it fail, then implement.
- **`system/web/knowledge-map/pg.js evaluate()` is not the engine and must not be consulted.** Decision D-14 sets out why.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | Workspace root; the `ci` script that defines "green" |
| `system/packages/sgg-metrics/src/types.ts` | Wire types, shared by the engine, the app and the parity harness |
| `system/packages/sgg-metrics/src/iou.ts` | Box IoU |
| `system/packages/sgg-metrics/src/rle.ts` | COCO RLE decode, mask IoU |
| `system/packages/sgg-metrics/src/match.ts` | The match relation, greedy assignment, verdicts |
| `system/packages/sgg-metrics/src/constraint.ts` | `graph` / `none` / `semi` filtering |
| `system/packages/sgg-metrics/src/metrics.ts` | R, mR, ngR, zR |
| `system/packages/sgg-metrics/src/index.ts` | `evaluate(request): EvalResponse` |
| `system/backend/app/schema.py` | Pydantic models; the dangling-reference invariant |
| `system/backend/app/eval/iou.py` | Box IoU |
| `system/backend/app/eval/rle.py` | COCO RLE decode, mask IoU |
| `system/backend/app/eval/match.py` | The match relation, greedy assignment, verdicts |
| `system/backend/app/eval/constraint.py` | Constraint filtering |
| `system/backend/app/eval/metrics.py` | R, mR, ngR, zR |
| `system/backend/app/eval/engine.py` | `evaluate(request) -> EvalResponse`; the authoritative entry point |
| `system/backend/app/api/health.py` | `/api/health` |
| `system/backend/app/api/eval.py` | `/api/eval` |
| `system/backend/app/api/datasets.py` | `/api/datasets`, `/api/datasets/{ds}/images/{id}` |
| `system/backend/app/datasets/loader.py` | Slice loading and validation |
| `system/backend/scripts/cut_slice.py` | Deterministic slice selection |
| `system/backend/scripts/bundle_slices.py` | Packs the cut images into the zip the class receives |
| `system/backend/scripts/verify_bundle.py` | Checks an unpacked bundle against `MANIFEST.json` |
| `system/backend/scripts/make_placeholders.py` | Synthetic frames so every lab runs unfetched |
| `data/golden/vectors.json` | The one fixture both engines read |
| `system/tools/parity.mjs` | Cross-implementation diff |
| `system/frontend/src/main.tsx` | Vite entry; the health page |

Files that change together live together: each metric concept has a Python file and a TypeScript file with the same name and the same function names, because the parity harness reads both and a reviewer must be able to place them side by side.

---

### Task 1: Workspace skeleton

**Files:**
- Create: `package.json`, `.gitignore`, `system/backend/requirements.txt`, `system/backend/pyproject.toml`, `system/packages/sgg-metrics/package.json`, `system/packages/sgg-metrics/tsconfig.json`

**Interfaces:**
- Produces: the npm workspace root, so `system/packages/sgg-metrics` is importable as `sgg-metrics` from `system/frontend/` and from `system/tools/`.

- [ ] **Step 1: Verify the Node prerequisite**

Run: `node --version`

Expected: `v22.12.0` or higher. If it prints `v20.x`, install Node 22 LTS before continuing — `vite@8.3.0` declares `engines: ^20.19.0 || >=22.12.0` and `npm create vite` will refuse. Do not work around this by pinning an older Vite; decision D-03 rejects that.

- [ ] **Step 2: Write the workspace root**

`package.json`:

```json
{
  "name": "scene-graph-studio",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "frontend"],
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "ci": "npm run test:py && npm run test:ts && npm run lint:parity && npm run lint:i18n && npm run lint:content && npm run lint:frozen",
    "test:py": "pytest backend/tests -q",
    "test:ts": "vitest run",
    "lint:parity": "node tools/parity.mjs",
    "lint:i18n": "node tools/i18n_parity.mjs",
    "lint:content": "node tools/content_lint.mjs",
    "lint:frozen": "node tools/audit.js && node tools/check.js"
  },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^3.0.0" }
}
```

- [ ] **Step 3: Write the metrics package manifest**

`system/packages/sgg-metrics/package.json`:

```json
{
  "name": "sgg-metrics",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {}
}
```

The empty `dependencies` block is deliberate and is asserted in Task 20. This package computes metrics and does nothing else — no DOM, no React, no fetch.

`system/packages/sgg-metrics/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write the ignore rules and the Python manifests**

`.gitignore` — append to the existing file:

```
node_modules/
dist/
.venv/
__pycache__/
.env
data/slices/*/images/
.pytest_cache/
```

`system/backend/requirements.txt`:

```
fastapi==0.136.1
uvicorn==0.46.0
pydantic==2.13.3
python-multipart==0.0.20
pillow==12.2.0
pytest==9.0.3
pytest-cov==6.0.0
httpx==0.28.1
ruff==0.9.0
```

`torch`, `transformers`, `timm` and `huggingface_hub` are deliberately absent. They belong to plan 03's optional inference path and are installed from `system/backend/requirements-infer.txt` there. NFR-1 requires the application to run without them.

`system/backend/pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 5: Install and commit**

```bash
cd AI-LLM/scene-graph-studio
npm install
python -m pip install -r backend/requirements.txt
git add package.json .gitignore backend/requirements.txt backend/pyproject.toml packages/
git commit -m "feat(sgs): npm workspace, python manifests, ignore rules"
```

---

### Task 2: The canonical schema and its invariant

**Files:**
- Create: `system/backend/app/schema.py`, `system/backend/tests/test_schema.py`

**Interfaces:**
- Produces: `BBox`, `RLEMask`, `SGObject`, `SGRelationship`, `Provenance`, `SceneGraph` as Pydantic v2 models. Every later task imports `SceneGraph` from here.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_schema.py`:

```python
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schema import SceneGraph


def _graph(rels: list[dict]) -> dict:
    return {
        "image_id": "img-1",
        "dataset": "vg150-sgb",
        "width": 100,
        "height": 80,
        "objects": [
            {"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}},
            {"object_id": 2, "names": ["table"], "bbox": {"x": 5, "y": 5, "w": 20, "h": 20}},
        ],
        "relationships": rels,
        "provenance": {"kind": "ground_truth", "fidelity": "measured"},
    }


def test_valid_graph_round_trips():
    g = SceneGraph.model_validate(_graph([
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"}
    ]))
    assert g.relationships[0].predicate == "on"
    assert SceneGraph.model_validate(g.model_dump()) == g


def test_dangling_subject_is_rejected():
    with pytest.raises(ValidationError) as e:
        SceneGraph.model_validate(_graph([
            {"relationship_id": 7, "subject_id": 99, "object_id": 2, "predicate": "on"}
        ]))
    assert "99" in str(e.value)


def test_reconstructed_fidelity_requires_a_note():
    bad = _graph([])
    bad["provenance"] = {"kind": "model", "fidelity": "reconstructed", "model": "motifs"}
    with pytest.raises(ValidationError):
        SceneGraph.model_validate(bad)


def test_bare_vg150_is_not_a_dataset():
    bad = _graph([])
    bad["dataset"] = "vg150"
    with pytest.raises(ValidationError):
        SceneGraph.model_validate(bad)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_schema.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schema'`

- [ ] **Step 3: Implement the schema**

`system/backend/app/schema.py`:

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DatasetId = Literal["vrd", "vg150-sgb", "psg", "indoorvg", "haystack", "mini-isg"]
Protocol = Literal["predcls", "sgcls", "sgdet"]
Constraint = Literal["graph", "none", "semi"]
MaskPairing = Literal["single_mpo", "multi_mpo"]
Fidelity = Literal["measured", "reconstructed", "published"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class BBox(Strict):
    x: float
    y: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)


class RLEMask(Strict):
    counts: str
    size: tuple[int, int]


class SGObject(Strict):
    object_id: int
    names: list[str] = Field(min_length=1)
    bbox: BBox
    mask: RLEMask | None = None
    attributes: list[str] = Field(default_factory=list)
    synsets: list[str] = Field(default_factory=list)

    @property
    def name(self) -> str:
        return self.names[0]


class SGRelationship(Strict):
    relationship_id: int
    subject_id: int
    object_id: int
    predicate: str
    score: float | None = None


class Provenance(Strict):
    kind: Literal["ground_truth", "model", "vlm", "user"]
    fidelity: Fidelity
    model: str | None = None
    vlm: str | None = None
    generated_at: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _note_required_when_not_measured(self) -> Provenance:
        if self.fidelity != "measured" and not self.note:
            raise ValueError(f"provenance.note is required when fidelity is {self.fidelity!r}")
        return self


class SceneGraph(Strict):
    image_id: str
    dataset: DatasetId
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    objects: list[SGObject]
    relationships: list[SGRelationship]
    provenance: Provenance

    @model_validator(mode="after")
    def _no_dangling_references(self) -> SceneGraph:
        known = {o.object_id for o in self.objects}
        dangling = [
            r.relationship_id
            for r in self.relationships
            if r.subject_id not in known or r.object_id not in known
        ]
        if dangling:
            missing = sorted(
                {r.subject_id for r in self.relationships if r.subject_id not in known}
                | {r.object_id for r in self.relationships if r.object_id not in known}
            )
            raise ValueError(
                f"relationships {dangling} reference object_ids not present in this graph: {missing}"
            )
        return self

    def object_by_id(self, object_id: int) -> SGObject:
        for o in self.objects:
            if o.object_id == object_id:
                return o
        raise KeyError(object_id)
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pytest backend/tests/test_schema.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/schema.py backend/tests/test_schema.py
git commit -m "feat(sgs): canonical SceneGraph schema with the no-dangling-reference invariant"
```

---

### Task 3: `/api/health`

**Files:**
- Create: `system/backend/app/main.py`, `system/backend/app/api/health.py`, `system/backend/app/errors.py`, `system/backend/tests/test_health.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `create_app() -> FastAPI` in `app.main`. Every later API test builds its client from it.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_health.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_health_reports_the_machine_honestly():
    client = TestClient(create_app())
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert isinstance(body["torch_present"], bool)
    assert isinstance(body["cuda_available"], bool)
    assert body["device"] in ("cpu", "cuda")
    assert isinstance(body["live_models"], list)
    assert body["vlm_provider"] in ("transcript", "claude")
    assert isinstance(body["slices_present"], dict)


def test_health_does_not_import_torch():
    import sys

    sys.modules.pop("torch", None)
    client = TestClient(create_app())
    client.get("/api/health")
    assert "torch" not in sys.modules, "health probed torch by importing it; use find_spec"


def test_unknown_route_returns_the_bilingual_error_shape():
    client = TestClient(create_app())
    r = client.get("/api/nope")
    assert r.status_code == 404
    err = r.json()["error"]
    assert err["code"] == "not_found"
    assert err["message_en"] and err["message_zh"]
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_health.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Implement the error model and the app**

`system/backend/app/errors.py`:

```python
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

MESSAGES: dict[str, tuple[str, str]] = {
    "bad_request": ("The request could not be understood.", "無法解析此請求。"),
    "not_found": ("No such resource.", "找不到此資源。"),
    "dangling_reference": (
        "A relationship references an object that is not in this graph.",
        "關係引用了不存在於本圖中的物件。",
    ),
    "schema_invalid": ("The request body failed validation.", "請求內容未通過結構驗證。"),
    "slice_images_missing": (
        "The annotations are present but the image files have not been unpacked.",
        "標註已存在，但影像檔尚未解壓縮。",
    ),
    "inference_unavailable": (
        "Live inference is not available for this model on this machine.",
        "此機器無法對本模型執行即時推論。",
    ),
    "vlm_unavailable": (
        "No live VLM provider is configured.", "尚未設定即時 VLM 供應者。"
    ),
    "internal_error": ("An unexpected error occurred.", "發生未預期的錯誤。"),
}


class ApiError(Exception):
    def __init__(self, code: str, status: int, detail: Any = None) -> None:
        self.code, self.status, self.detail = code, status, detail


def _payload(code: str, detail: Any = None) -> dict[str, Any]:
    en, zh = MESSAGES.get(code, MESSAGES["internal_error"])
    body: dict[str, Any] = {"code": code, "message_en": en, "message_zh": zh}
    if detail is not None:
        body["detail"] = detail
    return {"error": body}


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=_payload(exc.code, exc.detail))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "bad_request"
        return JSONResponse(status_code=exc.status_code, content=_payload(code))

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content=_payload("schema_invalid", exc.errors()))

    @app.exception_handler(Exception)
    async def _any(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content=_payload("internal_error"))
```

`system/backend/app/api/health.py`:

```python
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from app.settings import DATA_DIR, VERSION

router = APIRouter()

DATASETS = ["vrd", "vg150-sgb", "psg", "indoorvg", "haystack", "mini-isg"]


def _torch_state() -> tuple[bool, str | None, bool]:
    """Probe torch without importing it. Importing costs seconds and defeats NFR-8."""
    if importlib.util.find_spec("torch") is None:
        return False, None, False
    import torch  # noqa: PLC0415 — deliberately lazy

    return True, torch.__version__, bool(torch.cuda.is_available())


@router.get("/health")
def health() -> dict[str, Any]:
    present, version, cuda = _torch_state()
    present = {
        ds: (DATA_DIR / "slices" / ds / "images").is_dir()
        and any((DATA_DIR / "slices" / ds / "images").iterdir())
        for ds in DATASETS
    }
    return {
        "status": "ok",
        "version": VERSION,
        "torch_present": present,
        "torch_version": version,
        "cuda_available": cuda,
        "device": "cuda" if cuda else "cpu",
        "live_models": ["reltr"] if present else [],
        "vlm_provider": "transcript",
        "slices_present": present,
    }
```

`system/backend/app/settings.py`:

```python
from __future__ import annotations

from pathlib import Path

VERSION = "0.1.0"
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
```

`system/backend/app/main.py`:

```python
from __future__ import annotations

from fastapi import FastAPI

from app import errors
from app.api import health


def create_app() -> FastAPI:
    app = FastAPI(title="Scene Graph Studio", version="0.1.0")
    errors.install(app)
    app.include_router(health.router, prefix="/api")
    return app


app = create_app()
```

Add empty `system/backend/app/__init__.py` and `system/backend/app/api/__init__.py`.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pytest backend/tests/test_health.py -v`
Expected: 3 passed

The second test is the one that matters: `health()` must reach `find_spec` and stop when torch is absent. If it fails, the import is eager somewhere.

- [ ] **Step 5: Boot the server by hand, then commit**

```bash
python -m uvicorn app.main:app --app-dir backend --port 8000
curl http://127.0.0.1:8000/api/health
git add backend/app backend/tests/test_health.py
git commit -m "feat(sgs): FastAPI skeleton, bilingual error model, /api/health"
```

---

### Task 4: Box IoU

**Files:**
- Create: `system/backend/app/eval/iou.py`, `system/backend/tests/test_iou.py`, `system/backend/app/eval/__init__.py`

**Interfaces:**
- Produces: `box_iou(a: BBox, b: BBox) -> float`. Consumed by Task 6.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_iou.py`:

```python
from __future__ import annotations

from app.eval.iou import box_iou
from app.schema import BBox


def b(x: float, y: float, w: float, h: float) -> BBox:
    return BBox(x=x, y=y, w=w, h=h)


def test_identical_boxes_have_iou_one():
    assert box_iou(b(0, 0, 10, 10), b(0, 0, 10, 10)) == 1.0


def test_disjoint_boxes_have_iou_zero():
    assert box_iou(b(0, 0, 10, 10), b(20, 20, 10, 10)) == 0.0


def test_touching_edges_have_iou_zero():
    assert box_iou(b(0, 0, 10, 10), b(10, 0, 10, 10)) == 0.0


def test_half_overlap():
    # intersection 5x10 = 50; union 100 + 100 - 50 = 150
    assert box_iou(b(0, 0, 10, 10), b(5, 0, 10, 10)) == 50 / 150


def test_containment_is_the_area_ratio():
    assert box_iou(b(0, 0, 10, 10), b(0, 0, 5, 5)) == 25 / 100


def test_is_symmetric():
    p, q = b(3, 4, 7, 9), b(5, 2, 11, 6)
    assert box_iou(p, q) == box_iou(q, p)


def test_the_scale_bound_from_derivation_F3():
    # A(b') = 4 A(b) with b inside b' → IoU = 1/4, so λ=2 ≥ √2 gives IoU < 0.5
    assert box_iou(b(0, 0, 10, 10), b(0, 0, 20, 20)) == 100 / 400
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_iou.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.eval.iou'`

- [ ] **Step 3: Implement**

`system/backend/app/eval/iou.py`:

```python
from __future__ import annotations

from app.schema import BBox


def box_iou(a: BBox, b: BBox) -> float:
    """Intersection over union of two axis-aligned boxes, in image pixels.

    Boxes are half-open: [x, x + w) x [y, y + h). Touching edges do not intersect.
    """
    ix = min(a.x + a.w, b.x + b.w) - max(a.x, b.x)
    iy = min(a.y + a.h, b.y + b.h) - max(a.y, b.y)
    if ix <= 0.0 or iy <= 0.0:
        return 0.0
    inter = ix * iy
    union = a.w * a.h + b.w * b.h - inter
    return inter / union
```

- [ ] **Step 4: Run and watch them pass**

Run: `pytest backend/tests/test_iou.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/eval backend/tests/test_iou.py
git commit -m "feat(sgs): box IoU, stdlib only"
```

---

### Task 5: COCO RLE decode and mask IoU

**Files:**
- Create: `system/backend/app/eval/rle.py`, `system/backend/tests/test_rle.py`

**Interfaces:**
- Consumes: `RLEMask` from `app.schema`.
- Produces: `decode(mask: RLEMask) -> list[int]` returning a flat column-major bitmap, and `mask_iou(a: RLEMask, b: RLEMask) -> float`. The TypeScript mirror in Task 16 reproduces both exactly.

COCO's compressed RLE encodes run lengths in a variable-length base-32 scheme over the printable ASCII range. Decision D-12 records why this is implemented here rather than taken from `pycocotools`.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_rle.py`:

```python
from __future__ import annotations

import pytest

from app.eval.rle import decode, encode_counts, mask_iou
from app.schema import RLEMask


def rle(counts: list[int], h: int, w: int) -> RLEMask:
    return RLEMask(counts=encode_counts(counts), size=(h, w))


def test_empty_mask_decodes_to_all_zero():
    m = rle([16], 4, 4)
    assert sum(decode(m)) == 0


def test_full_mask_decodes_to_all_one():
    m = rle([0, 16], 4, 4)
    assert sum(decode(m)) == 16


def test_counts_alternate_starting_with_background():
    # 4x4, column-major: 2 off, 3 on, 11 off
    m = rle([2, 3, 11], 4, 4)
    assert decode(m) == [0, 0, 1, 1, 1] + [0] * 11


def test_identical_masks_have_iou_one():
    m = rle([2, 3, 11], 4, 4)
    assert mask_iou(m, m) == 1.0


def test_disjoint_masks_have_iou_zero():
    assert mask_iou(rle([0, 4, 12], 4, 4), rle([4, 4, 8], 4, 4)) == 0.0


def test_half_overlap():
    # A = pixels 0..7, B = pixels 4..11 → inter 4, union 12
    assert mask_iou(rle([0, 8, 8], 4, 4), rle([4, 8, 4], 4, 4)) == 4 / 12


def test_empty_against_empty_is_zero_not_nan():
    assert mask_iou(rle([16], 4, 4), rle([16], 4, 4)) == 0.0


def test_mismatched_sizes_are_rejected():
    with pytest.raises(ValueError):
        mask_iou(rle([16], 4, 4), rle([9], 3, 3))


def test_encode_decode_round_trips_a_long_run():
    counts = [0, 100000, 1]
    assert sum(decode(RLEMask(counts=encode_counts(counts), size=(1, 100001)))) == 100000
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_rle.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.eval.rle'`

- [ ] **Step 3: Implement**

`system/backend/app/eval/rle.py`:

```python
from __future__ import annotations

from app.schema import RLEMask

# COCO's compressed RLE: each run length is written as a sequence of 5-bit groups,
# low group first, offset by 48 so every byte is printable ASCII. Bit 5 (value 32)
# is the continuation flag. The first group's bit 4 (value 16) is the sign bit, and
# a negative value is a delta against the run two positions earlier.


def decode_counts(counts: str) -> list[int]:
    out: list[int] = []
    i, n = 0, len(counts)
    while i < n:
        value, shift, more = 0, 0, True
        while more:
            char = ord(counts[i]) - 48
            i += 1
            value |= (char & 0x1F) << shift
            more = bool(char & 0x20)
            shift += 5
            if not more and (char & 0x10):
                value |= -1 << shift
        if len(out) > 2:
            value += out[-2]
        out.append(value)
    return out


def encode_counts(values: list[int]) -> str:
    """Inverse of decode_counts. Used by fixtures and by the slice converter."""
    out: list[str] = []
    for index, raw in enumerate(values):
        value = raw - values[index - 2] if index > 2 else raw
        more = True
        while more:
            char = value & 0x1F
            value >>= 5
            more = not ((value == 0 and not char & 0x10) or (value == -1 and char & 0x10))
            if more:
                char |= 0x20
            out.append(chr(char + 48))
    return "".join(out)


def decode(mask: RLEMask) -> list[int]:
    """Return a flat column-major bitmap of length height * width."""
    height, width = mask.size
    bitmap: list[int] = []
    value = 0
    for run in decode_counts(mask.counts):
        bitmap.extend([value] * run)
        value ^= 1
    expected = height * width
    if len(bitmap) < expected:
        bitmap.extend([0] * (expected - len(bitmap)))
    return bitmap[:expected]


def mask_iou(a: RLEMask, b: RLEMask) -> float:
    if a.size != b.size:
        raise ValueError(f"mask sizes differ: {a.size} vs {b.size}")
    pa, pb = decode(a), decode(b)
    inter = sum(1 for x, y in zip(pa, pb, strict=True) if x and y)
    union = sum(1 for x, y in zip(pa, pb, strict=True) if x or y)
    return inter / union if union else 0.0
```

- [ ] **Step 4: Run and watch them pass**

Run: `pytest backend/tests/test_rle.py -v`
Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/eval/rle.py backend/tests/test_rle.py
git commit -m "feat(sgs): in-house COCO RLE decode and mask IoU, no pycocotools"
```

---

### Task 6: The match relation

**Files:**
- Create: `system/backend/app/eval/match.py`, `system/backend/tests/test_match.py`

**Interfaces:**
- Consumes: `box_iou`, `mask_iou`, `SceneGraph`.
- Produces:
  - `Triplet` — a frozen dataclass `(subject_name, predicate, object_name, subject_bbox, object_bbox, subject_mask, object_mask, relationship_id, score, index)`.
  - `to_triplets(graph: SceneGraph) -> list[Triplet]`
  - `classify(pred: Triplet, gts: list[Triplet], used: list[bool], iou_thresh: float, use_masks: bool) -> MatchOutcome` where `MatchOutcome` is `(verdict, gt_index | None, iou_subject | None, iou_object | None)`.

**The matching rule, stated because SRS §4.2 makes it observable.** Among ground-truth triplets that are unused and satisfy all five conjuncts, take the one with the **lowest ground-truth index**. If none satisfies all five but at least one unused ground truth agrees on subject class, object class and predicate, the verdict is `localization` and the reported IoUs come from the candidate with the highest `min(iou_subject, iou_object)`; that ground truth is **not** consumed. Otherwise the verdict is `spurious`.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_match.py`:

```python
from __future__ import annotations

from app.eval.match import classify, to_triplets
from app.schema import BBox, Provenance, SceneGraph, SGObject, SGRelationship


def graph(objs: list[tuple[int, str, tuple[float, float, float, float]]],
          rels: list[tuple[int, int, str, int]]) -> SceneGraph:
    return SceneGraph(
        image_id="i", dataset="vg150-sgb", width=100, height=100,
        objects=[SGObject(object_id=i, names=[n], bbox=BBox(x=b[0], y=b[1], w=b[2], h=b[3]))
                 for i, n, b in objs],
        relationships=[SGRelationship(relationship_id=rid, subject_id=s, predicate=p, object_id=o)
                       for rid, s, p, o in rels],
        provenance=Provenance(kind="ground_truth", fidelity="measured"),
    )


GT = graph(
    [(1, "person", (0, 0, 10, 10)), (2, "table", (20, 20, 10, 10))],
    [(1, 1, "on", 2)],
)


def test_exact_match():
    gts = to_triplets(GT)
    preds = to_triplets(GT)
    verdict, gi, ious, iuo = classify(preds[0], gts, [False], 0.5, False)
    assert (verdict, gi) == ("match", 0)
    assert ious == 1.0 and iuo == 1.0


def test_wrong_predicate_is_spurious():
    gts = to_triplets(GT)
    p = to_triplets(graph(
        [(1, "person", (0, 0, 10, 10)), (2, "table", (20, 20, 10, 10))],
        [(1, 1, "under", 2)]))[0]
    assert classify(p, gts, [False], 0.5, False)[0] == "spurious"


def test_right_classes_bad_boxes_is_localization_and_does_not_consume_gt():
    gts = to_triplets(GT)
    used = [False]
    p = to_triplets(graph(
        [(1, "person", (40, 40, 10, 10)), (2, "table", (20, 20, 10, 10))],
        [(1, 1, "on", 2)]))[0]
    verdict, gi, ious, _ = classify(p, gts, used, 0.5, False)
    assert verdict == "localization"
    assert ious == 0.0
    assert used == [False], "a localization failure must not consume the ground truth"


def test_iou_exactly_at_threshold_matches():
    gts = to_triplets(GT)
    # subject 5x10 overlap of two 10x10 boxes → 50/150 = 0.333; use w=10 shifted by 10/3
    p = to_triplets(graph(
        [(1, "person", (10 / 3, 0, 10, 10)), (2, "table", (20, 20, 10, 10))],
        [(1, 1, "on", 2)]))[0]
    verdict, _, ious, _ = classify(p, gts, [False], ious_at := 0.5, False)
    # 10/3 shift → inter 20/3 x 10; union 200 - 200/3 → iou = 0.5 exactly
    assert abs(ious - 0.5) < 1e-12
    assert verdict == "match", "the threshold is inclusive: IoU >= tau"


def test_a_used_ground_truth_is_not_matched_twice():
    gts = to_triplets(GT)
    p = to_triplets(GT)[0]
    assert classify(p, gts, [True], 0.5, False)[0] == "localization"


def test_lowest_gt_index_wins_among_equal_candidates():
    gt = graph(
        [(1, "a", (0, 0, 10, 10)), (2, "b", (0, 0, 10, 10)), (3, "b", (0, 0, 10, 10))],
        [(1, 1, "on", 2), (2, 1, "on", 3)],
    )
    gts = to_triplets(gt)
    p = to_triplets(gt)[1]  # matches both GT 0 and GT 1
    assert classify(p, gts, [False, False], 0.5, False)[1] == 0
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_match.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.eval.match'`

- [ ] **Step 3: Implement**

`system/backend/app/eval/match.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.eval.iou import box_iou
from app.eval.rle import mask_iou
from app.schema import BBox, RLEMask, SceneGraph

Verdict = Literal["match", "spurious", "localization", "missed"]


@dataclass(frozen=True)
class Triplet:
    index: int
    relationship_id: int
    subject_name: str
    predicate: str
    object_name: str
    subject_bbox: BBox
    object_bbox: BBox
    subject_mask: RLEMask | None
    object_mask: RLEMask | None
    score: float | None

    @property
    def classes(self) -> tuple[str, str, str]:
        return (self.subject_name, self.predicate, self.object_name)


def to_triplets(graph: SceneGraph) -> list[Triplet]:
    out: list[Triplet] = []
    for i, r in enumerate(graph.relationships):
        s, o = graph.object_by_id(r.subject_id), graph.object_by_id(r.object_id)
        out.append(
            Triplet(
                index=i, relationship_id=r.relationship_id,
                subject_name=s.name, predicate=r.predicate, object_name=o.name,
                subject_bbox=s.bbox, object_bbox=o.bbox,
                subject_mask=s.mask, object_mask=o.mask, score=r.score,
            )
        )
    return out


def _overlap(a_box: BBox, b_box: BBox, a_mask: RLEMask | None, b_mask: RLEMask | None,
             use_masks: bool) -> float:
    if use_masks and a_mask is not None and b_mask is not None:
        return mask_iou(a_mask, b_mask)
    return box_iou(a_box, b_box)


MatchOutcome = tuple[Verdict, int | None, float | None, float | None]


def classify(pred: Triplet, gts: list[Triplet], used: list[bool],
             iou_thresh: float, use_masks: bool) -> MatchOutcome:
    """Classify one prediction against the ground truth. Does not mutate `used`.

    Returns (verdict, gt_index, iou_subject, iou_object). The caller consumes the
    ground truth only on a 'match'.
    """
    best_loc: tuple[float, int, float, float] | None = None
    for gi, gt in enumerate(gts):
        if pred.classes != gt.classes:
            continue
        ious = _overlap(pred.subject_bbox, gt.subject_bbox,
                        pred.subject_mask, gt.subject_mask, use_masks)
        iuo = _overlap(pred.object_bbox, gt.object_bbox,
                       pred.object_mask, gt.object_mask, use_masks)
        if not used[gi] and ious >= iou_thresh and iuo >= iou_thresh:
            return ("match", gi, ious, iuo)
        weakest = min(ious, iuo)
        if best_loc is None or weakest > best_loc[0]:
            best_loc = (weakest, gi, ious, iuo)
    if best_loc is not None:
        _, gi, ious, iuo = best_loc
        return ("localization", gi, ious, iuo)
    return ("spurious", None, None, None)
```

- [ ] **Step 4: Run and watch them pass**

Run: `pytest backend/tests/test_match.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/eval/match.py backend/tests/test_match.py
git commit -m "feat(sgs): the match relation, with localization separated from classification"
```

---

### Task 7: Constraint modes and ranking

**Files:**
- Create: `system/backend/app/eval/constraint.py`, `system/backend/tests/test_constraint.py`

**Interfaces:**
- Consumes: `Triplet`.
- Produces: `rank(preds: list[Triplet]) -> list[Triplet]` (deterministic sort) and `apply_constraint(preds, mode, max_per_pair) -> list[Triplet]`.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_constraint.py`:

```python
from __future__ import annotations

from app.eval.constraint import apply_constraint, has_ties, rank
from app.eval.match import Triplet
from app.schema import BBox

B = BBox(x=0, y=0, w=1, h=1)


def t(index: int, rid: int, s: str, p: str, o: str, score: float) -> Triplet:
    return Triplet(index=index, relationship_id=rid, subject_name=s, predicate=p,
                   object_name=o, subject_bbox=B, object_bbox=B,
                   subject_mask=None, object_mask=None, score=score)


PREDS = [
    t(0, 10, "person", "on", "table", 0.9),
    t(1, 11, "person", "near", "table", 0.8),
    t(2, 12, "person", "under", "table", 0.7),
    t(3, 13, "box", "on", "table", 0.6),
]


def test_rank_is_descending_by_score():
    assert [x.score for x in rank(PREDS)] == [0.9, 0.8, 0.7, 0.6]


def test_ties_break_by_relationship_id_ascending():
    a, b = t(0, 99, "a", "p", "b", 0.5), t(1, 7, "c", "p", "d", 0.5)
    assert [x.relationship_id for x in rank([a, b])] == [7, 99]
    assert has_ties([a, b]) is True
    assert has_ties(PREDS) is False


def test_missing_scores_sort_last_and_keep_input_order():
    u = t(4, 14, "z", "p", "y", None)
    assert rank([u, PREDS[0]])[0].relationship_id == 10


def test_graph_constraint_keeps_one_predicate_per_ordered_pair():
    kept = apply_constraint(rank(PREDS), "graph", 1)
    assert [x.predicate for x in kept] == ["on", "on"]
    assert len(kept) == 2


def test_none_constraint_keeps_everything():
    assert len(apply_constraint(rank(PREDS), "none", 1)) == 4


def test_semi_constraint_keeps_at_most_n_per_pair():
    kept = apply_constraint(rank(PREDS), "semi", 2)
    assert [x.predicate for x in kept] == ["on", "near", "on"]


def test_the_ordered_pair_is_direction_sensitive():
    pair = [t(0, 1, "a", "on", "b", 0.9), t(1, 2, "b", "on", "a", 0.8)]
    assert len(apply_constraint(rank(pair), "graph", 1)) == 2
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_constraint.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.eval.constraint'`

- [ ] **Step 3: Implement**

`system/backend/app/eval/constraint.py`:

```python
from __future__ import annotations

from app.eval.match import Triplet
from app.schema import Constraint


def rank(preds: list[Triplet]) -> list[Triplet]:
    """Score-descending, ties broken by relationship_id ascending. NFR-4.

    A prediction with no score sorts after every scored prediction, keeping input order.
    """
    scored = [p for p in preds if p.score is not None]
    unscored = [p for p in preds if p.score is None]
    scored.sort(key=lambda p: (-(p.score or 0.0), p.relationship_id))
    return scored + unscored


def has_ties(preds: list[Triplet]) -> bool:
    seen: set[float] = set()
    for p in preds:
        if p.score is None:
            continue
        if p.score in seen:
            return True
        seen.add(p.score)
    return False


def apply_constraint(ranked: list[Triplet], mode: Constraint, max_per_pair: int) -> list[Triplet]:
    """Filter a ranked list. The pair key is the ORDERED (subject, object) class pair."""
    if mode == "none":
        return list(ranked)
    cap = 1 if mode == "graph" else max(1, max_per_pair)
    counts: dict[tuple[str, str], int] = {}
    out: list[Triplet] = []
    for p in ranked:
        key = (p.subject_name, p.object_name)
        if counts.get(key, 0) >= cap:
            continue
        counts[key] = counts.get(key, 0) + 1
        out.append(p)
    return out
```

- [ ] **Step 4: Run and watch them pass**

Run: `pytest backend/tests/test_constraint.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/eval/constraint.py backend/tests/test_constraint.py
git commit -m "feat(sgs): graph/none/semi constraint modes and the deterministic ranking"
```

---

### Task 8: The four metrics

**Files:**
- Create: `system/backend/app/eval/metrics.py`, `system/backend/tests/test_metrics.py`

**Interfaces:**
- Consumes: `Triplet`, `classify`, `rank`, `apply_constraint`.
- Produces: `assign(preds, gts, k, iou_thresh, use_masks) -> Assignment` and the four metric functions `recall_at_k`, `mean_recall_at_k`, `zero_shot_recall_at_k`. `ng_recall_at_k` is `recall_at_k` over the unconstrained pool and has no separate function.

`Assignment` is a dataclass carrying `matched_gt: list[bool]`, `verdicts: list[tuple[int, Verdict, int | None, float | None, float | None]]` and `per_predicate: dict[str, tuple[int, int]]` mapping a predicate to `(gt_count, matched_count)`.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_metrics.py`:

```python
from __future__ import annotations

from app.eval.constraint import apply_constraint, rank
from app.eval.match import Triplet
from app.eval.metrics import assign, mean_recall_at_k, recall_at_k, zero_shot_recall_at_k
from app.schema import BBox

B = BBox(x=0, y=0, w=10, h=10)


def t(i: int, s: str, p: str, o: str, score: float | None = None) -> Triplet:
    return Triplet(index=i, relationship_id=i, subject_name=s, predicate=p, object_name=o,
                   subject_bbox=B, object_bbox=B, subject_mask=None, object_mask=None, score=score)


GT = [t(0, "a", "on", "b"), t(1, "c", "on", "d"), t(2, "e", "under", "f")]


def test_recall_counts_matched_over_total():
    preds = [t(0, "a", "on", "b", 0.9), t(1, "c", "on", "d", 0.8)]
    a = assign(rank(preds), GT, 20, 0.5, False)
    assert recall_at_k(a, 20) == 2 / 3


def test_recall_is_zero_on_empty_predictions():
    a = assign([], GT, 20, 0.5, False)
    assert recall_at_k(a, 20) == 0.0


def test_recall_is_none_on_empty_ground_truth():
    a = assign([t(0, "a", "on", "b", 0.9)], [], 20, 0.5, False)
    assert recall_at_k(a, 20) is None


def test_top_k_truncates_the_ranking():
    preds = [t(0, "x", "no", "y", 0.99), t(1, "a", "on", "b", 0.5)]
    assert recall_at_k(assign(rank(preds), GT, 1, 0.5, False), 1) == 0.0
    assert recall_at_k(assign(rank(preds), GT, 2, 0.5, False), 2) == 1 / 3


def test_mean_recall_averages_over_classes_present_in_ground_truth():
    # 'on' has 2 GT and 1 match → 0.5;  'under' has 1 GT and 1 match → 1.0
    preds = [t(0, "a", "on", "b", 0.9), t(1, "e", "under", "f", 0.8)]
    a = assign(rank(preds), GT, 20, 0.5, False)
    assert mean_recall_at_k(a, 20) == (0.5 + 1.0) / 2
    assert recall_at_k(a, 20) == 2 / 3


def test_the_mean_recall_denominator_trap():
    """A class with one GT instance weighs as much as a class with many."""
    gt = [t(i, "a", "on", "b") for i in range(9)] + [t(9, "c", "rare", "d")]
    preds = [t(i, "a", "on", "b", 0.9 - i / 100) for i in range(9)]
    a = assign(rank(preds), gt, 20, 0.5, False)
    assert recall_at_k(a, 20) == 0.9
    assert mean_recall_at_k(a, 20) == 0.5


def test_no_graph_constraint_raises_recall():
    preds = [t(0, "a", "near", "b", 0.9), t(1, "a", "on", "b", 0.8)]
    ranked = rank(preds)
    constrained = apply_constraint(ranked, "graph", 1)
    unconstrained = apply_constraint(ranked, "none", 1)
    r = recall_at_k(assign(constrained, GT, 20, 0.5, False), 20)
    ng = recall_at_k(assign(unconstrained, GT, 20, 0.5, False), 20)
    assert r == 0.0 and ng == 1 / 3 and ng > r


def test_zero_shot_restricts_the_denominator():
    seen = {("a", "on", "b"), ("c", "on", "d")}
    preds = [t(0, "a", "on", "b", 0.9), t(1, "e", "under", "f", 0.8)]
    a = assign(rank(preds), GT, 20, 0.5, False)
    assert zero_shot_recall_at_k(a, GT, seen, 20) == 1.0


def test_zero_shot_is_none_when_every_triplet_was_seen():
    seen = {tr.classes for tr in GT}
    a = assign(rank([]), GT, 20, 0.5, False)
    assert zero_shot_recall_at_k(a, GT, seen, 20) is None


def test_duplicate_predictions_credit_the_ground_truth_once():
    preds = [t(0, "a", "on", "b", 0.9), t(1, "a", "on", "b", 0.8)]
    a = assign(rank(preds), GT, 20, 0.5, False)
    assert recall_at_k(a, 20) == 1 / 3
    assert [v[1] for v in a.verdicts[:2]] == ["match", "localization"]
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_metrics.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.eval.metrics'`

- [ ] **Step 3: Implement**

`system/backend/app/eval/metrics.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field

from app.eval.match import Triplet, Verdict, classify


@dataclass
class Assignment:
    gts: list[Triplet]
    matched_gt: list[bool]
    verdicts: list[tuple[int, Verdict, int | None, float | None, float | None]]
    matched_at: list[int | None] = field(default_factory=list)
    """matched_at[i] is the 1-based rank at which gt i was matched, else None."""


def assign(ranked_preds: list[Triplet], gts: list[Triplet], k: int,
           iou_thresh: float, use_masks: bool) -> Assignment:
    """Greedy one-to-one assignment over the top-k of a ranked prediction list."""
    used = [False] * len(gts)
    matched_at: list[int | None] = [None] * len(gts)
    verdicts: list[tuple[int, Verdict, int | None, float | None, float | None]] = []
    for position, pred in enumerate(ranked_preds[:k], start=1):
        verdict, gi, ious, iuo = classify(pred, gts, used, iou_thresh, use_masks)
        if verdict == "match" and gi is not None:
            used[gi] = True
            matched_at[gi] = position
        verdicts.append((pred.index, verdict, gi, ious, iuo))
    return Assignment(gts=gts, matched_gt=used, verdicts=verdicts, matched_at=matched_at)


def recall_at_k(a: Assignment, k: int) -> float | None:
    """R@K. None — not zero — when there is no ground truth to recall."""
    if not a.gts:
        return None
    hit = sum(1 for m in a.matched_at if m is not None and m <= k)
    return hit / len(a.gts)


def mean_recall_at_k(a: Assignment, k: int) -> float | None:
    """mR@K: R@K per predicate class, averaged unweighted over classes present in the GT."""
    if not a.gts:
        return None
    totals: dict[str, int] = {}
    hits: dict[str, int] = {}
    for i, gt in enumerate(a.gts):
        totals[gt.predicate] = totals.get(gt.predicate, 0) + 1
        at = a.matched_at[i]
        if at is not None and at <= k:
            hits[gt.predicate] = hits.get(gt.predicate, 0) + 1
    per_class = [hits.get(p, 0) / n for p, n in totals.items()]
    return sum(per_class) / len(per_class)


def zero_shot_recall_at_k(a: Assignment, gts: list[Triplet],
                          train_triplets: set[tuple[str, str, str]], k: int) -> float | None:
    """zR@K: R@K restricted to GT triplet types absent from the training split."""
    zero_shot = [i for i, gt in enumerate(gts) if gt.classes not in train_triplets]
    if not zero_shot:
        return None
    hit = sum(1 for i in zero_shot if (at := a.matched_at[i]) is not None and at <= k)
    return hit / len(zero_shot)
```

- [ ] **Step 4: Run and watch them pass**

Run: `pytest backend/tests/test_metrics.py -v`
Expected: 10 passed

`test_the_mean_recall_denominator_trap` is the one to read if a later change breaks parity. It is SRS §8's named edge case and the reason mean Recall exists.

- [ ] **Step 5: Commit**

```bash
git add backend/app/eval/metrics.py backend/tests/test_metrics.py
git commit -m "feat(sgs): R@K, mR@K, ng-R@K and zR@K with the denominator traps under test"
```

---

### Task 9: The engine entry point and `/api/eval`

**Files:**
- Create: `system/backend/app/eval/engine.py`, `system/backend/app/api/eval.py`, `system/backend/tests/test_eval_api.py`
- Modify: `system/backend/app/main.py`

**Interfaces:**
- Consumes: everything from Tasks 4–8.
- Produces: `evaluate(request: EvalRequest) -> EvalResponse`. This is the authoritative entry point named in SRS §4 and the one `system/tools/parity.mjs` drives.

- [ ] **Step 1: Write the failing test**

`system/backend/tests/test_eval_api.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def graph(kind: str, rels: list[dict]) -> dict:
    return {
        "image_id": "i", "dataset": "vg150-sgb", "width": 100, "height": 100,
        "objects": [
            {"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}},
            {"object_id": 2, "names": ["table"], "bbox": {"x": 20, "y": 20, "w": 10, "h": 10}},
        ],
        "relationships": rels,
        "provenance": {"kind": kind, "fidelity": "measured"},
    }


BASE = {
    "gt": graph("ground_truth", [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"}]),
    "pred": graph("model", [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on",
         "score": 0.9}]),
    "protocol": "predcls", "constraint": "graph", "k": [20],
    "iou_thresh": 0.5, "mask_pairing": "single_mpo",
}


def test_every_metric_is_tagged():
    body = client.post("/api/eval", json=BASE).json()
    for m in body["metrics"]:
        assert set(m) >= {"value", "metric", "k", "protocol", "constraint",
                          "source", "verified", "fidelity"}
        assert m["protocol"] == "predcls" and m["constraint"] == "graph" and m["k"] == 20
    assert {m["metric"] for m in body["metrics"]} == {"R", "mR", "ngR", "zR"}


def test_predcls_always_warns_about_boxes_not_pairs():
    body = client.post("/api/eval", json=BASE).json()
    assert "gt_boxes_not_pairs" in {w["code"] for w in body["warnings"]}


def test_zero_shot_is_null_without_a_training_split():
    body = client.post("/api/eval", json=BASE).json()
    z = next(m for m in body["metrics"] if m["metric"] == "zR")
    assert z["value"] is None
    assert "zero_shot_unavailable" in {w["code"] for w in body["warnings"]}


def test_verdicts_drive_the_four_colour_diff():
    body = client.post("/api/eval", json=BASE).json()
    assert body["verdicts"][0]["verdict"] == "match"
    assert body["verdicts"][0]["rank"] == 1


def test_missed_ground_truth_is_reported():
    req = {**BASE, "pred": graph("model", [])}
    body = client.post("/api/eval", json=req).json()
    missed = [v for v in body["verdicts"] if v["verdict"] == "missed"]
    assert len(missed) == 1 and missed[0]["pred_index"] == -1 and missed[0]["gt_index"] == 0


def test_dangling_reference_is_422_and_names_the_id():
    bad = graph("model", [
        {"relationship_id": 1, "subject_id": 77, "object_id": 2, "predicate": "on", "score": 1.0}])
    r = client.post("/api/eval", json={**BASE, "pred": bad})
    assert r.status_code == 422
    assert "77" in str(r.json())


def test_identical_requests_return_identical_responses():
    a = client.post("/api/eval", json=BASE).json()
    b = client.post("/api/eval", json=BASE).json()
    assert a == b


def test_params_are_echoed():
    body = client.post("/api/eval", json=BASE).json()
    assert body["params_echo"]["iou_thresh"] == 0.5
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_eval_api.py -v`
Expected: FAIL with `404` on every request — the router is not mounted.

- [ ] **Step 3: Implement the engine and the router**

`system/backend/app/eval/engine.py`:

```python
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.eval.constraint import apply_constraint, has_ties, rank
from app.eval.match import to_triplets
from app.eval.metrics import assign, mean_recall_at_k, recall_at_k, zero_shot_recall_at_k
from app.schema import Constraint, MaskPairing, Protocol, SceneGraph, Strict

WARNINGS: dict[str, tuple[str, str]] = {
    "gt_boxes_not_pairs": (
        "PredCls and SGCls supply ground-truth boxes, not ground-truth pairs.",
        "PredCls 與 SGCls 提供的是 ground-truth boxes，不是 ground-truth pairs。",
    ),
    "empty_ground_truth": ("There is no ground truth; recall is undefined.",
                           "沒有 ground truth，recall 無定義。"),
    "empty_prediction": ("No predictions were supplied.", "未提供任何預測。"),
    "ties_broken_by_index": (
        "Two or more predictions share a score; ties break by relationship_id ascending.",
        "有預測分數相同，並列時依 relationship_id 由小至大排序。",
    ),
    "masks_ignored": ("One graph carries masks and the other does not; boxes were used.",
                      "僅一方帶有 mask，故改用 box 計算。"),
    "zero_shot_unavailable": (
        "No training split was supplied, so zero-shot recall is not computed.",
        "未提供訓練集三元組，因此不計算 zero-shot recall。",
    ),
}


class EvalRequest(Strict):
    gt: SceneGraph
    pred: SceneGraph
    protocol: Protocol
    constraint: Constraint
    k: list[int] = Field(default_factory=lambda: [20, 50, 100])
    iou_thresh: float = 0.5
    mask_pairing: MaskPairing = "single_mpo"
    zero_shot_train_triplets: list[tuple[str, str, str]] | None = None
    semi_constraint_max_per_pair: int = 2


class MetricValue(BaseModel):
    value: float | None
    metric: str
    k: int
    protocol: Protocol
    constraint: Constraint
    source: str = "engine"
    verified: bool = True
    fidelity: str = "measured"


def _warn(code: str) -> dict[str, str]:
    en, zh = WARNINGS[code]
    return {"code": code, "message_en": en, "message_zh": zh}


def evaluate(req: EvalRequest) -> dict[str, Any]:
    gts = to_triplets(req.gt)
    preds = to_triplets(req.pred)
    ranked = rank(preds)

    gt_masked = any(o.mask for o in req.gt.objects)
    pred_masked = any(o.mask for o in req.pred.objects)
    use_masks = gt_masked and pred_masked

    constrained = apply_constraint(ranked, req.constraint, req.semi_constraint_max_per_pair)
    unconstrained = apply_constraint(ranked, "none", 1)
    train = set(req.zero_shot_train_triplets or [])

    metrics: list[MetricValue] = []
    per_predicate: dict[str, dict[str, Any]] = {}
    verdict_rows: list[dict[str, Any]] = []
    top_assign = None

    for k in sorted(req.k):
        a = assign(constrained, gts, k, req.iou_thresh, use_masks)
        ng = assign(unconstrained, gts, k, req.iou_thresh, use_masks)
        tag = {"k": k, "protocol": req.protocol, "constraint": req.constraint}
        metrics.append(MetricValue(value=recall_at_k(a, k), metric="R", **tag))
        metrics.append(MetricValue(value=mean_recall_at_k(a, k), metric="mR", **tag))
        metrics.append(MetricValue(value=recall_at_k(ng, k), metric="ngR", **tag))
        metrics.append(
            MetricValue(
                value=zero_shot_recall_at_k(a, gts, train, k) if train else None,
                metric="zR", **tag,
            )
        )
        for i, gt in enumerate(gts):
            row = per_predicate.setdefault(
                gt.predicate, {"predicate": gt.predicate, "gt_count": 0, "matched": {}})
            if k == sorted(req.k)[0]:
                row["gt_count"] += 1
            at = a.matched_at[i]
            row["matched"][str(k)] = row["matched"].get(str(k), 0) + (
                1 if at is not None and at <= k else 0)
        if top_assign is None or k == max(req.k):
            top_assign = a

    assert top_assign is not None
    matched_gt_indices: set[int] = set()
    for position, (pred_index, verdict, gi, ious, iuo) in enumerate(top_assign.verdicts, start=1):
        if verdict == "match" and gi is not None:
            matched_gt_indices.add(gi)
        verdict_rows.append({
            "pred_index": pred_index, "gt_index": gi, "verdict": verdict,
            "iou_subject": ious, "iou_object": iuo, "rank": position,
            "entered_top_k": {str(k): position <= k for k in sorted(req.k)},
        })
    for gi, _ in enumerate(gts):
        if gi not in matched_gt_indices:
            verdict_rows.append({
                "pred_index": -1, "gt_index": gi, "verdict": "missed",
                "iou_subject": None, "iou_object": None, "rank": 0,
                "entered_top_k": {str(k): False for k in sorted(req.k)},
            })

    warnings = []
    if req.protocol in ("predcls", "sgcls"):
        warnings.append(_warn("gt_boxes_not_pairs"))
    if not gts:
        warnings.append(_warn("empty_ground_truth"))
    if not preds:
        warnings.append(_warn("empty_prediction"))
    if has_ties(preds):
        warnings.append(_warn("ties_broken_by_index"))
    if gt_masked != pred_masked:
        warnings.append(_warn("masks_ignored"))
    if not train:
        warnings.append(_warn("zero_shot_unavailable"))

    return {
        "metrics": [m.model_dump() for m in metrics],
        "verdicts": verdict_rows,
        "matched_count": sum(1 for m in top_assign.matched_gt if m),
        "gt_count": len(gts),
        "pred_count_considered": len(constrained),
        "per_predicate": list(per_predicate.values()),
        "warnings": warnings,
        "params_echo": req.model_dump(),
    }
```

`system/backend/app/api/eval.py`:

```python
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.eval.engine import EvalRequest, evaluate

router = APIRouter()


@router.post("/eval")
def post_eval(req: EvalRequest) -> dict[str, Any]:
    return evaluate(req)
```

In `system/backend/app/main.py`, add `from app.api import eval as eval_api` and `app.include_router(eval_api.router, prefix="/api")`.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pytest backend/tests -q`
Expected: all tests pass, 39 or more

- [ ] **Step 5: Commit**

```bash
git add backend/app/eval/engine.py backend/app/api/eval.py backend/app/main.py backend/tests/test_eval_api.py
git commit -m "feat(sgs): /api/eval — tagged metrics, four-colour verdicts, unconditional protocol warning"
```

---

### Task 10: Golden vectors

**Files:**
- Create: `data/golden/vectors.json`, `data/golden/README.md`, `system/backend/tests/test_golden.py`

**Interfaces:**
- Produces: `data/golden/vectors.json` conforming to contracts D-16. Task 17's parity harness reads the same file.

**Every expected value is computed on paper before it is written into the file.** `hand_checked: true` records that it was. A fixture whose expectations were produced by running the engine proves nothing.

- [ ] **Step 1: Write the loader test first**

`system/backend/tests/test_golden.py`:

```python
from __future__ import annotations

import json

import pytest

from app.eval.engine import EvalRequest, evaluate
from app.settings import DATA_DIR

CASES = json.loads((DATA_DIR / "golden" / "vectors.json").read_text(encoding="utf-8"))["cases"]
TOL = 1e-9

REQUIRED_IDS = {
    "gv-001-trivial-exact-match",
    "gv-002-empty-ground-truth",
    "gv-003-empty-prediction",
    "gv-004-all-tied-scores",
    "gv-005-duplicate-predictions",
    "gv-006-iou-exactly-at-threshold",
    "gv-007-single-instance-predicate-class",
    "gv-008-greedy-vs-maximum-matching",
    "gv-009-mask-iou",
    "gv-010-constraint-gap",
}


def test_every_required_case_is_present():
    assert REQUIRED_IDS <= {c["id"] for c in CASES}


def test_every_case_is_hand_checked():
    assert [c["id"] for c in CASES if not c.get("hand_checked")] == []


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["id"])
def test_engine_matches_the_hand_computed_expectation(case):
    body = evaluate(EvalRequest.model_validate({
        "gt": case["gt"], "pred": case["pred"], **case["params"]}))
    got = {(m["metric"], str(m["k"])): m["value"] for m in body["metrics"]}
    for metric, by_k in case["expect"].items():
        if metric == "verdicts":
            continue
        for k, want in by_k.items():
            have = got[(metric, k)]
            if want is None:
                assert have is None, f"{case['id']} {metric}@{k}: expected null, got {have}"
            else:
                assert have is not None and abs(have - want) < TOL, \
                    f"{case['id']} {metric}@{k}: expected {want}, got {have}"
    for want in case["expect"].get("verdicts", []):
        row = next(v for v in body["verdicts"] if v["pred_index"] == want["pred_index"])
        assert row["verdict"] == want["verdict"], f"{case['id']} pred {want['pred_index']}"
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_golden.py -v`
Expected: FAIL with `FileNotFoundError` on `data/golden/vectors.json`

- [ ] **Step 3: Write the fixture, one case at a time, arithmetic first**

Write `data/golden/README.md` first, stating the rule: *compute on paper, then write the file; never paste engine output into an expectation.*

Then write the ten cases. `gv-001` in full, as the shape every other case follows:

```json
{
  "$schema_version": 1,
  "cases": [
    {
      "id": "gv-001-trivial-exact-match",
      "why": "One GT, one prediction, identical boxes. R = mR = ngR = 1.",
      "hand_checked": true,
      "gt": {
        "image_id": "gv1", "dataset": "vg150-sgb", "width": 100, "height": 100,
        "objects": [
          {"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}},
          {"object_id": 2, "names": ["table"], "bbox": {"x": 20, "y": 20, "w": 10, "h": 10}}
        ],
        "relationships": [
          {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"}
        ],
        "provenance": {"kind": "ground_truth", "fidelity": "measured"}
      },
      "pred": {
        "image_id": "gv1", "dataset": "vg150-sgb", "width": 100, "height": 100,
        "objects": [
          {"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}},
          {"object_id": 2, "names": ["table"], "bbox": {"x": 20, "y": 20, "w": 10, "h": 10}}
        ],
        "relationships": [
          {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on",
           "score": 0.9}
        ],
        "provenance": {"kind": "model", "fidelity": "measured", "model": "fixture"}
      },
      "params": {
        "protocol": "predcls", "constraint": "graph", "k": [20],
        "iou_thresh": 0.5, "mask_pairing": "single_mpo"
      },
      "expect": {
        "R": {"20": 1.0}, "mR": {"20": 1.0}, "ngR": {"20": 1.0}, "zR": {"20": null},
        "verdicts": [{"pred_index": 0, "verdict": "match"}]
      }
    }
  ]
}
```

The remaining nine, with the arithmetic each must encode:

| Case | Construction | Hand-computed expectation |
|---|---|---|
| `gv-002-empty-ground-truth` | GT has no relationships; one prediction | Every metric `null`; the prediction's verdict is `spurious`; warning `empty_ground_truth` |
| `gv-003-empty-prediction` | Three GT relationships; no predictions | `R = mR = ngR = 0.0`; three `missed` verdicts |
| `gv-004-all-tied-scores` | Four predictions, every score `0.5`, `relationship_id` 4, 3, 2, 1; two match | Ranking is 1, 2, 3, 4; `R@2 = 1/3`; warning `ties_broken_by_index` |
| `gv-005-duplicate-predictions` | The same triplet predicted twice, scores 0.9 and 0.8; one GT | `R = 1/3`; first verdict `match`, second `localization` — the GT is credited once |
| `gv-006-iou-exactly-at-threshold` | Subject boxes by **containment**: a 10×20 prediction box holding the 10×10 ground-truth box → `inter = 100`, `union = 200`, IoU **exactly** 0.5; τ = 0.5. Do **not** offset two 10×10 boxes by 10/3 — that yields 0.4999999999999999 and tests the wrong side of the boundary (deviation D4) | `match`, because the relation is `IoU ≥ τ` |
| `gv-007-single-instance-predicate-class` | 9 GT of `on`, 1 of `rare`; all 9 `on` predicted, `rare` not | `R@20 = 0.9`, `mR@20 = 0.5` |
| `gv-008-greedy-vs-maximum-matching` | Adversarial: prediction ranked 1 can match GT-A or GT-B; prediction ranked 2 can match only GT-A. Greedy takes GT-A first and leaves prediction 2 unmatched | `R = 1/2` under greedy; a maximum matching would give `1`. The fixture records the greedy answer and `why` states that this discharges SRS §11.2's assumption rather than asserting it |
| `gv-009-mask-iou` | Both graphs carry RLE masks on a 4×4 canvas; subject masks overlap 4 of 12, object masks identical | Subject IoU `1/3 < 0.5` → `localization` |
| `gv-010-constraint-gap` | One ordered pair, two predicted predicates: the wrong one scores higher | `R@20 = 0`, `ngR@20 = 1`. This is the fixture that Phase 9 verification item 3 leans on |

- [ ] **Step 4: Run and watch them pass**

Run: `pytest backend/tests/test_golden.py -v`
Expected: 12 passed

If a case fails, the engine and the paper disagree. Re-derive on paper before touching the engine — the fixture is more likely to be right, because it was computed from the definition rather than from the code.

- [ ] **Step 5: Commit**

```bash
git add data/golden backend/tests/test_golden.py
git commit -m "test(sgs): ten hand-computed golden vectors including the greedy-matching adversary"
```

---

### Task 11: The TypeScript wire types

**Files:**
- Create: `system/packages/sgg-metrics/src/types.ts`, `system/packages/sgg-metrics/test/types.test.ts`

**Interfaces:**
- Produces: `BBox`, `RLEMask`, `SGObject`, `SGRelationship`, `Provenance`, `SceneGraph`, `MetricValue`, `Verdict`, `Warning`, `EvalRequest`, `EvalResponse`. Task 12 onward import from here; the frontend imports from here; nothing redeclares them.

- [ ] **Step 1: Write the failing test**

`system/packages/sgg-metrics/test/types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { EvalRequest, SceneGraph } from '../src/types';
import { isSceneGraph } from '../src/types';

describe('wire types', () => {
  it('accepts a well-formed graph', () => {
    const g: SceneGraph = {
      image_id: 'i', dataset: 'vg150-sgb', width: 10, height: 10,
      objects: [{ object_id: 1, names: ['a'], bbox: { x: 0, y: 0, w: 1, h: 1 } }],
      relationships: [],
      provenance: { kind: 'ground_truth', fidelity: 'measured' },
    };
    expect(isSceneGraph(g)).toBe(true);
  });

  it('rejects a graph whose relationship dangles', () => {
    expect(isSceneGraph({
      image_id: 'i', dataset: 'vg150-sgb', width: 10, height: 10,
      objects: [],
      relationships: [{ relationship_id: 1, subject_id: 9, object_id: 8, predicate: 'on' }],
      provenance: { kind: 'user', fidelity: 'measured' },
    })).toBe(false);
  });

  it('defaults k to all three cutoffs', () => {
    const r: EvalRequest = {
      gt: {} as SceneGraph, pred: {} as SceneGraph,
      protocol: 'predcls', constraint: 'graph',
      k: [20, 50, 100], iou_thresh: 0.5, mask_pairing: 'single_mpo',
    };
    expect(r.k).toEqual([20, 50, 100]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/sgg-metrics`
Expected: FAIL — cannot resolve `../src/types`

- [ ] **Step 3: Implement**

`system/packages/sgg-metrics/src/types.ts`:

```typescript
export type DatasetId = 'vrd' | 'vg150-sgb' | 'psg' | 'indoorvg' | 'haystack' | 'mini-isg';
export type Protocol = 'predcls' | 'sgcls' | 'sgdet';
export type Constraint = 'graph' | 'none' | 'semi';
export type MaskPairing = 'single_mpo' | 'multi_mpo';
export type Fidelity = 'measured' | 'reconstructed' | 'published';
export type VerdictKind = 'match' | 'spurious' | 'localization' | 'missed';

export interface BBox { x: number; y: number; w: number; h: number }
export interface RLEMask { counts: string; size: [number, number] }

export interface SGObject {
  object_id: number;
  names: string[];
  bbox: BBox;
  mask?: RLEMask;
  attributes?: string[];
  synsets?: string[];
}

export interface SGRelationship {
  relationship_id: number;
  subject_id: number;
  object_id: number;
  predicate: string;
  score?: number | null;
}

export interface Provenance {
  kind: 'ground_truth' | 'model' | 'vlm' | 'user';
  fidelity: Fidelity;
  model?: string;
  vlm?: string;
  generated_at?: string;
  note?: string;
}

export interface SceneGraph {
  image_id: string;
  dataset: DatasetId;
  width: number;
  height: number;
  objects: SGObject[];
  relationships: SGRelationship[];
  provenance: Provenance;
}

export interface MetricValue {
  value: number | null;
  metric: 'R' | 'mR' | 'ngR' | 'zR';
  k: number;
  protocol: Protocol;
  constraint: Constraint;
  source: string;
  verified: boolean;
  fidelity: Fidelity;
}

export interface Verdict {
  pred_index: number;
  gt_index: number | null;
  verdict: VerdictKind;
  iou_subject: number | null;
  iou_object: number | null;
  rank: number;
  entered_top_k: Record<string, boolean>;
}

export interface Warning { code: string; message_en: string; message_zh: string }

export interface EvalRequest {
  gt: SceneGraph;
  pred: SceneGraph;
  protocol: Protocol;
  constraint: Constraint;
  k: number[];
  iou_thresh: number;
  mask_pairing: MaskPairing;
  zero_shot_train_triplets?: Array<[string, string, string]>;
  semi_constraint_max_per_pair?: number;
}

export interface EvalResponse {
  metrics: MetricValue[];
  verdicts: Verdict[];
  matched_count: number;
  gt_count: number;
  pred_count_considered: number;
  per_predicate: Array<{ predicate: string; gt_count: number; matched: Record<string, number> }>;
  warnings: Warning[];
  params_echo: EvalRequest;
}

/** The SRS §3 invariant, checked in the browser so a lab cannot build an invalid graph. */
export function isSceneGraph(value: unknown): value is SceneGraph {
  const g = value as SceneGraph;
  if (!g || !Array.isArray(g.objects) || !Array.isArray(g.relationships)) return false;
  const known = new Set(g.objects.map((o) => o.object_id));
  return g.relationships.every((r) => known.has(r.subject_id) && known.has(r.object_id));
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run packages/sgg-metrics`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add packages/sgg-metrics/src/types.ts packages/sgg-metrics/test/types.test.ts
git commit -m "feat(sgs): shared TypeScript wire types with the dangling-reference guard"
```

---

### Task 12: The TypeScript engine

**Files:**
- Create: `system/packages/sgg-metrics/src/iou.ts`, `src/rle.ts`, `src/match.ts`, `src/constraint.ts`, `src/metrics.ts`, `src/index.ts`
- Create: `system/packages/sgg-metrics/test/engine.test.ts`

**Interfaces:**
- Consumes: the types from Task 11.
- Produces: `evaluate(request: EvalRequest): EvalResponse` — the same signature, the same field names and the same semantics as `app.eval.engine.evaluate`.

**Mirror rule.** Each TypeScript file is a line-for-line translation of its Python counterpart: same function names, same argument order, same early returns. When the two drift, the parity harness fails and the diff must be read side by side; identical structure is what makes that reading possible.

- [ ] **Step 1: Write the failing test**

`system/packages/sgg-metrics/test/engine.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index';
import { boxIou } from '../src/iou';
import { maskIou, encodeCounts } from '../src/rle';

const TOL = 1e-9;
const cases = JSON.parse(
  readFileSync(new URL('../../../data/golden/vectors.json', import.meta.url), 'utf-8'),
).cases as Array<Record<string, any>>;

describe('box iou', () => {
  it('halves correctly', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }))
      .toBeCloseTo(50 / 150, 12);
  });
  it('is zero on touching edges', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
  });
});

describe('mask iou', () => {
  it('matches the python worked example', () => {
    const a = { counts: encodeCounts([0, 8, 8]), size: [4, 4] as [number, number] };
    const b = { counts: encodeCounts([4, 8, 4]), size: [4, 4] as [number, number] };
    expect(maskIou(a, b)).toBeCloseTo(4 / 12, 12);
  });
});

describe('golden vectors', () => {
  for (const c of cases) {
    it(c.id, () => {
      const body = evaluate({ gt: c.gt, pred: c.pred, ...c.params });
      const got = new Map(body.metrics.map((m) => [`${m.metric}@${m.k}`, m.value]));
      for (const [metric, byK] of Object.entries(c.expect)) {
        if (metric === 'verdicts') continue;
        for (const [k, want] of Object.entries(byK as Record<string, number | null>)) {
          const have = got.get(`${metric}@${k}`);
          if (want === null) expect(have).toBeNull();
          else expect(Math.abs((have as number) - want)).toBeLessThan(TOL);
        }
      }
    });
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run packages/sgg-metrics`
Expected: FAIL — cannot resolve `../src/index`

- [ ] **Step 3: Implement, mirroring the Python file by file**

`system/packages/sgg-metrics/src/iou.ts`:

```typescript
import type { BBox } from './types';

export function boxIou(a: BBox, b: BBox): number {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (ix <= 0 || iy <= 0) return 0;
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter);
}
```

`system/packages/sgg-metrics/src/rle.ts` — mirror `system/backend/app/eval/rle.py` exactly, exporting `decodeCounts`, `encodeCounts`, `decode` and `maskIou`. The bit manipulation is identical; JavaScript's `>>` and `&` are 32-bit signed, which matches the Python implementation's semantics for the run lengths COCO produces.

`system/packages/sgg-metrics/src/match.ts` — mirror `match.py`: a `Triplet` interface with the same fields, `toTriplets`, and `classify` returning `[verdict, gtIndex, iouSubject, iouObject]`.

`system/packages/sgg-metrics/src/constraint.ts` — mirror `constraint.py`: `rank`, `hasTies`, `applyConstraint`. The sort must be explicitly stable on `(-score, relationship_id)`; do not rely on `Array.prototype.sort` stability alone, because the Python side sorts on a tuple key and the tie-break must be the same comparison.

`system/packages/sgg-metrics/src/metrics.ts` — mirror `metrics.py`: `assign`, `recallAtK`, `meanRecallAtK`, `zeroShotRecallAtK`, returning `null` where Python returns `None`.

`system/packages/sgg-metrics/src/index.ts` — mirror `engine.py`'s `evaluate`, including the `WARNINGS` table with the identical bilingual strings.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run packages/sgg-metrics`
Expected: 15 passed — 3 from Task 11, 2 IoU, 1 mask, and one per golden case

- [ ] **Step 5: Commit**

```bash
git add packages/sgg-metrics
git commit -m "feat(sgs): TypeScript evaluation engine mirroring the Python reference"
```

---

### Task 13: The parity harness

**Files:**
- Create: `system/tools/parity.mjs`, `system/backend/scripts/run_golden.py`

**Interfaces:**
- Consumes: both engines and `data/golden/vectors.json`.
- Produces: `npm run lint:parity`, exit code 1 on any disagreement. This is the mechanism NFR-3 asserts.

- [ ] **Step 1: Write the Python side**

`system/backend/scripts/run_golden.py` — emits the Python engine's output for every case as JSON on stdout:

```python
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.eval.engine import EvalRequest, evaluate  # noqa: E402
from app.settings import DATA_DIR  # noqa: E402

cases = json.loads((DATA_DIR / "golden" / "vectors.json").read_text(encoding="utf-8"))["cases"]
out = {}
for case in cases:
    body = evaluate(EvalRequest.model_validate(
        {"gt": case["gt"], "pred": case["pred"], **case["params"]}))
    out[case["id"]] = {
        "metrics": {f"{m['metric']}@{m['k']}": m["value"] for m in body["metrics"]},
        "verdicts": [[v["pred_index"], v["verdict"], v["gt_index"]] for v in body["verdicts"]],
        "warnings": sorted(w["code"] for w in body["warnings"]),
        "matched_count": body["matched_count"],
        "pred_count_considered": body["pred_count_considered"],
    }
print(json.dumps(out, sort_keys=True))
```

- [ ] **Step 2: Write the harness**

`system/tools/parity.mjs`:

```javascript
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { evaluate } from '../packages/sgg-metrics/src/index.ts';

const TOL = 1e-9;
const cases = JSON.parse(readFileSync('data/golden/vectors.json', 'utf-8')).cases;

const python = JSON.parse(
  execFileSync('python', ['backend/scripts/run_golden.py'], { encoding: 'utf-8' }),
);

const failures = [];
for (const c of cases) {
  const body = evaluate({ gt: c.gt, pred: c.pred, ...c.params });
  const ts = {
    metrics: Object.fromEntries(body.metrics.map((m) => [`${m.metric}@${m.k}`, m.value])),
    verdicts: body.verdicts.map((v) => [v.pred_index, v.verdict, v.gt_index]),
    warnings: body.warnings.map((w) => w.code).sort(),
    matched_count: body.matched_count,
    pred_count_considered: body.pred_count_considered,
  };
  const py = python[c.id];
  for (const [key, want] of Object.entries(py.metrics)) {
    const have = ts.metrics[key];
    const agree = want === null ? have === null : Math.abs(have - want) < TOL;
    if (!agree) failures.push(`${c.id} ${key}: python=${want} typescript=${have}`);
  }
  if (JSON.stringify(py.verdicts) !== JSON.stringify(ts.verdicts)) {
    failures.push(`${c.id} verdicts differ\n  python=${JSON.stringify(py.verdicts)}` +
                  `\n  typescript=${JSON.stringify(ts.verdicts)}`);
  }
  if (JSON.stringify(py.warnings) !== JSON.stringify(ts.warnings)) {
    failures.push(`${c.id} warnings differ: ${py.warnings} vs ${ts.warnings}`);
  }
  for (const field of ['matched_count', 'pred_count_considered']) {
    if (py[field] !== ts[field]) {
      failures.push(`${c.id} ${field}: python=${py[field]} typescript=${ts[field]}`);
    }
  }
}

if (failures.length) {
  console.error(`parity: ${failures.length} disagreement(s)\n` + failures.join('\n'));
  process.exit(1);
}
console.log(`parity: ${cases.length} cases agree`);
```

`system/tools/parity.mjs` imports a `.ts` file, so it runs under Node's type stripping, which Node 22.12 supports for type-only syntax. Should a construct require transpilation, run it through `vitest`'s node API instead; do not introduce a build step for the harness.

- [ ] **Step 3: Run it and watch it pass**

Run: `npm run lint:parity`
Expected: `parity: 10 cases agree`

- [ ] **Step 4: Break it on purpose, confirm it fails**

Change `recallAtK` in `system/packages/sgg-metrics/src/metrics.ts` to divide by `gts.length + 1`, run `npm run lint:parity`, and confirm a non-zero exit naming the cases. Revert the change.

This step is not optional. A parity harness that has never failed has not been shown to work, and NFR-3 rests entirely on it.

- [ ] **Step 5: Commit**

```bash
git add tools/parity.mjs backend/scripts/run_golden.py
git commit -m "test(sgs): cross-implementation parity harness, verified by deliberate breakage"
```

---

### Task 14: Slice ingest, bundling, and the two licence gates

**Files:**
- Create: `system/backend/scripts/cut_slice.py`, `system/backend/scripts/bundle_slices.py`, `system/backend/scripts/verify_bundle.py`, `system/backend/scripts/make_placeholders.py`, `data/LICENCES.md`, `system/backend/tests/test_slices.py`
- Create: `system/backend/app/datasets/loader.py`, `system/backend/app/datasets/adapters/{vg150_sgb,psg,vrd,indoorvg,haystack}.py`, `system/backend/app/api/datasets.py`
- Modify: `system/backend/app/main.py`, `system/backend/app/settings.py`, `.gitignore`

**Interfaces:**
- Produces: `load_slice(ds) -> tuple[SceneGraph, ...]`, `selection_ok(graph) -> bool`, `GET /api/datasets`, `GET /api/datasets/{ds}/images/{id}`.

**The acquisition model (D-08).** The author downloads the source corpora by hand into `SGS_CORPUS_ROOT` (default `data/_raw/`, git-ignored). `cut_slice.py` reads that root and writes the slice. `bundle_slices.py` packs the cut images into one zip the class receives out of band. **No script in this repository downloads a dataset.** There is no `fetch_slices.py`; a reference to one predates this revision.

- [ ] **Step 1: Write `data/LICENCES.md` with both gates UNVERIFIED**

```markdown
# Slice licences

Two separate questions per dataset, because downloading for one's own use and distributing to a
class are different acts.

- **annotations_commit** — may derived annotations be committed to this repository?
- **bundle_distribute** — may the image files be distributed to enrolled students for classroom use?

`cut_slice.py` refuses to write `annotations.json` for a dataset whose `annotations_commit` is not
`YES`. `bundle_slices.py` refuses to include a dataset whose `bundle_distribute` is not `YES`.
`UNCLEAR` is treated as `NO`.

| Dataset | Licence | Statement URL | Checked | annotations_commit | bundle_distribute |
|---|---|---|---|---|---|
| vg150-sgb | | | | UNVERIFIED | UNVERIFIED |
| psg | | | | UNVERIFIED | UNVERIFIED |
| vrd | | | | UNVERIFIED | UNVERIFIED |
| indoorvg | | | | UNVERIFIED | UNVERIFIED |
| haystack | | | | UNVERIFIED | UNVERIFIED |
```

Fill each row from the source's own licence statement, not a survey or a mirror, and record the URL and the date read. SRS §9 records VG150 as CC BY 4.0 and PSG as MIT; confirm both rather than carrying them forward on trust.

- [ ] **Step 2: Write the failing test**

`system/backend/tests/test_slices.py`:

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from app.datasets.loader import SELECTION_RULE, load_slice, selection_ok
from app.main import create_app
from app.schema import SceneGraph
from app.settings import DATA_DIR

client = TestClient(create_app())


def test_placeholder_slice_always_exists():
    """NFR-1: every lab must be demonstrable on a bare clone with no corpora and no bundle."""
    graphs = load_slice("placeholder")
    assert len(graphs) >= 3
    assert all(isinstance(g, SceneGraph) for g in graphs)


def test_every_committed_annotation_validates():
    for path in (DATA_DIR / "slices").glob("*/annotations.json"):
        for g in load_slice(path.parent.name):
            SceneGraph.model_validate(g.model_dump())


def test_the_selection_rule_is_enforced_not_merely_documented():
    for g in load_slice("placeholder"):
        assert selection_ok(g), f"{g.image_id} violates {SELECTION_RULE}"


def test_no_annotations_are_committed_for_an_uncleared_dataset():
    """D-08's first gate, checked against what is actually on disk."""
    rows = (DATA_DIR / "LICENCES.md").read_text(encoding="utf-8")
    for path in (DATA_DIR / "slices").glob("*/annotations.json"):
        ds = path.parent.name
        if ds == "placeholder":
            continue
        row = next(line for line in rows.splitlines() if line.startswith(f"| {ds} "))
        assert "UNVERIFIED" not in row.split("|")[5], f"{ds} annotations committed uncleared"


def test_no_corpus_root_path_is_committed():
    """The author's download location must never leak into a committed file."""
    for path in (DATA_DIR / "slices").rglob("*.json"):
        text = path.read_text(encoding="utf-8")
        assert "_raw" not in text and "SGS_CORPUS_ROOT" not in text


def test_datasets_endpoint_surfaces_both_gates_and_presence():
    body = client.get("/api/datasets").json()
    for d in body["datasets"]:
        assert {"licence_commit_cleared", "licence_bundle_cleared", "images_present"} <= set(d)


def test_missing_image_returns_422_naming_the_bundle_not_500():
    r = client.get("/api/datasets/vg150-sgb/images/does-not-exist")
    assert r.status_code in (404, 422)
    err = r.json()["error"]
    assert err["code"] in ("not_found", "slice_images_missing")
    if err["code"] == "slice_images_missing":
        assert "bundle" in str(err["detail"]).lower()


def test_export_import_round_trips_losslessly():
    g = load_slice("placeholder")[0]
    assert SceneGraph.model_validate(g.model_dump()) == g
```

- [ ] **Step 3: Run it and watch it fail, then implement the loader**

Run: `pytest backend/tests/test_slices.py -v` → FAIL, no `app.datasets.loader`.

`system/backend/app/settings.py` gains the corpus root:

```python
import os

CORPUS_ROOT = Path(os.environ.get("SGS_CORPUS_ROOT", ROOT / "data" / "_raw"))
```

`system/backend/app/datasets/loader.py`:

```python
from __future__ import annotations

import json
from functools import lru_cache

from app.schema import SceneGraph
from app.settings import DATA_DIR

SELECTION_RULE = (
    "at least 4 objects; at least 3 relationships; at least one relationship whose predicate "
    "is outside the slice's ten most frequent"
)


def _top_predicates(graphs: list[SceneGraph], n: int = 10) -> set[str]:
    counts: dict[str, int] = {}
    for g in graphs:
        for r in g.relationships:
            counts[r.predicate] = counts.get(r.predicate, 0) + 1
    return {p for p, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:n]}


@lru_cache(maxsize=None)
def load_slice(ds: str) -> tuple[SceneGraph, ...]:
    path = DATA_DIR / "slices" / ds / "annotations.json"
    if not path.is_file():
        return ()
    raw = json.loads(path.read_text(encoding="utf-8"))
    return tuple(SceneGraph.model_validate(g) for g in raw["graphs"])


def selection_ok(g: SceneGraph, head: set[str] | None = None) -> bool:
    if len(g.objects) < 4 or len(g.relationships) < 3:
        return False
    if head is None:
        head = _top_predicates(list(load_slice(g.dataset)))
    return any(r.predicate not in head for r in g.relationships)
```

- [ ] **Step 4: Write the three scripts and the five adapters**

`make_placeholders.py` generates six 640×480 synthetic frames with Pillow — flat-coloured rectangles standing for `person`, `table`, `box`, `conveyor`, `robot arm` and `panel` — writes them to `data/slices/placeholder/images/`, and emits `annotations.json` satisfying `SELECTION_RULE`. The placeholder slice is the one whose **images are committed**, because it is this project's own generated output and NFR-1 depends on it being present on a bare clone. Add `!data/slices/placeholder/images/` to `.gitignore` after the `data/slices/*/images/` rule.

`cut_slice.py --dataset <ds> --n <count> --seed 20260915`:

1. resolves the corpus under `SGS_CORPUS_ROOT` at the layout D-08 tabulates, and exits with a message naming the expected path when it is absent — a missing corpus is a normal state, not an error the reader should have to decode;
2. refuses when that dataset's `annotations_commit` is not `YES`, naming the row to fill;
3. converts through `adapters/<ds>.py` to `SceneGraph`, applies the selection rule, and samples with the fixed seed;
4. writes `annotations.json` and `MANIFEST.json` (committed) and copies the chosen images into `images/` (git-ignored).

Each adapter exposes exactly one function, `def read(root: Path) -> Iterator[SceneGraph]`. The adapters are the only dataset-specific code in the project; everything downstream sees `SceneGraph`.

`bundle_slices.py` refuses any dataset whose `bundle_distribute` is not `YES`, then writes `dist/scene-graph-studio-slices-<YYYY-MM-DD>.zip` containing every cleared slice's `images/` plus a copy of each `MANIFEST.json` and of `LICENCES.md`. It prints the resulting size and the SHA-256 of the zip, so the author can quote both when distributing it.

`verify_bundle.py` walks `data/slices/*/images/` and checks every file against `MANIFEST.json`, reporting missing, extra and hash-mismatched files separately. A student who reports a broken lab runs this first, and it is what the 422 detail points them to.

`system/backend/app/api/datasets.py` implements contracts §1.3 and §1.4, reads both licence gates from `LICENCES.md`, and raises `ApiError("slice_images_missing", 422, {...})` naming the bundle when the annotation exists but the file does not.

- [ ] **Step 5: Generate the placeholders, run the tests, commit**

```bash
python backend/scripts/make_placeholders.py
pytest backend/tests/test_slices.py -v
git add backend/app/datasets backend/app/api/datasets.py backend/scripts data/LICENCES.md
git add data/slices/placeholder .gitignore backend/tests/test_slices.py
git commit -m "feat(sgs): slice ingest from a local corpus root, bundling, and two licence gates"
```

Real Tier-1 slices land in a follow-up commit once the corpora are downloaded and `data/LICENCES.md` is filled in. That work is deliberately not blocked on: the placeholder slice satisfies NFR-1, and every later plan develops against it.

---

### Task 15: The frontend skeleton

**Files:**
- Create: `system/frontend/` via `npm create vite`, then `system/frontend/src/main.tsx`, `system/frontend/src/App.tsx`, `system/frontend/src/i18n/{zh-TW,en}.json`, `system/frontend/src/i18n/useLocale.ts`, `system/frontend/vite.config.ts`, `system/tools/i18n_parity.mjs`

**Interfaces:**
- Consumes: `sgg-metrics` as a workspace dependency, `/api/health`.
- Produces: `useLocale()` returning `{ locale, t, setLocale }`; the dev proxy to the backend.

- [ ] **Step 1: Scaffold**

```bash
cd AI-LLM/scene-graph-studio
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install tailwindcss@4.3.3 @tailwindcss/vite react-router@7 @tanstack/react-query@5 katex@0.18.7
npm install sgg-metrics@*
```

- [ ] **Step 2: Configure the proxy and Tailwind**

`system/frontend/vite.config.ts`:

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
});
```

- [ ] **Step 3: Write the locale module and its lint**

`system/frontend/src/i18n/useLocale.ts`:

```typescript
import { useSyncExternalStore } from 'react';
import en from './en.json';
import zh from './zh-TW.json';

export type Locale = 'zh-TW' | 'en';
const TABLES: Record<Locale, Record<string, string>> = { 'zh-TW': zh, en };
const KEY = 'sgs:v1:lang';
const listeners = new Set<() => void>();

let current: Locale = read();

function read(): Locale {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'en' || v === 'zh-TW' ? v : 'zh-TW';
  } catch {
    return 'zh-TW';
  }
}

export function setLocale(next: Locale): void {
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* private window; in-memory only */ }
  listeners.forEach((fn) => fn());
}

export function useLocale() {
  const locale = useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => current,
    () => 'zh-TW' as Locale,
  );
  const t = (key: string): string => {
    const value = TABLES[locale][key];
    if (value === undefined) {
      if (import.meta.env.DEV) return `⟦${key}⟧`;
      throw new Error(`missing i18n key: ${key}`);
    }
    return value;
  };
  return { locale, t, setLocale };
}
```

There is no fallback locale. NFR-6 forbids one: a fallback lets a half-translated build ship looking finished.

`system/tools/i18n_parity.mjs` loads both JSON files, diffs the key sets in both directions, prints every missing key with the locale that lacks it, and exits 1 if either direction is non-empty.

- [ ] **Step 4: Write the health page and verify end to end**

`system/frontend/src/App.tsx` fetches `/api/health` and renders `torch_present`, `device`, `live_models` and `slices_present`, each label drawn from `t()`. Then:

```bash
python -m uvicorn app.main:app --app-dir backend --port 8000 &
cd frontend && npm run dev
```

Open `http://localhost:5173`. The page must show the backend's real values, and switching the locale must swap every label with no reload and survive a refresh.

- [ ] **Step 5: Run the full gate and commit**

```bash
npm run ci
git add frontend tools/i18n_parity.mjs
git commit -m "feat(sgs): Vite frontend skeleton, locale store with no fallback, health page"
```

---

### Task 16: CI

**Files:**
- Create: `.github/workflows/scene-graph-studio.yml` at the **repository root**, `system/tools/content_lint.mjs`

**Interfaces:**
- Consumes: the `ci` script from Task 1.
- Produces: the same gate on GitHub, path-filtered to this track.

- [ ] **Step 1: Write a content lint that passes vacuously**

`system/tools/content_lint.mjs` at this stage validates only what exists: that `data/golden/vectors.json` parses, that every case carries `hand_checked`, and that `data/LICENCES.md` contains no committed slice whose row reads `UNVERIFIED`. Plan 02 extends it to the module corpus, the symbol table and the `source`/`verified` fields; writing the file now means CI is complete from the first commit rather than retrofitted.

- [ ] **Step 2: Write the workflow**

`.github/workflows/scene-graph-studio.yml`:

```yaml
name: scene-graph-studio

on:
  push:
    paths: ['AI-LLM/scene-graph-studio/**', '.github/workflows/scene-graph-studio.yml']
  pull_request:
    paths: ['AI-LLM/scene-graph-studio/**']

jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: AI-LLM/scene-graph-studio
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22.12' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: python -m pip install -r backend/requirements.txt
      - run: npm ci
      - run: npm run ci
```

The path filter is not optional. `course-lab` carries eleven other tracks whose commits are PowerPoint builds; an unfiltered workflow would run on all of them and be muted within a week.

- [ ] **Step 3: Verify the gate locally**

Run: `npm run ci`
Expected: pytest green, vitest green, `parity: 10 cases agree`, i18n parity clean, content lint clean, `audit.js` and `check.js` clean against the frozen page.

- [ ] **Step 4: Push and confirm the workflow runs**

Push the branch and confirm the action triggers on this path and on no other.

- [ ] **Step 5: Commit**

```bash
git add ../../.github/workflows/scene-graph-studio.yml tools/content_lint.mjs
git commit -m "ci(sgs): one local command, mirrored by a path-filtered workflow"
```

---

## Self-review

**Spec coverage.** SRS §2 architecture — Tasks 1, 15. §3 data model — Tasks 2, 11. §4.1 triplet matching — Tasks 4, 5, 6. §4.2 assignment — Tasks 6, 8. §4.3 metrics — Task 8. §4.4 protocols and the mandatory warning — Task 9. §4.5 constraint modes — Task 7. §4.6 mask pairing — Task 5 supplies mask IoU; the `multi_mpo` / `single_mpo` **behavioural difference** is exercised by L6 in plan 03, and `mask_pairing` is carried through the request and echoed here without yet changing the result. That is deliberate and is stated so no one mistakes the parameter for being implemented. §5 API — Tasks 3, 9, 14; the remaining five endpoints belong to plans 02 and 03. §7 NFR-1 — Tasks 3, 14. NFR-3 — Task 13. NFR-4 — Tasks 7, 9. NFR-6 — Task 15. NFR-7 — Task 14. §8 test strategy — Tasks 10, 13, 14.

**Not covered here, by design:** SRS §6 the IndVisSGG replica (plan 03), §9 Tier-2 and Tier-3 reference cards (plan 02), §11 mathematical presentation (plan 02).

**Known partial:** `mask_pairing` is plumbed but inert until plan 03 Task 1. `data/LICENCES.md` ships with both gates `UNVERIFIED` for every dataset, and the real slices land after the corpora are downloaded and the rows are filled; the committed placeholder slice keeps every later plan unblocked meanwhile.

---

## Done when

```
npm run ci
```

prints pytest green, vitest green, `parity: 10 cases agree`, and clean i18n, content and frozen-page lints — and `GET /api/health` answers truthfully with `torch` uninstalled.
