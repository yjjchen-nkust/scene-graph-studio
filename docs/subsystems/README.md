# Subsystem map

The map routes a change to the page that owns it. Sixteen pages, S1 to S16, each state the current rules of one subsystem and cite the records behind them.

## How to use it

Find the file you are changing in the ownership table below. Open the page of the subsystem it names. Update that page's current rules in the same commit as the change.

## Path ownership

A path belongs to the subsystem of the longest prefix that matches it. Exempt from ownership: `docs/`, `CLAUDE.md`, `README.md`, `DEVIATIONS.md`.

| Prefix | Id |
|---|---|
| `system/backend/app/eval/` | S1 |
| `system/packages/sgg-metrics/` | S1 |
| `system/backend/scripts/build_golden.py` | S1 |
| `system/backend/scripts/run_golden.py` | S1 |
| `system/tools/parity.mjs` | S1 |
| `system/backend/tests/test_constraint.py` | S1 |
| `system/backend/tests/test_golden.py` | S1 |
| `system/backend/tests/test_iou.py` | S1 |
| `system/backend/tests/test_match.py` | S1 |
| `system/backend/tests/test_metrics.py` | S1 |
| `system/backend/tests/test_pairing.py` | S1 |
| `system/backend/tests/test_rle.py` | S1 |
| `system/backend/app/__init__.py` | S2 |
| `system/backend/app/main.py` | S2 |
| `system/backend/app/api/` | S2 |
| `system/backend/app/schema.py` | S2 |
| `system/backend/app/errors.py` | S2 |
| `system/backend/app/settings.py` | S2 |
| `system/backend/tests/test_eval_api.py` | S2 |
| `system/backend/tests/test_health.py` | S2 |
| `system/backend/tests/test_schema.py` | S2 |
| `system/backend/tests/test_cors.py` | S2 |
| `system/backend/app/datasets/` | S3 |
| `system/backend/scripts/cut_slice.py` | S3 |
| `system/backend/scripts/bundle_slices.py` | S3 |
| `system/backend/scripts/verify_bundle.py` | S3 |
| `system/backend/scripts/make_placeholders.py` | S3 |
| `system/backend/scripts/cut_mini_isg.py` | S3 |
| `system/backend/scripts/build_mini_isg.py` | S3 |
| `system/backend/scripts/fetch_images.py` | S3 |
| `system/backend/scripts/make_adapter_fixture.py` | S3 |
| `system/backend/scripts/make_psg_fixture.py` | S3 |
| `system/backend/tests/fixtures/` | S3 |
| `system/backend/tests/test_adapters.py` | S3 |
| `system/backend/tests/test_psg_adapter.py` | S3 |
| `system/backend/tests/test_slices.py` | S3 |
| `system/backend/tests/test_mini_isg.py` | S3 |
| `system/backend/app/infer/` | S4 |
| `system/backend/scripts/reconstruct_predictions.py` | S4 |
| `system/backend/requirements-infer.txt` | S4 |
| `system/backend/tests/test_reconstruct.py` | S4 |
| `system/backend/tests/test_registry.py` | S4 |
| `system/backend/tests/test_reltr.py` | S4 |
| `system/backend/app/vlm/` | S5 |
| `system/backend/scripts/rekey_step2_transcripts.py` | S5 |
| `system/backend/tests/test_indvissgg.py` | S5 |
| `system/backend/tests/test_openai_compat.py` | S5 |
| `system/backend/tests/test_vlm_provider.py` | S5 |
| `system/frontend/src/content/` | S6 |
| `system/mdx.plugin.ts` | S6 |
| `system/tools/harvest.mjs` | S6 |
| `system/tools/kp_latex.mjs` | S6 |
| `system/tools/gen_modules.py` | S6 |
| `system/tools/content_lint.mjs` | S6 |
| `system/tools/test/harvest.test.mjs` | S6 |
| `system/tools/test/kp_latex.test.mjs` | S6 |
| `system/tools/test/content_lint.test.mjs` | S6 |
| `system/frontend/src/pages/` | S7 |
| `system/tools/gen_papers.py` | S7 |
| `system/tools/test/papers.test.mjs` | S7 |
| `system/tools/test/leaderboards.test.mjs` | S7 |
| `system/web/` | S8 |
| `system/tools/audit.js` | S8 |
| `system/tools/check.js` | S8 |
| `system/tools/build_standalone.mjs` | S8 |
| `system/tools/test/standalone.check.mjs` | S8 |
| `system/frontend/src/graph/` | S9 |
| `system/frontend/src/components/` | S9 |
| `system/frontend/` | S10 |
| `system/frontend/src/pages/Home.tsx` | S10 |
| `system/frontend/src/pages/Status.tsx` | S10 |
| `system/tools/i18n_parity.mjs` | S10 |
| `system/tools/test/i18n_parity.test.mjs` | S10 |
| `system/frontend/src/labs/` | S11 |
| `system/frontend/src/playgrounds/` | S12 |
| `system/frontend/src/demos/` | S13 |
| `system/backend/scripts/cut_demo_m0.py` | S13 |
| `system/backend/scripts/build_demo_m0.py` | S13 |
| `system/backend/scripts/record_demo_indvissgg.py` | S13 |
| `system/backend/scripts/record_demo_traditional.py` | S13 |
| `system/backend/tests/test_demo_indvissgg.py` | S13 |
| `system/backend/tests/test_demo_m0.py` | S13 |
| `system/backend/tests/test_demo_traditional.py` | S13 |
| `system/package.json` | S14 |
| `system/package-lock.json` | S14 |
| `system/.gitignore` | S14 |
| `system/vitest.config.ts` | S14 |
| `system/playwright.config.ts` | S14 |
| `system/e2e/` | S14 |
| `system/tools/package.json` | S14 |
| `system/tools/perf_check.mjs` | S14 |
| `system/tools/offline_check.mjs` | S14 |
| `system/tools/servers.mjs` | S14 |
| `system/tools/py.mjs` | S14 |
| `system/tools/Resolve-Python.ps1` | S14 |
| `system/tools/docs_index.mjs` | S14 |
| `system/tools/test/py.test.mjs` | S14 |
| `system/tools/test/servers.test.mjs` | S14 |
| `system/tools/test/docs_index.test.mjs` | S14 |
| `system/backend/scripts/check_pins.py` | S14 |
| `system/backend/tests/__init__.py` | S14 |
| `system/backend/tests/test_pins.py` | S14 |
| `system/backend/pyproject.toml` | S14 |
| `system/backend/requirements.txt` | S14 |
| `.gitattributes` | S14 |
| `data.toml` | S15 |
| `data.drive.json` | S15 |
| `fetch-data.ps1` | S15 |
| `fixtures/` | S15 |
| `.gitignore` | S15 |
| `system/data.dir.ts` | S15 |
| `system/fs.plugin.ts` | S15 |
| `system/tools/data_dir.mjs` | S15 |
| `system/tools/fixture.mjs` | S15 |
| `system/tools/Connect-DataDirectory.ps1` | S15 |
| `system/backend/scripts/data_bundles.py` | S15 |
| `system/backend/requirements-data.txt` | S15 |
| `system/backend/tests/test_data_bundles.py` | S15 |
| `system/backend/tests/test_data_dir_guard.py` | S15 |
| `system/tools/test/connect_data.test.mjs` | S15 |
| `system/tools/test/data_dir.test.mjs` | S15 |
| `system/tools/test/fixture.test.mjs` | S15 |
| `system/tools/test/fs_plugin.test.mjs` | S15 |
| `system/tools/test/dev_server.test.mjs` | S15 |
| `start.ps1` | S16 |
| `deploy.ps1` | S16 |
| `render.yaml` | S16 |
| `.github/` | S16 |
| `.claude/` | S16 |
| `system/tools/start.mjs` | S16 |

## Dependencies

DRAFT

## Cross-cutting rules

**The P0 rule.** No P0 feature may depend on `torch`, on CUDA, on the network or on an API key. A task that appears to violate it has been misread, and D-05 is the record to check before writing the code. The rule outranks every other statement in the track's index, and the master plan lists it first among the rules every plan obeys. [D-05] [`2026-09-15-00-master.md`] [`docs/INDEX.md`]

**Two numbering schemes.** Binding decisions are numbered D-01 and upward, in the decisions document. Deviations from plan are numbered D1 and upward, in `DEVIATIONS.md`. The two collide in print, and D-22 and D22 are different records about different things. A reference must therefore keep the hyphen for a decision and omit it for a deviation. [D-22] [D22] [`DEVIATIONS.md`]

**One shared `data/`.** `data/` is a link to the NAS copy, so a branch that changes it changes it for every branch and every checkout at once. Until such a branch merges, `main` fails its gate against the NAS, and running `main`'s harvest or gate in between writes the old content back. D111 records this for M5's playgrounds, D115 for the rekey of the Figure 2 transcripts, and D124 for D-V's recording again. [D111] [D115] [D124]

**Deleting `data/`.** The NAS copy is the only copy. Measured on a scratch junction, `rm -rf data/` in Git Bash, with the trailing slash, deletes the files on the NAS through the link, whereas `rm -rf data`, `git clean -fdX` and PowerShell `Remove-Item -Recurse` remove the link alone. [D110]

**LF pins.** Generated files are pinned to LF in `.gitattributes`, because `core.autocrlf=true` checks a file out as CRLF while every generator writes LF. The mismatch either fails a byte-equality step or, silently, leaves `git status` dirty after a green gate with `git diff` showing nothing. A generator that writes into a tracked path needs its path pinned there as well, and the Python generators write LF with `newline=""`. [D89] [D91]

## Non-functional requirements

| Id | Requirement | Enforced by | Subsystem |
|---|---|---|---|
| NFR-1 | Offline-complete; every P0 feature works with the network down and `torch` absent | the placeholder slice, in `data/`, which comes from the NAS (D109) | S3, S15 |
| NFR-2 | Honest numbers: every figure carries a source and a `verified` flag | `content_lint.mjs` | S6, S9 |
| NFR-3 | Two implementations, one truth | `parity.mjs`, 21 golden vectors | S1 |
| NFR-4 | Determinism, including tie-break order | `sorted(key=(-score, relationship_id))` | S1 |
| NFR-5 | Projector-legible; colour-blind-safe diff | lecture shell | S9, S10 |
| NFR-6 | Bilingual parity; no fallback locale | `i18n_parity.mjs` | S10 |
| NFR-7 | Licence hygiene | `data/LICENCES.md`, two gates | S3 |
| NFR-8 | Cold start < 10 s; labs < 100 ms | `npm run check:perf`, measured, VERIFICATION §10 | S14 |

## Citation forms

| Kind | Form | Example |
|---|---|---|
| Binding decision | `D-` and two digits | `D-22` |
| Deviation | `D` and digits, with no hyphen | `D99` |
| Verification section | the word and the sign | `VERIFICATION §23` |
| Contracts, SRS, design, PRD section | document name and sign | `contracts §1.5`, `SRS §4.3` |
| Spec or plan | the file name in backticks | `2026-09-27-graph-constraint-key-design.md` |
| Path | repository-root-relative, in backticks | `system/backend/app/eval/` |
| Knowledge point | `kp:` prefix | `kp:D1`, so it is never read as deviation D1 |

## Maintenance rule

A change to subsystem X updates X's current rules in the same commit. A new deviation or verification section fails `npm run ci` until a page cites it.
