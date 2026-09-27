"""The mini-ISG teaching set: its vocabulary, and the annotations built against it.

The set is forty frames of a STEMFIE construction-toy assembly bench, cut from IndustReal.
`data/mini-isg/README.md` states in both languages that the scenes are "industrial-like" --
IndustReal's own word -- and that there is no robot arm, no conveyor and no terminal block in
them. A vocabulary written for a factory floor would therefore ask the model for entities that
are not there, which is the failure mode §3.2 of the anchor paper calls a redundant entity, built
into the criteria instead of caught by step 2.
"""

from __future__ import annotations

import json

from app.datasets.loader import load_slice
from app.settings import DATA_DIR
from app.vlm.prompts import O_ISG, P_ISG

MANIFEST = DATA_DIR / "slices" / "mini-isg" / "MANIFEST.json"

#: Terms the README says are absent from every frame. L7's caption vocabulary uses all of them.
FACTORY_FLOOR = ("robot arm", "conveyor", "terminal", "panel", "workcell")


def test_the_vocabulary_names_nothing_the_frames_do_not_contain():
    for term in FACTORY_FLOOR:
        assert term not in O_ISG, (
            f"{term!r} is in the mini-ISG object set, and data/mini-isg/README.md states it is "
            f"in none of the frames"
        )


def test_the_predicate_dictionary_excludes_the_word_the_draft_reaches_for():
    """The paper's third correction, reproduced in this set's own vocabulary.

    `taping` is absent from the paper's P so that step 2 has something to replace. Turning a nut
    invites `tightening` and `screwing`, and neither is in P, so a draft that reaches for either
    scores zero however well it describes the frame. That is knowledge point L10 in the data
    rather than in a slide.
    """
    assert "tightening" not in P_ISG
    assert "screwing" not in P_ISG
    assert "assembling" in P_ISG, "the legal term the annotator is meant to substitute"


def test_every_annotated_predicate_is_in_the_dictionary():
    for g in load_slice("mini-isg"):
        for r in g.relationships:
            assert r.predicate in P_ISG, f"{g.image_id}: {r.predicate!r} is outside P"


def test_every_annotated_object_is_in_the_object_set():
    for g in load_slice("mini-isg"):
        for o in g.objects:
            assert o.name in O_ISG, f"{g.image_id}: {o.name!r} is outside O"


def test_every_cut_frame_is_annotated_and_every_annotation_has_a_frame():
    """A frame with no annotation is a gap in the lab; an annotation with no frame is a claim
    about an image nobody can look at."""
    cut = {row["image_id"] for row in json.loads(MANIFEST.read_text(encoding="utf-8"))["images"]}
    annotated = {g.image_id for g in load_slice("mini-isg")}
    assert annotated == cut, {"only_cut": sorted(cut - annotated),
                              "only_annotated": sorted(annotated - cut)}


def test_the_annotations_say_a_person_made_them():
    for g in load_slice("mini-isg"):
        assert g.provenance.kind == "user", g.image_id
        assert g.provenance.note, g.image_id


# ── the two generated artefacts ───────────────────────────────────────────────────────────────

AUTHORING = DATA_DIR / "mini-isg" / "authoring.json"


def _authoring() -> dict:
    return json.loads(AUTHORING.read_text(encoding="utf-8"))


def test_the_committed_artefacts_are_what_the_authoring_file_generates():
    """One source, two outputs. A draft and a reference annotation that drifted apart would make
    the lab's correction count a comparison of two unrelated things."""
    import scripts.build_mini_isg as build

    authoring = _authoring()
    assert build.dumps(build.build_transcript(authoring)) == \
        build.TRANSCRIPT.read_text(encoding="utf-8")
    assert build.dumps(build.build_annotations(authoring)) == \
        build.ANNOTATIONS.read_text(encoding="utf-8")


def test_every_frames_draft_is_reachable_through_the_pipeline():
    """The key is a hash of the prompt. Editing `step1_prompt` makes all forty unreachable, and
    that must fail here rather than at the lecture."""
    from app.vlm import indvissgg
    from app.vlm.prompts import EXAMPLES_ISG
    from app.vlm.transcript import reload

    reload()
    for image_id in sorted(_authoring()):
        body = indvissgg.run(
            image_ref=image_id, dataset="mini-isg", O=list(O_ISG), P=list(P_ISG),
            E=EXAMPLES_ISG, steps=[1],
        )
        graph = body["step1"]["graph"]
        assert graph["relationships"], image_id
        assert graph["provenance"]["fidelity"] == "reconstructed", image_id


def test_the_drafts_reach_for_a_predicate_the_dictionary_does_not_have():
    """L10 in the data. A draft that says `tightening` scores zero however well it describes the
    frame, and the correction to `assembling` is the single most instructive edit in the lab."""
    drafted = {p for f in _authoring().values() for _, p, _ in f["draft"]}
    assert drafted - set(P_ISG), "no draft is out of vocabulary; the lab has nothing to teach"
    assert "tightening" in drafted


def test_the_reference_set_has_no_out_of_vocabulary_predicate_left():
    """The drafts may be wrong. The corrected set is what wrong is measured against."""
    for f in _authoring().values():
        for _, p, _ in f["final"]:
            assert p in P_ISG, p


def test_correcting_a_draft_is_work_on_every_frame():
    """PRD §6.2: the lab exists so a student sees what annotation costs. A frame whose draft is
    already right costs nothing and teaches nothing, so no frame may be in that state."""
    for image_id, f in _authoring().items():
        draft = {(s.split("#")[0], p, o.split("#")[0]) for s, p, o in f["draft"]}
        final = {(s.split("#")[0], p, o.split("#")[0]) for s, p, o in f["final"]}
        assert final - draft, f"{image_id}: the draft is already complete"


def test_every_annotated_object_takes_part_in_a_relationship():
    """A box no relationship touches is drawn by the overlay, reachable by no metric, and there
    only because somebody gave it a box. Seven of them were."""
    for g in load_slice("mini-isg"):
        used = {r.subject_id for r in g.relationships} | {r.object_id for r in g.relationships}
        loose = [o.names[0] for o in g.objects if o.object_id not in used]
        assert not loose, f"{g.image_id}: {loose}"


def test_the_reference_set_cannot_score_one_against_itself_under_graph_constraint():
    """Four frames carry two predicates on one *object* pair, and graph constraint keeps one
    predicate per ordered object pair. Scoring the reference against itself therefore gives
    R < 1.0 on exactly those frames, isg-011, isg-013, isg-025 and isg-035, and 1.0 under `none`.

    D51 pinned thirteen, because the engine keyed the constraint on class pairs: nine of them are
    two hands on one object (seven an assembly, isg-007 a wheel, isg-033 a beam), such as
    `<hand#a, holding, assembly>` and `<hand#b, assembling, assembly>`, two object pairs that
    Tang's evaluator keeps and that the engine now keeps (D99). The four that
    remain are two relations the annotator put on one pair of objects, which graph constraint can
    express one of. Pinned in both directions: a count that rose would mean the key had drifted back
    toward class names, one that fell would mean a true relation had been deleted.
    """
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app())
    imperfect = []
    for g in load_slice("mini-isg"):
        graph = g.model_dump()
        for constraint in ("graph", "none"):
            body = client.post("/api/eval", json={
                "gt": graph, "pred": graph, "protocol": "predcls",
                "constraint": constraint, "k": [100],
            }).json()
            recall = next(m for m in body["metrics"] if m["metric"] == "R")["value"]
            if constraint == "none":
                assert recall == 1.0, f"{g.image_id} under no constraint"
            elif recall < 1.0:
                imperfect.append(g.image_id)

    assert imperfect == ["isg-011", "isg-013", "isg-025", "isg-035"], imperfect
    for image_id in imperfect:
        graph = load_slice("mini-isg")[int(image_id.split("-")[1]) - 1]
        pairs = [(r.subject_id, r.object_id) for r in graph.relationships]
        assert any(pairs.count(p) > 1 for p in pairs), image_id


def test_the_obvious_api_call_reaches_a_mini_isg_draft():
    """`POST /api/vlm/indvissgg {"image_id": "isg-001"}` and nothing else.

    The forty drafts were keyed on `step1_prompt(O_ISG, P_ISG, EXAMPLES_ISG)`, and the request
    defaults were the paper's Figure 2 wiring vocabulary, so the obvious call answered 503 and
    every draft was reachable only by a caller who already knew to send the criteria. The test
    that covered this sent them, which proved the drafts exist and not that anyone can get at
    them.
    """
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app())
    r = client.post("/api/vlm/indvissgg", json={"image_id": "isg-001", "steps": [1]})
    assert r.status_code == 200, r.json()
    graph = r.json()["step1"]["graph"]
    assert [o["names"][0] for o in graph["objects"]], graph
    assert all(o["names"][0] in O_ISG for o in graph["objects"]), graph


def test_the_figure_2_frames_keep_the_paper_s_vocabulary():
    """The criteria follow the frame, and the Figure 2 walkthrough is not a mini-ISG frame. Its
    transcripts were keyed on `O_DEFAULT`, so reaching for the bench vocabulary there would make
    every L5 exchange unreachable in exactly the way it just fixed for L8."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app())
    r = client.post("/api/vlm/indvissgg", json={"image_id": "isg-fig2-t1", "steps": [1]})
    assert r.status_code == 200, r.json()
    assert any(o["names"][0] == "wrench" for o in r.json()["step1"]["graph"]["objects"])


def test_the_readme_s_predicate_table_is_what_the_data_says():
    """The README prints the distribution twice, once per language. A count in prose is a claim,
    and an uncheckable claim in a document that exists to stop three misreadings is worse than no
    table at all. `attached to` was already wrong by one before this ran."""
    import collections
    import re

    counts = collections.Counter(
        r.predicate for g in load_slice("mini-isg") for r in g.relationships
    )
    text = (DATA_DIR / "mini-isg" / "README.md").read_text(encoding="utf-8")
    rows = re.findall(r"^\| `([a-z ]+)` \| (\d+) \|$", text, re.M)
    assert rows, "the README no longer prints a predicate table"
    # Twice: once in each language. Both must agree with the data and with each other.
    assert len(rows) == 2 * len(counts), rows
    for predicate, printed in rows:
        assert counts[predicate] == int(printed), (predicate, printed, counts[predicate])
