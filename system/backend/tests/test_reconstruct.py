"""The reconstructed tier: predictions built to exhibit a documented behaviour, labelled as such.

Nothing here is a model's output and nothing here reproduces a published number. A reconstruction
that claimed either would be worse than no data at all, because it would be believed. What it
does claim is narrow and checkable: this file exhibits the duplicate-mask behaviour the ECCV 2024
correction documents, or it does not, and the labs need one of each to have anything to show.
"""

from __future__ import annotations

import json

from app.infer import reconstruct
from app.schema import SceneGraph
from app.settings import DATA_DIR

GT = SceneGraph.model_validate({
    "image_id": "t1",
    "dataset": "placeholder",
    "width": 100,
    "height": 100,
    "objects": [
        {"object_id": 1, "names": ["person"], "bbox": {"x": 0, "y": 0, "w": 10, "h": 10}},
        {"object_id": 2, "names": ["table"], "bbox": {"x": 20, "y": 20, "w": 10, "h": 10}},
        {"object_id": 3, "names": ["cup"], "bbox": {"x": 40, "y": 40, "w": 10, "h": 10}},
    ],
    "relationships": [
        {"relationship_id": 1, "subject_id": 1, "object_id": 2, "predicate": "on"},
        {"relationship_id": 2, "subject_id": 1, "object_id": 3, "predicate": "holding"},
        {"relationship_id": 3, "subject_id": 3, "object_id": 2, "predicate": "on"},
    ],
    "provenance": {"kind": "ground_truth", "fidelity": "measured"},
})


def build(model: str = "psgformer", **over):
    profile = {**reconstruct.PROFILES[model], **over}
    return reconstruct.reconstruct(GT, model=model, profile=profile, seed=20260918)


def test_the_output_is_a_valid_scene_graph():
    SceneGraph.model_validate(build().model_dump())


def test_it_is_reconstructed_and_says_so_in_both_the_field_and_the_note():
    g = build()
    assert g.provenance.fidelity == "reconstructed"
    assert g.provenance.kind == "model"
    note = g.provenance.note or ""
    assert "NOT" in note and "no checkpoint" in note.lower()
    assert g.provenance.model == "psgformer"


def test_it_is_deterministic_under_a_fixed_seed():
    a = reconstruct.reconstruct(GT, model="psgformer", profile=reconstruct.PROFILES["psgformer"],
                                seed=7)
    b = reconstruct.reconstruct(GT, model="psgformer", profile=reconstruct.PROFILES["psgformer"],
                                seed=7)
    assert a.model_dump() == b.model_dump()


def test_a_different_seed_gives_a_different_file():
    a = reconstruct.reconstruct(GT, model="psgformer", profile=reconstruct.PROFILES["psgformer"],
                                seed=7)
    b = reconstruct.reconstruct(GT, model="psgformer", profile=reconstruct.PROFILES["psgformer"],
                                seed=8)
    assert a.model_dump() != b.model_dump()


def test_a_duplicating_profile_emits_several_predictions_at_one_pair():
    g = build("psgformer")
    pairs = [(r.subject_id, r.object_id) for r in g.relationships]
    assert len(pairs) > len(set(pairs)), "a one-stage profile must duplicate a pair"


def test_a_non_duplicating_profile_emits_one_per_pair():
    g = build("vctree")
    pairs = [(r.subject_id, r.object_id) for r in g.relationships]
    assert len(pairs) == len(set(pairs))


def test_every_prediction_carries_a_score_and_they_descend():
    scores = [r.score for r in build().relationships]
    assert all(s is not None for s in scores)
    assert scores == sorted(scores, reverse=True)


def test_no_relationship_dangles():
    g = build()
    known = {o.object_id for o in g.objects}
    assert all(r.subject_id in known and r.object_id in known for r in g.relationships)


def test_it_recovers_some_ground_truth_and_invents_some_of_its_own():
    """A reconstruction that returned the ground truth verbatim would score 1.0 and teach
    nothing; one that returned only noise would score 0 and teach nothing either."""
    g = build()
    truth = {(r.subject_id, r.predicate, r.object_id) for r in GT.relationships}
    got = {(r.subject_id, r.predicate, r.object_id) for r in g.relationships}
    assert truth & got, "nothing recovered"
    assert got - truth, "nothing spurious"
    assert truth - got, "nothing missed"


def test_every_model_in_the_registry_that_cannot_run_has_a_profile():
    from app.infer import registry
    blocked = [m["id"] for m in registry.describe_all() if not m["live"]]
    assert set(blocked) <= set(reconstruct.PROFILES), set(blocked) - set(reconstruct.PROFILES)


def test_the_committed_files_match_what_the_script_regenerates():
    """The script is the source of truth and the files are its output. If they drift, the note in
    PROVENANCE.md that says how they were made is no longer true of them."""
    root = DATA_DIR / "predictions" / "placeholder"
    if not root.is_dir():
        import pytest
        pytest.skip("the reconstructed tier has not been written yet")
    slice_graphs = {
        g["image_id"]: SceneGraph.model_validate(g)
        for g in json.loads(
            (DATA_DIR / "slices" / "placeholder" / "annotations.json").read_text(encoding="utf-8")
        )["graphs"]
    }
    checked = 0
    for model_dir in sorted(root.iterdir()):
        for path in sorted(model_dir.glob("*.json")):
            committed = json.loads(path.read_text(encoding="utf-8"))
            rebuilt = reconstruct.reconstruct(
                slice_graphs[path.stem],
                model=model_dir.name,
                profile=reconstruct.PROFILES[model_dir.name],
                seed=reconstruct.SEED,
            ).model_dump(mode="json")
            # `generated_at` is the one field a rebuild cannot reproduce, and it is the field that
            # makes the claim about when. Everything else must be identical.
            committed.pop("provenance", {}).pop("generated_at", None)
            rebuilt["provenance"].pop("generated_at", None)
            assert committed["relationships"] == rebuilt["relationships"], path.name
            assert committed["objects"] == rebuilt["objects"], path.name
            checked += 1
    assert checked > 0
