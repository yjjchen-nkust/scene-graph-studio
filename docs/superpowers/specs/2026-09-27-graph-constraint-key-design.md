# The graph constraint's key (design)

The evaluation engine applies the graph constraint, and its semi variant, to the ordered pair of
**class names** of a prediction's subject and object. The field's reference evaluator, the course's
own formula and the SRS apply it to the ordered pair of **objects**. This document moves both
engines onto object pairs, states honestly what the application's `semi` mode is, and brings the
records into line.

Governed by `…-decisions.md` (D-14: the engine is written from `METRICS.md` and arXiv 2404.09616),
`…-contracts.md`, the SRS §4 and the eight NFRs. Where this document and those disagree, they win
and this one is wrong.

---

## 1. Context

Found on 2026-09-27 while checking a review finding of the M3 playground branch (D98): a
counterexample that should have produced SGDet recall 1.0 against SGCls recall 0.5 produced 0.5
for both. The cause is `apply_constraint` in `backend/app/eval/constraint.py` (line 30) and
`packages/sgg-metrics/src/constraint.ts`, whose docstrings say: "The pair key is the ORDERED
(subject, object) class pair." The key entered in plan 01's constraint task with no stated reason.

### Decisions locked with the user, 2026-09-27

| Question | Answer |
|---|---|
| Order | **The engine first**, as its own cycle; the M2/M3 review minors resume after it. |
| Graph constraint | **Keyed on the ordered object pair**, (subject_id, object_id), in both engines. |
| Semi constraint | **Re-keyed on the ordered object pair and renamed honestly.** It keeps its cap (at most N predicates per object pair, N = 2 by default). The course and the docs stop presenting it as Action Genome's semi constraint, and STTran's rule is recorded as not implemented, with its source. |
| Approach | **The triplet carries its object ids.** Rejected: keying on box geometry, which would merge two objects annotated with one box, where the reference keys on indices. |

---

## 2. What the sources say

Read on 2026-09-27.

**Tang, `Scene-Graph-Benchmark.pytorch`, `maskrcnn_benchmark/data/datasets/evaluation/vg/sgg_eval.py`,
commit `fca98604916f9fb2fbeca4fbf430c5b515b42a91`, `SGRecall.calculate_recall`, line 66:**
`pred_rels = np.column_stack((pred_rel_inds, 1+rel_scores[:,1:].argmax(1)))`. `pred_rel_inds` holds
pairs of predicted object indices; each pair keeps its one highest-scoring predicate. This is the
implementation whose configuration sets the IoU threshold (M2 design §2).

**The course's formula**, kp E4 (M4): $\pi(\langle s,p,o\rangle)=(s,o)$; graph constraint
$\iff \forall\, t\ne t'\in X_k:\ \pi(t)\ne\pi(t')$, with $s$ and $o$ the objects.

**SRS §4.5** [cited as §4.1 when this was written; corrected 2026-09-27]**:** "`graph` — at most one predicate per ordered subject-object pair."

**STTran, `lib/evaluation_recall.py`, commit `bcc72cf691015fc5a435ceb95975418b1becdeb4`,
`evaluate_from_dict`:** with `method == 'semi'`, for each pair in `pred_rel_inds` it keeps the top
attention predicate and every spatial or contacting predicate whose score exceeds `threshold`,
0.9 by default. This is Action Genome's semi constraint as the video work evaluates it: per object
pair, one attention relation and any number of confident spatial and contacting ones.

### Findings

1. **The graph constraint is keyed on class names, not objects.** Two object pairs with the same
   class names keep one predicate between them, where the reference keeps one each. The committed
   slices carry such frames:

   | Slice | Frames | Frames where one class pair spans 2+ object pairs | Annotated relations on such class pairs |
   |---|---|---|---|
   | placeholder | 6 | 0 | 0 of 36 |
   | vg150-sgb | 80 | 55 | 463 of 892 |
   | indoorvg | 20 | 12 | 88 of 212 |
   | mini-isg | 40 | 9 | 18 of 350 |
   | psg | 50 | 26 | 99 of 349 |

2. **The semi constraint has the same key, and a different rule.** It caps predicates per class
   pair at N; STTran keeps one attention predicate and every spatial or contacting predicate above
   0.9, per object pair. M4 s5 says the application's `semi` is what "M12 shows video work
   adopting", and M12 s2 calls it "the mode that matches the data". Neither holds for a cap.
3. **D51 rests on the class-pair key.** It records that the mini-ISG reference set does not score
   1.0 against itself under the graph constraint (thirteen of forty frames at 0.875 to 0.9) and
   calls this "the engine correct and the data true": the thirteen relations sit on `hand` class
   pairs held by two different hands. Keyed on objects, two hands are two pairs.
4. **The golden vectors do not see it.** Of the thirteen, three put one class pair on several
   object pairs (`gv-004`, `gv-007`, `gv-008`), and all three run with `constraint: none`, where
   the key plays no part. Nothing pins the difference.

---

## 3. The engine

**Triplet.** `Triplet` in `backend/app/eval/match.py` and `packages/sgg-metrics/src/match.ts` gains
`subject_id` and `object_id`, taken from the relationship by `to_triplets` / `toTriplets`.

**Key.** `apply_constraint` keys `graph` and `semi` on (`subject_id`, `object_id`), ordered. The
docstrings cite Tang's line 66 at `fca9860`, the E4 formula, and, for `semi`, that STTran's rule
is not what the cap computes. `none` is unchanged; mask pairing already keys on mask instances and
is unchanged.

**Request.** No field changes. `semi_constraint_max_per_pair` is documented as "per ordered object
pair" in the contracts and in both engines.

**Parity.** `npm run lint:parity` keeps both engines identical on every golden vector.

---

## 4. Tests and data

**Unit tests in both engines, written first and watched failing:** under `graph`, two object pairs
sharing one class pair each keep their top predicate; one object pair carrying two predicates keeps
one; under `semi`, the cap applies per object pair.

**The counterexample, in both engines.** Ground truths (man#1, on, table#2) and (man#1, near,
table#2). A prediction on the given boxes, `on` 0.9 and `near` 0.8 on the one pair: R@50 under
`graph` is 0.5. A prediction with two box pairs of its own, each at IoU 9,604 / 10,396 = 0.924 with
the annotation, `on` on one and `near` on the other: R@50 is 1.0. It is the record's evidence that
the recall ordering between protocols is not forced (D98).

**A fourteenth golden vector**, `gv-014-graph-constraint-per-object-pair`, built in
`backend/scripts/build_golden.py` with its expectation hand-computed and the arithmetic in `why`:
two object pairs with one class pair, one annotated triplet each, both predicted; R = 1.0 under
`graph`, where the class-pair key gave 0.5.

**Re-measurement.** The full gate, the Chromium suite and the perf check run. A lab test whose
figure moves is updated only after the new figure is traced to the re-keying and written into the
record. D51's measurement over the forty mini-ISG reference frames is re-run and the result
annotated in place.

---

## 5. Content and records

**M4 s5 and M12 s2 and s4, both locales, body and presenter notes.** The application's `semi` is
"at most m predicates per ordered object pair, m = 2". Action Genome's semi constraint is stated as
STTran implements it, with its source, and the text says that the application approximates it by
the cap and does not compute it. M12's "the mode that matches the data" becomes the cap that
approximates it.

**SRS §4.1**, the line calling `semi` "the Action Genome semi-constraint mode", is annotated in
place. **The contracts' comment** on `semi_constraint_max_per_pair` says "per ordered object pair".
kp E4 is already stated on objects and stays; the brief says only that Action Genome has a
semi-constraint mode, which is true, and stays.

**Records.** Deviation D99, D51 annotated in place, VERIFICATION §23, and CLAUDE.md, INDEX and
README updated with the run they quote.

Branch `fix/sgs-graph-constraint-key`, from `main` at `df93d63`. Before merge: `npm run ci`,
`npm run test:e2e` and `npm run check:perf`, all exit 0, then a review pass. The user merges.

---

## 6. Out of scope

* Implementing STTran's semi rule, which needs Action Genome's predicate groups in both engines.
* STTran's `no` mode, which keeps the top 100 overall scores; the engine's `none` keeps every
  predicate.
* The M2/M3 review minors, which resume on their own branch after this one.

## 7. Open items

None.
