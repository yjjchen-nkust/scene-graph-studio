# S8 Knowledge map and brief

## 1. Purpose and boundary

S8 is the two static pages that predate the application: the knowledge map under `system/web/knowledge-map/`, which is the source the harvest reads and a fallback that opens from disk with no build step, and the published brief under `system/web/brief/`, with the two validators that audit them and the build that writes the brief's standalone copy into `docs/`. It is not the course corpus the harvest feeds (S6), and the map's `pg.js evaluate()` is not the evaluation engine (S1) and never becomes it.

## 2. Code and data

| Path | Role |
|---|---|
| `system/web/` | Knowledge map page and published brief |
| `system/tools/audit.js` | Audits display math in the knowledge map and the brief |
| `system/tools/check.js` | Checks the knowledge map data |
| `system/tools/build_standalone.mjs` | Builds the standalone brief with pre-rendered math |
| `system/tools/test/standalone.check.mjs` | Asserts the standalone brief renders with no network: no request, no unrendered math, the prototype working |

## 3. Interfaces

**Provides:**

- The knowledge map's data declarations, `CLUSTERS` in `system/web/knowledge-map/kp-data.js` and `MATH` and `DERIV` in `pg.js`, which S6's `system/tools/harvest.mjs` reads as text; S6's `registry.test.tsx` also reads `pg.js`, the map's `index.html`, `FROZEN.md` and `system/web/brief/index.html`.
- `docs/brief.standalone.html`, the brief's standalone copy, written by `system/tools/build_standalone.mjs`.
- `npm run lint:frozen` and `npm run lint:standalone`, steps 9 and 10 of `npm run ci`, and `npm run build:standalone`, declared in S14's `system/package.json`.

**Consumes:** none. The owned paths read only their own files and `docs/brief.standalone.html`, which no subsystem owns; `build_standalone.mjs` imports the `mathjax-full` package and `standalone.check.mjs` the `jsdom` package.

## 4. Current rules

1. The knowledge map, `system/web/knowledge-map/` (`index.html`, `kp-data.js`, `pg.js`, `imagelab.js`), is the source the harvest reads: the 93 knowledge points in 12 clusters of `kp-data.js` `CLUSTERS`, and the `MATH` and `DERIV` maps of `pg.js`. [D-13] [D-23] [`system/tools/harvest.mjs`]
2. What the page may become, and what it may never become: since D-23 released the freeze of D-13, the page may be extended and not only corrected, while D-14 stands, so `pg.js evaluate()`, a teaching instrument over fifteen hard-coded prediction rows, is excluded from the harvest and never becomes the evaluation engine, which is written with no reference to it. [D-23] [D-14] [D101]
3. D-14's reason: `evaluate()` matches a triplet by string equality against a precomputed per-prediction IoU scalar, carries no protocol, no constraint mode and no mask pairing, has a `Ra` weighting dial that is no published metric, and runs on eight hard-coded objects and fifteen rows. Promoted, it would disagree with the field while the parity check passed, both engines being wrong together; the dial survives as knowledge point E6, taught and not computed. [D-14] [`system/web/knowledge-map/FROZEN.md`]
4. Besides D-14, three things stand from the freeze: the harvest from the page, the two validators, which still run as `npm run lint:frozen` under that name, and a page that opens from disk with no build step. [D-23]
5. An edit to the page is followed by `npm run harvest`, which writes `kp.json`, `math.json` and `deriv.json` under `data/content/` through the `data/` link. D-23 has the page and the three files committed together; §8 item 10 records why that no longer settles what a commit carries. [D-23] [D110] [`system/tools/harvest.mjs`]
6. Changes to the page since the release are logged in `DEVIATIONS.md`, and `FROZEN.md` keeps its name and its log of the corrections made under the freeze. [D-23] [D101]
7. A formula or derivation corrected in a module is rebuilt on the page from the corrected MDX and harvested again, so the two cannot differ. [D98] [D106] [D111]
8. A correction to the page leaves its toy demonstrations computing as they did and corrects what the page says about them: E10's bars from invented IoU scale factors, whose readout now says "ordering on this toy", T1's toy readout with its |P| slider to 310, and T2's toy average over the whole graph. [D98] [D100] [D111] [`system/web/knowledge-map/FROZEN.md`]
9. `npm run lint:frozen`, step 9 of `npm run ci`, runs `audit.js` and then `check.js`, and each exits non-zero on a problem. [D-23] [`system/web/knowledge-map/FROZEN.md`] [`system/package.json`]
10. `audit.js` holds the map and the brief to the same checks: every display block terminated and free of a `\\` outside the environments it lists, `aligned` and `cases` among them, the inline delimiters balanced, five block tags balanced, ids unique, and as many `lang="en"` spans as `lang="zh"`. [`system/web/knowledge-map/FROZEN.md`] [`system/tools/audit.js`]
11. `audit.js` also requires a display block free of a stray `\\` in every `MATH` and `DERIV` entry of `pg.js`, a style for every class the page and its scripts use, and every UI string of `pg.js` in the `ZH` table or in the `KEEP` list of strings left identical in both languages. [`system/web/knowledge-map/FROZEN.md`] [`system/tools/audit.js`]
12. `check.js` checks every derivation's `aligned` environments, display delimiters and braces and every formula's braces and delimiters, and requires every point marked live in `kp-data.js` to resolve to a playground of `pg.js`, directly or through `PG_ALIAS`, with no alias pointing at no playground or shadowing a real one. [`system/web/knowledge-map/FROZEN.md`] [`system/tools/check.js`]
13. The page holds 26 playgrounds, 26 formulas and 23 derivations, and its 27 live points are hosted by the 26 playgrounds, E5 through its alias to E3. [VERIFICATION §29] [VERIFICATION §30] [`system/tools/check.js`]
14. `audit.js` and `check.js` are CommonJS: `system/tools/package.json` declares the directory `commonjs`, so a `"type": "module"` above it does not reach them, and the `.mjs` files beside them stay ES modules. [D7]
15. The brief, `system/web/brief/index.html`, is the published brief, and it fetches MathJax from cdnjs and its fonts from Google. [`system/tools/build_standalone.mjs`] [`system/web/brief/index.html`]
16. `docs/brief.standalone.html` is generated from the brief by `npm run build:standalone`: every equation is pre-rendered to SVG with its glyph paths inline, and the MathJax runtime and the webfont links are removed, with system font stacks in their place. The build fails if a `src` or `href` still fetches anything but a doi.org or arxiv.org citation, or if fewer than 20 equations rendered. [`CLAUDE.md`] [`system/tools/build_standalone.mjs`]
17. `npm run lint:standalone`, step 10 of `npm run ci`, rebuilds the standalone and fails if it differs from the file in `docs/`, then loads that file in jsdom and requires no network request, no unrendered mathematics, at least 15 display and 50 inline equations, the prototype mounted, its constraint toggle moving R to the caption's 0.800 with mR at 0.810, and the `zh` toggle working. The brief is therefore edited at its source and rebuilt in the same commit. [`CLAUDE.md`] [`system/tools/test/standalone.check.mjs`]
18. The standalone carries 254 equations in 1063 KB. [VERIFICATION §29] [VERIFICATION §30]
19. Both brief files are pinned to LF in `.gitattributes`, since the standalone check compares them by plain string equality. [`.gitattributes`]
20. `@xmldom/xmldom`, which MathJax's `speech-rule-engine` pins, is lifted to 0.9.12 by an `overrides` entry; its sole consumer is `build_standalone.mjs`, and the standalone was byte-identical after it. [D73] [`system/package.json`]
21. The brief states the protocols' inclusion of hypothesis spaces with its condition and the recall ordering as observed in published tables, counts ordered pairs as |V|(|V| − 1), and says that an earlier release of VG150, since fixed, drew its validation images from the test pool. [D93] [D95] [D98] [`system/web/brief/index.html`]
22. A correction to a course statement is searched for in the brief, and the brief is corrected and rebuilt where it states it. [D93] [D106] [D111]

## 5. Verification

**Records:** VERIFICATION §22, VERIFICATION §29, VERIFICATION §30.

**`npm run ci` steps:** 9 frozen, `system/tools/audit.js` and `system/tools/check.js`; 10 standalone, `system/tools/build_standalone.mjs --check` and `system/tools/test/standalone.check.mjs`. Two of S6's steps also read the page: 1 harvest, which refuses a page whose counts are not 93 points, 12 clusters and 27 live, and 4 vitest, whose `system/frontend/src/content/test/registry.test.tsx` reads `pg.js`, the map's `index.html`, `FROZEN.md` and the brief for the corrections and the release of the freeze.

**Outside `ci`:** none of `test:e2e`, `check:offline`, `check:perf` and `check:pins` measures S8.

**What the records measure.** §22 includes the harvest unchanged in number, 26 formulas and 23 derivations, after E1's and E10's corrections, the standalone at 254 equations, and the brief no longer stating the protocol ordering as a law. §29 and §30 include the frozen lints with no problems over 26 playgrounds, 26 formulas and 23 derivations, and the standalone at 254 equations and 1063 KB; §29 ends with the brief's pair-recall bound left open.

## 6. Traps

- A correction is not an extension: a page that teaches something false is worse than one out of date, which is why the freeze admitted corrections and logged each one. [`system/web/knowledge-map/FROZEN.md`]
- A figure repeated across the page, the brief and a decision from one early reading is wrong in all three at once, and only opening the source finds it. [D93] [`system/web/knowledge-map/FROZEN.md`]
- Neither validator reads a claim: in D16 every number was real and correctly transcribed, and only the sentences around them were wrong. [D16]
- A `\\` line break inside display math outside an alignment renders in MathJax as a visible red error rather than failing loudly, which is what `audit.js` exists to catch. [`CLAUDE.md`] [`system/web/knowledge-map/FROZEN.md`]
- A validator path declared and never read audits nothing: `audit.js` declared the brief's directory and did not audit the brief until 2026-09-16. [`system/web/knowledge-map/FROZEN.md`]
- `pg.js evaluate()` is the most tempting shortcut in the repository: promoted, it would pass the parity check, both engines being wrong together. [D-14] [`CLAUDE.md`]
- A `"type": "module"` in a parent `package.json` turns a CommonJS `.js` file beneath it into an ES module, which fails with `require is not defined`. [D7]
- The standalone is generated: an edit made in `docs/brief.standalone.html` is lost at the next build, and an edit to the source without `npm run build:standalone` fails `lint:standalone`. [`CLAUDE.md`] [`system/tools/build_standalone.mjs`]

## 7. History

**Binding decisions:** D-13, D-14, D-23.

**Specs and plans:** `2026-09-15-02-graph-labs-and-content.md`.

| Deviation | Effect | Role |
|---|---|---|
| D7 | `system/tools/` scoped back to CommonJS | secondary |
| D16 | two content errors about the anchor paper's ablations | primary |
| D73 | the audit, reduced to what actually cannot be fixed | secondary |
| D93 | M1's three playgrounds, and the premise X1 could not be built on | secondary |
| D95 | the review of the day's merges: F6's status under its clip, and what surrounded it | secondary |
| D97 | M2's playground, F3, and three statements about IoU the sources contradict | secondary |
| D98 | M3's playgrounds, E1 and E10, and four statements about matching and protocols | secondary |
| D100 | the review minors of M2, M3 and D99, settled | secondary |
| D101 | the map indexes the knowledge points, and the knowledge-map freeze is released (D-23) | secondary |
| D106 | M4's playgrounds, E3, E4, E7, E13 and X2, and the constraint statements the engine contradicted | secondary |
| D111 | M5's playgrounds, T1 and T2 | secondary |

## 8. Open items

1. The brief defines pair recall, PR@k = |π(G) ∩ π(X_k)| / |π(G)|, and states R@k ≤ PR@k with no condition on the constraint. The bound holds under the graph constraint and fails without it when two ground truths share a pair: under `none` a run on the engine gives R@2 = 2/3 with 1 of 2 annotated pairs covered. Left for its own cycle. [D106] [VERIFICATION §29] [`system/web/brief/index.html:577`]
2. D-23 says the page opens from disk with no build step, no dependency and no network. The page's `index.html` loads MathJax from cdnjs and its fonts from Google Fonts; no record reconciles the two. [D-23] [`system/web/knowledge-map/index.html`]
3. D-23 says that `npm run ci` fails on drift between the page and the three harvested files, and `FROZEN.md` that the gate fails if the harvest's output drifts from the page. The harvest rewrites the three files from the page on every run and refuses only a count other than 93 points, 12 clusters and 27 live or a formula with no point; no step compares its output with an earlier copy. [D-23] [`system/web/knowledge-map/FROZEN.md`] [`system/tools/harvest.mjs`]
4. `FROZEN.md` opens by saying that the rest of the file is kept as written and that later changes to the page are logged in `DEVIATIONS.md`. Its 2026-09-28 and 2026-09-29 entries were appended after the release, by D106 and D111, which logged the same corrections in `DEVIATIONS.md`; no record says which practice holds. [D-23] [D106] [D111] [`system/web/knowledge-map/FROZEN.md`]
5. Contracts §2.5 says the knowledge map is the only thing in the repository that uses MathJax. The brief loads it from cdnjs, and `build_standalone.mjs` imports `mathjax-full`. [contracts §2.5] [`system/web/brief/index.html`] [`system/tools/build_standalone.mjs`]
6. How `MATH.T2`'s three lines lay out in the map's formula card, where every other formula is one line, was not checked; `lint:frozen` passes over it, and no look at it in a browser is recorded. [D111]
7. The frozen F7 note's "s ≈ 1.1" was not examined, and the note still carries it. [D93] [`system/web/knowledge-map/pg.js`]
8. Knowledge point F3's `knobs` field names "sliders: x, y, w, h of the predicted box", where F3 has Δx, Δy and one scale λ; recorded and not changed, since the field makes no claim about a source. [D97]
9. Knowledge point X2's title, "VRD and the undeclared k", and the label of its toy's knob still write k for the per-pair count, which its `knobs` field, its note and M4 write m; left as the frozen page's own. [D106] [`system/web/knowledge-map/FROZEN.md`]
10. D-23 has the page and the three harvested files committed together, and `CLAUDE.md` said to commit the page until its traps became pointers to these pages on 2026-10-08. Since D110 no data file lies in the checkout, but D125 tracks fixture copies of the three, `fixtures/data/content/kp.json`, `math.json` and `deriv.json`, which `system/tools/test/fixture.test.mjs` holds byte-equal to their NAS copies outside CI, and which `npm run fixture:refresh` copies over from the NAS. Committing the page alone is therefore incomplete, and no record states the current commit rule. In this checkout on 2026-10-08, `data/` is a junction to `fixtures/data`, so the harvest writes the fixture copies directly. [D-23] [D110] [D125] [`CLAUDE.md`] [`system/tools/test/fixture.test.mjs`]
