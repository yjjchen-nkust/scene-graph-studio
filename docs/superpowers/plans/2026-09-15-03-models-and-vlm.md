# Plan 03 — Models and the VLM Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One image runs through several models and through the three-step IndVisSGG pipeline, and a student can see a benchmark correction change a published ranking in front of them.

**Architecture:** A registry serves committed predictions and reports honestly which models can run on this machine; RelTR is the only live path and it is opt-in. The `VLMProvider` protocol has an offline transcript player as its default implementation, so L5 works with no key and no network. `multi_mpo` and `single_mpo` become behaviourally distinct here — plan 01 plumbed the parameter and left it inert, deliberately.

**Tech Stack:** FastAPI · PyTorch (optional import) · Pydantic v2 · React 19

**Spec:** `../specs/2026-09-15-scene-graph-studio-SRS.md` §4.6, §5, §6 · `…-PRD.md` §6.2 (L4, L5, L6), §9
**Decisions:** D-05 (cache-first), D-06 (tiers and the spike), D-07 (provenance), D-17 (Claude, opt-in)
**Contracts:** §1.6, §1.7, §1.8, §1.9

## Global Constraints

See `2026-09-15-00-master.md` § Global constraints. The three that bite hardest here:

- **No P0 feature may depend on `torch`.** Live inference is the degradable path and nothing else degrades with it.
- **`fidelity: 'reconstructed'` requires a populated `note` and renders unverified.** A reconstructed prediction is never described as a model's output.
- **The published IndVisSGG numbers and the student's own run are returned in separate fields and are never summed, averaged or compared in one figure.**

---

## File structure

| File | Responsibility |
|---|---|
| `system/backend/app/eval/pairing.py` | `single_mpo` / `multi_mpo` — the one place the protocols differ |
| `system/backend/app/infer/registry.py` | Model metadata; what can run here |
| `system/backend/app/infer/cached.py` | Committed prediction lookup |
| `system/backend/app/infer/reltr_cpu.py` | The one live path; `torch` imported lazily |
| `system/backend/app/api/models.py` | `/api/models`, `/api/infer/{model}`, `/api/predictions/...` |
| `system/backend/app/vlm/provider.py` | The `VLMProvider` protocol |
| `system/backend/app/vlm/transcript.py` | The offline player — the default |
| `system/backend/app/vlm/claude.py` | The opt-in live provider |
| `system/backend/app/vlm/indvissgg.py` | Three steps, N experts, TEC |
| `system/backend/app/api/vlm.py` | `/api/vlm/indvissgg` |
| `data/predictions/PROVENANCE.md` | How every committed prediction was obtained |
| `data/vlm/transcripts/*.json` | Recorded VLM exchanges |
| `data/content/indvissgg_tables.json` | Tables 3 and 4, as published |
| `system/frontend/src/labs/L4/MethodComparator.tsx` | One image, several models, side by side |
| `system/frontend/src/labs/L5/IndVisSGGReplica.tsx` | TEC editor, expert count, ablation replay |
| `system/frontend/src/labs/L6/ProtocolForensics.tsx` | The same predictions under both pairings |

---

### Task 1: Mask-pairing modes

**Files:**
- Create: `system/backend/app/eval/pairing.py`, `system/backend/tests/test_pairing.py`, `system/packages/sgg-metrics/src/pairing.ts`
- Modify: `system/backend/app/eval/engine.py`, `system/packages/sgg-metrics/src/index.ts`, `data/golden/vectors.json`

**Interfaces:**
- Produces: `apply_pairing(ranked: list[Triplet], mode: MaskPairing) -> list[Triplet]`, applied between ranking and constraint filtering.

**The rule, from the E13 derivation in the harvested corpus.** Under `single_mpo` each ordered pair admits one mask instance: predictions sharing both a subject mask and an object mask collapse to the highest-scoring one. Under `multi_mpo` duplicates survive, so `μ̂ = Σ min(d, true matches at (s,o)) ≥ μ`. A one-stage model emits duplicate masks freely, so `d > 1` costs it nothing and pays; a two-stage model emits one mask per instance, so `d = 1` either way.

- [ ] **Step 1: Write the failing test**

```python
def test_single_mpo_collapses_duplicate_mask_instances():
    preds = [dup(score=0.9), dup(score=0.8), other(score=0.7)]
    assert len(apply_pairing(rank(preds), "single_mpo")) == 2


def test_multi_mpo_keeps_them():
    preds = [dup(score=0.9), dup(score=0.8), other(score=0.7)]
    assert len(apply_pairing(rank(preds), "multi_mpo")) == 3


def test_single_mpo_keeps_the_highest_scoring_duplicate():
    kept = apply_pairing(rank([dup(score=0.4), dup(score=0.9)]), "single_mpo")
    assert kept[0].score == 0.9


def test_a_one_stage_style_model_loses_recall_under_the_correction():
    """Direction, not magnitude: ECCV'24's Table. PSGTR 20.8 -> 11.62, HiLo 30.3 -> 18.33."""
    one_stage = duplicating_predictions()
    multi = recall_under(one_stage, "multi_mpo")
    single = recall_under(one_stage, "single_mpo")
    assert single < multi


def test_a_two_stage_style_model_is_unchanged():
    """VCTree was approximately unchanged, because it emits one mask per instance."""
    two_stage = non_duplicating_predictions()
    assert recall_under(two_stage, "multi_mpo") == recall_under(two_stage, "single_mpo")


def test_boxes_only_graphs_are_unaffected_by_the_pairing_mode():
    preds = box_only_predictions()
    assert apply_pairing(rank(preds), "single_mpo") == apply_pairing(rank(preds), "multi_mpo")
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pytest backend/tests/test_pairing.py -v` → `ModuleNotFoundError`

- [ ] **Step 3: Implement**

```python
from __future__ import annotations

from app.eval.match import Triplet
from app.schema import MaskPairing


def apply_pairing(ranked: list[Triplet], mode: MaskPairing) -> list[Triplet]:
    """Mask-instance de-duplication. A no-op on graphs that carry no masks."""
    if mode == "multi_mpo":
        return list(ranked)
    seen: set[tuple[str, str, str, str]] = set()
    out: list[Triplet] = []
    for p in ranked:
        if p.subject_mask is None or p.object_mask is None:
            out.append(p)
            continue
        key = (p.subject_name, p.object_name, p.subject_mask.counts, p.object_mask.counts)
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out
```

In `engine.evaluate`, apply it immediately after `rank` and before `apply_constraint`, on both the constrained and unconstrained pools. Mirror it in TypeScript.

- [ ] **Step 4: Extend the golden vectors, run parity**

Add `gv-011-mask-pairing-gap`: one ordered pair, three predicted mask instances of which two are duplicates, two ground-truth triplets at that pair. Hand-compute `R@20` under both modes; they must differ. Then:

```bash
pytest backend/tests -q && npm run lint:parity
```

Expected: green, `parity: 11 cases agree`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/eval/pairing.py packages/sgg-metrics/src/pairing.ts backend/tests/test_pairing.py data/golden/vectors.json
git commit -m "feat(sgs): single_mpo and multi_mpo become behaviourally distinct"
```

---

### Task 2: The model registry and honest capability reporting

**Files:**
- Create: `system/backend/app/infer/registry.py`, `system/backend/app/infer/cached.py`, `system/backend/app/api/models.py`, `system/backend/tests/test_registry.py`
- Create: `data/predictions/PROVENANCE.md`
- Modify: `system/backend/app/main.py`, `system/backend/app/api/health.py`

- [ ] **Step 1: Write the failing test**

```python
def test_every_non_live_model_states_a_reason_in_both_languages():
    body = client.get("/api/models").json()
    for m in body["models"]:
        if not m["live"]:
            assert m["live_blocked_reason_en"] and m["live_blocked_reason_zh"]


def test_reltr_is_the_only_model_that_can_ever_be_live():
    body = client.get("/api/models").json()
    assert {m["id"] for m in body["models"] if m["live"]} <= {"reltr"}


def test_infer_on_a_detectron2_family_model_is_503_not_500():
    r = client.post("/api/infer/motifs", json={"dataset": "placeholder", "image_id": "p1"})
    assert r.status_code == 503
    err = r.json()["error"]
    assert err["code"] == "inference_unavailable"
    assert "torch_present" in err["detail"]


def test_reltr_without_torch_degrades_with_a_reason(monkeypatch):
    monkeypatch.setattr("app.infer.registry.torch_present", lambda: False)
    r = client.post("/api/infer/reltr", json={"dataset": "placeholder", "image_id": "p1"})
    assert r.status_code == 503
    assert r.json()["error"]["detail"]["torch_present"] is False


def test_a_reconstructed_prediction_carries_a_note():
    for path in (DATA_DIR / "predictions").rglob("*.json"):
        g = SceneGraph.model_validate_json(path.read_text(encoding="utf-8"))
        if g.provenance.fidelity != "measured":
            assert g.provenance.note, path


def test_no_committed_prediction_claims_measured_without_an_entry_in_provenance_md():
    recorded = (DATA_DIR / "predictions" / "PROVENANCE.md").read_text(encoding="utf-8")
    for path in (DATA_DIR / "predictions").rglob("*.json"):
        g = SceneGraph.model_validate_json(path.read_text(encoding="utf-8"))
        if g.provenance.fidelity == "measured":
            assert f"{g.provenance.model}" in recorded, path
```

The last two tests are the enforcement of D-07. Without them, `fidelity` is a field someone fills in optimistically.

- [ ] **Step 2: Run it and watch it fail, then implement**

`registry.py` holds the metadata table and `torch_present()`, which uses `importlib.util.find_spec` and never imports. `cached.py` reads `data/predictions/{ds}/{model}/{image_id}.json`. `api/models.py` implements contracts §1.6, §1.7 and §1.8, raising `ApiError("inference_unavailable", 503, {...})` with `model`, `reason`, `torch_present` and `checkpoint_present` in the detail.

The blocked reasons are written once, in both languages, and they are specific:

- Motifs, VCTree: *"This model needs `maskrcnn-benchmark`, which is unmaintained and pinned to a PyTorch and CUDA generation this project does not install."*
- PSGFormer: *"This model needs `detectron2`, which does not build in this environment."*
- EGTR: *"Predictions are committed; live inference is not wired up."*

- [ ] **Step 3: Run the tests**

Run: `pytest backend/tests/test_registry.py -v`

- [ ] **Step 4: Write `PROVENANCE.md`**

One section per model: how the predictions were obtained, on what hardware, with what checkpoint and what commit, on what date. For a `reconstructed` set, what published behaviour it reproduces and from which table. This file is the audit trail the tests check against.

- [ ] **Step 5: Commit**

```bash
git add backend/app/infer backend/app/api/models.py data/predictions/PROVENANCE.md backend/tests/test_registry.py
git commit -m "feat(sgs): model registry that reports its own limits, and the provenance audit trail"
```

---

### Task 3: The detectron2 spike, timeboxed

**Files:**
- Modify: `data/predictions/PROVENANCE.md`

This task is a **four-hour timebox** (D-06). It exists because the development machine is AMD64 with an RTX 3070 Ti, so the design document's ARM64 objection does not apply to it. Nothing downstream may assume it succeeded.

- [ ] **Step 1: Attempt the build**

Install a CUDA build of torch into a **separate** virtual environment — never the project environment, which must keep its CPU wheel so NFR-1 stays testable — then attempt `detectron2` against it.

- [ ] **Step 2: Stop at the timebox, whatever the state**

Do not extend it. Do not carry a partial build into the repository.

- [ ] **Step 3: Record the outcome either way**

Append to `PROVENANCE.md`: the date, the exact commands, the failure text or the success, and the decision taken. A failed spike that is written down is worth more than one that is repeated in six months.

- [ ] **Step 4: If it succeeded, produce real predictions**

Run Motifs and PSGFormer over the slice, commit with `fidelity: 'measured'`, and skip Task 4.

- [ ] **Step 5: If it failed, proceed to Task 4**

```bash
git add data/predictions/PROVENANCE.md
git commit -m "docs(sgs): record the detectron2 spike outcome"
```

---

### Task 4: Committed predictions

**Files:**
- Create: `system/backend/scripts/run_reltr.py`, `system/backend/scripts/run_egtr.py`, `system/backend/scripts/reconstruct_predictions.py`
- Create: `data/predictions/**/*.json`
- Create: `system/backend/requirements-infer.txt`

- [ ] **Step 1: Produce the measured tier**

`system/backend/requirements-infer.txt` carries `torch`, `transformers`, `huggingface_hub` and `timm`, separate from `requirements.txt` so the base install stays torch-free. Run RelTR and EGTR over the fetched slices and write one file per `(dataset, model, image)` with `fidelity: 'measured'`, the checkpoint identifier in `note`, and `generated_at`.

- [ ] **Step 2: Build the reconstructed tier**

`reconstruct_predictions.py` takes a ground-truth graph, a target recall profile and a duplication rate, and emits a prediction file whose behaviour reproduces a published model's documented characteristics on this slice. Every file carries:

```json
"provenance": {
  "kind": "model", "fidelity": "reconstructed", "model": "psgformer",
  "note": "Reconstructed to reproduce the duplicate-mask behaviour reported for one-stage panoptic models (ECCV 2024 mask-pairing correction). This is NOT PSGFormer output; no PSGFormer checkpoint was run."
}
```

The script is committed and deterministic under a fixed seed, so a reader can regenerate the files and see exactly what was constructed.

- [ ] **Step 3: Assert the tiers in tests**

Run: `pytest backend/tests/test_registry.py -v` — the two provenance tests from Task 2 now have real files to check.

- [ ] **Step 4: Verify the sanity check of design §6 item 2**

Feed the committed RelTR predictions for the `vg150-sgb` slice through `/api/eval` at SGDet, graph constraint, K = 50. Record the number in `PROVENANCE.md` **as a sanity check and never as a reproduction**: the slice is 80 images, not 26,446, so the published 27.5 is not the target. What is being checked is that the magnitude is plausible and that the constraint and protocol tags are right.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/run_*.py backend/scripts/reconstruct_predictions.py backend/requirements-infer.txt data/predictions
git commit -m "feat(sgs): measured RelTR/EGTR predictions and labelled reconstructions"
```

---

### Task 5: RelTR live inference

**Files:**
- Create: `system/backend/app/infer/reltr_cpu.py`, `system/backend/tests/test_reltr.py`

- [ ] **Step 1: Write the failing test**

```python
def test_module_imports_without_torch(monkeypatch):
    """NFR-1: importing the app must not require torch."""
    monkeypatch.setitem(sys.modules, "torch", None)
    import app.infer.reltr_cpu  # must not raise


def test_latency_estimate_is_measured_not_guessed():
    est = reltr_cpu.estimated_seconds_per_image()
    assert est is None or est > 0


def test_inference_returns_a_valid_scene_graph():
    if not registry.torch_present():
        pytest.skip("torch absent; the live path is opt-in")
    g = reltr_cpu.infer(placeholder_image(), max_triplets=20)
    SceneGraph.model_validate(g.model_dump())
    assert g.provenance.fidelity == "measured"
    assert all(r.score is not None for r in g.relationships)
```

- [ ] **Step 2: Run it and watch it fail, then implement**

`torch` is imported inside `infer()`, never at module scope. `estimated_seconds_per_image()` returns a value measured on first run and cached to `data/predictions/.latency.json`, or `None` before any run — NFR-8 requires a measured estimate, and a hard-coded guess is worse than no number.

- [ ] **Step 3: Measure and record**

Run one inference on DEV, record the measured latency in `PROVENANCE.md`.

- [ ] **Step 4: Verify the degradation path**

In an environment with `torch` absent, `POST /api/infer/reltr` must return 503 with a reason. Confirm by hand, not only in the test.

- [ ] **Step 5: Commit**

```bash
git add backend/app/infer/reltr_cpu.py backend/tests/test_reltr.py
git commit -m "feat(sgs): RelTR CPU live path, lazily imported, with a measured latency estimate"
```

---

### Task 6: The `VLMProvider` protocol and the transcript player

**Files:**
- Create: `system/backend/app/vlm/provider.py`, `system/backend/app/vlm/transcript.py`, `system/backend/app/vlm/claude.py`, `data/vlm/transcripts/*.json`, `system/backend/tests/test_vlm_provider.py`

**Interfaces:**
- Produces:

```python
class VLMProvider(Protocol):
    name: str
    def complete(self, *, prompt: str, image_ref: str | None,
                 context: dict[str, Any]) -> str: ...
```

- [ ] **Step 1: Write the failing test**

```python
def test_transcript_player_is_the_default():
    assert get_provider(None).name == "transcript"


def test_transcript_player_needs_no_network_and_no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = get_provider(None).complete(prompt="step1", image_ref="p1", context={})
    assert out


def test_an_unrecorded_prompt_raises_a_stated_error_not_a_silent_empty():
    with pytest.raises(TranscriptMiss) as e:
        get_provider(None).complete(prompt="nothing recorded", image_ref="p1", context={})
    assert "record" in str(e.value).lower()


def test_claude_provider_without_a_key_is_never_selected_silently(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ProviderUnavailable):
        get_provider("claude")


def test_no_transcript_contains_anything_resembling_a_key():
    for path in (DATA_DIR / "vlm" / "transcripts").rglob("*.json"):
        text = path.read_text(encoding="utf-8")
        assert "sk-" not in text and "ANTHROPIC_API_KEY" not in text
```

The last test is not paranoia: transcripts are recorded from live runs, and a recorded exchange is exactly the kind of artefact that carries a header by accident.

- [ ] **Step 2: Run it and watch it fail, then implement**

The transcript player keys on a hash of `(prompt, image_ref, sorted context)` and raises `TranscriptMiss` naming the missing key and how to record it. Silence would let L5 appear to work while teaching nothing.

`claude.py` reads `ANTHROPIC_API_KEY` from the environment, raises `ProviderUnavailable` when it is absent, and is selected only by explicit request.

- [ ] **Step 3: Record the transcripts**

Run the three canned corrections of SRS §6 against a live provider once, and commit the exchanges: deleting a hallucinated `wrench`; recovering missing `terminals`, `beam` and `panel`; rewriting an imprecise `taping` to the criteria-legal `knocking on`. Redact nothing except credentials — the point is that a student can read what the model actually said.

- [ ] **Step 4: Run the tests**

Run: `pytest backend/tests/test_vlm_provider.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/vlm data/vlm/transcripts backend/tests/test_vlm_provider.py
git commit -m "feat(sgs): VLMProvider protocol, offline transcript player as the default"
```

---

### Task 7: The IndVisSGG replica

**Files:**
- Create: `system/backend/app/vlm/indvissgg.py`, `system/backend/app/api/vlm.py`, `data/content/indvissgg_tables.json`, `system/backend/tests/test_indvissgg.py`

- [ ] **Step 1: Write the failing test**

```python
def test_step_one_without_criteria_differs_from_step_one_with_them():
    plain = run(O=[], P=[], E=[], steps=[1])
    with_tec = run(O=OBJECTS, P=PREDICATES, E=EXAMPLES, steps=[1])
    assert plain["step1"]["graph"] != with_tec["step1"]["graph"]


def test_expert_count_produces_that_many_analyses():
    for n in (1, 2, 3, 5):
        assert len(run(n_experts=n, steps=[1, 2])["step2"]) == n


def test_the_prompt_is_returned_so_a_student_can_read_it():
    body = run(steps=[1])
    assert body["step1"]["prompt_shown"].strip()


def test_published_tables_are_returned_separately_and_labelled():
    body = run(steps=[1, 2, 3])
    assert "not this run" in body["published_reference"]["note_en"]


def test_table3_is_the_full_five_row_factorial():
    """Rows 2 and 3 are single-component ablations. Reading them as cumulative loses the
    paper's most interesting result: O alone gives 1.787 and P alone 2.079, but together
    they give 20.792 -- an order of magnitude beyond either."""
    t3 = run(steps=[1])["published_reference"]["table3"]
    assert len(t3) == 5
    assert [row["r_at_20"] for row in t3] == [0.032, 1.787, 2.079, 20.792, 23.040]
    assert [row["components"] for row in t3] == ["", "O", "P", "O+P", "O+P+E"]


def test_table4_carries_every_cutoff_because_n5_is_not_uniformly_better():
    """A two-column summary would imply N=5 dominates N=3. It does not: at k=50 it loses
    on mR and at k=100 it loses on R. The lab must be able to show that."""
    t4 = {row["n_experts"]: row for row in run(steps=[1])["published_reference"]["table4"]}
    assert set(t4) == {1, 2, 3, 5}
    assert t4[3]["r_at_20"] == 23.158 and t4[3]["mr_at_20"] == 16.947
    assert t4[5]["r_at_20"] > t4[3]["r_at_20"]        # N=5 leads at k=20
    assert t4[5]["mr_at_50"] < t4[3]["mr_at_50"]      # and loses at k=50
    assert t4[5]["r_at_100"] < t4[3]["r_at_100"]      # and at k=100


def test_ablating_each_component_is_independent():
    for component in ("O", "P", "E"):
        body = run(ablate=[component], steps=[1])
        assert body["step1"]["prompt_shown"].count(component) >= 0  # shape only
        assert body["step1"]["graph"]["provenance"]["kind"] == "vlm"


def test_a_predicate_outside_P_is_scored_as_a_false_positive():
    """Knowledge point L10: the error is counted twice — a wasted rank and a miss."""
    graph = run(steps=[1])["step1"]["graph"]
    illegal = [r for r in graph["relationships"] if r["predicate"] not in PREDICATES]
    assert illegal == [], "step 1 with P supplied must not emit an out-of-vocabulary predicate"
```

- [ ] **Step 2: Run it and watch it fail, then implement**

Three functions mirroring SRS §6 exactly:

```python
def step1(video_frame, O, P, E, prompt, provider) -> SceneGraph: ...
def step2(video_frame, O, P, E, prompt, s1, n_experts, provider) -> list[tuple[SceneGraph, str]]: ...
def step3(s2_graphs, analyses, alpha, prompt, provider) -> SceneGraph: ...
```

Every emitted graph carries `provenance.kind = 'vlm'` and `fidelity = 'measured'` when it came from a live provider, `'reconstructed'` with a note when it came from a transcript replaying a different image.

`data/content/indvissgg_tables.json` holds both published tables, each marked
`fidelity: 'published'` with the table cited. Both are transcribed in full, with the
reading of each, in `../specs/2026-09-16-indvissgg-reading.md` §7 — use that as the
source rather than re-reading the PDF, and keep its warnings about how each table is
misread.

**Table 3 is a five-row factorial over (*O*, *P*, *E*&Analysis), not a cumulative sequence.**
Rows 2 and 3 are single-component ablations — *O* alone, then *P* alone — and reading them as
cumulative loses the paper's most interesting result. Commit all five rows:

| *O* | *P* | *E*&Analysis | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|---|---|
| ✗ | ✗ | ✗ | 0.032 | 0.014 | 0.041 | 0.027 | 0.055 | 0.039 |
| ✓ | ✗ | ✗ | 1.787 | 0.378 | 3.195 | 2.645 | 3.272 | 2.652 |
| ✗ | ✓ | ✗ | 2.079 | 1.122 | 3.563 | 1.975 | 3.955 | 2.678 |
| ✓ | ✓ | ✗ | 20.792 | 16.538 | 28.188 | 21.673 | 29.038 | 22.046 |
| ✓ | ✓ | ✓ | 23.040 | 17.250 | 29.785 | 27.375 | 30.147 | 27.680 |

The result to surface in L5: *O* alone gives 1.787 and *P* alone gives 2.079, but together they
give 20.792 — an order of magnitude beyond either. Constraining one end of the triplet is nearly
worthless; constraining both is transformative. The paper does not remark on it.

**Table 4, all four rows**, because `N=5` is *not* uniformly better than `N=3` and a two-column
summary implies it is:

| N | R@20 | mR@20 | R@50 | mR@50 | R@100 | mR@100 |
|---|---|---|---|---|---|---|
| 1 | 21.323 | 15.400 | 23.530 | 18.701 | 24.431 | 24.920 |
| 2 | 21.584 | 16.428 | 25.371 | 19.247 | 26.541 | 25.396 |
| 3 | 23.158 | 16.947 | 28.447 | 25.480 | 30.142 | 27.031 |
| 5 | 23.287 | 17.890 | 28.754 | 24.383 | 30.020 | 27.591 |

At `k=20`, `N=5` leads on both axes. At `k=50` it loses on mR (24.383 against 25.480) and at
`k=100` it loses on R (30.020 against 30.142). So `N=3` is not dominated and the paper's
recommendation rests on more than token cost. A lab that shows only the `@20` column would teach
the opposite.

- [ ] **Step 3: Implement `/api/vlm/indvissgg` per contracts §1.9**

- [ ] **Step 4: Run the tests**

Run: `pytest backend/tests/test_indvissgg.py -v`

- [ ] **Step 5: Commit**

```bash
git add backend/app/vlm/indvissgg.py backend/app/api/vlm.py data/content/indvissgg_tables.json backend/tests/test_indvissgg.py
git commit -m "feat(sgs): the three-step, N-expert IndVisSGG replica with published tables kept separate"
```

---

### Task 8: L5, the IndVisSGG Replica lab

**Files:**
- Create: `system/frontend/src/labs/L5/IndVisSGGReplica.tsx`, `system/frontend/src/labs/L5/TECEditor.tsx`, `system/frontend/src/labs/L5/AblationReplay.tsx`

- [ ] **Step 1: Write the failing test**

Assert: editing *O* and re-running changes step 1's output; the expert slider renders N analyses; the ablation replay shows the published Table 3 row and the student's own run **in two visually distinct panels** with different headings; and a snapshot test confirms the two numbers are never rendered inside one element.

```typescript
it('never renders a published number and a student number in the same element', () => {
  const { container } = render(<AblationReplay published={TABLE3} own={OWN_RUN} />);
  for (const el of container.querySelectorAll('[data-figure]')) {
    const kinds = new Set([...el.querySelectorAll('[data-fidelity]')]
      .map((n) => n.getAttribute('data-fidelity')));
    expect(kinds.size).toBeLessThanOrEqual(1);
  }
});
```

- [ ] **Step 2: Run it and watch it fail, then implement**

`TECEditor` edits *O*, *P* and *E* as three lists; each example carries its analysis, because SRS §6 makes examples-with-analysis the third ablation dimension and an example without one is a different treatment.

The three canned corrections play back as a step-through, each showing the expert's analysis text alongside the graph before and after.

- [ ] **Step 3: Render the prompt**

Every step shows its `prompt_shown` in a collapsible panel. A student who cannot read the prompt cannot evaluate the method, and the paper's entire claim is that the prompt's arguments are what move `R@20` from 0.032 to 23.040 with no architectural change.

- [ ] **Step 4: Run the tests and walk the lab by hand**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/labs/L5
git commit -m "feat(sgs): L5 — TEC editor, expert count, ablation replay, prompts shown"
```

---

### Task 9: L4 Method Comparator

**Files:**
- Create: `system/frontend/src/labs/L4/MethodComparator.tsx`

- [ ] **Step 1: Write the failing test**

Assert: every model column carries a provenance chip; a `reconstructed` column is visually distinct and its note is reachable without a click; the live-inference button is disabled with a stated reason when `/api/health` reports `torch_present: false`; and the measured latency estimate is shown before inference starts, never after.

- [ ] **Step 2: Run it and watch it fail, then implement**

One image, several columns, each a `SceneGraphView` in diff mode against the same ground truth, with a `MetricReadout` row beneath. The VLM pipeline's output is one of the columns, so two-stage, one-stage and VLM sit in one comparison — which is the lesson.

- [ ] **Step 3: Verify the degradation path by hand**

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/labs/L4
git commit -m "feat(sgs): L4 Method Comparator with provenance chips on every column"
```

---

### Task 10: L6 Protocol Forensics

**Files:**
- Create: `system/frontend/src/labs/L6/ProtocolForensics.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
it('shows one-stage numbers falling and two-stage numbers roughly stable', () => {
  const oneStage = scoreBoth(ONE_STAGE_PREDICTIONS);
  const twoStage = scoreBoth(TWO_STAGE_PREDICTIONS);
  expect(oneStage.single).toBeLessThan(oneStage.multi);
  expect(Math.abs(twoStage.single - twoStage.multi)).toBeLessThan(1e-9);
});

it('labels the reconstructed predictions as reconstructed', () => {
  const { container } = render(<ProtocolForensics />);
  expect(container.querySelector('[data-fidelity="reconstructed"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run it and watch it fail, then implement**

The same predictions, scored under both pairings, with the two rankings side by side and the rows that changed position highlighted. The published direction — PSGTR 20.8 → 11.62, HiLo 30.3 → 18.33, VCTree approximately unchanged — is shown as a `published` reference beside the lab's own numbers, in a separate panel per the L5 rule.

- [ ] **Step 3: State what this lab is and is not**

A standing note in the lab, in both languages: these predictions are reconstructed to reproduce the documented duplicate-mask behaviour, and the lab demonstrates the mechanism of the correction, not a reproduction of the published table. If Task 3's spike produced real Motifs and PSGFormer output, this note changes to say so, and the fidelity chips change with it.

- [ ] **Step 4: Run the tests**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/labs/L6
git commit -m "feat(sgs): L6 Protocol Forensics — one correction, two rankings, honest labels"
```

---

## Self-review

**Spec coverage.** SRS §4.6 mask pairing — Task 1, which closes plan 01's declared partial. §5 the remaining endpoints — Tasks 2, 5, 7. §6 the IndVisSGG replica in full — Tasks 6, 7, 8. §9 data tiers — Task 4. PRD §6.2 L4, L5, L6 — Tasks 9, 8, 10. §9 the cache-first constraint — Tasks 2, 3, 4, 5. NFR-1 — Tasks 5, 6, 9. NFR-2 and D-07 — Tasks 2, 4, 8, 9, 10. NFR-8 measured latency — Task 5.

**Type consistency check.** `apply_pairing` takes and returns `list[Triplet]`, the same type `apply_constraint` takes in plan 01 Task 7, and is inserted between `rank` and `apply_constraint` in both engines. `VLMProvider.complete` has the same signature in `transcript.py` and `claude.py`. `IndVisSGGResponse`'s field names match contracts §1.9 exactly and are consumed unchanged by Task 8.

**Known risk.** Task 3's spike may succeed, which would change Tasks 4, 9 and 10 from `reconstructed` to `measured` labels. Nothing structural changes — only the `fidelity` values and the standing notes — because D-07 made provenance a data field rather than a branch in the code.

---

## Done when

A student can open `/lab/L4`, see one frame scored against four models with an honest provenance chip on each; open `/lab/L5`, delete `O` from the criteria and watch `R@20` collapse; and open `/lab/L6`, flip one protocol switch, and watch a published ranking reorder itself.
