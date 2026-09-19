from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.datasets.licences import gates_for, read_gates
from app.datasets.loader import (
    DATASETS,
    MEDIA_TYPES,
    SELECTION_RULE,
    distribution_mode,
    image_file,
    images_present,
    load_slice,
    selection_ok,
    top_predicates,
)
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
        graphs = load_slice(path.parent.name)
        assert graphs, path
        for g in graphs:
            SceneGraph.model_validate(g.model_dump())


def test_the_selection_rule_is_enforced_not_merely_documented():
    for g in load_slice("placeholder"):
        assert selection_ok(g), f"{g.image_id} violates {SELECTION_RULE}"


def test_no_annotations_are_committed_for_an_uncleared_dataset():
    """D-08's first gate, checked against what is actually on disk."""
    for path in (DATA_DIR / "slices").glob("*/annotations.json"):
        ds = path.parent.name
        assert gates_for(ds).annotations_commit, (
            f"{ds} has committed annotations but data/LICENCES.md does not clear "
            f"annotations_commit for it"
        )


def test_every_dataset_has_a_licence_row():
    known = {"vrd", "vg150-sgb", "psg", "indoorvg", "haystack", "placeholder"}
    assert known <= set(read_gates())


def test_an_uncleared_dataset_is_reported_as_uncleared():
    """haystack states no licence anywhere, so both gates stay shut."""
    assert gates_for("haystack").annotations_commit is False
    assert gates_for("haystack").bundle_distribute is False


def test_no_corpus_root_path_leaks_into_a_committed_file():
    for path in (DATA_DIR / "slices").rglob("*.json"):
        text = path.read_text(encoding="utf-8")
        assert "_raw" not in text and "SGS_CORPUS_ROOT" not in text


def test_datasets_endpoint_surfaces_both_gates_and_presence():
    body = client.get("/api/datasets").json()
    assert body["datasets"]
    for d in body["datasets"]:
        assert {"licence_commit_cleared", "licence_bundle_cleared", "images_present"} <= set(d)


def test_placeholder_image_is_served_and_its_graph_is_ground_truth():
    g = load_slice("placeholder")[0]
    r = client.get(f"/api/datasets/placeholder/images/{g.image_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["provenance"]["kind"] == "ground_truth"
    assert body["provenance"]["fidelity"] == "measured"


def test_missing_image_returns_422_naming_the_bundle_not_500():
    r = client.get("/api/datasets/vg150-sgb/images/does-not-exist")
    assert r.status_code in (404, 422)
    err = r.json()["error"]
    assert err["code"] in ("not_found", "slice_images_missing")


def test_unknown_dataset_is_404():
    r = client.get("/api/datasets/not-a-dataset/images/x")
    assert r.status_code == 404


def test_include_image_returns_a_data_url():
    g = load_slice("placeholder")[0]
    body = client.get(
        f"/api/datasets/placeholder/images/{g.image_id}", params={"include_image": "true"}
    ).json()
    assert body["image_data_url"].startswith("data:image/png;base64,")


@pytest.mark.parametrize("ds", [d for d in DATASETS if d != "placeholder"])
def test_every_cut_slice_serves_its_images_whatever_the_extension(ds):
    """The endpoint once hard-coded `.png`, and only the placeholder slice is PNG.

    Every corpus the project has cut publishes JPEG, so `include_image` answered 422 for all of
    them while this file stayed green — the one slice under test was the one slice that worked.
    """
    graphs = load_slice(ds)
    if not graphs or not images_present(ds):
        pytest.skip(f"no slice cut for {ds} on this machine")
    g = graphs[0]
    body = client.get(
        f"/api/datasets/{ds}/images/{g.image_id}", params={"include_image": "true"}
    ).json()
    assert "error" not in body, body
    assert body["image_data_url"].startswith("data:image/")


def test_the_media_type_follows_the_file_rather_than_being_assumed():
    for ds in DATASETS:
        if not load_slice(ds) or not images_present(ds):
            continue
        g = load_slice(ds)[0]
        path = image_file(ds, g.image_id)
        assert path is not None, ds
        body = client.get(
            f"/api/datasets/{ds}/images/{g.image_id}", params={"include_image": "true"}
        ).json()
        assert body["image_data_url"].startswith(f"data:{MEDIA_TYPES[path.suffix.lower()]};")


def test_an_image_the_slice_does_not_carry_is_reported_not_guessed():
    assert image_file("placeholder", "no-such-image") is None


def test_export_import_round_trips_losslessly():
    g = load_slice("placeholder")[0]
    assert SceneGraph.model_validate(g.model_dump()) == g


def test_a_graph_from_the_slice_evaluates_against_itself_perfectly():
    """The slice and the engine must actually fit together, not merely both exist."""
    g = load_slice("placeholder")[0]
    pred = g.model_dump()
    pred["provenance"] = {"kind": "model", "fidelity": "measured", "model": "identity"}
    for i, r in enumerate(pred["relationships"]):
        r["score"] = 1.0 - i / 100
    body = client.post("/api/eval", json={
        "gt": g.model_dump(), "pred": pred, "protocol": "predcls",
        "constraint": "none", "k": [20], "iou_thresh": 0.5, "mask_pairing": "single_mpo",
    }).json()
    r_at_20 = next(m for m in body["metrics"] if m["metric"] == "R")
    assert r_at_20["value"] == 1.0


def test_the_two_licence_gates_disagree_where_the_evidence_says_they_should():
    """PSG annotations are MIT; PSG images are COCO photographs MIT does not reach.

    The whole point of splitting the gate in two is that a dataset can be open for one act and
    closed for the other. If this ever collapses to a single boolean, that distinction is gone.
    """
    psg = gates_for("psg")
    assert psg.annotations_commit is True
    assert psg.bundle_distribute is False


def test_a_dataset_with_no_licence_statement_stays_closed():
    """An absent statement is not a permissive one. VRD states nothing at all."""
    vrd = gates_for("vrd")
    assert vrd.annotations_commit is False
    assert vrd.bundle_distribute is False


def test_every_licence_row_cites_a_source_once_it_is_opened():
    for name, g in read_gates().items():
        if g.annotations_commit or g.bundle_distribute:
            assert g.licence, f"{name}: a gate is open with no licence named"
            assert g.checked, f"{name}: a gate is open with no date checked"
            if name != "placeholder":
                assert g.statement_url.startswith("http"), f"{name}: no statement URL"


def test_distribution_mode_is_recorded_not_guessed():
    """Each of the three states, against a dataset genuinely in it.

    'none' has to be asserted against something uncut, not against whichever dataset happened
    to be uncut when this was written -- vg150-sgb was cut on 2026-09-16 and the assertion went
    stale the moment it was.
    """
    assert distribution_mode("placeholder") == "bundle"      # cleared to distribute
    assert distribution_mode("vg150-sgb") == "fetch"         # cut, images not distributable
    assert distribution_mode("vrd") == "none"                # gate shut, nothing cut


def test_datasets_endpoint_reports_the_distribution_path():
    body = client.get("/api/datasets").json()
    by_id = {d["id"]: d for d in body["datasets"]}
    assert by_id["placeholder"]["distribution"] == "bundle"
    assert by_id["vg150-sgb"]["distribution"] == "fetch"
    assert by_id["vrd"]["distribution"] == "none"


def test_a_cut_slice_reports_the_distribution_its_licence_cleared():
    """`distribution_mode` reads MANIFEST.json out of the slice directory, and a manifest
    written anywhere else is a manifest the application cannot see.

    mini-ISG shipped its manifest to `data/mini-isg/` because the plan named that path, so the
    slice answered `none` although `data/LICENCES.md` had cleared it for the bundle, and
    `image_file` fell back to guessing the extension instead of reading the recorded sha256.
    Nothing failed: the guess happened to be right.
    """
    for ds in DATASETS:
        if not images_present(ds):
            continue
        assert distribution_mode(ds) != "none", (
            f"{ds} has images cut but no MANIFEST.json in data/slices/{ds}/; the application "
            f"cannot tell how students obtain them"
        )
        if gates_for(ds).bundle_distribute:
            assert distribution_mode(ds) == "bundle", ds


def test_the_tail_condition_is_not_applied_to_a_vocabulary_that_has_no_tail():
    """D-10 asks for one relationship whose predicate is outside the slice's ten most frequent.

    A slice whose whole predicate dictionary is seven words has no eleventh predicate, so the
    condition is unsatisfiable rather than unsatisfied, and `selection_ok` returning False would
    report a vocabulary that is small as a slice that is badly chosen. mini-ISG is exactly that
    case: `P_ISG` has seven entries and all forty frames were rejected.
    """
    from app.vlm.prompts import P_ISG

    graphs = list(load_slice("mini-isg"))
    if not graphs:
        pytest.skip("mini-isg is not annotated on this machine")
    assert len(P_ISG) <= 10, "this test's premise; raise the dictionary and revisit D-10"
    for g in graphs:
        assert selection_ok(g), (
            f"{g.image_id} was rejected although the tail condition cannot be met by any frame "
            f"drawn from a {len(P_ISG)}-predicate dictionary"
        )


def test_the_tail_condition_is_still_enforced_where_there_is_a_tail():
    """The guard above must be narrow. Widened to every slice it would delete D-10's rule while
    every test stayed green, because the other tests only ever assert that a well-chosen frame
    passes. So: take a real slice's frame, replace its predicates with the most frequent one,
    and require the rejection.
    """
    graphs = list(load_slice("placeholder"))
    head = sorted(top_predicates(graphs, 10))
    assert head, "premise"
    blob = graphs[0].model_dump()
    for r in blob["relationships"]:
        r["predicate"] = head[0]
    all_head = SceneGraph.model_validate(blob)
    assert not selection_ok(all_head), (
        "a frame whose every relationship is a head predicate must fail D-10 on a slice that "
        "has a tail; the vocabulary guard has been widened too far"
    )


def test_images_endpoint_lists_the_slice_in_annotation_order():
    # A standalone lab route has to pick a frame before it can ask for one. Without this the
    # frontend's only options were an id guessed from a naming convention or a committed copy
    # of every manifest in the bundle. Deviation D60.
    body = client.get("/api/datasets/placeholder/images").json()
    expected = [g.image_id for g in load_slice("placeholder")]
    assert body["dataset"] == "placeholder"
    assert [row["image_id"] for row in body["images"]] == expected
    assert body["image_count"] == len(expected)


def test_images_endpoint_reports_presence_per_frame_not_per_dataset():
    body = client.get("/api/datasets/placeholder/images").json()
    # Every placeholder frame is generated locally, so all of them are present. The field is
    # per frame because a partially unpacked bundle is the case the lab has to survive.
    assert all(row["present"] is True for row in body["images"])
    assert all(row["width"] > 0 and row["height"] > 0 for row in body["images"])


def test_images_endpoint_says_a_slice_is_empty_rather_than_404():
    # `vrd` has a licence gate shut, so no slice was ever cut. An empty list is the truth;
    # a 404 would read as "no such dataset", which is a different and wrong statement.
    r = client.get("/api/datasets/vrd/images")
    assert r.status_code == 200
    assert r.json()["images"] == []


def test_images_endpoint_404s_on_a_dataset_that_does_not_exist():
    r = client.get("/api/datasets/not-a-dataset/images")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_data_dir_follows_its_environment_variable(monkeypatch, tmp_path):
    """Check 6 needs a run with no slices fetched, and moving the author's is not an option.

    Every module reads `DATA_DIR` from `app.settings`, so one variable redirects the whole
    application at a scratch directory. Without it the offline check could only be run on a
    machine that had never fetched anything, which is a machine nobody has twice.
    """
    import importlib

    monkeypatch.setenv("SGS_DATA_DIR", str(tmp_path))
    # `SGS_CORPUS_ROOT` is set on the author's machine -- `C:\DataRaw`, per docs/INDEX §5 -- and
    # it takes precedence over the default below. Without this line the test asserts the ambient
    # environment rather than the rule, and it fails on the one machine that has the corpora.
    monkeypatch.delenv("SGS_CORPUS_ROOT", raising=False)
    import app.settings

    reloaded = importlib.reload(app.settings)
    try:
        assert reloaded.DATA_DIR == tmp_path
        # With no corpus root named, it defaults underneath, so one variable moves both.
        assert reloaded.CORPUS_ROOT == tmp_path / "_raw"
    finally:
        monkeypatch.delenv("SGS_DATA_DIR", raising=False)
        importlib.reload(app.settings)


def test_an_explicit_corpus_root_is_not_moved_by_the_data_dir(monkeypatch, tmp_path):
    """The other half of the rule, and the half check 6 relies on.

    `tools/offline_check.mjs` sets `SGS_CORPUS_ROOT` as well as `SGS_DATA_DIR`, rather than
    trusting the default above. This states why: an explicit corpus root wins, so on a machine
    that has one set, redirecting `SGS_DATA_DIR` alone would leave the real corpora in reach.
    """
    import importlib

    corpus = tmp_path / "elsewhere"
    monkeypatch.setenv("SGS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SGS_CORPUS_ROOT", str(corpus))
    import app.settings

    reloaded = importlib.reload(app.settings)
    try:
        assert reloaded.DATA_DIR == tmp_path
        assert reloaded.CORPUS_ROOT == corpus
    finally:
        monkeypatch.delenv("SGS_DATA_DIR", raising=False)
        monkeypatch.delenv("SGS_CORPUS_ROOT", raising=False)
        importlib.reload(app.settings)


def test_data_dir_defaults_to_the_tracked_data_directory():
    from app.settings import DATA_DIR, TRACK_ROOT

    assert DATA_DIR == TRACK_ROOT / "data"
