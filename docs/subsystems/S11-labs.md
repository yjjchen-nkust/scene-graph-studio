# S11 Labs

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/frontend/src/labs/` | The eight labs L1 to L8, their frame, registry and API client |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

**Records:** VERIFICATION §4, VERIFICATION §5, VERIFICATION §10, VERIFICATION §32.

DRAFT

## 6. Traps

DRAFT

## 7. History

**Binding decisions:** none.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`, `2026-09-15-03-models-and-vlm.md`, `2026-09-15-04-labs-shells-hardening.md`, `2026-09-15-scene-graph-studio-PRD.md`.

| Deviation | Effect | Role |
|---|---|---|
| D26 | the plan's lab URL cannot round-trip a built graph | primary |
| D27 | the engine does not read `protocol`, so the ordering invariant was untestable | primary |
| D40 | L5 has no ground truth to score against, and L4 has nothing to compare | primary |
| D43 | three of plan 04 Task 1's four assertions could not hold as written | primary |
| D50 | the box-adjustment category was inert until it was wired | primary |
| D60 | `/lab/:labId`, and the endpoint a standalone lab needed | primary |
| D61 | the mutation run that raced its own restore | primary |
| D66 | the export, and the two things it refuses to do | secondary |
| D74 | NFR-8 was the one requirement with no enforcer, and the instrument reported itself | secondary |
| D75 | a box is clickable on its outline only, and widening it has a cost | secondary |
| D98 | M3's playgrounds, E1 and E10, and four statements about matching and protocols | secondary |
| D99 | the graph constraint was keyed on class pairs; the reference keys it on object pairs | secondary |
| D106 | M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted | secondary |
| D120 | the review of 2026-10-01 | secondary |
| D122 | the findings D120 left open, the RLE engines' memory and width, and D121's drift made visible | secondary |
| D127 | the frontend on GitHub Pages and the backend on Render | secondary |

## 8. Open items

DRAFT
