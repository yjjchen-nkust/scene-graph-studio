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

DRAFT

## 6. Traps

DRAFT

## 7. History

DRAFT

## 8. Open items

DRAFT
