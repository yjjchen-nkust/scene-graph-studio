# S15 Data infrastructure

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `data.toml` | devdata entry that names the data link |
| `data.drive.json` | Google Drive bundle ids and checksums |
| `fetch-data.ps1` | Reports and obtains slice data |
| `fixtures/` | The CI fixture, fixtures/data |
| `.gitignore` | Ignore rules of the track root, including /data/ |
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

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §33, VERIFICATION §35.

DRAFT

## 6. Traps

DRAFT

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

DRAFT
