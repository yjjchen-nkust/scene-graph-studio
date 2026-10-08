# S14 Checks and instruments

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/package.json` | Workspace root and the npm scripts, including npm run ci |
| `system/package-lock.json` | Lock file of the workspace |
| `system/.gitignore` | Ignore rules under system/ |
| `system/vitest.config.ts` | Vitest projects and the filesystem allow list |
| `system/playwright.config.ts` | Playwright configuration for the keyboard walkthrough |
| `system/e2e/` | End-to-end specs: lecture, offline, perf, projector |
| `system/tools/package.json` | Declares the tools directory as CommonJS |
| `system/tools/perf_check.mjs` | NFR-8 cold start and input-to-paint check |
| `system/tools/offline_check.mjs` | Offline check with a torch-free interpreter |
| `system/tools/servers.mjs` | Starts and stops servers, and refuses a held port |
| `system/tools/py.mjs` | Resolves the Python interpreter for Node tools |
| `system/tools/Resolve-Python.ps1` | Resolves the Python interpreter for PowerShell |
| `system/tools/docs_index.mjs` | Coverage rules R1 to R8 of the subsystem index |
| `system/tools/test/py.test.mjs` | Tests of the interpreter resolution |
| `system/tools/test/servers.test.mjs` | Tests of server handling |
| `system/tools/test/docs_index.test.mjs` | Tests of the subsystem index rules |
| `system/backend/scripts/check_pins.py` | Compares requirement pins to the interpreter |
| `system/backend/tests/__init__.py` | Package marker of the backend tests |
| `system/backend/tests/test_pins.py` | Tests of the dependency pins |
| `system/backend/pyproject.toml` | Backend tool configuration |
| `system/backend/requirements.txt` | Pinned backend requirements |
| `.gitattributes` | Line-ending pins for generated files |

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
