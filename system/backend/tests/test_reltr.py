"""The one live path, and the two things that stop it being live on any given machine.

RelTR carries **no licence** — the GitHub API reports `license: null` for `yrcong/RelTR` and the
repository holds no LICENSE file — so none of its source may be vendored here. The operator points
`SGS_RELTR_PATH` at their own clone and drops the checkpoint into `data/checkpoints/reltr/`, both
of which stay outside version control. DEVIATIONS D41.

The conversion from the model's output tensors to a `SceneGraph` is the part most likely to be
wrong and is the part that needs no weights to test, so it is a pure function and most of this
file exercises it.
"""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import pytest

from app.infer import registry, reltr_cpu
from app.schema import SceneGraph
from app.settings import DATA_DIR


def test_module_imports_without_torch(monkeypatch):
    """NFR-1: importing the app must not require torch. The live path is the only degradable
    thing in the system and it must degrade alone."""
    monkeypatch.setitem(sys.modules, "torch", None)
    importlib.reload(reltr_cpu)


def test_the_module_body_mentions_no_torch_symbol_at_import_time():
    # A stricter reading of the same rule: `import torch` inside a function is lazy, at module
    # scope it is not, and the difference is invisible on a machine that has torch installed.
    source = (reltr_cpu.__file__ or "")
    with open(source, encoding="utf-8") as fh:
        lines = [ln for ln in fh if ln.startswith(("import torch", "from torch"))]
    assert lines == [], f"torch imported at module scope: {lines}"


def test_latency_estimate_is_measured_not_guessed():
    est = reltr_cpu.estimated_seconds_per_image()
    assert est is None or est > 0


def test_a_recorded_latency_round_trips(tmp_path, monkeypatch):
    monkeypatch.setattr(reltr_cpu, "LATENCY", tmp_path / ".latency.json")
    assert reltr_cpu.estimated_seconds_per_image() is None
    reltr_cpu.record_latency(3.25)
    assert reltr_cpu.estimated_seconds_per_image() == 3.25
    assert json.loads((tmp_path / ".latency.json").read_text(encoding="utf-8"))["reltr"] == 3.25


def test_a_nonsense_latency_is_refused(tmp_path, monkeypatch):
    """NFR-8 wants a measurement. Zero or negative seconds is not one, and storing it would put a
    number on the page that no run produced."""
    monkeypatch.setattr(reltr_cpu, "LATENCY", tmp_path / ".latency.json")
    for bad in (0.0, -1.0):
        with pytest.raises(ValueError):
            reltr_cpu.record_latency(bad)


def test_availability_states_which_of_the_three_things_is_missing(monkeypatch):
    monkeypatch.setattr(registry, "torch_present", lambda: False)
    ok, reason = reltr_cpu.available()
    assert ok is False and "torch" in reason.lower()

    monkeypatch.setattr(registry, "torch_present", lambda: True)
    monkeypatch.setattr(registry, "checkpoint_present", lambda model: False)
    monkeypatch.setenv("SGS_RELTR_PATH", "C:/nowhere")
    ok, reason = reltr_cpu.available()
    assert ok is False and "checkpoint" in reason.lower()

    monkeypatch.setattr(registry, "checkpoint_present", lambda model: True)
    monkeypatch.delenv("SGS_RELTR_PATH", raising=False)
    ok, reason = reltr_cpu.available()
    assert ok is False and "SGS_RELTR_PATH" in reason


def test_inference_refuses_rather_than_half_running(monkeypatch):
    monkeypatch.setattr(registry, "torch_present", lambda: False)
    with pytest.raises(reltr_cpu.InferenceUnavailable) as e:
        reltr_cpu.infer(b"", image_id="p1", dataset="placeholder")
    assert "torch" in str(e.value).lower()


#: Lines that only appear in a copy of RelTR's own source. A *mention* does not count --
#: `reltr_cpu` names the symbols it imports from the operator's clone, and this file quotes them
#: -- so the check is on a line that opens a definition at column zero.
VENDORED_MARKERS = (
    "class RelTR",
    "class Transformer",
    "class Backbone",
    "def build_model",
    "REL_CLASSES =",
    "CLASSES = [",
)


# Trees that are on this disk without being in this repository. Installed third-party code is
# not vendored code, and a licence guard that cannot tell the difference is worse than none: it
# fires on an ordinary developer action and trains the reader to ignore it.
#
# Found on 2026-09-19. `check:offline` asks for a torch-free interpreter and its own usage note
# suggests building one at `system/.offline-venv`; doing so put `dns.py`, from a dependency of a
# dependency, under the scan, and its `CLASSES = [` tripped a marker written for RelTR's own
# class list. The file is gitignored and was never going to be committed. `site-packages` rather
# than a list of venv names, because it is the one directory every layout has.
SKIP_DIRS = {"node_modules", "__pycache__", "site-packages"}


def vendored_lines(root: Path) -> list[str]:
    out = []
    for path in root.rglob("*.py"):
        if SKIP_DIRS & set(path.parts):
            continue
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if any(line.startswith(marker) for marker in VENDORED_MARKERS):
                out.append(f"{path.name}: {line}")
    return out


def test_no_reltr_source_is_vendored_into_this_repository():
    """The licence guard. `yrcong/RelTR` declares none, so copying any of it here would be a
    redistribution nobody granted. This fails the moment someone pastes the model definition in."""
    assert vendored_lines(DATA_DIR.parent / "system") == []


def test_the_licence_guard_can_actually_fail(tmp_path):
    """The guard above scans a tree that is clean by construction, so on its own it proves
    nothing -- the trap D19, D22 and D24 record. This runs the same rule over a file that
    violates it.

    Written because the first version of the guard passed with vendored source sitting in the
    tree: its regex reached the file through a heredoc, which turned the word boundary escape
    into a literal backspace, so the pattern required a control character no source file holds.
    """
    (tmp_path / "vendored.py").write_text("class RelTR:\n    pass\n", encoding="utf-8")
    assert vendored_lines(tmp_path) == ["vendored.py: class RelTR:"]


# ── the conversion, which needs no weights ────────────────────────────────────────────────────

DETECTIONS = [
    {"label": "person", "bbox": [0.0, 0.0, 10.0, 20.0]},
    {"label": "table", "bbox": [5.0, 5.0, 30.0, 30.0]},
    {"label": "cup", "bbox": [8.0, 8.0, 12.0, 12.0]},
]
RELATIONS = [
    {"subject": 0, "object": 1, "predicate": "on", "score": 0.90},
    {"subject": 0, "object": 2, "predicate": "holding", "score": 0.70},
    {"subject": 2, "object": 1, "predicate": "on", "score": 0.80},
]


def graph(**over):
    kwargs = {
        "detections": DETECTIONS,
        "relations": RELATIONS,
        "image_id": "p1",
        "dataset": "placeholder",
        "width": 64,
        "height": 48,
        "checkpoint": "checkpoint0149.pth",
        "max_triplets": 100,
    }
    kwargs.update(over)
    return reltr_cpu.to_scene_graph(**kwargs)


def test_the_conversion_produces_a_valid_scene_graph():
    g = graph()
    SceneGraph.model_validate(g.model_dump())
    assert g.provenance.kind == "model"
    assert g.provenance.fidelity == "measured"
    assert g.provenance.model == "reltr"
    assert g.provenance.generated_at


def test_every_relationship_carries_a_score():
    """An unscored prediction cannot be ranked, and `rank` puts it after every scored one. A
    detector that emits confidences and loses them on the way in has silently changed @K."""
    assert all(r.score is not None for r in graph().relationships)


def test_relationships_come_back_in_score_order():
    assert [r.score for r in graph().relationships] == [0.90, 0.80, 0.70]


def test_max_triplets_truncates_the_lowest_scoring_first():
    kept = graph(max_triplets=2)
    assert [r.score for r in kept.relationships] == [0.90, 0.80]
    # And the object that only the dropped triplet referenced goes with it, or the graph dangles.
    assert {o.names[0] for o in kept.objects} == {"person", "table", "cup"}


def test_the_checkpoint_is_named_in_the_provenance_note():
    # D-07: "measured" is a claim about a run, and a run is a checkpoint on a machine on a date.
    assert "checkpoint0149.pth" in (graph().provenance.note or "")


def test_a_relation_referencing_a_detection_that_is_not_there_is_dropped():
    """SRS §3's invariant is enforced by the schema; reaching it with a dangling id would raise
    on a student's screen instead of being filtered where the model output is read."""
    g = graph(relations=[*RELATIONS, {"subject": 0, "object": 99, "predicate": "near",
                                      "score": 0.6}])
    assert len(g.relationships) == 3


def test_an_empty_prediction_is_a_valid_empty_graph_not_an_error():
    g = graph(detections=[], relations=[])
    assert g.relationships == []
    assert g.objects == []


def test_the_checkpoint_is_never_unpickled_unguarded():
    """A .pth from a Google Drive link is untrusted input. torch.load defaults to
    weights_only=False, which unpickles arbitrary objects: loading it unguarded is remote code
    execution wearing a file extension."""
    source = open(reltr_cpu.__file__, encoding="utf-8").read()
    calls = [ln.strip() for ln in source.splitlines() if "torch.load(" in ln]
    assert calls, "no torch.load call found; this guard has nothing to guard"
    for call in calls:
        assert "weights_only=True" in call, call
