# S7 Papers and reference pages

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/pages/` | Reference pages: field map, knowledge index, paper cards, leaderboards |
| `system/tools/gen_papers.py` | Authors the paper corpus |
| `system/tools/test/papers.test.mjs` | Tests of the paper corpus |
| `system/tools/test/leaderboards.test.mjs` | Tests of the leaderboards |
| `data/content/papers.json` | The paper corpus (NAS) |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §9, VERIFICATION §32.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** D-21.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`, `2026-09-15-scene-graph-studio-PRD.md`.

| Deviation | Effect | Role |
|---|---|---|
| D32 | the tier-A list and D-21 cannot both be satisfied | primary |
| D33 | three smaller corrections to Task 9 | primary |
| D34 | eighty-two numbers carried a protocol their source never states | primary |
| D35 | a leaderboard row cannot name three things its source never states | primary |
| D72 | `/api/content/*` is normative, absent, and should stay absent | secondary |
| D79 | `ruff` was in the gate for half the Python in the repository | secondary |
| D92 | the suite written to guard the lint rules missed eight of seventeen breaks | secondary |
| D101 | the map indexes the knowledge points, and the knowledge-map freeze is released (D-23) | primary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |

## 8. Open items

DRAFT
