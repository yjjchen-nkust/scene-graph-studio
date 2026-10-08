# S9 Graph and readouts

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/graph/` | Scene graph view, image overlay, geometry, palette |
| `system/frontend/src/components/` | Metric readout and warning list |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §10, VERIFICATION §32.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** none.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`, `2026-09-15-scene-graph-studio-contracts.md`.

| Deviation | Effect | Role |
|---|---|---|
| D20 | component tests live beside the component | secondary |
| D22 | the plan's draw-mode tests could not run, and one of them passed anyway | primary |
| D23 | the graph view cannot draw a missed verdict from the props the contract gives it | primary |
| D24 | a test that could not fail, written the same night D22 was logged | primary |
| D27 | the engine does not read `protocol`, so the ordering invariant was untestable | secondary |
| D34 | eighty-two numbers carried a protocol their source never states | secondary |
| D75 | a box is clickable on its outline only, and widening it has a cost | primary |
| D88 | the three M0 playgrounds, and the four things building them decided | secondary |
| D96 | the long playgrounds split across steps, and triplets counted as a set | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |

## 8. Open items

DRAFT
