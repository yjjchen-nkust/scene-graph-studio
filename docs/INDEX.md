# Knowledge index

The register of every planning document in this repository: what each governs, its status, and
the subsystems whose pages cite it.

**Read order:** the map, `subsystems/README.md`; then the page of the subsystem being changed;
then the decisions and contracts that page cites.

**The rule that outranks everything below:** no P0 feature may depend on `torch`, on CUDA, on the
network, or on an API key. A task that appears to violate it has been misread.

---

## 1. The documents

| Document | Governs | Status | Subsystems |
|---|---|---|---|
| `subsystems/README.md` | The map: which subsystem owns each path, the dependencies, the cross-cutting rules, NFR-1…8 and the maintenance rule; the sixteen pages S1 to S16 sit beside it | **live** | map |
| `superpowers/specs/2026-09-15-…-PRD.md` | Users, goals G1–G5, curriculum M0–M14, what we will not claim | approved | S6, S7, S11, S16 |
| `superpowers/specs/2026-09-15-…-SRS.md` | Architecture, data model, eval engine, API surface, NFR-1…8 | approved | S1, S2 |
| `superpowers/specs/2026-09-15-…-design.md` | PRD + SRS + the nine-phase plan; §7 open items, all closed | approved | S1, S14 |
| `superpowers/specs/2026-09-15-…-decisions.md` | **D-01…D-24. Binding. Read before any task.** | live | S16; S1 to S10, S14 and S15 by decision |
| `superpowers/specs/2026-09-15-…-contracts.md` | **Normative field names, types, enum spellings** | live | S2, S6, S9, S10, S12 |
| `superpowers/specs/2026-09-16-indvissgg-reading.md` | The anchor paper read as M11's source | reference | S5, S6 |
| `superpowers/specs/2026-09-19-playgrounds-design.md` | The `playground` step kind, and the three that complete M0 | **executed** | S6, S12 |
| `superpowers/specs/2026-09-19-relocation-design.md` | The move out of `course-lab` into WekaExt: the target layout, how the history travels, the dependencies the move severs and what replaces them | **executed** (D87); its location superseded by D-24 | S16 |
| `superpowers/specs/2026-09-26-playgrounds-m1-design.md` | F6, F7, X1, and what the opened sources say about VG150 | **executed** | S12 |
| `superpowers/specs/2026-09-26-split-and-distinct-design.md` | A playground split across steps as parts; triplets counted as a set | **executed** | S12 |
| `superpowers/specs/2026-09-27-playgrounds-m2-design.md` | F3, and three statements about IoU the opened sources contradict | **executed** | S12 |
| `superpowers/specs/2026-09-27-playgrounds-m3-design.md` | E1, E10, and four statements about matching and protocols the engine and sources contradict | **executed** | S12 |
| `superpowers/specs/2026-09-27-graph-constraint-key-design.md` | The graph and semi constraints keyed on object pairs, as the reference keys them | **executed** | S1 |
| `superpowers/specs/2026-09-28-playgrounds-m4-design.md` | E3, E4, E7, E13, X2, and five statements about constraints, blends and VRD's per-pair count the engine contradicts | **executed** | S12 |
| `superpowers/specs/2026-09-29-playgrounds-m5-design.md` | T1, T2, and the pair and averaging statements the corpus and M5's derivation contradict | **executed** | S12 |
| `superpowers/specs/2026-09-29-m0-demos-design.md` | The `demo` step kind, D-T and D-V over recorded artefacts, the clip and ten frames, and what a demo may compute | **executed** | S5, S13 |
| `superpowers/specs/2026-10-08-subsystem-index-design.md` | The subsystem index: the map, the sixteen pages, the coverage test, and the changes to this index and `CLAUDE.md` | **executed** | S14 |
| `superpowers/plans/…-00-master.md` | Index, dependency graph, global constraints | live | S14 |
| `superpowers/plans/…-01-skeleton-and-eval-engine.md` | Phases 1–2 | **executed** | S1, S2, S3, S16 |
| `superpowers/plans/…-02-graph-labs-and-content.md` | Phases 3–4: graph, L1, L2, harvest, corpus | **executed** | S6, S7, S8, S9, S11 |
| `superpowers/plans/…-03-models-and-vlm.md` | Phases 5–6: registry, RelTR, L4, L6, L5 | **executed**; the measured prediction tier is blocked on licences, see PROVENANCE.md | S4, S5, S11 |
| `superpowers/plans/…-04-labs-shells-hardening.md` | Phases 7–9: L3, L7, L8, shells, hardening | **executed** | S3, S10, S11, S14 |
| `superpowers/plans/2026-09-19-playgrounds-m0.md` | The `playground` step kind, F1, F2, F8, the golden file, the lint rules | **executed** | S12 |
| `superpowers/plans/2026-09-19-relocation.md` | The move by `git subtree`, the history carried, the two severed dependencies restored, the decisions marked superseded, a new `CLAUDE.md` and a Gitea workflow | **executed** (D87); its location superseded by D-24 | S16 |
| `superpowers/plans/2026-09-26-playgrounds-m1.md` | X1's cited figures, rules 9 and 12, the corrections, F6, F7, X1 | **executed** | S12 |
| `superpowers/plans/2026-09-27-playgrounds-m2.md` | The IoU corrections, F3's arithmetic and golden cases, the component, M2 s3 and s4 | **executed** | S12 |
| `superpowers/plans/2026-09-27-playgrounds-m3.md` | M3's corrections, `PhotoMarks`, E1 and E10, their golden cases, M3 s3 to s7 | **executed** | S12 |
| `superpowers/plans/2026-09-27-graph-constraint-key.md` | Both engines re-keyed, gv-014, `semi` described, D51 corrected | **executed** | S1 |
| `superpowers/plans/2026-09-28-playgrounds-m4.md` | M4's corrections, the ranked list and its arithmetic, E3, E4, E7, E13 and X2, their golden cases, M4 s3 to s16 | **executed** | S12 |
| `superpowers/plans/2026-09-29-playgrounds-m5.md` | M5's corrections, the slice ordered and the six beliefs, T1 and T2, their golden cases, M5 s3, s5 and s6 | **executed** | S12 |
| `superpowers/plans/2026-10-02-devdata-migration.md` | remotex devdata's wave 2 for this track: the NAS folder moved, the writers' guard, the CI fixture, lint to zero, the CI link | **executed**; steps 5 and 6 of the spec's §10.1 wait for a second machine | S15 |
| `superpowers/plans/2026-09-29-m0-demos.md` | The live VLM provider's frame, the clip, D-T and D-V recorded and derived, the demo components, the lint rules, M0 s7 to s15, the Chromium checks | **executed** | S5, S13 |
| `superpowers/plans/2026-10-08-subsystem-index.md` | The coverage test, D-24 and D126 to D129, the map and the sixteen pages, `HISTORY.md`, this index and `CLAUDE.md` | **executed** | S14 |
| `PLAYBOOK.md` | How this was built, as reusable prompts for the next project | reference | map |
| `HISTORY.md` | This index's former §5, the changelog to 2026-10-02, moved verbatim | reference | map |
| `DEPLOY-GITHUB.md` | The hosted course: GitHub Pages, the Render backend, the one-time setup and what to expect | live | S16 |
| `../DEVIATIONS.md` | **D1…D130. Every departure from plan, with its reason.** | live | S1 to S16 |
| `VERIFICATION.md` | **The nine checks of design §6, plus NFR-8 (§10), the pins (§11), the interpreter (§12), the CUDA build (§13), the runner (§14), the playgrounds (§15), the lint suite by mutation (§16), the M1 playgrounds (§17), the M1 minors (§18), the review of the day's merges (§19), the split playgrounds (§20), the M2 playground (§21), the M3 playgrounds (§22), the graph constraint's key (§23), the review minors (§24), the deferred minors (§25), the open checks (§26), the review of the open checks (§27), the empty training split (§28), the M4 playgrounds (§29), the M5 playgrounds (§30), the M0 demos (§31), the findings D120 left open (§32), the dev server and F2's edges (§33), D-V recorded again (§34), the devdata migration (§35) and the subsystem index (§36)** | live | S1 to S16 |
| `../data/LICENCES.md` | The two licence gates, per dataset | live | S3 |
| `../system/web/knowledge-map/FROZEN.md` | The freeze, its release by D-23, and every correction made under it | live | S8 |

`brief.standalone.html` in this directory is a build output, not a source. Edit
`../system/web/brief/index.html`; `npm run build:standalone` regenerates it and CI fails if it
drifts.

---

## 2. Decisions — D-01 … D-24

| | | |
|---|---|---|
| **D-01** | Repository lives at `AI-LLM/scene-graph-studio/` | **superseded 2026-09-19 by D-22** |
| **D-02** | Two machines; the ship target is the weaker | TEACH is ARM64, no CUDA |
| **D-03** | Node ≥ 22.12 is a hard prerequisite | **closed: 24.19.0 on both machines** |
| **D-04** | Dependency versions pinned at measured values | see master plan |
| **D-05** | Cache-first rule stands, rationale corrected | `maskrcnn-benchmark` is the real blocker |
| **D-06** | Live inference tier list; timeboxed detectron2 spike | RelTR only |
| **D-07** | Prediction provenance has three tiers | `measured` / `reconstructed` / `published` |
| **D-08** | **Author downloads corpora; class gets a cut bundle** | no script downloads a dataset |
| **D-09** | `vg150-sgb` is the split; bare `vg150` is forbidden | several releases share the short name; annotated 2026-09-26 (D93) |
| **D-10** | Slice composition: 200 images, allocated per dataset | plus the selection rule |
| **D-11** | Eval engine is pure-Python stdlib | no numpy, no pycocotools |
| **D-12** | COCO RLE decoded in-house, both languages | |
| **D-13** | The knowledge-map is harvested, then frozen | **freeze released 2026-09-27 by D-23**; the harvest stands |
| **D-14** | `pg.js evaluate()` is a teaching toy, never the engine | both sides would be wrong together |
| **D-15** | CI is one local command, mirrored by a workflow | `npm run ci` |
| **D-16** | Golden vectors are one JSON both engines read | neither embeds a copy |
| **D-17** | Live VLM provider is Claude, opt-in via `.env` | offline player is the default |
| **D-18** | Mini-ISG licence gate precedes any frame commit | |
| **D-19** | Effort estimates and the cut order | 44 days, four plans |
| **D-20** | The track is documented in the repo `CLAUDE.md` | **superseded 2026-09-19 by D-22** |
| **D-21** | Paper corpus is two tiers; only scored methods carry numbers | 35 cards decided; 60 built, reason never recorded, closed at 60 (D92); no unverified tier |
| **D-22** | Repository lives at `scene-graph-studio/` inside WekaExt | **superseded 2026-10-08 by D-24**; it had superseded D-01 and D-20 |
| **D-23** | The knowledge-map freeze is released | the page may be extended; still the harvest source, still no build step; D-14 stands |
| **D-24** | The repository stands alone, and the course is hosted | frontend on GitHub Pages, backend on Render serving `fixtures/data` without `torch`; supersedes D-22 |

---

## 3. Non-functional requirements — NFR-1 … 8

Moved to the map's Non-functional requirements, with the subsystem that enforces each.

---

## 4. Where each thing is defined

Superseded by the map's Path ownership table and each page's §2 and §4.

---

## 5. State, 2026-09-26

Moved verbatim to `HISTORY.md`.

---

## 6. Traps this project has already fallen into

Each trap is on the page of the subsystem it belongs to, in §6; the cross-cutting ones are on the map.
