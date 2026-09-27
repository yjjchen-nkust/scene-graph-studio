# The Graph Constraint's Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Key the graph and semi constraints on the ordered object pair in both engines, as Tang's evaluator and the course define it. Pin the change with a fourteenth golden vector, state honestly what the application's `semi` is, and bring every figure and record that depended on the class-pair key into line.

**Architecture:** `Triplet` gains `subject_id` and `object_id` in `backend/app/eval/match.py` and `packages/sgg-metrics/src/match.ts`, and `apply_constraint` / `applyConstraint` key on them. The request and response are unchanged. Parity between the two engines is kept by `npm run lint:parity` over fourteen golden vectors.

**Tech Stack:** Python 3.12 (py12, pytest, pydantic, FastAPI), TypeScript (vitest), Node ≥ 22.12, MDX.

**Spec:** `docs/superpowers/specs/2026-09-27-graph-constraint-key-design.md`.

## Global Constraints

- **Branch `fix/sgs-graph-constraint-key`**, from `main` at `df93d63`. The user merges.
- **Working directory is `scene-graph-studio/system/`.** Python is `py12`, run through `node tools/py.mjs` or `npm run test:py`.
- **The two engines stay identical:** every behavioural change lands in `match.py`/`constraint.py` and `match.ts`/`constraint.ts` in the same commit, and `npm run lint:parity` agrees.
- **A golden expectation is hand-computed and written as a literal before the engine is run against it** (`build_golden.py`'s own rule). Its `why` writes out the arithmetic.
- **A figure that moves is traced to the re-keying before its test or record is changed.** Engine output is never pasted into an expectation.
- **Sources cited exactly:**
  - Tang `sgg_eval.py`, commit `fca98604916f9fb2fbeca4fbf430c5b515b42a91`, line 66;
  - STTran `lib/evaluation_recall.py`, commit `bcc72cf691015fc5a435ceb95975418b1becdeb4`, `evaluate_from_dict`, semi branch, threshold 0.9.
- **Copy:** formal written Chinese with Chinese punctuation; no em dashes in new text.
- **Working-tree files are CRLF.** Never `sed -i`. Write LaTeX or backslash-bearing text with the Write tool and splice it in with a script. `data/**/*.json` is pinned LF.
- **`npm run ci` exits 0 before every commit.** Kill any stale `vite preview` on 4173 before `test:e2e` or `check:perf`.

## Review Focus

1. **Two predicted objects with identical names and boxes but different ids** (duplicate detections). Expected: they are two object pairs, each keeping its top predicate, as Tang's indices are. *(Task 1 unit test)*
2. **`semi` with `semi_constraint_max_per_pair` of 1, or of 0.** Expected: 1 behaves as `graph` per object pair; 0 is clamped to 1, as before. *(Task 1 unit test)*
3. **The Python and TypeScript engines on the new vector.** Expected: identical R, mR, ngR and verdicts on `gv-014`. *(Task 1, `lint:parity`)*
4. **A lab whose fixture repeats a class pair on two object pairs.** Expected: its graph-constrained figure rises to what the object-pair key gives, and its test and record say why. *(Task 1 Step 7)*
5. **A prediction whose subject and object are the same object.** Expected: the pair (id, id) is a pair like any other; nothing crashes. *(Task 1 unit test)*

---

### Task 1: Both engines keyed on object pairs, and the fourteenth vector

**Files:**
- Modify: `backend/app/eval/match.py` (`Triplet`, `to_triplets`), `backend/app/eval/constraint.py`
- Modify: `packages/sgg-metrics/src/match.ts` (`Triplet`, `toTriplets`), `packages/sgg-metrics/src/constraint.ts`
- Modify: `backend/scripts/build_golden.py` (append `gv-014`); regenerate `../data/golden/vectors.json`
- Modify (test helpers that build `Triplet`):
  - `backend/tests/test_constraint.py`, `backend/tests/test_metrics.py`, `backend/tests/test_pairing.py`;
  - `frontend/src/playgrounds/test/logic.test.ts` (`asEngine`).
- Test:
  - `backend/tests/test_constraint.py`, `backend/tests/test_metrics.py`;
  - `packages/sgg-metrics/test/engine.test.ts`;
  - `backend/tests/test_mini_isg.py:145`.

**Interfaces:**
- **Produces:**
  - Python: `Triplet` has `subject_id: int` and `object_id: int`, required, placed after `relationship_id`.
  - TypeScript: the same two fields on `Triplet`, as `number`.
  - `to_triplets` / `toTriplets` fill them from `r.subject_id` / `r.object_id`.
  - `apply_constraint` / `applyConstraint` key on `(subject_id, object_id)`. The signatures are unchanged.

- [ ] **Step 1: Update the test helpers to carry ids.**
  - `test_constraint.t(...)` gains `sid: int, oid: int` as keyword arguments with defaults derived from a fixed map `{"person": 1, "table": 2, "box": 3, "a": 1, "b": 2, "c": 3, "d": 4}`, so the existing tests keep their meaning: the three person→table predictions are one object pair, and box→table is another.
  - `test_metrics.t`, `test_pairing`'s builder and `logic.test.ts`'s `asEngine` pass explicit ids: 1 and 2 unless a test needs otherwise.

- [ ] **Step 2: Write the failing unit tests.** In `test_constraint.py`:

```python
def test_graph_keeps_one_predicate_per_object_pair_not_per_class_pair():
    two_pairs = [t(0, 1, "hand", "holding", "assembly", 0.9, sid=1, oid=3),
                 t(1, 2, "hand", "assembling", "assembly", 0.8, sid=2, oid=3)]
    assert [x.relationship_id for x in apply_constraint(rank(two_pairs), "graph", 1)] == [1, 2]

def test_graph_still_keeps_one_on_a_single_object_pair():
    one_pair = [t(0, 1, "hand", "holding", "assembly", 0.9, sid=1, oid=3),
                t(1, 2, "hand", "assembling", "assembly", 0.8, sid=1, oid=3)]
    assert [x.relationship_id for x in apply_constraint(rank(one_pair), "graph", 1)] == [1]

def test_duplicate_detections_are_two_pairs():
    dup = [t(0, 1, "man", "on", "street", 0.9, sid=1, oid=9), t(1, 2, "man", "on", "street", 0.8, sid=2, oid=9)]
    assert len(apply_constraint(rank(dup), "graph", 1)) == 2

def test_semi_caps_per_object_pair():
    preds = [t(i, i + 1, "hand", p, "assembly", 0.9 - i / 10, sid=1 + i // 3, oid=9)
             for i, p in enumerate(["holding", "assembling", "near", "holding", "assembling", "near"])]
    assert [x.relationship_id for x in apply_constraint(rank(preds), "semi", 2)] == [1, 2, 4, 5]
    assert len(apply_constraint(rank(preds), "semi", 1)) == 2
    assert len(apply_constraint(rank(preds), "semi", 0)) == 2

def test_a_self_pair_is_a_pair():
    same = [t(0, 1, "arm", "near", "arm", 0.9, sid=4, oid=4), t(1, 2, "arm", "on", "arm", 0.8, sid=4, oid=4)]
    assert len(apply_constraint(rank(same), "graph", 1)) == 1
```

  In `test_metrics.py`, `test_recall_ordering_between_protocols_is_not_forced` goes through `app.eval.engine.evaluate`. It builds the ground truth (man#1, on, table#2) and (man#1, near, table#2), boxes (0,0,100,100) and (200,0,100,100) on a 400×200 image. Two predictions:
  - **the given boxes:** `on` 0.9 and `near` 0.8 on objects 1→2, giving R@50 under `graph` of 0.5;
  - **boxes of its own:** objects 1 and 2 as given, plus 3 at (2,2,100,100) `man` and 4 at (202,2,100,100) `table`; `on` 0.9 on 1→2 and `near` 0.8 on 3→4, giving R@50 of 1.0.

  In `engine.test.ts`, the same two cases through `evaluate` (the block kept at `.superpowers/sdd/review-minors-engine-test.txt`, with `mask_pairing: 'single_mpo'`), and a unit block for `applyConstraint` mirroring the first four Python tests.

- [ ] **Step 3: Append `gv-014-graph-constraint-per-object-pair` to `build_golden.py`.** The ground truth has objects 1 `hand` (0,0,10,10), 2 `hand` (40,0,10,10) and 3 `assembly` (20,20,10,10), with relationships (1, holding, 3) and (2, assembling, 3). The prediction is the same graph with scores 0.9 and 0.8. `params` is `P_GRAPH`. Expect R 1.0, mR 1.0, ngR 1.0, zR null, and verdicts match and match. The `why` reads: "Two hands, one assembly: (hand#1, holding, assembly#3) and (hand#2, assembling, assembly#3) share the class pair (hand, assembly) but are two object pairs. The graph constraint keeps one predicate per ordered object pair, as Tang's evaluator keys it on predicted object indices, so both survive and both match: R = 2/2 = 1.0. Keyed on class pairs, one would be dropped and R would be 1/2 = 0.5, which is what this vector exists to refuse." Regenerate with `node tools/py.mjs backend/scripts/build_golden.py`.

- [ ] **Step 4: Run and confirm failure.** Run `npm run test:py -- -q -k "constraint or ordering or golden" ; npx vitest run packages/sgg-metrics`. Expected: FAIL.
  - The new object-pair tests fail.
  - `gv-014` fails with R 0.5 in both engines.
  - The ordering test fails with 0.5 against 1.0.
  - The self-pair and semi-0 tests may already pass; they pin behaviour that must survive.

- [ ] **Step 5: Implement.**
  - Add the fields and fill them in both `to_triplets` implementations.
  - Key both constraint functions on `(p.subject_id, p.object_id)`.
  - The docstrings say: "The pair key is the ORDERED object pair (subject_id, object_id), as Tang's `sgg_eval.py` (fca9860, line 66) keys the graph constraint on predicted object indices and M4's E4 formula writes π(⟨s,p,o⟩) = (s,o). `semi` caps predicates per object pair; it is not Action Genome's semi constraint, which STTran (bcc72cf) evaluates as one attention predicate plus every spatial or contacting predicate above 0.9 (D99)."

- [ ] **Step 6: Update D51's pinned test.** In `test_mini_isg.py:145`, `test_the_reference_set_cannot_score_one_against_itself_under_graph_constraint`:
  - It expects 4 imperfect frames, `isg-011`, `isg-013`, `isg-025` and `isg-035`, counted from the annotations, where each carries one object pair with two predicates.
  - It asserts that each imperfect frame has a repeated `(subject_id, object_id)` pair.
  - Its docstring says that nine frames D51 counted were two hands on one assembly, two object pairs, which the object-pair key now keeps; the four that remain carry two predicates on one object pair.

- [ ] **Step 7: Run everything and trace what moves.**
  - Run `npm run test:py && npx vitest run && npm run lint:parity`.
  - Expected: PASS, with parity at 14 cases.
  - If a lab or content test fails:
    - derive the new figure by hand from that fixture under the object-pair key;
    - confirm that the fixture's prediction repeats a class pair on two object pairs;
    - then update the test and every text quoting the figure;
    - record each in the ledger.

- [ ] **Step 8: Commit.** `npm run ci`, then `git commit -m "fix(sgs): the graph and semi constraints keyed on object pairs, as the reference keys them"`.

---

### Task 2: `semi` described as what it is

**Files:**
- Modify: `frontend/src/content/m04.en.mdx`, `frontend/src/content/m04.zh-TW.mdx` (s5, the paragraph on `semi`)
- Modify: `frontend/src/content/m12.en.mdx`, `frontend/src/content/m12.zh-TW.mdx` (s2's paragraph on the third mode; s4's body and presenter note)
- Modify: `../docs/superpowers/specs/2026-09-15-scene-graph-studio-SRS.md` (the constraint lines of §4.1), `../docs/superpowers/specs/2026-09-15-scene-graph-studio-contracts.md` (the `semi_constraint_max_per_pair` comment), and the field's description in `backend/app/schema.py` and `packages/sgg-metrics/src/types.ts` if either carries one
- Test: `frontend/src/content/test/registry.test.tsx`

- [ ] **Step 1: Write the failing test.** Add `it('semi is described as the cap it is, and Action Genome\'s rule as not computed')`, reading files through the file's `source()` helper:
  - M4 and M12, both locales, contain `per ordered object pair` / `有序物件配對`, and contain `0.9`;
  - neither contains `the mode that matches the data` or `for this kind of data it is the correct one`, nor 「方為與資料相符的模式」 or 「它才是正確的設定」;
  - the SRS contains `[**Corrected 2026-09-27 (D99):**`.

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run frontend/src/content/test/registry.test.tsx`. Expected: FAIL on the first `toContain`.

- [ ] **Step 3: Replace the passages.** Write the replacement text with the Write tool and splice it in.
  - **M4 s5 en:** "The application's third mode, `semi`, sits between the two: at most $m$ predicates per ordered object pair, with $m = 2$. It is a cap, and it is not Action Genome's semi constraint, which M12 states with its source; the application approximates that rule and does not compute it."
  - **M4 s5 zh-TW:** 「本應用的第三種模式 `semi` 位於兩者之間：每一有序物件配對至多保留 $m$ 個 predicate，$m = 2$。此為一上限，並非 Action Genome 之 semi constraint（M12 載明其出處）；本應用僅以此上限近似該規則，並未實際計算之。」
  - **M12 s2 en:** keep the paragraph's first two sentences, then replace the last: "Action Genome's semi constraint, as STTran evaluates it, keeps for each object pair the top attention predicate and every spatial or contacting predicate scoring above 0.9. The application's `semi` is a cap, at most two predicates per ordered object pair, which approximates that rule without computing it."
  - **M12 s2 zh-TW:** replace its last sentence with 「Action Genome 之 semi constraint，依 STTran 之評估實作，對每一物件配對保留分數最高之 attention predicate，以及分數高於 0.9 之全部 spatial 與 contacting predicate。本應用之 `semi` 為一上限，每一有序物件配對至多保留兩個 predicate，僅近似該規則而未實際計算之。」
  - **M12 s4 body en:** its last sentence becomes "The middle setting is closer to this data than either end, and it is still a cap of two per ordered object pair, not Action Genome's rule."
  - **M12 s4 body zh-TW:** 「中間設定較兩端更接近此類資料，但仍為每一有序物件配對至多兩個之上限，而非 Action Genome 之規則。」
  - **M12 s4 note en:** its last sentence becomes "Say the key sentence in the room: the middle setting is closer to this data than either end, and it is a cap of two per ordered object pair, not Action Genome's semi constraint, which keeps one attention predicate and every spatial or contacting predicate above 0.9."
  - **M12 s4 note zh-TW:** 「關鍵句須當場說明：中間設定較兩端更接近此類資料，但其為每一有序物件配對至多兩個之上限，而非 Action Genome 之 semi constraint；後者保留一個 attention predicate，以及分數高於 0.9 之全部 spatial 與 contacting predicate。」

- [ ] **Step 4: The SRS and the contracts.**
  - In SRS §4.1, after the constraint line, add: "[**Corrected 2026-09-27 (D99):** `graph` keeps one predicate per ordered object pair, as Tang's evaluator keys it; `semi` keeps at most `semi_constraint_max_per_pair` per ordered object pair and is not Action Genome's semi constraint, which STTran implements as one attention predicate plus every spatial or contacting predicate above 0.9 and which this application does not implement.]"
  - The contracts comment becomes `// per ordered object pair; required when constraint === 'semi'; default 2`, and likewise any field description in the two engines' schemas.

- [ ] **Step 5: Run and commit.** Run `npx vitest run frontend/src/content && npm run lint:content`, then `npm run ci`. Expected: PASS. Then `git commit -m "fix(sgs): semi described as the cap it is; Action Genome's rule stated and not claimed"`.

---

### Task 3: Records, and the full gate

**Files:**
- Modify: `../DEVIATIONS.md` (D51 annotated in place; append **D99**), `../docs/VERIFICATION.md` (append **§23**), `../docs/INDEX.md`, `../README.md`, `../CLAUDE.md`

- [ ] **Step 1: Run the full gate.** Run `npm run ci`, `npm run test:e2e` and `npm run check:perf`. Record exit codes and counts, the parity count (14) and the golden count.

- [ ] **Step 2: Annotate D51 in place.** After its paragraph "**The reference set does not score 1.0 against itself under graph constraint.**", add: "[**Corrected 2026-09-27 (D99):** the thirteen came from keying the graph constraint on class pairs. Nine of them are two hands on one assembly, two object pairs, which the reference evaluator keeps and the engine now keeps; four frames, isg-011, isg-013, isg-025 and isg-035, carry two predicates on one object pair and still score below 1.0 against themselves. The claim that the engine was correct did not hold.]"

- [ ] **Step 3: Write D99.** It covers:
  - the finding and its sources;
  - the table of affected relations per slice (spec §2);
  - the two engines' change;
  - `gv-014`;
  - the ordering counterexample, now an engine test in both languages;
  - D51's four frames;
  - every figure that moved in Task 1 Step 7, with its trace;
  - the honest description of `semi`;
  - the gate figures.

- [ ] **Step 4: Write VERIFICATION §23**, "The graph constraint's key — measured, 2026-09-27". It covers:
  - the gate table;
  - the new unit tests;
  - `gv-014`'s arithmetic;
  - parity 14;
  - the mini-ISG re-measurement (4 of 40, named);
  - any moved lab figure.

- [ ] **Step 5: Update the counts** the run changed:
  - CLAUDE.md: `D1…D99`, all 99 deviations, §23 in the VERIFICATION list, and a trap line stating that the graph constraint keys on object pairs;
  - INDEX: D99, §23, "parity 13" becomes 14, the golden count, and the status and verification paragraphs;
  - README: the quoted counts.

- [ ] **Step 6: Verify and commit.** Run `npm run ci`; expected exit 0. Then `git commit -m "docs(sgs): D99 and VERIFICATION §23; D51 corrected in place; counts brought up to date"`. Then request a review of the branch against `main`; the user merges.
