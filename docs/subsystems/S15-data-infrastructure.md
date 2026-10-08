# S15 Data infrastructure

## 1. Purpose and boundary

S15 decides where `data/` is and how a machine comes to have it: the devdata link to the NAS and the scripts that make it, the guard that stops a writer when the link is absent, the CI fixture `fixtures/data`, the Google Drive bundles, and the two Vite pieces that let the test run and the dev server read through the link. It does not own what `data/` holds, which belongs to the subsystems that write each part (the golden vectors S1's, the slices and licence findings S3's, the content S6's, the demos S13's), and it does not decide what may leave the machine, which `data/LICENCES.md` decides (S3).

## 2. Code and data

| Path | Role |
|---|---|
| `data.toml` | devdata entry that names the data link |
| `data.drive.json` | Google Drive bundle ids and checksums |
| `fetch-data.ps1` | Reports and obtains slice data |
| `fixtures/` | The CI fixture, fixtures/data |
| `.gitignore` | Ignore rules of the repository root, including /data/ |
| `system/data.dir.ts` | Real path of data/ for the filesystem guard |
| `system/fs.plugin.ts` | Dev server plugin serving data/ across drives |
| `system/tools/data_dir.mjs` | Locates data/ and stops when it is absent |
| `system/tools/fixture.mjs` | Lists and refreshes the CI fixture against data/ |
| `system/tools/Connect-DataDirectory.ps1` | Makes data/ a link to the data directory |
| `system/backend/scripts/data_bundles.py` | Packs and fetches data/ through Google Drive |
| `system/backend/requirements-data.txt` | Requirements of the Drive fetch |
| `system/backend/tests/test_data_bundles.py` | Tests of the Drive bundles |
| `system/backend/tests/test_data_dir_guard.py` | Tests of the stop of every writer when the link is absent |
| `system/tools/test/connect_data.test.mjs` | Tests of the link script |
| `system/tools/test/data_dir.test.mjs` | Tests of the data directory lookup |
| `system/tools/test/fixture.test.mjs` | Tests that the fixture equals its NAS copy |
| `system/tools/test/fs_plugin.test.mjs` | Tests of the dev server plugin |
| `system/tools/test/dev_server.test.mjs` | Tests of the dev server |
| `data/` | Link to the NAS copy of all data (NAS) |

## 3. Interfaces

**Provides:**

- The `data/` link itself, through which every reader of the project's data reaches it, under the path each reader already names.
- `DATA_DIR` and `requireDataDir` in `system/tools/data_dir.mjs`, imported by S6 (`system/tools/harvest.mjs`).
- `dataDirectory()` in `system/data.dir.ts`, imported by S14 (`system/vitest.config.ts`) and S10 (`system/frontend/vite.config.ts`), and `crossDriveFs` in `system/fs.plugin.ts`, imported by S10 (`system/frontend/vite.config.ts`).
- `Connect-DataDirectory` and `Get-DataTarget` in `system/tools/Connect-DataDirectory.ps1`, dot-sourced by S16 (`start.ps1`) and by `fetch-data.ps1`.
- `fixtures/data`, which S16's workflow links in place of `data/` and S16's `render.yaml` names as the backend's data directory.
- The commands behind `npm run fixture:refresh`, `npm run data:fetch` and `npm run data:pack`, which S14's `system/package.json` declares.

**Consumes:**

- S2 (`system/backend/scripts/data_bundles.py` imports `DATA_DIR` and `TRACK_ROOT` from `app.settings`; `system/backend/tests/test_data_dir_guard.py` imports `app.settings` and exercises its `require_data_dir`).
- S3 (`system/backend/scripts/data_bundles.py` imports `gates_for` from `app.datasets.licences` and `system/backend/tests/test_data_bundles.py` its `Gates`; `fetch-data.ps1` runs `system/backend/scripts/fetch_images.py` and `system/backend/scripts/verify_bundle.py`; `system/backend/tests/test_data_dir_guard.py` runs `system/backend/scripts/make_placeholders.py`).
- S1, S3, S4, S5 and S13 (`system/backend/tests/test_data_dir_guard.py` reads the source of the thirteen writers under `system/backend/scripts/`, each owned by one of the five).
- S6 (`system/tools/test/data_dir.test.mjs` runs `system/tools/harvest.mjs` without `data/`).
- S10 (`system/tools/test/dev_server.test.mjs` starts the dev server from `system/frontend/vite.config.ts`).
- S14 (`fetch-data.ps1` dot-sources `system/tools/Resolve-Python.ps1`).

## 4. Current rules

1. `data/` is a link, and no data file lives in the checkout but the CI fixture: every reader keeps its `data/` path and reaches the one copy through the link. `SGS_DATA_DIR` names another directory to the backend's `DATA_DIR` and to `system/tools/data_dir.mjs` alike. [D110] [D125] [`system/backend/app/settings.py`] [`system/tools/data_dir.mjs`]
2. `data.toml` declares one dataset entry: `path = "data"`, `source = "raw:WekaExt/scene-graph-studio"` and `fixture = "fixtures/data"`. On the author's machines `data/` is a directory junction to that NAS folder, which `devdata pull` makes from the source and the machine's roots file. [D110] [D125] [`data.toml`]
3. `system/tools/Connect-DataDirectory.ps1` makes the same link on a machine without remotex: to `SGS_DATA_DIR` when it is set, otherwise to the source under the root that devdata's roots file names (`DEVDATA_ROOTS_FILE`, else `~/.config/devdata/roots.toml`), as a junction, or as a symbolic link for a `\\server\share` target. `start.ps1` calls it before any install, and `fetch-data.ps1` before any read. [D110] [D125] [`system/tools/Connect-DataDirectory.ps1`] [`start.ps1`] [`fetch-data.ps1`]
4. The script creates and never deletes or moves: a real `data/` directory, a link to another target, an unreachable target and an unconfigured location each return a sentence instead of a link. [D110] [`system/tools/Connect-DataDirectory.ps1`]
5. On the CI runner, and in the build of the Pages site, `data/` is a symbolic link to `fixtures/data`, made by `ln -s fixtures/data ../data` from `system/`. D126 replaced D125's `devdata pull --ci` with it, and the workflow installs no remotex and reads no `REMOTEX_READ_TOKEN`. [D126] [D127] [`.github/workflows/ci-cd.yml`]
6. The hosted backend reads `fixtures/data` with no link: `render.yaml` sets `SGS_DATA_DIR` to `../../fixtures/data`, relative to `system/backend`. [D127] [`render.yaml`]
7. A writer stops when the link is absent: each of the thirteen backend scripts that write under `DATA_DIR` calls `app.settings.require_data_dir()` before anything else, and the harvest calls `requireDataDir` from `system/tools/data_dir.mjs`. Both stop with a message naming `devdata pull` and create nothing, since a real directory where the link belongs is what devdata reports as `occupied`, and what a writer put there would reach no NAS. [D125] [`system/backend/app/settings.py`] [`system/tools/data_dir.mjs`]
8. `system/backend/tests/test_data_dir_guard.py` lists the thirteen writers, requires each to call the guard, and refuses any script that names `DATA_DIR` and writes a file without being a listed writer or exempt. [D125] [D128] [`system/backend/tests/test_data_dir_guard.py`]
9. The one exempt writer is `system/backend/scripts/data_bundles.py`, D128's exception to D125's rule: its `fetch` creates `data/` as a real directory where it is absent, and refuses when `data/` is a symbolic link or a junction, so where the link exists it writes nothing. [D128] [`system/backend/scripts/data_bundles.py`] [`system/backend/tests/test_data_dir_guard.py`]
10. `system/tools/start.mjs` refuses to start when `data/LICENCES.md` does not resolve, and names `devdata pull` and `start.ps1` as the remedy. [D110] [D125] [`system/tools/start.mjs`]
11. Git carries no data but the fixture: `.gitignore` ignores `/data/`, anchored to the root, and devdata's managed block adds `/data` and `/.devdata/`. [D109] [D123] [`.gitignore`]
12. `fixtures/data` is the CI fixture and the only project data git tracks: 127 files, 6.3 MB, what `npm run ci` reads, without the corpora, the two papers, the earlier recordings or the images of `vg150-sgb`, `psg` and `indoorvg`. Every file clears its row of `data/LICENCES.md`. [D125] [`data.toml`]
13. `system/tools/test/fixture.test.mjs` refuses a fixture file under `_raw/`, an image of those three slices, a `pre-D1nn` recording or a PDF, and requires each fixture file to equal its copy in `data/` byte for byte; it skips that comparison where `data/` resolves to the fixture itself, as on the runner. [D125] [`system/tools/test/fixture.test.mjs`]
14. `npm run fixture:refresh` copies the version in `data/` over each fixture file that differs, and never adds a file; a file the gate comes to need is copied in by hand. [D125] [`system/tools/fixture.mjs`]
15. `.gitattributes` unsets `text` under `fixtures/data`, since its bytes are compared and hashed. [D125] [`.gitattributes`]
16. Google Drive is a second route to `data/`: `npm run data:fetch` and `npm run data:pack` run `system/backend/scripts/data_bundles.py`, and `data.drive.json` names the Drive folder and each bundle's file id, size and SHA-256. CI does not use it. [D128] [`data.drive.json`] [`system/package.json`]
17. There are two bundles: `core`, the archive `scene-graph-studio-core.zip`, 135 files and 4898723 bytes, extracted into `data/`; and `industreal`, the file `all_rgb_videos.zip`, 4960644152 bytes, placed at `data/_raw/industreal/all_rgb_videos.zip`. [D128] [`data.drive.json`]
18. `fetch` needs `gdown==6.4.1` from `system/backend/requirements-data.txt`, which the labs and the test suite do not need. It rejects a bundle whose SHA-256 differs from the manifest with nothing placed, extracts an archive only after no member is found to resolve outside `data/`, and stops at a bundle with no `file_id`. [D128] [`system/backend/scripts/data_bundles.py`] [`system/backend/requirements-data.txt`]
19. `pack` builds the core archive from everything under `data/` except `_raw/`, every `.pdf`, and the images under the slice of each dataset whose `bundle_distribute` in `data/LICENCES.md` is not YES, and records the checksums in `data.drive.json`; the upload and the file ids are the maintainer's, by hand. [D128] [`system/backend/scripts/data_bundles.py`]
20. Vite's filesystem guard checks real paths, so `system/data.dir.ts` returns the link's real path, or the link's own path when it does not resolve, and `system/vitest.config.ts` and `system/frontend/vite.config.ts` add it to `server.fs.allow`. [D110] [D123] [`system/data.dir.ts`]
21. `crossDriveFs` in `system/fs.plugin.ts` is a development-only middleware, registered on Windows ahead of Vite's own, that serves a `/@fs/` file on another drive than the dev server's, inside the allow list and requested with no query, honouring byte ranges; every other request goes on to Vite. [D123] [`system/fs.plugin.ts`]
22. `fetch-data.ps1` downloads no corpus. It reports each dataset's state, fetches a cut slice's images from the source through `system/backend/scripts/fetch_images.py`, verifies unpacked images, and unpacks a slice bundle; the corpora are the author's, under `SGS_CORPUS_ROOT`, `data/_raw` by default. [D-08] [`fetch-data.ps1`]
23. The convention since D125 is that a tracked file names a data location by the entry path, by the root's name, as `raw:WekaExt/scene-graph-studio`, or by `SGS_CORPUS_ROOT`; after D125's rewrite, `devdata lint` reported zero findings on 2026-10-02. [D125] [VERIFICATION §35]

## 5. Verification

**Records:** VERIFICATION §33, VERIFICATION §35.

**`npm run ci` steps:** the gate's readers of `data/` are other subsystems' (1 harvest, 2 pytest, 4 vitest, 6 parity, 8 content and 11 frontend build among them), and all reach it through the link. S15's own tests run in 2 pytest, `system/backend/tests/test_data_bundles.py` and `system/backend/tests/test_data_dir_guard.py`, and in 4 vitest's `tools` project, `system/tools/test/data_dir.test.mjs`, `system/tools/test/fixture.test.mjs`, `system/tools/test/fs_plugin.test.mjs`, `system/tools/test/dev_server.test.mjs` and `system/tools/test/connect_data.test.mjs`, the last under `pwsh` and skipped where `pwsh` is absent.

**Outside `ci`:** none of `test:e2e`, `check:offline`, `check:perf` and `check:pins` is specific to S15. `check:offline` seeds its scratch data directory from `data/`, and `node tools/fixture.mjs`, run from `system/`, lists every fixture file that differs from `data/` and exits 1 on any.

**What the records measure.** §33 is D123's dev server: before it, the clip's `/@fs/` URL answered with `index.html` and status 200; after it, both clips and the twelve photographs of M0's study page loaded under `npm start`. §35 is D125's migration: the NAS folder renamed with its 289 files and bytes unchanged, `devdata lint` from 54 findings to 0, a writer run without `data/` stopping and creating nothing, the gate green against the NAS and against `fixtures/data` alone, and the fixture's 127 files equal to the NAS's.

## 6. Traps

- A bare `data` pattern in a parent `.gitignore` swallows a whole tree, and git will not descend into an ignored directory, so negations inside it never fire; this `.gitignore` anchors its rule as `/data/` for that reason. INDEX's write-up is §19.2 of KNOWLEDGE_BASE.md, a file of the course-lab repository, outside this one. [D87] [D109] [`docs/INDEX.md`] [`2026-09-19-relocation-design.md`]
- Vite checks real paths, and Vite 8.3.0's `/@fs/` reads only its own drive and answers a file on another with `index.html` and status 200, so a clip or a photograph from `data/` failed under `npm start` with nothing in the terminal saying why, while the build showed it. [D110] [D123] [`CLAUDE.md`] [`system/tools/test/dev_server.test.mjs`]
- A fresh clone has no `data/` until `devdata pull`, `start.ps1`, `fetch-data.ps1` or `npm run data:fetch` makes it. [D125] [D128] [`CLAUDE.md`]
- The NAS folder is replicated by Synology, so every gate run's harvest writes `data/content/` into a replicated folder. [D123] [`CLAUDE.md`]
- The one shared copy of `data/`, which a branch changes for every branch at once, and the hazard of `rm -rf data/` in Git Bash are cross-cutting and stated on the map. [D110] [D111] [`docs/subsystems/README.md`]

## 7. History

**Binding decisions:** D-08, D-24.

**Specs and plans:** `2026-10-02-devdata-migration.md`.

| Deviation | Effect | Role |
|---|---|---|
| D37 | `/api/health` advertised a model this machine cannot run | secondary |
| D80 | every Python step now names its interpreter: the `py12` environment | secondary |
| D108 | the data git does not carry moves through the NAS, by `sync-data.ps1` | primary |
| D109 | all of `data/` on the NAS, and none of it in git | primary |
| D110 | `data/` a link to the NAS, and no data file in the checkout | primary |
| D111 | M5's playgrounds, T1 and T2 | secondary |
| D115 | The expert prompt carries the criteria and asks for labelled analyses; D-V is recorded again | secondary |
| D123 | the dev server serves data/ across drives, F2 draws its edges, and devdata declares data/ | primary |
| D124 | D-V names each hand, and is recorded again on the A6000 | secondary |
| D125 | the track's data follows remotex devdata: moved, guarded, fixtured, and named by root | primary |
| D126 | the repository stands alone, with its own workflow and launch configuration | secondary |
| D128 | data shared through Google Drive with `gdown`, beside the devdata link | primary |

## 8. Open items

1. Observed on 2026-10-08 and recorded nowhere: in this checkout `data/` is a directory junction to the checkout's own `fixtures/data`, not to the NAS folder `data.toml` names. Every read here sees the fixture's 127 files only, the gate's harvest writes into tracked files of the fixture, and `system/tools/test/fixture.test.mjs` skips its comparison with the NAS. [D110] [D125] [`data.toml`] [`system/tools/test/fixture.test.mjs`]
2. PRD §5 lists "Hosting full dataset corpora" among the non-goals, and D-24 annotates §5 for cloud deployment only. D128's `industreal` bundle on Google Drive is `all_rgb_videos.zip`, 4960644152 bytes, kept under `_raw/`, where `system/backend/scripts/data_bundles.py` places the unmodified source corpora. Whether that bundle is the hosting §5 rules out is the author's to rule; no record answers it. [PRD §5] [D128] [D-24] [`system/backend/scripts/data_bundles.py`]
3. `README.md` gives the Drive folder's URL, and no record states who can read the folder. This belongs with F5's unresolved question of the audience the named licences cover. [D128] [D-24] [`README.md`]
4. `data.toml`'s comment says that `devdata pull --ci` links the fixture on the runner, which no longer describes the runner. [D126] [`data.toml`]
5. D125 left for the author the devdata spec's steps 5 and 6 of its §10.1: once a second machine passes with `git pull`, `devdata pull` and the tests, `system/tools/Connect-DataDirectory.ps1`, the link step of `fetch-data.ps1`, `SGS_DATA_DIR` and `SGS_CORPUS_ROOT` retire. The secret it asked for, `REMOTEX_READ_TOKEN`, is no longer read since D126. [D125] [D126] [`2026-10-02-devdata-migration.md`]
6. The devdata plan's Task 3 states that a test whose input the fixture omits is skipped under `CI=true` and fails outside it. No tracked test reads `CI`: the backend tests skip on the absence of their input whatever the environment, as `system/backend/tests/test_slices.py` does, and `system/tools/test/fixture.test.mjs` skips where `data/` resolves to the fixture. [`2026-10-02-devdata-migration.md`] [`system/backend/tests/test_slices.py`] [`system/tools/test/fixture.test.mjs`]
7. D-08's table marks the slices' annotations and manifests and the placeholder slice as committed; since D109 nothing under `data/` is tracked, and D-08 carries no note of it. [D-08] [D109]
8. `.gitignore`'s comment says that WekaExt's root `.gitignore` has no rule over this tree; since D-24 the repository stands alone and has no such parent. [D-24] [`.gitignore`]
9. Tracked lines still name folders on a machine, against D125's convention: `DEVIATIONS.md:5469` names the NAS's folder on a drive, `DEVIATIONS.md:5431` a file path on a drive, and `docs/superpowers/plans/2026-09-26-playgrounds-m1.md:99` a corpus path under a drive. D125 records `devdata lint` at zero findings on 2026-10-02, and no record reconciles these lines with that result. The paths are not repeated here, so this page adds none. [D125] [VERIFICATION §35] [`DEVIATIONS.md`] [`docs/superpowers/plans/2026-09-26-playgrounds-m1.md`]
