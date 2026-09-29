"""The three-step, N-expert replica, and the wall between a student's run and the paper's numbers.

The published tables are the thing most likely to be misused here, so most of these tests are
about them rather than about the pipeline: five rows in Table 3 because four hides the
superadditive jump, four rows at six cutoffs in Table 4 because N=5 loses to N=3 at two of them,
and a `published_reference` field that never merges with anything. DEVIATIONS D16.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.vlm import indvissgg, prompts

client = TestClient(create_app())
PREDICATES = list(prompts.P_DEFAULT)


def run(**kwargs):
    return indvissgg.run(**kwargs)


# ── the three steps ───────────────────────────────────────────────────────────────────────────


def test_step_one_without_criteria_differs_from_step_one_with_them():
    plain = run(O=[], P=[], E=[], steps=[1])
    with_tec = run(steps=[1])
    assert plain["step1"]["graph"] != with_tec["step1"]["graph"]
    assert plain["step1"]["prompt_shown"] != with_tec["step1"]["prompt_shown"]


def test_expert_count_produces_that_many_analyses():
    for n in (1, 2, 3, 5):
        body = run(n_experts=n, steps=[1, 2])
        assert len(body["step2"]) == n
        assert all(e["analysis_en"] and e["analysis_zh"] for e in body["step2"]), n


def test_the_prompt_is_returned_so_a_student_can_read_it():
    body = run(steps=[1, 2, 3])
    assert body["step1"]["prompt_shown"].strip()
    assert all(e["prompt_shown"].strip() for e in body["step2"])
    assert body["step3"]["prompt_shown"].strip()


def test_each_expert_gets_its_own_prompt():
    """N experts given identical prompts would be one expert sampled N times, which is not the
    experiment Table 4 measures."""
    shown = [e["prompt_shown"] for e in run(n_experts=3, steps=[1, 2])["step2"]]
    assert len(set(shown)) == 3


def test_a_replayed_graph_is_never_called_measured():
    """The transcript player replays a recording. Calling that `measured` would turn the offline
    default into a way of manufacturing evidence about a model."""
    body = run(steps=[1, 2, 3])
    graphs = [body["step1"]["graph"], body["step3"]["graph"]]
    graphs += [e["graph"] for e in body["step2"]]
    for g in graphs:
        assert g["provenance"]["kind"] == "vlm"
        assert g["provenance"]["fidelity"] == "reconstructed"
        assert g["provenance"]["note"]


def test_no_graph_claims_a_box_it_did_not_measure():
    """This method emits triplets and no geometry, so the boxes are placeholders and say so."""
    note = run(steps=[1])["step1"]["graph"]["provenance"]["note"]
    assert "placeholder" in note.lower()


def test_ablating_each_component_is_independent():
    for component in ("O", "P", "E"):
        body = run(ablate=[component], steps=[1])
        assert body["step1"]["graph"]["provenance"]["kind"] == "vlm"
    # And the three ablations are three different prompts, not one prompt three times.
    prompts_shown = {c: run(ablate=[c], steps=[1])["step1"]["prompt_shown"] for c in "OPE"}
    assert len(set(prompts_shown.values())) == 3


def test_a_predicate_outside_P_is_scored_as_a_false_positive():
    """Knowledge point L10: the error is counted twice -- a wasted rank and a miss."""
    graph = run(steps=[1])["step1"]["graph"]
    illegal = [r for r in graph["relationships"] if r["predicate"] not in PREDICATES]
    assert illegal == [], "step 1 with P supplied must not emit an out-of-vocabulary predicate"


def test_ablating_P_does_emit_one_so_the_lab_has_something_to_show():
    """The complement of the test above. Without it, that one passes on a pipeline that cannot
    emit an illegal predicate under any conditions, which would prove nothing about P."""
    graph = run(ablate=["P"], steps=[1])["step1"]["graph"]
    illegal = [r for r in graph["relationships"] if r["predicate"] not in PREDICATES]
    assert illegal, "with P withheld there is nothing to keep the predicate legal"


# ── the published tables ──────────────────────────────────────────────────────────────────────


def test_published_tables_are_returned_separately_and_labelled():
    body = run(steps=[1, 2, 3])
    assert "not this run" in body["published_reference"]["note_en"]
    assert body["published_reference"]["fidelity"] == "published"
    assert "step1" in body and "published_reference" in body
    assert "table3" not in body["step1"]


def test_table3_is_the_full_five_row_factorial():
    t3 = run(steps=[1])["published_reference"]["table3"]
    assert len(t3) == 5
    assert [row["r_at_20"] for row in t3] == [0.032, 1.787, 2.079, 20.792, 23.040]
    assert [row["components"] for row in t3] == ["", "O", "P", "O+P", "O+P+E"]


def test_table3_carries_the_superadditive_jump_the_paper_does_not_remark_on():
    by = {row["components"]: row for row in run(steps=[1])["published_reference"]["table3"]}
    assert by["O"]["r_at_20"] + by["P"]["r_at_20"] < by["O+P"]["r_at_20"] / 4


def test_table4_carries_every_cutoff_because_n5_is_not_uniformly_better():
    t4 = {row["n_experts"]: row for row in run(steps=[1])["published_reference"]["table4"]}
    assert set(t4) == {1, 2, 3, 5}
    assert t4[3]["r_at_20"] == 23.158 and t4[3]["mr_at_20"] == 16.947
    assert t4[5]["r_at_20"] > t4[3]["r_at_20"]
    assert t4[5]["mr_at_50"] < t4[3]["mr_at_50"]
    assert t4[5]["r_at_100"] < t4[3]["r_at_100"]


def test_every_published_row_names_the_table_it_was_read_from():
    ref = run(steps=[1])["published_reference"]
    for row in ref["table3"] + ref["table4"]:
        assert row["source_table"] in ("Table 3", "Table 4")
    assert ref["source"] == "indvissgg-2025"


def test_nothing_in_the_module_merges_a_run_with_the_published_numbers():
    names = [n for n in dir(indvissgg) if not n.startswith("_")]
    assert not [n for n in names if "compare" in n or "merge" in n or "vs" in n.lower()]


# ── the endpoint ──────────────────────────────────────────────────────────────────────────────


def test_the_endpoint_answers_with_the_contract_shape():
    r = client.post("/api/vlm/indvissgg", json={
        "dataset": "mini-isg", "image_id": "isg-fig2-t1",
        "O": list(prompts.O_DEFAULT), "P": PREDICATES, "E": indvissgg.EXAMPLES,
        "n_experts": 3, "steps": [1, 2, 3], "ablate": [], "provider": "transcript",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    for field in ("step1", "step2", "step3", "provider_used", "published_reference"):
        assert field in body
    assert body["provider_used"] == "transcript"
    assert len(body["step2"]) == 3


def test_an_unrecorded_configuration_is_a_stated_error_not_an_empty_graph():
    r = client.post("/api/vlm/indvissgg", json={
        "dataset": "mini-isg", "image_id": "no-such-frame",
        "O": list(prompts.O_DEFAULT), "P": PREDICATES, "E": [],
        "n_experts": 1, "steps": [1], "ablate": [], "provider": "transcript",
    })
    assert r.status_code == 503
    err = r.json()["error"]
    assert err["code"] == "vlm_unavailable"
    assert "record" in str(err["detail"]).lower()


def test_asking_for_a_live_provider_without_a_key_is_stated(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    r = client.post("/api/vlm/indvissgg", json={
        "dataset": "mini-isg", "image_id": "isg-fig2-t1",
        "O": list(prompts.O_DEFAULT), "P": PREDICATES, "E": [],
        "n_experts": 1, "steps": [1], "ablate": [], "provider": "claude",
    })
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in str(r.json()["error"]["detail"])


@pytest.mark.parametrize("n", [4, 6, 0])
def test_an_expert_count_the_paper_did_not_measure_is_refused(n):
    """Contracts §1.9 fixes n_experts to 1, 2, 3 or 5. Any other value would put a number beside
    a Table 4 row that does not exist."""
    r = client.post("/api/vlm/indvissgg", json={
        "dataset": "mini-isg", "image_id": "isg-fig2-t1",
        "O": list(prompts.O_DEFAULT), "P": PREDICATES, "E": [],
        "n_experts": n, "steps": [1], "ablate": [], "provider": "transcript",
    })
    assert r.status_code == 422


def test_criteria_for_the_m0_demo_frames_is_the_isg_triple() -> None:
    isg = (prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG)
    assert indvissgg.criteria_for("m0-demo-096") == isg
    assert indvissgg.criteria_for("m0-demo-999") != isg


# ── the expert prompt carries the criteria and asks for labelled analyses (D115) ──────────────

STEP1_ISG_LITERAL = (
    "INFORMATION\nYou are given one video frame from an industrial workcell.\n"
    "Extract every relation you can see as <subject, predicate, object> triplets.\n\n"
    "TRIPLETS EXTRACTION CRITERIA -- object categories\n- hand\n- beam\n- brace\n- block\n"
    "- wheel\n- axle\n- pin\n- nut\n- washer\n- assembly\n- instruction sheet\n- workbench\n\n"
    "TRIPLETS EXTRACTION CRITERIA -- predicate dictionary\n- holding\n- assembling\n"
    "- attached to\n- inserted into\n- on\n- near\n- reaching for\n\n"
    "TRIPLETS EXTRACTION CRITERIA -- examples\n"
    "[positive] <hand, assembling, assembly> -- The hand is working on the partly built model; "
    "`assembling` is in P.\n"
    "[negative] <hand, tightening, nut> -- `tightening` is not in P, so this triplet cannot be "
    "scored at all.\n\n"
    "OUTPUT\nOne triplet per line, in <subject, predicate, object> form."
)


def criteria_section(prompt: str) -> str:
    """From the first criteria heading to the blank line before OUTPUT."""
    start = prompt.index("TRIPLETS EXTRACTION CRITERIA -- object categories")
    return prompt[start:prompt.index("\n\nOUTPUT")]


def test_the_expert_prompt_carries_the_criteria_and_asks_for_labelled_analyses():
    prompt = prompts.step2_prompt(
        [("hand", "holding", "beam")], 2, prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG
    )
    lines = prompt.split("\n")
    for entry in (*prompts.O_ISG, *prompts.P_ISG):
        assert f"- {entry}" in lines, entry
    for ex in prompts.EXAMPLES_ISG:
        s, p, o = ex["triplet"]
        assert f"[{ex['kind']}] <{s}, {p}, {o}> -- {ex['analysis']}" in lines
    assert "DRAFT\n<hand, holding, beam>" in prompt
    assert "expert 2 of N" in prompt
    assert prompt.endswith(
        "OUTPUT\n"
        "The revised triplet set, one per line, in <subject, predicate, object> form.\n"
        "Then a line reading ANALYSIS_EN, followed by one paragraph in English explaining every "
        "change.\n"
        "Then a line reading ANALYSIS_ZH, followed by the same paragraph in Traditional Chinese."
    )


def test_step_one_is_unchanged_by_the_shared_criteria_helper():
    prompt = prompts.step1_prompt(prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG)
    assert prompt == STEP1_ISG_LITERAL


def test_the_criteria_block_is_one_text_in_both_prompts():
    one = prompts.step1_prompt(prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG)
    two = prompts.step2_prompt(
        [("hand", "holding", "beam")], 1, prompts.O_ISG, prompts.P_ISG, prompts.EXAMPLES_ISG
    )
    assert criteria_section(one) in two


class Capturing:
    """A provider that records every prompt and answers step 2 with labelled analyses."""

    name = "capturing"

    def __init__(self) -> None:
        self.prompts: list[str] = []

    def complete(self, *, prompt: str, image_ref: str | None, context: dict) -> str:
        self.prompts.append(prompt)
        if prompt.startswith("TRIPLE-CHECKING"):
            i = prompt.split("expert ")[1].split(" ")[0]
            return f"<hand, holding, beam>\nANALYSIS_EN\nen-{i}\nANALYSIS_ZH\nzh-{i}"
        return "<hand, holding, beam>"


def test_run_gives_the_experts_the_criteria_step_one_had(monkeypatch):
    fake = Capturing()
    monkeypatch.setattr(indvissgg, "get_provider", lambda name=None: fake)
    run(image_ref="isg-fig2-t1", steps=[1, 2])
    step1, *experts = fake.prompts
    assert len(experts) == 3
    section = criteria_section(step1)
    assert all(section in e for e in experts)


def test_the_labelled_analyses_reach_the_summary(monkeypatch):
    fake = Capturing()
    monkeypatch.setattr(indvissgg, "get_provider", lambda name=None: fake)
    body = run(image_ref="isg-fig2-t1", steps=[1, 2, 3])
    step3 = fake.prompts[-1]
    for i in (1, 2, 3):
        assert f"EXPERT {i} ANALYSIS\nen-{i}\n" in step3
        assert body["step2"][i - 1]["analysis_zh"] == f"zh-{i}"
