# Playgrounds, M1: F6, F7 and X1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build M1's three playgrounds (F6 predicate synonymy, F7 the long tail, X1 the VG150 releases), after correcting the X1 premise the opened sources contradict, so that M1 goes from 6 steps to 9 with every figure it shows either computed from a committed annotation or cited to a quoted source.

**Architecture:** Each playground is a component registered by knowledge-point id in `PLAYGROUND_MOUNTS`, over the existing control kit, with its arithmetic in `playgrounds/logic.ts`. F6 and F7 count over the committed `vg150-sgb` annotations, imported at build time. X1 reads `data/content/vg150_splits.json`, a file of quoted figures that a new lint rule checks. Nothing computed is a metric.

**Tech Stack:** TypeScript, React 19, Vite 8, MDX, vitest (jsdom), Playwright (Chromium), Node ≥ 22.12, py12 for one measurement.

**Spec:** `docs/superpowers/specs/2026-09-26-playgrounds-m1-design.md`. It builds on `docs/superpowers/specs/2026-09-19-playgrounds-design.md`, whose contract (§2) and cross-cutting rules (§4, §6) still hold.

## Global Constraints

- **Branch `feat/playgrounds-m1`**, cut from `fix/sgs-lint-test-gaps`. Do not merge; the user merges after review.
- **Working directory is `scene-graph-studio/system/`.** Every `npm` command runs there. Paths below are relative to it unless they start with `../` or `data/`, `docs/` (track root).
- **Python is `py12`.** Never the bare `python`. Node resolves it through `tools/py.mjs`.
- **A playground computes a count, a bound or a set membership. Never a metric.** No R, mR, R@K or γ appears in F6 or F7. Nothing in `frontend/src/playgrounds/` imports from `sgg-metrics` except types.
- **`pg.js evaluate()` is never promoted** (D-14).
- **`system/web/knowledge-map/` is frozen** (D-13). Task 3 corrects it, which D-13 permits; no other task touches it, and Task 3 adds no option, control or knowledge point.
- **No figure is recalled.** Every number in `vg150_splits.json` is copied from the quoted passage, and the lint checks its digits against the quote.
- **Bilingual parity** (NFR-6). Every i18n key in `en.json` and `zh-TW.json`; every MDX step in both locale files with the same id, `kind`, `kp` and its own locale's notes.
- **Chinese is formal written Chinese** with Chinese punctuation (、。：「」（）／); numbers, proper nouns and technical terms verbatim.
- **Lecture legibility:** type in `em`, never below 18 px in the lecture shell; ink `slate-700` or darker on `slate-50`; colour never the only channel.
- **Knob ids equal their query keys**, namespaced by kp (`F6.mp`, not `mp`).
- **Generated files stay LF.** `data/content/*.json` is already pinned in `.gitattributes`.
- **`npm run ci` exits 0 before every commit.** Commit messages end with the `Claude-Session:` line given for this session.

## Review Focus

Five conditions the spec implies and no happy path exercises. Each has its test in the owning task.

1. **`?F6.sub=` naming a predicate outside the merge group, or the edge's own predicate.** Expected: falls back to the first group member that differs from the edge's predicate; never renders a sentence with an arbitrary word. *(Task 5)*
2. **`?F6.img=` naming a frame that does not exist or carries no group edge.** Expected: falls back to the teaching frame, chosen from the data; the membership panel never blanks. *(Task 5)*
3. **F7 knobs out of range from the URL: `?F7.s=-1`, `?F7.C=500`, `?F7.k=0`, and `k > C`.** Expected: clamped to s ∈ [0, 2.4], C ∈ [4, 50], k ∈ [1, C]; the head share stays in (0, 1] and is never `NaN`. *(Task 4 for the arithmetic, Task 6 for the component)*
4. **X1 comparing a release with itself, or naming a release that does not exist.** Expected: an unknown id falls back to the default; a self-comparison shows differences of 0 and claims no explanation. *(Task 4 for `explain`, Task 7 for the component)*
5. **X1 comparing Xu (a share, not a count) with a release that states counts.** Expected: "not both stated as counts"; the playground never computes 0.7 × 108,077. *(Task 4, Task 7, and a golden case)*

---

## File Structure

| File | Responsibility |
|---|---|
| `data/content/vg150_splits.json` | **Create.** Four releases, each figure with `value`, `source`, `url`, `locator`, `quote`; the notes a difference can equal. |
| `tools/content_lint.mjs` | **Modify.** Rule 9 amended (`image_id` or `scope`); rule 12 added (every release figure cited, digits in the quote). |
| `tools/test/content_lint.test.mjs` | **Modify.** Fixtures for rules 9 and 12. |
| `web/knowledge-map/kp-data.js`, `web/knowledge-map/pg.js`, `web/knowledge-map/FROZEN.md` | **Modify (correction only).** kp X1's title, knobs and statement; the frozen X1's figures and note. |
| `data/content/kp.json`, `math.json` | **Regenerated** by `npm run harvest`. |
| `frontend/src/content/m01.en.mdx`, `m01.zh-TW.mdx` | **Modify.** s4 corrected (Task 3); three playground steps and renumbering (Task 8). |
| `docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md`, `…-SRS.md`, `…-design.md` | **Modify.** Annotated in place: D-09, hazard 1, gotcha 1. |
| `backend/app/datasets/adapters/vg150_sgb.py` | **Modify.** Docstring only. |
| `frontend/src/playgrounds/slice.ts` | **Modify.** A second export: the `vg150-sgb` frames. |
| `frontend/src/playgrounds/splits.ts` | **Create.** Imports `vg150_splits.json` once and types it. |
| `frontend/src/playgrounds/logic.ts` | **Modify.** Merge map and counts, merged membership, harmonic numbers, head share, tail ratio, ranking, split difference, explanation, disjointness. |
| `frontend/src/playgrounds/F6/groups.ts`, `F6/PredicateSynonymy.tsx` | **Create.** F6's two merge groups; the component. |
| `frontend/src/playgrounds/F7/LongTailDistribution.tsx` | **Create.** |
| `frontend/src/playgrounds/X1/SplitReleases.tsx` | **Create.** |
| `frontend/src/playgrounds/mounts.tsx` | **Modify.** Three entries. |
| `frontend/src/i18n/en.json`, `zh-TW.json` | **Modify.** The new keys. |
| `data/content/playground_golden.json`, `frontend/src/playgrounds/test/golden.test.ts` | **Modify.** Eleven cases; the dispatch for `scope`. |
| `e2e/lecture.spec.ts`, `e2e/projector.spec.ts`, `e2e/perf.spec.ts` | **Modify.** M1's steps in Chromium. |
| `../DEVIATIONS.md`, `docs/VERIFICATION.md`, `docs/INDEX.md`, `../CLAUDE.md`, `../README.md`, `…-contracts.md` | **Modify.** D93, §17, counts, contract text. |

---

## Task 1: The sources, and `vg150_splits.json`

The spec's §10 left two items open. Both were closed while this plan was written (issue #94 read verbatim through the GitHub API; the card's upstream revision recorded and its README found byte-identical to the local copy), and Steps 1–2 re-confirm them before any figure enters a file.

**Files:**
- Create: `data/content/vg150_splits.json`

**Interfaces:**
- Produces: `{ "$schema_version": 1, "sources": [...], "releases": Release[] }`, where `Release` is `{ id, label_en, label_zh, figures: { train?, val?, test?, pool?, val_from?, zero_relation? }, notes: Note[] }`, a figure is `{ value: number | string | null, source, url, locator, quote, measured? }`, and a note is a figure with a numeric `value` plus `text_en`, `text_zh`. Release ids: `xu-2017`, `canonical`, `sgb-v1`, `sgb-v2`. `val_from` values: `"trainval"`, `"test"`, `null`. `zero_relation` values: `"kept"`, `"dropped"`, `null`.

- [ ] **Step 1: Re-read issue #94 verbatim**

Run (from the track root):

```bash
curl -s https://api.github.com/repos/Maelic/SGG-Benchmark/issues/94 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.created_at,j.state);console.log(j.body.split('\n').filter(l=>/Train|Val|Test/.test(l)).join('\n'))})"
```

Expected (read on 2026-09-26):

```
2026-07-15T14:12:53Z closed
| **Train** | 73,538 | 57,723 |
| **Val** | 4,844 | 5,000 |
| **Test** | 27,032 | 26,446 |
```

If any figure differs, stop: the golden cases in Task 7 and the spec's reconciliation table follow the verbatim figure, and D93 records the difference.

- [ ] **Step 2: Confirm the card and the parquet on disk are the ones the spec quotes**

```bash
sha256sum /c/DataRaw/vg150-sgb/README.md /c/DataRaw/vg150-sgb/annotations/val-00000-of-00001.parquet
node tools/py.mjs -c "import os, pyarrow.parquet as pq; print(pq.ParquetFile(os.path.join(os.environ['SGS_CORPUS_ROOT'], 'vg150-sgb/annotations/val-00000-of-00001.parquet')).metadata.num_rows)"
```

Expected:

```
6fe84d8666f6549d74c2b6d6884bc0de53fecec09e0a11cd9c5dfc958e6a5f15 *…/README.md
66830fb049a10616d08a3ebfd5c5f24db8002452224dd186a525ebdeaefea0e6 *…/val-00000-of-00001.parquet
5000
```

Then confirm the upstream card has not changed since the corpus was downloaded:

```bash
curl -s https://huggingface.co/api/datasets/maelic/VG150-coco-format | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.sha,j.lastModified)})"
curl -sL https://huggingface.co/datasets/maelic/VG150-coco-format/raw/main/README.md | sha256sum
```

Expected (2026-09-26): `ea6fb3a56a0876eee98165ea17792fc6ec8460e6 2026-07-16T15:49:20.000Z`, and the same `6fe84d86…` hash as the local card. If either differs, the card has moved: re-read Steps 3–4 against the new card and record the change in D93.

- [ ] **Step 3: Write `data/content/vg150_splits.json`**

Every `quote` below was copied from the source; where the source wraps a sentence across lines, the line breaks are collapsed to single spaces and nothing else changes. The table rows keep the card's own spacing.

```json
{
  "$schema_version": 1,
  "$comment": "X1's figures. Each is copied from the passage in `quote`, and content_lint.mjs rule 12 refuses a figure without its source, url, locator and quote, or a count whose digits are not in its quote. A null value is a figure the source does not state; its quote is the passage that does not state it. See docs/superpowers/specs/2026-09-26-playgrounds-m1-design.md §2.",
  "sources": [
    { "id": "xu-2017", "url": "https://arxiv.org/abs/1701.02426", "read": "2026-09-26", "note": "Xu et al., Scene Graph Generation by Iterative Message Passing, CVPR 2017. §4, Visual Genome paragraph, p. 5." },
    { "id": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "read": "2026-09-26", "sha256": "6fe84d8666f6549d74c2b6d6884bc0de53fecec09e0a11cd9c5dfc958e6a5f15", "revision": "ea6fb3a56a0876eee98165ea17792fc6ec8460e6", "last_modified": "2026-07-16T15:49:20Z", "note": "README.md as downloaded with the corpus on 2026-09-16; byte-identical to the upstream card at this revision on 2026-09-26." },
    { "id": "SGG-Benchmark issue #94", "url": "https://github.com/Maelic/SGG-Benchmark/issues/94", "read": "2026-09-26", "note": "Opened 2026-07-15T14:12:53Z, closed. Read through the GitHub API." }
  ],
  "releases": [
    {
      "id": "xu-2017",
      "label_en": "Xu et al. 2017",
      "label_zh": "Xu 等人 2017",
      "figures": {
        "pool": { "value": 108077, "source": "Xu et al. 2017", "url": "https://arxiv.org/abs/1701.02426", "locator": "§4, Visual Genome", "quote": "The original VG scene graph dataset contains 108,077 images with an average of 38 objects and 22 relationships per image." },
        "train": { "value": "70%", "source": "Xu et al. 2017", "url": "https://arxiv.org/abs/1701.02426", "locator": "§4, Visual Genome", "quote": "We use 70% of the images for training and the remaining 30% for testing." },
        "val": { "value": null, "source": "Xu et al. 2017", "url": "https://arxiv.org/abs/1701.02426", "locator": "§4, Visual Genome", "quote": "We use 70% of the images for training and the remaining 30% for testing." },
        "test": { "value": "30%", "source": "Xu et al. 2017", "url": "https://arxiv.org/abs/1701.02426", "locator": "§4, Visual Genome", "quote": "We use 70% of the images for training and the remaining 30% for testing." },
        "val_from": { "value": null, "source": "Xu et al. 2017", "url": "https://arxiv.org/abs/1701.02426", "locator": "§4, Visual Genome", "quote": "We use 70% of the images for training and the remaining 30% for testing." },
        "zero_relation": { "value": null, "source": "Xu et al. 2017", "url": "https://arxiv.org/abs/1701.02426", "locator": "§4, Visual Genome", "quote": "In this experiment, we use the most frequent 150 object categories and 50 predicates for evaluation." }
      },
      "notes": []
    },
    {
      "id": "canonical",
      "label_en": "Canonical protocol, as the card states it",
      "label_zh": "標準協定（依資料卡所述）",
      "figures": {
        "train": { "value": 57723, "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "relation-based training/eval effectively sees 57,723 / 5,000 / 26,446 images, matching the canonical VG150 protocol exactly" },
        "val": { "value": 5000, "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "relation-based training/eval effectively sees 57,723 / 5,000 / 26,446 images, matching the canonical VG150 protocol exactly" },
        "test": { "value": 26446, "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "relation-based training/eval effectively sees 57,723 / 5,000 / 26,446 images, matching the canonical VG150 protocol exactly" },
        "val_from": { "value": "trainval", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Changelog", "quote": "the entire train/val pool was placed in `train` with no validation images held out" },
        "zero_relation": { "value": "dropped", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "SGG-specific loaders (`sgg_benchmark/data/datasets/visual_genome.py`) already filter these out per-split at load time" }
      },
      "notes": []
    },
    {
      "id": "sgb-v1",
      "label_en": "SGG-Benchmark release, v1 (withdrawn)",
      "label_zh": "SGG-Benchmark 發布版本 v1（已撤回）",
      "figures": {
        "train": { "value": 73538, "source": "SGG-Benchmark issue #94", "url": "https://github.com/Maelic/SGG-Benchmark/issues/94", "locator": "§1, the COCO Format column", "quote": "| **Train** | 73,538 | 57,723 |" },
        "val": { "value": 4844, "source": "SGG-Benchmark issue #94", "url": "https://github.com/Maelic/SGG-Benchmark/issues/94", "locator": "§1, the COCO Format column", "quote": "| **Val** | 4,844 | 5,000 |" },
        "test": { "value": 27032, "source": "SGG-Benchmark issue #94", "url": "https://github.com/Maelic/SGG-Benchmark/issues/94", "locator": "§1, the COCO Format column", "quote": "| **Test** | 27,032 | 26,446 |" },
        "val_from": { "value": "test", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Changelog", "quote": "`val` was actually built from the first ~4,844 images of the *test* pool" },
        "zero_relation": { "value": null, "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Changelog", "quote": "Object/relation annotations themselves were not affected by this bug and are unchanged content-wise." }
      },
      "notes": [
        { "value": 4844, "text_en": "v1's validation images, drawn from the test pool", "text_zh": "v1 之驗證影像，取自測試影像池", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Changelog", "quote": "`val` was actually built from the first ~4,844 images of the *test* pool" },
        { "value": 5000, "text_en": "the canonical validation set, folded into v1's train", "text_zh": "標準驗證集，於 v1 中併入訓練集", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Changelog", "quote": "the true 5,000-image canonical validation set was silently folded into `train`" }
      ]
    },
    {
      "id": "sgb-v2",
      "label_en": "SGG-Benchmark release, v2 (current; the corpus on disk)",
      "label_zh": "SGG-Benchmark 發布版本 v2（現行；本機語料）",
      "figures": {
        "train": { "value": 68538, "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "| train |  68 538 |  730 270           |  405 822   | 10 815                      |" },
        "val": { "value": 5000, "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "| val   |   5 000 |   62 754           |   33 203   | 0 (all have ≥1 relation)    |", "measured": { "command": "node tools/py.mjs -c \"import os, pyarrow.parquet as pq; print(pq.ParquetFile(os.path.join(os.environ['SGS_CORPUS_ROOT'], 'vg150-sgb/annotations/val-00000-of-00001.parquet')).metadata.num_rows)\"", "sha256": "66830fb049a10616d08a3ebfd5c5f24db8002452224dd186a525ebdeaefea0e6", "rows": 5000, "date": "2026-09-26" } },
        "test": { "value": 31876, "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "| test  |  31 876 |  352 330           |  183 640   | 5 430                       |" },
        "val_from": { "value": "trainval", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Changelog", "quote": "`val` is now exactly the standard Neural-Motifs / Scene-Graph-Benchmark 5,000-image validation set (all with ≥1 annotated relation), disjoint from both `train` and `test`" },
        "zero_relation": { "value": "kept", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "Images with zero relations are kept" }
      },
      "notes": [
        { "value": 10815, "text_en": "v2's training images with no relation, kept", "text_zh": "v2 保留之無關係訓練影像", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "| train |  68 538 |  730 270           |  405 822   | 10 815                      |" },
        { "value": 5430, "text_en": "v2's test images with no relation, kept", "text_zh": "v2 保留之無關係測試影像", "source": "vg150-sgb card", "url": "https://huggingface.co/datasets/maelic/VG150-coco-format", "locator": "Dataset statistics", "quote": "| test  |  31 876 |  352 330           |  183 640   | 5 430                       |" }
      ]
    }
  ]
}
```

- [ ] **Step 4: Check every quote against its source, mechanically**

The card's quotes are checked against the file on disk; a quote that is not a substring (after collapsing whitespace runs to one space) is a transcription error.

```bash
node -e "
const fs=require('fs');const card=fs.readFileSync(process.env.SGS_CORPUS_ROOT+'/vg150-sgb/README.md','utf8').replace(/\s+/g,' ');
const j=JSON.parse(fs.readFileSync('../data/content/vg150_splits.json','utf8'));
let bad=0;for(const r of j.releases){for(const f of [...Object.values(r.figures),...r.notes]){if(f.source!=='vg150-sgb card')continue;const q=f.quote.replace(/\s+/g,' ');if(!card.includes(q)){bad++;console.log('NOT IN CARD',r.id,q)}}}
console.log('card quotes checked, mismatches:',bad)"
```

Expected: `card quotes checked, mismatches: 0`. The issue's three rows were checked in Step 1. Xu's three sentences are on p. 5 of the PDF, §4; open it and confirm by eye.

- [ ] **Step 5: Commit**

```bash
git add ../data/content/vg150_splits.json
git commit -m "feat(sgs): X1's figures, each copied from a quoted passage"
```

`npm run ci` is unaffected: nothing reads the file yet.

---

## Task 2: Lint rules 9 and 12

**Files:**
- Modify: `tools/content_lint.mjs` (the playground golden loop, after `const PLAYGROUND_GOLDEN`; a new section before `// ---- report`; the success line)
- Modify: `tools/test/content_lint.test.mjs`

**Interfaces:**
- Consumes: `data/content/vg150_splits.json` (Task 1).
- Produces: rule 9, "a case carries exactly one of `image_id` or `scope` ∈ {`slice`, `model`, `sources`}"; rule 12, "every release figure and note carries `source`, `url`, `locator`, a non-empty `quote`; a numeric value's digits appear in its quote's digits; `measured.rows` equals `value`; every note has a numeric value and `text_en`, `text_zh`; every release has `label_en`, `label_zh`; there is at least one release". Messages as in the code below.

- [ ] **Step 1: Give the fixture corpus a splits file**

In `tools/test/content_lint.test.mjs`, add a default and a parameter to `corpus`:

```js
/** One release with one cited figure: the smallest file rule 12 accepts. */
const SPLITS = {
  $schema_version: 1,
  releases: [{
    id: 'r1', label_en: 'R', label_zh: 'R',
    figures: {
      train: { value: 68538, source: 'card', url: 'https://example.org/card', locator: 'Stats',
        quote: '| train |  68 538 |' },
    },
    notes: [],
  }],
};
```

Add `splits` to the destructured parameters of `corpus` (`mounts = …, golden, splits = SPLITS,`) and write it beside the golden file:

```js
  write('data/content/vg150_splits.json', JSON.stringify(splits));
```

Run: `npx vitest run tools/test/content_lint.test.mjs`
Expected: 18 passed (the lint does not read the file yet).

- [ ] **Step 2: Write the failing tests for rule 9**

Replace the test `'refuses a golden case missing a field'` and add three beside it:

```js
  it('refuses a golden case missing a field', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', image_id: 'x', expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).toContain("pg-1: missing 'knobs'");
  });

  it('accepts a golden case with a scope in place of a frame', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', scope: 'model', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).not.toContain('pg-1');
    expect(r.ok, r.out).toBe(true);
  });

  it('refuses a golden case with neither a frame nor a scope, and one with both', () => {
    const base = { kp: 'F1', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) };
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', ...base }, { id: 'pg-2', image_id: 'x', scope: 'slice', ...base }] },
    }));
    expect(r.out).toContain('pg-1: carries neither image_id nor a scope');
    expect(r.out).toContain('pg-2: carries both image_id and a scope');
  });

  it('refuses a golden case whose scope is not one of the three', () => {
    const r = lint(corpus({
      golden: { cases: [{ id: 'pg-1', kp: 'F1', scope: 'world', knobs: {}, expect: { a: 1 }, why: 'y'.repeat(50) }] },
    }));
    expect(r.out).toContain("pg-1: scope 'world' is not one of slice, model, sources");
  });
```

- [ ] **Step 3: Write the failing tests for rule 12**

```js
  const fig = { value: 68538, source: 'card', url: 'https://example.org/card', locator: 'Stats', quote: '| train |  68 538 |' };
  const withFigure = (f, extra = {}) => ({
    $schema_version: 1,
    releases: [{ id: 'r1', label_en: 'R', label_zh: 'R', figures: { train: f }, notes: [], ...extra }],
  });

  it('refuses a release figure without its source, url, locator or quote', () => {
    for (const key of ['source', 'url', 'locator', 'quote']) {
      const r = lint(corpus({ splits: withFigure({ ...fig, [key]: '' }) }));
      expect(r.out, key).toContain(`r1.train: no '${key}'`);
    }
  });

  it('refuses a count whose digits are not in its quote', () => {
    const r = lint(corpus({ splits: withFigure({ ...fig, value: 68583 }) }));
    expect(r.out).toContain('r1.train: value 68583 does not appear in its quote');
  });

  it('accepts a null or a share, which have no digits to check, but not without a quote', () => {
    expect(lint(corpus({ splits: withFigure({ ...fig, value: null }) })).ok).toBe(true);
    expect(lint(corpus({ splits: withFigure({ ...fig, value: '70%' }) })).ok).toBe(true);
    const r = lint(corpus({ splits: withFigure({ ...fig, value: null, quote: '' }) }));
    expect(r.out).toContain("r1.train: no 'quote'");
  });

  it('refuses a measurement that disagrees with the figure it measures', () => {
    const r = lint(corpus({ splits: withFigure({ ...fig, measured: { rows: 5000 } }) }));
    expect(r.out).toContain('r1.train: measured 5000 rows but carries 68538');
  });

  it('refuses a note without a numeric value or its two texts', () => {
    const note = { ...fig, value: '10815', text_en: 'kept' };
    const r = lint(corpus({ splits: withFigure(fig, { notes: [note] }) }));
    expect(r.out).toContain('r1.notes[0]: a note needs a numeric value');
    expect(r.out).toContain("r1.notes[0]: no 'text_zh'");
  });

  it('refuses a release without both labels, and a file with no releases', () => {
    const r = lint(corpus({ splits: withFigure(fig, { label_zh: '' }) }));
    expect(r.out).toContain("r1: no 'label_zh'");
    const empty = lint(corpus({ splits: { $schema_version: 1, releases: [] } }));
    expect(empty.out).toContain('vg150_splits.json: no releases');
  });
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npx vitest run tools/test/content_lint.test.mjs`
Expected: the seven new or changed tests FAIL (rule 12 does not exist; rule 9 still demands `image_id`), and 14 pass.

- [ ] **Step 5: Amend rule 9**

In `tools/content_lint.mjs`, inside `for (const c of PLAYGROUND_GOLDEN.cases)`, replace

```js
  for (const key of ['kp', 'image_id', 'knobs', 'expect']) {
    if (!c[key]) problems.push(`${c.id}: missing '${key}'`);
  }
```

with

```js
  for (const key of ['kp', 'knobs', 'expect']) {
    if (!c[key]) problems.push(`${c.id}: missing '${key}'`);
  }
  // A case pins a frame's arithmetic or a slice's, a model's or the sources'. F1, F2, F6 and F8
  // read a frame; F7's model and X1's cited figures have none, and demanding an `image_id` of
  // them would have meant inventing one (spec 2026-09-26 §6).
  if (c.scope !== undefined && !SCOPES.has(c.scope)) {
    problems.push(`${c.id}: scope '${c.scope}' is not one of ${[...SCOPES].join(', ')}`);
  }
  if (Boolean(c.image_id) === (c.scope !== undefined)) {
    problems.push(`${c.id}: carries ${c.image_id ? 'both image_id and a scope' : 'neither image_id nor a scope'}`);
  }
```

and above the loop:

```js
const SCOPES = new Set(['slice', 'model', 'sources']);
```

- [ ] **Step 6: Add rule 12**

Before `// ---- report`, add:

```js
// ---- X1's release figures, rule 12 ----------------------------------------
// Every figure X1 displays is a transcription, never a recollection: it names where it was read
// and carries the sentence, and a count's digits must be among that sentence's digits, which
// catches `68583` typed for "68 538" without anyone re-reading the card. A null is a figure the
// source does not state, and it still carries the passage that does not state it.
const SPLITS_FILE = '../data/content/vg150_splits.json';
const SPLITS = existsSync(SPLITS_FILE) ? JSON.parse(readFileSync(SPLITS_FILE, 'utf-8')) : null;
const digitsOf = (x) => String(x).replace(/\D/g, '');
let releaseFigures = 0;
function citedFigure(where, f) {
  releaseFigures += 1;
  for (const key of ['source', 'url', 'locator', 'quote']) {
    if (typeof f?.[key] !== 'string' || f[key].trim() === '') {
      problems.push(`${where}: no '${key}'. X1 shows where every figure was read (NFR-2).`);
    }
  }
  if (typeof f?.value === 'number' && !digitsOf(f.quote ?? '').includes(digitsOf(f.value))) {
    problems.push(`${where}: value ${f.value} does not appear in its quote. A figure is copied, not recalled.`);
  }
  if (f?.measured !== undefined && f.measured.rows !== f.value) {
    problems.push(`${where}: measured ${f.measured.rows} rows but carries ${f.value}`);
  }
}
if (!SPLITS) {
  problems.push('vg150_splits.json: missing. X1 reads every figure it shows from it.');
} else {
  if (SPLITS.$schema_version !== 1) problems.push('vg150_splits.json: unknown schema version');
  if (!Array.isArray(SPLITS.releases) || SPLITS.releases.length === 0) {
    problems.push('vg150_splits.json: no releases');
  }
  for (const r of SPLITS.releases ?? []) {
    for (const key of ['label_en', 'label_zh']) {
      if (typeof r[key] !== 'string' || r[key].trim() === '') problems.push(`${r.id}: no '${key}'`);
    }
    for (const [name, f] of Object.entries(r.figures ?? {})) citedFigure(`${r.id}.${name}`, f);
    for (const [i, n] of (r.notes ?? []).entries()) {
      const where = `${r.id}.notes[${i}]`;
      citedFigure(where, n);
      if (typeof n.value !== 'number') problems.push(`${where}: a note needs a numeric value`);
      for (const key of ['text_en', 'text_zh']) {
        if (typeof n[key] !== 'string' || n[key].trim() === '') problems.push(`${where}: no '${key}'`);
      }
    }
  }
}
```

In the success line, after `${PLAYGROUND_GOLDEN.cases.length} playground cases, `, insert `${releaseFigures} release figures, `.

- [ ] **Step 7: Run the tests, then the real corpus**

Run: `npx vitest run tools/test/content_lint.test.mjs`
Expected: 25 passed.

Run: `npm run lint:content`
Expected: `content lint: 13 golden cases, 9 playground cases, 25 release figures, 7 licence rows, …, clean`. (25 = 6 for Xu, 5 for the canonical protocol, 5 + 2 notes for v1, 5 + 2 notes for v2.)

- [ ] **Step 8: Watch each new rule fail on the real file**

For each of the following, edit `../data/content/vg150_splits.json`, run `npm run lint:content`, read the named message in the output, then `git checkout ../data/content/vg150_splits.json`:

| Break | Message to find |
|---|---|
| `sgb-v2.train.value` → `68583` | `sgb-v2.train: value 68583 does not appear in its quote` |
| delete `canonical.test.locator` | `canonical.test: no 'locator'` |
| `sgb-v2.val.measured.rows` → `4844` | `sgb-v2.val: measured 4844 rows but carries 5000` |

Confirm `npm run lint:content` is clean again afterwards.

- [ ] **Step 9: Commit**

```bash
npm run ci
git add tools/content_lint.mjs tools/test/content_lint.test.mjs
git commit -m "feat(sgs): lint rule 12 cites every X1 figure; rule 9 admits a scope in place of a frame"
```

---

## Task 3: The corrections X1 is built on

Content only. Every sentence below is checked against the quotations in spec §2 before it is written.

**Files:**
- Modify: `web/knowledge-map/kp-data.js:115`, `web/knowledge-map/pg.js` (the `MATH` entry `X1`, the `ZH` table, and the `pg({id:'X1'…})` block), `web/knowledge-map/FROZEN.md`
- Regenerate: `../data/content/kp.json`, `../data/content/math.json`
- Modify: `frontend/src/content/m01.en.mdx`, `frontend/src/content/m01.zh-TW.mdx` (step s4: frontmatter notes and body)
- Modify: `../docs/superpowers/specs/2026-09-15-scene-graph-studio-decisions.md` (end of D-09), `…-SRS.md:214`, `…-design.md:96`
- Modify: `backend/app/datasets/adapters/vg150_sgb.py:1-5`

- [ ] **Step 1: List every statement of the premise**

```bash
grep -rnE "three incompatible|incompatible splits|share a name and not a test set|three distinct|three different splits|三組不同|不共用|三個不同的切分|enforced by lint|以 lint 而非" ../system/frontend/src/content ../system/web ../system/backend/app ../docs/superpowers/specs/2026-09-15-*.md --include=*.mdx --include=*.js --include=*.py --include=*.md --include=*.html
```

Expected hits, and only these (M10's "three distinct roles" is unrelated and stays): `m01.en.mdx` (s4 notes, math, body), `m01.zh-TW.mdx` (same), `kp-data.js:115`, `pg.js` MATH `X1` and the X1 notes, `vg150_sgb.py:3`, `SRS.md:214`, `design.md:96`. If another hit appears, correct it by the same rule or record it in D93 as out of scope with the reason.

- [ ] **Step 2: Correct the frozen page**

`kp-data.js:115` becomes:

```js
    ['X1','VG150 names several releases','VG150 指涉數個發布版本','choose a release · compare it with another · watch the images move between splits','live'],
```

The `MATH` entry for `X1` in `pg.js` becomes:

```js
X1:"\\[ \\texttt{VG150}\\ \\mapsto\\ \\text{releases } r,\\ \\text{each with its own }(\\mathcal{D}_{\\text{train}},\\mathcal{D}_{\\text{val}},\\mathcal{D}_{\\text{test}})_r\\ \\Longrightarrow\\ \\text{a number is comparable only when its } r \\text{ is named} \\]",
```

In the `ZH` table of `pg.js`, add beside `'Xu et al.':'Xu 等人',`:

```js
  'not stated':'來源未載明',
```

Replace the `pg({id:'X1', …})` block (from `/* X1 — the three VG150 splits */` to its closing `}});`) with:

```js
/* X1 — the VG150 releases */
pg({id:'X1',en:'VG150 names several releases',zh:'VG150 指涉數個發布版本',
 ctrls:[{t:'knob',k:'sp',label:'which VG150?',val:'xu',
   opts:[['xu','Xu et al.'],['tang','Tang'],['bench','SGG-Bench']]}],
 note_en:'Several releases circulate under one name. They differ in how the validation set is carved and in which images are filtered, and one published SGG-Benchmark release drew its validation set from the test pool. Xu et al. (2017, §4) state a 70/30 split of 108,077 images and no counts. The Tang and SGG-Bench figures are read from the vg150-sgb dataset card: images with at least one relation, and the current release as published. This is why the app shows per-paper tables with a non-comparability banner and never one merged leaderboard.',
 note_zh:'數個發布版本共用同一名稱，彼此於驗證集之切取方式與影像篩選規則上有所不同，且 SGG-Benchmark 曾有一個已發布版本自測試集抽取驗證集。Xu 等人（2017，§4）載明 108,077 張影像依 70／30 比例切分，未列張數。Tang 與 SGG-Bench 之數值取自 vg150-sgb 資料卡：前者為至少含一條關係之影像數，後者為現行發布版本之數值。這正是本應用程式只呈現逐論文的表格並加上「不可比較」橫幅、而絕不合併成單一排行榜的原因。',
 draw:function(s){
   var d={xu:{tr:null,te:null,v:null,src:'Xu et al. 2017, §4: 70% / 30% of 108,077 images, no counts'},
          tang:{tr:57723,te:26446,v:5000,src:'vg150-sgb card: the canonical protocol, images with at least one relation'},
          bench:{tr:68538,te:31876,v:5000,src:'vg150-sgb card: the current release, as published'}}[s.sp];
   function row(k,n,c){return {k:k,v:n?n/76000:0,l:n?n.toLocaleString():uiT('not stated'),c:c}}
   var items=[row('train',d.tr,'var(--accent)'),row('val',d.v,'var(--m-loc)'),row('test',d.te,'var(--muted)')];
   return {vis:bars(items,1,''),out:[
     {k:'train images',v:d.tr?d.tr.toLocaleString():uiT('not stated')},
     {k:'test images',v:d.te?d.te.toLocaleString():uiT('not stated')},
     {k:'source',v:'<span style="font-size:12px">'+d.src+'</span>'}]};
 }});
```

The removed sentence carried four figures (65.3, 64.6, 31.0, 25.1) that no table in this corpus verifies in that role; the correction removes rather than repairs them.

- [ ] **Step 3: Record the correction in `FROZEN.md`**

Append under `## Corrections after the freeze`:

```markdown
### 2026-09-26 — X1's premise, its figures, and its statement

Opened for the M1 playgrounds (`docs/superpowers/specs/2026-09-26-playgrounds-m1-design.md` §2).

**1 · The premise.** The page said three incompatible splits share the name and, in the harvested
statement, "three distinct (D_train, D_val, D_test)". The sources opened do not support that as
worded: the `vg150-sgb` card states that its current release's test is "the full, untouched test
pool" and that its relation-bearing counts match the canonical protocol exactly. What they support
is that releases differ in the validation carve-out and in filtering, and that one published
release drew its validation set from the test pool. Title, knobs and statement are corrected.

**2 · The figures.** "SGG-Bench" 73,538 / 27,032 / 4,844 were the withdrawn v1 release, labelled as
current; they are now the card's current figures, 68,538 / 31,876 / 5,000. "Xu et al." 75,651 /
32,422 are not in Xu et al. 2017, which states 70% / 30% of 108,077 images and no counts; the row
now says so. "Tang" 57,723 / 26,446 / 5,000 stand, attributed to the card that states them.

**3 · The note's four figures** (65.3, 64.6, 31.0, 25.1) are removed. No table in this corpus
verifies them in the role the note gave them.

No option, control or knowledge point was added. One UI string, `not stated`, entered the `ZH` table.
```

- [ ] **Step 4: Harvest and check the frozen page**

```bash
npm run harvest
npm run lint:frozen
npx vitest run tools/test/harvest.test.mjs
git diff --stat ../data/content/
```

Expected: `lint:frozen` exits 0; the harvest test passes (93 points, 27 live, 26 formulas); the diff touches `kp.json` and `math.json` only, each on X1. If `audit.js` names a new X1 string as untranslated, add its `ZH` entry in formal written Chinese rather than a `KEEP` entry, and list it in the `FROZEN.md` entry.

- [ ] **Step 5: Correct M1 s4, both locales**

In `frontend/src/content/m01.en.mdx`, the s4 `presenter_notes_en` becomes:

```yaml
    presenter_notes_en: "Three minutes, and it is a naming convention rather than a result, so keep it short. The point is that several releases share the name VG150, differing in how the validation set is carved and in which images are filtered, and that one release briefly drew its validation images from the test pool; a table that mixes them is not a comparison. Say plainly that this project writes vg150-sgb as its dataset identifier and that the schema refuses the bare form. If asked which release is better, the answer is that the course does not rank them and only requires that a paper say which one it used."
```

and the body of `<Step id="s4">` becomes:

```mdx
## `VG150` names several releases, not one

$$
\texttt{VG150}\ \mapsto\ \text{releases } r,\ \text{each with its own }(\mathcal{D}_{\text{train}},\mathcal{D}_{\text{val}},\mathcal{D}_{\text{test}})_r\ \Longrightarrow\ \text{a number is comparable only when its } r \text{ is named}
$$

The 150-object, 50-predicate subset of Visual Genome comes from Xu et al. (2017), who state a
70/30 split of the images and mention no validation set. Later releases carved a validation set
out of the training images, kept or dropped the images that carry no relation, and in one
published version drew the validation set from the test pool. They share a name, and the numbers
they produce differ for reasons unrelated to any model. A figure beside another in a table is a
comparison only when both papers say which release they used.

This project names its own: the dataset identifier is `vg150-sgb`, the corrected release of
Neau et al.'s SGG-Benchmark. Decision D-09 forbids `vg150` as a dataset identifier, and the
schema refuses it; prose uses VG150 only for the published benchmark's name.
```

In `frontend/src/content/m01.zh-TW.mdx`, the s4 `presenter_notes_zh` becomes:

```yaml
    presenter_notes_zh: "三分鐘。此頁為命名慣例而非理論，宜快。要點在於數個發布版本共用 VG150 一名，彼此於驗證集之切取方式與影像篩選規則上有所不同，且其中一個版本曾自測試集抽取驗證影像；混用各版本之表格並不構成比較。請明確說明本專案以 vg150-sgb 作為資料集識別碼，且資料結構描述拒絕簡寫形式。若現場詢問何者較佳，答為本課程不作此判斷，只要求論文指明所用者。"
```

and the body of `<Step id="s4">` becomes:

```mdx
## `VG150` 指涉數個發布版本

$$
\texttt{VG150}\ \mapsto\ \text{releases } r,\ \text{each with its own }(\mathcal{D}_{\text{train}},\mathcal{D}_{\text{val}},\mathcal{D}_{\text{test}})_r\ \Longrightarrow\ \text{a number is comparable only when its } r \text{ is named}
$$

Visual Genome 的 150 物件類別、50 predicate 子集源自 Xu 等人（2017）；原論文載明影像以 70／30 比例分為訓練與測試，未提及驗證集。其後的發布版本自訓練影像另切驗證集，對不含任何關係的影像或保留或剔除，其中一個已發布版本更曾自測試集抽取驗證集。各版本共用同一名稱，所得數值之差異與模型無關。兩篇論文之數值並列於同一表格，唯有雙方皆載明所採用之發布版本，方構成比較。

本專案明確命名所採用之版本：資料集識別碼為 `vg150-sgb`，即 Neau 等人 SGG-Benchmark 之修正後發布版本。決策 D-09 禁止以 `vg150` 作為資料集識別碼，並由資料結構描述（schema）拒絕之；正文僅於指稱既有基準名稱時使用 VG150。
```

- [ ] **Step 6: Annotate the three specification documents and the adapter**

At the end of the D-09 section in `…-decisions.md` (after the paragraph ending "…having named our own."), add:

```markdown
**Annotated 2026-09-26 (D93).** The corpus this project holds is not `VG-SGG.h5`. It is the
COCO-format parquet release `maelic/VG150-coco-format` of Neau et al.'s SGG-Benchmark, in its
corrected version: the val parquet has 5,000 rows, and the card records that an earlier version
drew its validation images from the test pool. `MANIFEST.json` carries per-image hashes, the seed
and the distribution mode, and has never carried a source-file hash. The letters `sgb` fit both
`Scene-Graph-Benchmark.pytorch`, which this decision names, and `SGG-Benchmark`, which the corpus
is; the identifier denotes the second. SRS §10's "three incompatible splits" is not supported by
the sources opened on 2026-09-26 (`specs/2026-09-26-playgrounds-m1-design.md` §2). The decision
itself, one named split and no bare identifier, stands.
```

`…-SRS.md:214` becomes:

```markdown
1. "VG150" names three incompatible splits. *(Annotated 2026-09-26: not supported as worded. The releases differ in the validation carve-out and in filtering, and one published release drew its validation set from the test pool; see `specs/2026-09-26-playgrounds-m1-design.md` §2 and D93.)*
```

`…-design.md:96` gains, at the end of the line:

```markdown
 *(Annotated 2026-09-26: the Xu figures are not in Xu et al. 2017, which states 70/30 of 108,077; the SGG-Benchmark figures are its withdrawn v1 release. See `specs/2026-09-26-playgrounds-m1-design.md` §2 and D93.)*
```

In `backend/app/datasets/adapters/vg150_sgb.py`, lines 1–5 become:

```python
"""VG150, as maelic publishes it: COCO-format parquet, images embedded.

The split is `vg150-sgb` and never bare `vg150` (D-09): several releases answer to the short
name, and this is the corrected release of Neau et al.'s SGG-Benchmark (`maelic/VG150-coco-format`).
150 object categories, 50 predicates.
"""
```

- [ ] **Step 7: Run the gate and commit**

```bash
npm run ci
git add web/knowledge-map ../data/content/kp.json ../data/content/math.json frontend/src/content/m01.en.mdx frontend/src/content/m01.zh-TW.mdx ../docs/superpowers/specs backend/app/datasets/adapters/vg150_sgb.py
git commit -m "fix(sgs): VG150 names several releases, not three splits without a shared test set"
```

Expected: `npm run ci` exits 0; `npm run build:standalone` is not needed (the brief is not touched; `lint:standalone` confirms).

---

## Task 4: Loaders and arithmetic

**Files:**
- Modify: `frontend/src/playgrounds/slice.ts`, `frontend/src/playgrounds/logic.ts`
- Create: `frontend/src/playgrounds/splits.ts`
- Test: `frontend/src/playgrounds/test/slice.test.ts`, `frontend/src/playgrounds/test/logic.test.ts`, `frontend/src/playgrounds/test/splits.test.ts`

**Interfaces:**
- Produces, in `slice.ts`: `VG_FRAMES: SceneGraph[]` (80), `vgFrameById(id: string): SceneGraph | undefined`.
- Produces, in `splits.ts`: `type Split = 'train' | 'val' | 'test'`; `interface Figure { value: number | string | null; source: string; url: string; locator: string; quote: string; measured?: {...} }`; `interface Note extends Figure { value: number; text_en: string; text_zh: string }`; `interface Release { id; label_en; label_zh; figures: Partial<Record<Split | 'pool' | 'val_from' | 'zero_relation', Figure>>; notes: Note[] }`; `RELEASES: Release[]`; `releaseById(id: string): Release | undefined`.
- Produces, in `logic.ts`: `mergeMap(groups: readonly (readonly string[])[]): Map<string, string>`; `canonical(label: string, merge: Map<string, string>): string`; `classCounts(labels: Iterable<string>, merge: Map<string, string>): Map<string, number>`; `predicateLabels(frames: SceneGraph[]): string[]`; `objectLabels(frames: SceneGraph[]): string[]`; `isInMergedE(graph: SceneGraph, t: Triplet, merge: Map<string, string>): boolean`; `harmonic(m: number, s: number): number`; `headShare(k: number, C: number, s: number): number`; `tailToHead(C: number, s: number): number`; `interface RankedClass { label: string; count: number }`; `ranked(labels: Iterable<string>): RankedClass[]`; `measuredHeadShare(rank: RankedClass[], k: number): number`; `splitDifference(a: Release, b: Release, split: Split): number | null`; `explain(difference: number, releases: Release[]): Note | undefined`; `valDisjointFromTest(r: Release): boolean | null`.

- [ ] **Step 1: Write the failing tests for the loaders**

Append to `frontend/src/playgrounds/test/slice.test.ts` (and add `VG_FRAMES, vgFrameById` to its import):

```ts
describe('the vg150-sgb slice, imported at build time', () => {
  it('carries the 80 committed frames and their 892 annotated edges', () => {
    expect(VG_FRAMES).toHaveLength(80);
    expect(VG_FRAMES.reduce((n, f) => n + f.relationships.length, 0)).toBe(892);
  });

  it('finds a frame by id and says nothing rather than guessing', () => {
    expect(vgFrameById('228')?.relationships.length).toBeGreaterThan(0);
    expect(vgFrameById('no-such-frame')).toBeUndefined();
  });
});
```

Create `frontend/src/playgrounds/test/splits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RELEASES, releaseById } from '../splits';

describe('the release figures X1 reads', () => {
  it('carries the four releases in the order X1 offers them', () => {
    expect(RELEASES.map((r) => r.id)).toEqual(['xu-2017', 'canonical', 'sgb-v1', 'sgb-v2']);
  });

  it('finds a release by id and says nothing rather than guessing', () => {
    expect(releaseById('sgb-v2')?.figures.train?.value).toBe(68538);
    expect(releaseById('vg150')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write the failing tests for the arithmetic**

Append to `frontend/src/playgrounds/test/logic.test.ts` (extend its imports from `../logic` with the new names, import `type Release` from `../splits` and `type SceneGraph` from `sgg-metrics`; `ph001` is already defined at the top of the file):

```ts
// A frame with chosen edges, built from a real one so every required field is present and
// nothing is cast: the construction the reversed-triplet test above already uses. `tsc -b`
// type-checks this file, since `tsconfig.app.json` includes all of `src`.
const graph = (rels: [number, string, number][]): SceneGraph => ({
  ...ph001,
  relationships: rels.map(([subject_id, predicate, object_id], relationship_id) => ({
    ...ph001.relationships[0]!,
    relationship_id,
    subject_id,
    predicate,
    object_id,
  })),
});

describe('F6: merging classes', () => {
  it('maps every member of a group to its first member, and nothing else', () => {
    const m = mergeMap([['on', 'above', 'over']]);
    expect(canonical('above', m)).toBe('on');
    expect(canonical('on', m)).toBe('on');
    expect(canonical('near', m)).toBe('near');
  });

  it('counts classes before and after a merge', () => {
    const labels = ['on', 'above', 'on', 'near', 'over'];
    expect(classCounts(labels, new Map()).size).toBe(4);
    const merged = classCounts(labels, mergeMap([['on', 'above', 'over']]));
    expect(merged.size).toBe(2);
    expect(merged.get('on')).toBe(4);
  });

  it('a group member absent from the vocabulary adds no class', () => {
    expect(classCounts(['on', 'near'], mergeMap([['on', 'sitting on']])).size).toBe(2);
  });

  it('merged membership: absent before, present after, and direction still counts', () => {
    const g = graph([[1, 'sitting on', 2]]);
    const t = { subject_id: 1, predicate: 'on', object_id: 2 };
    expect(isInMergedE(g, t, new Map())).toBe(false);
    expect(isInMergedE(g, t, mergeMap([['on', 'sitting on']]))).toBe(true);
    expect(isInMergedE(g, { ...t, subject_id: 2, object_id: 1 }, mergeMap([['on', 'sitting on']]))).toBe(false);
  });
});

describe('F7: the shape of a Zipf distribution', () => {
  it('H_4 at s = 1 is 25/12', () => {
    expect(harmonic(4, 1)).toBeCloseTo(25 / 12, 12);
  });

  it('the head share is k/C exactly when s = 0', () => {
    expect(headShare(3, 36, 0)).toBeCloseTo(3 / 36, 12);
  });

  it('one class of four at s = 1 holds 12/25', () => {
    expect(headShare(1, 4, 1)).toBeCloseTo(12 / 25, 12);
    expect(tailToHead(4, 1)).toBeCloseTo(0.25, 12);
  });

  it('clamps k into [1, C] and rounds C, so the share stays in (0, 1]', () => {
    expect(headShare(0, 4, 0)).toBeCloseTo(1 / 4, 12);
    expect(headShare(9, 4, 1)).toBe(1);
    expect(headShare(2, 3.6, 0)).toBeCloseTo(2 / 4, 12);
    expect(Number.isNaN(headShare(Number.NaN, 4, 1))).toBe(false);
  });

  it('ranks by count, ties by label, and measures the head share of the ranking', () => {
    const rank = ranked(['b', 'a', 'a', 'c', 'b', 'a']);
    expect(rank).toEqual([
      { label: 'a', count: 3 }, { label: 'b', count: 2 }, { label: 'c', count: 1 },
    ]);
    expect(measuredHeadShare(rank, 2)).toBeCloseTo(5 / 6, 12);
    expect(measuredHeadShare([], 2)).toBe(0);
  });
});

const release = (id: string, train: number | string | null, notes: { value: number; text_en: string }[] = []): Release => {
  const cite = { source: 's', url: 'u', locator: 'l', quote: 'q' };
  return {
    id, label_en: id, label_zh: id,
    figures: { train: { value: train, ...cite }, val_from: { value: id === 'leaky' ? 'test' : 'trainval', ...cite } },
    notes: notes.map((n) => ({ ...cite, text_zh: n.text_en, ...n })),
  };
};

describe('X1: differences between releases', () => {
  it('subtracts only two stated counts', () => {
    expect(splitDifference(release('a', 68538), release('b', 57723), 'train')).toBe(10815);
    expect(splitDifference(release('xu', '70%'), release('b', 57723), 'train')).toBeNull();
    expect(splitDifference(release('xu', null), release('b', 57723), 'train')).toBeNull();
  });

  it('finds the note a difference equals, in either direction', () => {
    const a = release('a', 68538, [{ value: 10815, text_en: 'kept' }]);
    const b = release('b', 57723);
    expect(explain(10815, [a, b])?.text_en).toBe('kept');
    expect(explain(-10815, [b, a])?.text_en).toBe('kept');
    expect(explain(586, [a, b])).toBeUndefined();
  });

  it('a zero difference claims no explanation, even when a note has value zero', () => {
    const a = release('a', 5000, [{ value: 0, text_en: 'zero' }]);
    expect(explain(0, [a, a])).toBeUndefined();
  });

  it('val is disjoint from test when drawn from the train/val pool, not when drawn from test', () => {
    expect(valDisjointFromTest(release('a', 1))).toBe(true);
    expect(valDisjointFromTest(release('leaky', 1))).toBe(false);
    const unstated = release('x', 1);
    unstated.figures.val_from = { value: null, source: 's', url: 'u', locator: 'l', quote: 'q' };
    expect(valDisjointFromTest(unstated)).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run frontend/src/playgrounds/test`
Expected: FAIL on missing exports (`VG_FRAMES`, `../splits`, `mergeMap`, …).

- [ ] **Step 4: Implement the loaders**

Append to `frontend/src/playgrounds/slice.ts`:

```ts
import vgRaw from '../../../../data/slices/vg150-sgb/annotations.json';

const vgParsed = vgRaw as unknown as { dataset: string; graphs: SceneGraph[] };

/**
 * The committed `vg150-sgb` slice: 80 frames of annotation, and no images.
 *
 * F6 and F7 count over a real vocabulary, and the placeholder's 16 predicates are this project's
 * own and carry no synonyms. The images of this slice are not committed (D-08) and neither
 * playground draws one, so both still compute with no backend, network or corpus. 583 KB raw,
 * 34 KB gzipped.
 */
export const VG_FRAMES: SceneGraph[] = vgParsed.graphs;

export function vgFrameById(imageId: string): SceneGraph | undefined {
  return VG_FRAMES.find((frame) => frame.image_id === imageId);
}
```

(Move the new `import` line to the top of the file beside the existing one.)

Create `frontend/src/playgrounds/splits.ts`:

```ts
import raw from '../../../../data/content/vg150_splits.json';

/**
 * X1's figures: the one place they come from.
 *
 * Every figure is a transcription, carrying the passage it was copied from, and
 * `content_lint.mjs` rule 12 refuses one that does not. A `null` value is a figure the source
 * does not state, which X1 says in words rather than estimating.
 */
export type Split = 'train' | 'val' | 'test';

export interface Figure {
  value: number | string | null;
  source: string;
  url: string;
  locator: string;
  quote: string;
  measured?: { command: string; sha256: string; rows: number; date: string };
}

export interface Note extends Figure {
  value: number;
  text_en: string;
  text_zh: string;
}

export interface Release {
  id: string;
  label_en: string;
  label_zh: string;
  figures: Partial<Record<Split | 'pool' | 'val_from' | 'zero_relation', Figure>>;
  notes: Note[];
}

export const RELEASES: Release[] = (raw as unknown as { releases: Release[] }).releases;

export function releaseById(id: string): Release | undefined {
  return RELEASES.find((r) => r.id === id);
}
```

- [ ] **Step 5: Implement the arithmetic**

Append to `frontend/src/playgrounds/logic.ts` (and add `import type { Note, Release, Split } from './splits';` at the top):

```ts
// ---- F6: merging classes ------------------------------------------------------------------

/**
 * Each member of each group mapped to the group's first member.
 *
 * F6's checkboxes build this. A label in no group maps to itself through `canonical`, so an
 * empty map is the vocabulary exactly as annotated.
 */
export function mergeMap(groups: readonly (readonly string[])[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const group of groups) {
    const head = group[0];
    if (head === undefined) continue;
    for (const member of group) out.set(member, head);
  }
  return out;
}

export function canonical(label: string, merge: Map<string, string>): string {
  return merge.get(label) ?? label;
}

/** How often each class occurs once the merge is applied. `.size` is the class count. */
export function classCounts(labels: Iterable<string>, merge: Map<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const label of labels) {
    const c = canonical(label, merge);
    out.set(c, (out.get(c) ?? 0) + 1);
  }
  return out;
}

export function predicateLabels(frames: SceneGraph[]): string[] {
  return frames.flatMap((f) => f.relationships.map((r) => r.predicate));
}

/** The first name of every object. Every object in the committed slices carries exactly one. */
export function objectLabels(frames: SceneGraph[]): string[] {
  return frames.flatMap((f) => f.objects.flatMap((o) => (o.names[0] === undefined ? [] : [o.names[0]])));
}

/**
 * Whether the triplet is one the annotator wrote, once synonyms are merged.
 *
 * Keyed on the two object ids and the predicate's class, as `isInE` is keyed on the ids and the
 * predicate itself; with an empty merge the two agree. F6 reports it in F8's words, recorded in
 * E′, never correct. Direction is kept: merging synonyms does not make a relation symmetric.
 */
export function isInMergedE(graph: SceneGraph, t: Triplet, merge: Map<string, string>): boolean {
  const p = canonical(t.predicate, merge);
  return graph.relationships.some(
    (r) => r.subject_id === t.subject_id && r.object_id === t.object_id && canonical(r.predicate, merge) === p,
  );
}

// ---- F7: the shape of the tail --------------------------------------------------------------

/** H_m^(s) = Σ_{p=1}^{m} p^(−s), the generalized harmonic number M1's s3 uses. */
export function harmonic(m: number, s: number): number {
  let sum = 0;
  for (let p = 1; p <= m; p += 1) sum += p ** -s;
  return sum;
}

function classCount(C: number): number {
  return Number.isFinite(C) ? Math.max(1, Math.round(C)) : 1;
}

/**
 * The share of all triplets held by the k most frequent of C classes when n_p ∝ p^(−s).
 *
 * H_k^(s) / H_C^(s): a ratio of two counts and nothing else. F7 shows how the data is shaped;
 * what a model's recall does on that shape is L3's to score.
 */
export function headShare(k: number, C: number, s: number): number {
  const classes = classCount(C);
  const head = Number.isFinite(k) ? Math.min(Math.max(1, Math.round(k)), classes) : 1;
  return harmonic(head, s) / harmonic(classes, s);
}

/** n_C / n_1 = C^(−s): the rarest class as a fraction of the most frequent. */
export function tailToHead(C: number, s: number): number {
  return classCount(C) ** -s;
}

export interface RankedClass {
  label: string;
  count: number;
}

/** Classes by count, most frequent first, ties broken by label so the order never depends on input order. */
export function ranked(labels: Iterable<string>): RankedClass[] {
  return [...classCounts(labels, new Map())]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

/** The share of all counted triplets held by the first k classes of a ranking. */
export function measuredHeadShare(rank: RankedClass[], k: number): number {
  const total = rank.reduce((n, c) => n + c.count, 0);
  if (total === 0) return 0;
  const head = Number.isFinite(k) ? Math.min(Math.max(0, Math.round(k)), rank.length) : 0;
  return rank.slice(0, head).reduce((n, c) => n + c.count, 0) / total;
}

// ---- X1: releases compared ------------------------------------------------------------------

/** a − b for one split, only when both releases state it as a count. A share is not a count. */
export function splitDifference(a: Release, b: Release, split: Split): number | null {
  const x = a.figures[split]?.value;
  const y = b.figures[split]?.value;
  return typeof x === 'number' && typeof y === 'number' ? x - y : null;
}

/**
 * The note of the sources a difference equals, if either release carries one.
 *
 * Matched on magnitude, so a − b and b − a find the same note. The equality is computed here; the
 * sentence is the source's. A zero difference has nothing to explain and claims nothing.
 */
export function explain(difference: number, releases: Release[]): Note | undefined {
  const magnitude = Math.abs(difference);
  if (magnitude === 0) return undefined;
  for (const r of releases) {
    const hit = r.notes.find((n) => n.value === magnitude);
    if (hit) return hit;
  }
  return undefined;
}

/** Yes when val comes from the train/val pool, no when from the test pool, null when unstated. */
export function valDisjointFromTest(r: Release): boolean | null {
  const from = r.figures.val_from?.value;
  if (from === 'trainval') return true;
  if (from === 'test') return false;
  return null;
}
```

Also update the module comment at the top of `logic.ts`: replace "The arithmetic every M0 playground displays" with "The arithmetic every playground displays", and "quantities M0's own definitions contain" with "quantities their modules' own definitions contain".

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run frontend/src/playgrounds/test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run ci
git add frontend/src/playgrounds
git commit -m "feat(sgs): the arithmetic M1's playgrounds display, and the two loaders"
```

---

## Task 5: F6, Predicate synonymy has no hierarchy

**Files:**
- Create: `frontend/src/playgrounds/F6/groups.ts`, `frontend/src/playgrounds/F6/PredicateSynonymy.tsx`, `frontend/src/playgrounds/F6/test/PredicateSynonymy.test.tsx`
- Modify: `frontend/src/playgrounds/mounts.tsx`, `frontend/src/playgrounds/test/Playground.test.tsx`, `frontend/src/i18n/en.json`, `frontend/src/i18n/zh-TW.json`, `../data/content/playground_golden.json`, `frontend/src/playgrounds/test/golden.test.ts`

**Interfaces:**
- Consumes: `VG_FRAMES`, `vgFrameById` (Task 4); `mergeMap`, `classCounts`, `predicateLabels`, `objectLabels`, `isInMergedE`, `isInE`, `flag` (logic.ts).
- Produces: `PREDICATE_GROUP`, `OBJECT_GROUP`, `VG150_PREDICATES` (groups.ts); `PredicateSynonymy` (component). Test ids: `F6.mp`, `F6.mo`, `F6.img`, `F6.rel`, `F6.sub`; `readout-F6.predicates`, `readout-F6.group`, `readout-F6.objects` (each with `-value`); `f6-annotated`, `f6-sentence`, `f6-status` (`data-recorded`), `f6-empty`.

- [ ] **Step 1: Write the groups**

```ts
// frontend/src/playgrounds/F6/groups.ts

/**
 * The two merges F6 offers, as kp F6's own `knobs` field names them:
 * "merge on/above/over/sitting-on · merge man/person/people".
 *
 * Not a claim that these are synonyms. The step's point is that the vocabulary has no hierarchy,
 * so whether `above` means `on` is a decision a paper makes; these are the decisions the knowledge
 * point was specified with. The first member names the merged class.
 */
export const PREDICATE_GROUP: readonly string[] = ['on', 'above', 'over', 'sitting on'];
export const OBJECT_GROUP: readonly string[] = ['man', 'person', 'people'];

/**
 * VG-150's predicate count, as Xu et al. 2017 §4 states it: "we use the most frequent 150 object
 * categories and 50 predicates". Shown beside the slice's own count and labelled with its origin.
 */
export const VG150_PREDICATES = 50;
```

- [ ] **Step 2: Add the i18n keys**

`en.json`:

```json
  "playground.f6.merge_predicates": "Merge on / above / over / sitting on",
  "playground.f6.merge_objects": "Merge man / person / people",
  "playground.f6.predicate_classes": "Predicate classes in use",
  "playground.f6.of_vg150": "of 50 defined for VG-150 (Xu et al. 2017, §4)",
  "playground.f6.group_triplets": "Triplets in the on class",
  "playground.f6.object_classes": "Object classes in use",
  "playground.f6.unmerged": "not merged",
  "playground.f6.annotated": "Annotated",
  "playground.f6.edge": "Annotated edge",
  "playground.f6.substitute": "Substitute",
  "playground.f6.in_e_prime": "Recorded in E′",
  "playground.f6.not_in_e_prime": "Not recorded in E′",
  "playground.f6.no_group_edge": "No annotated edge in this slice carries a predicate from the merge group.",
```

`zh-TW.json`:

```json
  "playground.f6.merge_predicates": "合併 on／above／over／sitting on",
  "playground.f6.merge_objects": "合併 man／person／people",
  "playground.f6.predicate_classes": "使用中之 predicate 類別數",
  "playground.f6.of_vg150": "VG-150 定義 50 類（Xu 等人 2017，§4）",
  "playground.f6.group_triplets": "on 類別之三元組數",
  "playground.f6.object_classes": "使用中之物件類別數",
  "playground.f6.unmerged": "未合併",
  "playground.f6.annotated": "標註",
  "playground.f6.edge": "已標註之邊",
  "playground.f6.substitute": "替換為",
  "playground.f6.in_e_prime": "此邊收錄於 E′",
  "playground.f6.not_in_e_prime": "此邊未收錄於 E′",
  "playground.f6.no_group_edge": "本切片中並無帶有合併群組 predicate 之已標註邊。",
```

- [ ] **Step 3: Write the failing component tests**

```tsx
// frontend/src/playgrounds/F6/test/PredicateSynonymy.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { PredicateSynonymy } from '../PredicateSynonymy';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m01${search}`]}>
      <PredicateSynonymy />
    </MemoryRouter>,
  );
}

const value = (id: string) => screen.getByTestId(`readout-${id}-value`);

describe('F6', () => {
  it('counts the predicate classes in use, and the merge removes three of them', () => {
    at();
    expect(value('F6.predicates')).toHaveTextContent(/^36$/);
    fireEvent.click(screen.getByTestId('F6.mp'));
    expect(value('F6.predicates')).toHaveTextContent(/^33$/);
  });

  it('writes the merged class out as the sum of its members', () => {
    at('?F6.mp=1');
    expect(value('F6.group')).toHaveTextContent(/^408$/);
    expect(screen.getByTestId('readout-F6.group')).toHaveTextContent(
      'on 382 + above 11 + over 5 + sitting on 10 = 408',
    );
  });

  it('merges the three names for people, independently of the predicates', () => {
    at('?F6.mo=1');
    expect(value('F6.objects')).toHaveTextContent(/^113$/);
    expect(screen.getByTestId('readout-F6.objects')).toHaveTextContent('man 56 + person 52 + people 19 = 127');
    expect(value('F6.predicates')).toHaveTextContent(/^36$/);
  });

  it('opens on a teaching edge: not recorded without the merge, recorded in E′ with it', () => {
    at();
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'false');
    fireEvent.click(screen.getByTestId('F6.mp'));
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'true');
    expect(screen.getByTestId('f6-status')).toHaveTextContent('Recorded in E′');
  });

  it('frame 228: glass sitting on table, with on substituted', () => {
    at('?F6.img=228&F6.rel=5');
    expect(screen.getByTestId('f6-annotated')).toHaveTextContent('glass sitting on table');
    expect(screen.getByTestId('f6-sentence')).toHaveTextContent('glass on table');
    expect(screen.getByTestId('f6-status')).toHaveTextContent('Not recorded in E');
  });

  it('a substitute from the URL outside the group falls back to one inside it', () => {
    at('?F6.img=228&F6.rel=5&F6.sub=eating');
    expect(screen.getByTestId('f6-sentence')).toHaveTextContent('glass on table');
  });

  it('a substitute equal to the edge\'s own predicate is not offered', () => {
    at('?F6.img=228&F6.rel=5&F6.sub=sitting%20on');
    expect(screen.getByTestId('f6-sentence')).toHaveTextContent('glass on table');
    const options = [...screen.getByTestId('F6.sub').querySelectorAll('option')].map((o) => o.value);
    expect(options).not.toContain('sitting on');
  });

  it('a frame from the URL that does not exist falls back to the teaching frame', () => {
    at('?F6.img=no-such-frame');
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'false');
  });

  it('never says true, false, correct or wrong', () => {
    at('?F6.mp=1');
    const text = screen.getByTestId('f6-status').textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\b(true|false|correct|wrong)\b/);
  });

  it('shows no metric', () => {
    const { container } = at('?F6.mp=1');
    expect(container.textContent ?? '').not.toMatch(/\bmR\b|R@|recall/i);
  });
});
```

Run: `npx vitest run frontend/src/playgrounds/F6`
Expected: FAIL, `PredicateSynonymy` does not exist.

- [ ] **Step 4: Implement the component**

```tsx
// frontend/src/playgrounds/F6/PredicateSynonymy.tsx
import type { SceneGraph, SGRelationship } from 'sgg-metrics';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { classCounts, flag, isInE, isInMergedE, mergeMap, objectLabels, predicateLabels } from '../logic';
import { VG_FRAMES, vgFrameById } from '../slice';
import { OBJECT_GROUP, PREDICATE_GROUP } from './groups';

/**
 * F6 — Predicate 同義詞沒有階層.
 *
 * Two merges, each a checkbox, independent because the vocabulary has no hierarchy to make one
 * depend on the other. Each moves a class count and a triplet count and leaves every annotation
 * where it was. The membership panel is F8's discipline applied to a merge: a substituted
 * predicate is 「未收錄於 E」 until the merge makes it 「收錄於 E′」, and the model never moved.
 *
 * No mR. s2's inequality carries the metric consequence; this playground shows its two inputs.
 */
const NO_MERGE = new Map<string, string>();
const P_MERGE = mergeMap([PREDICATE_GROUP]);
const O_MERGE = mergeMap([OBJECT_GROUP]);
const PREDICATES = predicateLabels(VG_FRAMES);
const OBJECTS = objectLabels(VG_FRAMES);
const BASE_P = classCounts(PREDICATES, NO_MERGE);
const BASE_O = classCounts(OBJECTS, NO_MERGE);
const HEAD = PREDICATE_GROUP[0]!;

function groupEdges(frame: SceneGraph): SGRelationship[] {
  return frame.relationships.filter((r) => PREDICATE_GROUP.includes(r.predicate));
}

/**
 * The edge the step exists for: its predicate is in the group but is not the group's head, and
 * the head is not also annotated on the same pair. Chosen from the data rather than named, so
 * re-cutting the slice moves the default instead of breaking it.
 */
function teachingEdge(frame: SceneGraph): SGRelationship | undefined {
  return groupEdges(frame).find(
    (r) =>
      r.predicate !== HEAD &&
      !isInE(frame, { subject_id: r.subject_id, predicate: HEAD, object_id: r.object_id }),
  );
}

const FRAMES_WITH_GROUP = VG_FRAMES.filter((f) => groupEdges(f).length > 0);
const DEFAULT_FRAME = VG_FRAMES.find((f) => teachingEdge(f)) ?? FRAMES_WITH_GROUP[0];
const DEFAULT_EDGE = DEFAULT_FRAME && (teachingEdge(DEFAULT_FRAME) ?? groupEdges(DEFAULT_FRAME)[0]);

function sumNote(group: readonly string[], base: Map<string, number>): string {
  const parts = group.map((g) => ({ g, n: base.get(g) ?? 0 }));
  return `${parts.map(({ g, n }) => `${g} ${n}`).join(' + ')} = ${parts.reduce((s, p) => s + p.n, 0)}`;
}

function nameOf(frame: SceneGraph, id: number): string {
  return frame.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);
}

export function PredicateSynonymy() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'F6.mp': 0,
    'F6.mo': 0,
    'F6.img': DEFAULT_FRAME?.image_id ?? '',
    'F6.rel': DEFAULT_EDGE?.relationship_id ?? 0,
    'F6.sub': HEAD,
  });
  const mergeP = flag(params['F6.mp'], false);
  const mergeO = flag(params['F6.mo'], false);

  const pCounts = classCounts(PREDICATES, mergeP ? P_MERGE : NO_MERGE);
  const oCounts = classCounts(OBJECTS, mergeO ? O_MERGE : NO_MERGE);

  // A frame from the URL that does not exist, or carries no group edge, falls back to the
  // teaching frame rather than blanking the panel.
  const asked = vgFrameById(params['F6.img']);
  const frame = asked && groupEdges(asked).length > 0 ? asked : DEFAULT_FRAME;
  const edges = frame ? groupEdges(frame) : [];
  const edge = edges.find((r) => r.relationship_id === params['F6.rel']) ?? edges[0];
  const substitutes = PREDICATE_GROUP.filter((p) => p !== edge?.predicate);
  const substitute = substitutes.includes(params['F6.sub']) ? params['F6.sub'] : substitutes[0]!;

  const controls = (
    <>
      <Toggle
        id="F6.mp"
        label={t('playground.f6.merge_predicates')}
        checked={mergeP}
        onChange={(on) => setParams({ 'F6.mp': on ? 1 : 0 })}
      />
      <Toggle
        id="F6.mo"
        label={t('playground.f6.merge_objects')}
        checked={mergeO}
        onChange={(on) => setParams({ 'F6.mo': on ? 1 : 0 })}
      />
      {frame && edge && (
        <>
          <Choice
            id="F6.img"
            label={t('playground.frame')}
            value={frame.image_id}
            options={FRAMES_WITH_GROUP.map((f) => ({ value: f.image_id, label: f.image_id }))}
            onChange={(next) => {
              const f = vgFrameById(next);
              const e = f && (teachingEdge(f) ?? groupEdges(f)[0]);
              setParams({ 'F6.img': next, 'F6.rel': e?.relationship_id ?? 0, 'F6.sub': HEAD });
            }}
          />
          <Choice
            id="F6.rel"
            label={t('playground.f6.edge')}
            value={String(edge.relationship_id)}
            options={edges.map((r) => ({
              value: String(r.relationship_id),
              label: `${nameOf(frame, r.subject_id)} ${r.predicate} ${nameOf(frame, r.object_id)}`,
            }))}
            onChange={(next) => setParams({ 'F6.rel': Number(next), 'F6.sub': HEAD })}
          />
          <Choice
            id="F6.sub"
            label={t('playground.f6.substitute')}
            value={substitute}
            options={substitutes.map((p) => ({ value: p, label: p }))}
            onChange={(next) => setParams({ 'F6.sub': next })}
          />
        </>
      )}
    </>
  );

  let membership = <p data-testid="f6-empty" className="text-[1.25em] text-slate-700">{t('playground.f6.no_group_edge')}</p>;
  if (frame && edge) {
    const triplet = { subject_id: edge.subject_id, predicate: substitute, object_id: edge.object_id };
    const recorded = mergeP ? isInMergedE(frame, triplet, P_MERGE) : isInE(frame, triplet);
    const status = mergeP
      ? t(recorded ? 'playground.f6.in_e_prime' : 'playground.f6.not_in_e_prime')
      : t(recorded ? 'playground.in_e' : 'playground.not_in_e');
    membership = (
      <div className="flex flex-col gap-2">
        <p data-testid="f6-annotated" className="text-[1em] text-slate-700">
          {t('playground.f6.annotated')}:{' '}
          <span className="font-mono">
            {nameOf(frame, edge.subject_id)} {edge.predicate} {nameOf(frame, edge.object_id)}
          </span>
        </p>
        <p data-testid="f6-sentence" className="font-mono text-[1.5em] text-slate-900">
          {nameOf(frame, edge.subject_id)} {substitute} {nameOf(frame, edge.object_id)}
        </p>
        <p
          data-testid="f6-status"
          data-recorded={String(recorded)}
          className={recorded ? 'text-[1.25em] text-emerald-900' : 'text-[1.25em] text-slate-700'}
        >
          {status}
        </p>
      </div>
    );
  }

  return (
    <PlaygroundFrame title="F6" controls={controls}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Readout
            id="F6.predicates"
            label={t('playground.f6.predicate_classes')}
            value={String(pCounts.size)}
            note={t('playground.f6.of_vg150')}
          />
          <Readout
            id="F6.group"
            label={t('playground.f6.group_triplets')}
            value={String(pCounts.get(HEAD) ?? 0)}
            note={mergeP ? sumNote(PREDICATE_GROUP, BASE_P) : `${HEAD} ${BASE_P.get(HEAD) ?? 0}`}
          />
          <Readout
            id="F6.objects"
            label={t('playground.f6.object_classes')}
            value={String(oCounts.size)}
            note={mergeO ? sumNote(OBJECT_GROUP, BASE_O) : t('playground.f6.unmerged')}
          />
        </div>
        {membership}
      </div>
    </PlaygroundFrame>
  );
}
```

- [ ] **Step 5: Register it**

In `frontend/src/playgrounds/mounts.tsx`, import `PredicateSynonymy` from `./F6/PredicateSynonymy` and add `F6: PredicateSynonymy,` between `F2` and `F8`. In `frontend/src/playgrounds/test/Playground.test.tsx`, rename the test to `'registers exactly the playgrounds M0 and M1 mount'` and change the expectation to `['F1', 'F2', 'F6', 'F8']`.

Run: `npx vitest run frontend/src/playgrounds`
Expected: PASS.

- [ ] **Step 6: Add F6's golden cases and their dispatch**

Append to `cases` in `../data/content/playground_golden.json`:

```json
    {
      "id": "pg-F6-slice-predicates-merged",
      "kp": "F6",
      "scope": "slice",
      "knobs": { "group": "predicates", "merged": true },
      "expect": { "classes": 33, "group_count": 408 },
      "why": "The 80 frames carry 36 predicates. Merging on, above, over and sitting on turns four classes into one: 36 - 4 + 1 = 33. Their triplets add: 382 + 11 + 5 + 10 = 408."
    },
    {
      "id": "pg-F6-slice-predicates-unmerged",
      "kp": "F6",
      "scope": "slice",
      "knobs": { "group": "predicates", "merged": false },
      "expect": { "classes": 36, "group_count": 382 },
      "why": "Unmerged, the slice uses 36 predicates, and on alone carries 382 of the 892 triplets. The other three members keep their own 11, 5 and 10."
    },
    {
      "id": "pg-F6-slice-objects-merged",
      "kp": "F6",
      "scope": "slice",
      "knobs": { "group": "objects", "merged": true },
      "expect": { "classes": 113, "group_count": 127 },
      "why": "The slice uses 115 object names. Merging man, person and people turns three into one: 115 - 3 + 1 = 113, with 56 + 52 + 19 = 127 objects in the merged class."
    },
    {
      "id": "pg-F6-228-membership-unmerged",
      "kp": "F6",
      "image_id": "228",
      "knobs": { "relationship_id": 5, "substitute": "on", "merged": false },
      "expect": { "annotated_predicate": "sitting on", "recorded": false },
      "why": "Frame 228, relationship 5 is glass (10) sitting on table (2). The frame carries no on edge from 10 to 2, so glass on table is not in E before the merge."
    },
    {
      "id": "pg-F6-228-membership-merged",
      "kp": "F6",
      "image_id": "228",
      "knobs": { "relationship_id": 5, "substitute": "on", "merged": true },
      "expect": { "annotated_predicate": "sitting on", "recorded": true },
      "why": "With on and sitting on merged, glass (10) sitting on table (2) and glass on table share the key (10, on, 2), so the substituted triplet is in E prime. No annotation and no model changed."
    }
```

In `frontend/src/playgrounds/test/golden.test.ts`, widen the case type and add the dispatch:

```ts
interface Case {
  id: string;
  kp: string;
  image_id?: string;
  scope?: 'slice' | 'model' | 'sources';
  knobs: Record<string, number | boolean | string>;
  expect: Record<string, number | boolean | string | null>;
  why: string;
}
```

Change each `frameById(c.image_id)!` to `frameById(c.image_id!)!`, extend the imports (`classCounts, isInMergedE, mergeMap, objectLabels, predicateLabels` from `../logic`; `VG_FRAMES, vgFrameById` from `../slice`; `OBJECT_GROUP, PREDICATE_GROUP` from `../F6/groups`), and add:

```ts
  it.each(cases.filter((c) => c.kp === 'F6' && c.scope === 'slice'))('$id', (c) => {
    const predicates = c.knobs.group === 'predicates';
    const group = predicates ? PREDICATE_GROUP : OBJECT_GROUP;
    const labels = predicates ? predicateLabels(VG_FRAMES) : objectLabels(VG_FRAMES);
    const counts = classCounts(labels, c.knobs.merged ? mergeMap([group]) : new Map());
    expect(counts.size).toBe(c.expect.classes);
    expect(counts.get(group[0]!)).toBe(c.expect.group_count);
  });

  it.each(cases.filter((c) => c.kp === 'F6' && c.image_id))('$id', (c) => {
    const frame = vgFrameById(c.image_id!)!;
    const rel = frame.relationships.find((r) => r.relationship_id === c.knobs.relationship_id)!;
    expect(rel.predicate).toBe(c.expect.annotated_predicate);
    const triplet = { subject_id: rel.subject_id, predicate: c.knobs.substitute as string, object_id: rel.object_id };
    const merge = c.knobs.merged ? mergeMap([PREDICATE_GROUP]) : new Map<string, string>();
    expect(isInMergedE(frame, triplet, merge)).toBe(c.expect.recorded);
  });
```

Run: `npx vitest run frontend/src/playgrounds/test/golden.test.ts && npm run lint:content`
Expected: PASS; content lint reports `14 playground cases`.

- [ ] **Step 7: Commit**

```bash
npm run ci
git add frontend/src/playgrounds frontend/src/i18n ../data/content/playground_golden.json
git commit -m "feat(sgs): F6, where a merge moves the counts and never the model"
```

---

## Task 6: F7, The long-tail predicate distribution

**Files:**
- Create: `frontend/src/playgrounds/F7/LongTailDistribution.tsx`, `frontend/src/playgrounds/F7/test/LongTailDistribution.test.tsx`
- Modify: `mounts.tsx`, `test/Playground.test.tsx`, `en.json`, `zh-TW.json`, `playground_golden.json`, `test/golden.test.ts`

**Interfaces:**
- Consumes: `harmonic`, `headShare`, `tailToHead`, `ranked`, `measuredHeadShare`, `predicateLabels`, `clamp`, `flag`, `formatRatio` (logic.ts); `VG_FRAMES`.
- Produces: `LongTailDistribution`. Test ids `F7.s`, `F7.C`, `F7.k`, `F7.measured`; `readout-F7.head`, `readout-F7.tail`, `readout-F7.measured` (each with `-value`); `f7-bars`.

- [ ] **Step 1: Add the i18n keys**

`en.json`:

```json
  "playground.f7.s": "Zipf exponent s",
  "playground.f7.s_note": "s is a starting value, not a fit.",
  "playground.f7.classes": "Classes C",
  "playground.f7.head": "Head size k",
  "playground.f7.overlay": "Overlay this slice's counts",
  "playground.f7.head_share": "Head share, model",
  "playground.f7.tail": "Rarest to most frequent, model",
  "playground.f7.measured_share": "Head share, this slice",
  "playground.f7.legend_model": "Outlined: the model, n_p ∝ p^−s",
  "playground.f7.legend_measured": "Filled: this slice's predicate counts, ranked",
  "playground.f7.to_l3": "What a model's recall does on this distribution is scored in L3.",
```

`zh-TW.json`:

```json
  "playground.f7.s": "Zipf 指數 s",
  "playground.f7.s_note": "s 為起始值，非擬合結果。",
  "playground.f7.classes": "類別數 C",
  "playground.f7.head": "頭部範圍 k",
  "playground.f7.overlay": "疊加本切片之計數",
  "playground.f7.head_share": "頭部比例（模型）",
  "playground.f7.tail": "最罕見類別對最常見類別之比（模型）",
  "playground.f7.measured_share": "頭部比例（本切片）",
  "playground.f7.legend_model": "空心：模型，n_p ∝ p^−s",
  "playground.f7.legend_measured": "實心：本切片之 predicate 計數，依次數排序",
  "playground.f7.to_l3": "模型召回率於此分布下之表現由 L3 評分。",
```

- [ ] **Step 2: Write the failing component tests**

```tsx
// frontend/src/playgrounds/F7/test/LongTailDistribution.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { LongTailDistribution } from '../LongTailDistribution';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m01${search}`]}>
      <LongTailDistribution />
    </MemoryRouter>,
  );
}

const value = (id: string) => screen.getByTestId(`readout-${id}-value`);

describe('F7', () => {
  it('one class of four at s = 1 holds 12/25 of the triplets, and the rarest is a quarter of the most frequent', () => {
    at('?F7.s=1&F7.C=4&F7.k=1');
    expect(value('F7.head')).toHaveTextContent(/^48\.00%$/);
    expect(value('F7.tail')).toHaveTextContent(/^25\.00%$/);
  });

  it('at s = 0 the head holds exactly k/C', () => {
    at('?F7.s=0&F7.C=36&F7.k=3');
    expect(value('F7.head')).toHaveTextContent(/^8\.33%$/);
  });

  it('opens with C counted from the slice, not written down', () => {
    at();
    expect(screen.getByTestId('F7.C')).toHaveValue('36');
  });

  it('the overlay measures this slice: 509 of 892 triplets in the top three', () => {
    at('?F7.measured=1&F7.k=3');
    expect(value('F7.measured')).toHaveTextContent(/^57\.06%$/);
    expect(screen.getByTestId('readout-F7.measured')).toHaveTextContent('509 / 892');
  });

  it('the overlay is off until asked for', () => {
    at();
    expect(screen.queryByTestId('readout-F7.measured')).toBeNull();
    fireEvent.click(screen.getByTestId('F7.measured'));
    expect(screen.getByTestId('readout-F7.measured')).toBeInTheDocument();
  });

  it('clamps knobs that arrive out of range from the URL', () => {
    at('?F7.s=-1&F7.C=4&F7.k=1');
    expect(value('F7.head')).toHaveTextContent(/^25\.00%$/);
  });

  it('clamps C to 50 and k to at least 1', () => {
    at('?F7.s=0&F7.C=500&F7.k=0');
    expect(value('F7.head')).toHaveTextContent(/^2\.00%$/);
  });

  it('shows no recall, no mR and no γ', () => {
    const { container } = at('?F7.measured=1');
    expect(container.textContent ?? '').not.toMatch(/\bmR\b|R@|γ|gamma/i);
  });
});
```

Run: `npx vitest run frontend/src/playgrounds/F7`
Expected: FAIL, `LongTailDistribution` does not exist.

- [ ] **Step 3: Implement the component**

```tsx
// frontend/src/playgrounds/F7/LongTailDistribution.tsx
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Readout, Slider, Toggle } from '../controls';
import {
  clamp, flag, formatRatio, harmonic, headShare, measuredHeadShare, predicateLabels, ranked, tailToHead,
} from '../logic';
import { VG_FRAMES } from '../slice';

/**
 * F7 — Predicate 的長尾分布.
 *
 * The shape of the data and nothing about any model. s shapes n_p ∝ p^(−s), C sets how many
 * classes share it, k marks the head, and every readout is a ratio of counts. γ, R and mR are
 * absent on purpose: under the rule this cycle kept, what recall does on this shape is L3's to
 * score, and L3 has the same s control.
 */
const RANK = ranked(predicateLabels(VG_FRAMES));
const TOTAL = RANK.reduce((n, c) => n + c.count, 0);
const S_MAX = 2.4;
const C_MIN = 4;
const C_MAX = 50;
const BAR = 10;
const GAP = 4;
const HEIGHT = 120;

export function LongTailDistribution() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'F7.s': 1,
    'F7.C': RANK.length,
    'F7.k': 3,
    'F7.measured': 0,
  });
  const s = clamp(params['F7.s'], 0, S_MAX);
  const C = Math.round(clamp(params['F7.C'], C_MIN, C_MAX));
  const k = Math.round(clamp(params['F7.k'], 1, C));
  const overlay = flag(params['F7.measured'], false);

  const H = harmonic(C, s);
  const model = Array.from({ length: C }, (_, i) => (i + 1) ** -s / H);
  const measured = RANK.map((c) => c.count / TOTAL);
  const headCount = RANK.slice(0, Math.min(k, RANK.length)).reduce((n, c) => n + c.count, 0);
  const bars = Math.max(C, overlay ? RANK.length : 0);
  const top = Math.max(model[0] ?? 0, overlay ? measured[0] ?? 0 : 0) || 1;
  const h = (v: number) => (v / top) * HEIGHT;

  const controls = (
    <>
      <Slider
        id="F7.s"
        label={t('playground.f7.s')}
        value={s}
        min={0}
        max={S_MAX}
        step={0.05}
        onChange={(next) => setParams({ 'F7.s': next })}
        valueLabel={s.toFixed(2)}
      />
      <Slider
        id="F7.C"
        label={t('playground.f7.classes')}
        value={C}
        min={C_MIN}
        max={C_MAX}
        step={1}
        onChange={(next) => setParams({ 'F7.C': next })}
        valueLabel={String(C)}
      />
      <Slider
        id="F7.k"
        label={t('playground.f7.head')}
        value={k}
        min={1}
        max={C}
        step={1}
        onChange={(next) => setParams({ 'F7.k': next })}
        valueLabel={String(k)}
      />
      <Toggle
        id="F7.measured"
        label={t('playground.f7.overlay')}
        checked={overlay}
        onChange={(on) => setParams({ 'F7.measured': on ? 1 : 0 })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F7" controls={controls}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Readout
            id="F7.head"
            label={t('playground.f7.head_share')}
            value={formatRatio(headShare(k, C, s))}
            note={`H_${k}(${s.toFixed(2)}) / H_${C}(${s.toFixed(2)})`}
          />
          <Readout
            id="F7.tail"
            label={t('playground.f7.tail')}
            value={formatRatio(tailToHead(C, s))}
            note={`${C}^(−${s.toFixed(2)})`}
          />
          {overlay && (
            <Readout
              id="F7.measured"
              label={t('playground.f7.measured_share')}
              value={formatRatio(measuredHeadShare(RANK, k))}
              note={`${headCount} / ${TOTAL}`}
            />
          )}
        </div>
        <p className="text-[0.875em] text-slate-700">{t('playground.f7.s_note')}</p>
        <svg
          data-testid="f7-bars"
          viewBox={`0 0 ${bars * (BAR + GAP)} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-[6em] w-full"
          aria-hidden="true"
        >
          {overlay &&
            measured.map((v, i) => (
              <rect key={`m${i}`} x={i * (BAR + GAP) + 2} y={HEIGHT - h(v)} width={BAR - 4} height={h(v)} className="fill-slate-400" />
            ))}
          {model.map((v, i) => (
            <rect
              key={`p${i}`}
              x={i * (BAR + GAP)}
              y={HEIGHT - h(v)}
              width={BAR}
              height={h(v)}
              fill="none"
              className={i < k ? 'stroke-slate-900' : 'stroke-slate-500'}
              strokeWidth={i < k ? 2 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <p className="text-[0.875em] text-slate-700">
          {t('playground.f7.legend_model')}
          {overlay && <> · {t('playground.f7.legend_measured')}</>}
        </p>
        <p className="text-[0.875em] text-slate-700">{t('playground.f7.to_l3')}</p>
      </div>
    </PlaygroundFrame>
  );
}
```

- [ ] **Step 4: Register it, and run**

`mounts.tsx`: import `LongTailDistribution` from `./F7/LongTailDistribution`; add `F7: LongTailDistribution,` after `F6`. `Playground.test.tsx`: `['F1', 'F2', 'F6', 'F7', 'F8']`.

Run: `npx vitest run frontend/src/playgrounds`
Expected: PASS.

- [ ] **Step 5: Add F7's golden cases and dispatch**

Append to `playground_golden.json`:

```json
    {
      "id": "pg-F7-model-flat",
      "kp": "F7",
      "scope": "model",
      "knobs": { "s": 0, "C": 36, "k": 3 },
      "expect": { "head_share": 0.083333, "tail_to_head": 1 },
      "why": "At s = 0 every class holds the same count, so the three most frequent of 36 hold 3 / 36 = 1/12 = 0.083333, and the rarest is as frequent as the first: 36^0 = 1."
    },
    {
      "id": "pg-F7-model-s1-C4-k1",
      "kp": "F7",
      "scope": "model",
      "knobs": { "s": 1, "C": 4, "k": 1 },
      "expect": { "head_share": 0.48, "tail_to_head": 0.25 },
      "why": "H_4 at s = 1 is 1 + 1/2 + 1/3 + 1/4 = 25/12. The first class holds 1 / (25/12) = 12/25 = 0.48. The fourth is 4^(-1) = 0.25 of the first."
    },
    {
      "id": "pg-F7-slice-top3",
      "kp": "F7",
      "scope": "slice",
      "knobs": { "k": 3 },
      "expect": { "head_share": 0.570628 },
      "why": "The slice's three most frequent predicates are on 382, has 68 and near 59: 382 + 68 + 59 = 509 of 892 triplets, and 509 / 892 = 0.570628."
    }
```

`golden.test.ts`: import `headShare, measuredHeadShare, ranked, tailToHead` and add:

```ts
  it.each(cases.filter((c) => c.kp === 'F7' && c.scope === 'model'))('$id', (c) => {
    const { s, C, k } = c.knobs as { s: number; C: number; k: number };
    expect(headShare(k, C, s)).toBeCloseTo(c.expect.head_share as number, 6);
    expect(tailToHead(C, s)).toBeCloseTo(c.expect.tail_to_head as number, 6);
  });

  it.each(cases.filter((c) => c.kp === 'F7' && c.scope === 'slice'))('$id', (c) => {
    const rank = ranked(predicateLabels(VG_FRAMES));
    expect(measuredHeadShare(rank, c.knobs.k as number)).toBeCloseTo(c.expect.head_share as number, 6);
  });
```

Run: `npx vitest run frontend/src/playgrounds/test/golden.test.ts && npm run lint:content`
Expected: PASS; `17 playground cases`.

- [ ] **Step 6: Commit**

```bash
npm run ci
git add frontend/src/playgrounds frontend/src/i18n ../data/content/playground_golden.json
git commit -m "feat(sgs): F7, the shape of the tail and nothing about a model"
```

---

## Task 7: X1, VG150 names several releases

**Files:**
- Create: `frontend/src/playgrounds/X1/SplitReleases.tsx`, `frontend/src/playgrounds/X1/test/SplitReleases.test.tsx`
- Modify: `mounts.tsx`, `test/Playground.test.tsx`, `en.json`, `zh-TW.json`, `playground_golden.json`, `test/golden.test.ts`

**Interfaces:**
- Consumes: `RELEASES`, `releaseById`, types `Figure`, `Release`, `Split` (splits.ts); `splitDifference`, `explain`, `valDisjointFromTest` (logic.ts).
- Produces: `SplitReleases`. Test ids `X1.r`, `X1.vs`; `x1-table`; cells `x1-{split}-a`, `x1-{split}-b`, `x1-{split}-diff` for split ∈ {train, val, test}; `x1-row-pool`, `x1-row-val_from`, `x1-row-zero_relation`; lines `x1-equality-{split}` (`data-explained`); `x1-disjoint-a`, `x1-disjoint-b`; `x1-sources`.

- [ ] **Step 1: Add the i18n keys**

`en.json`:

```json
  "playground.x1.release": "Release",
  "playground.x1.compare": "Compare with",
  "playground.x1.split": "Split",
  "playground.x1.train": "Train",
  "playground.x1.val": "Validation",
  "playground.x1.test": "Test",
  "playground.x1.pool": "Images in the source pool",
  "playground.x1.val_from": "Validation drawn from",
  "playground.x1.zero_relation": "Images with no relation",
  "playground.x1.from_trainval": "the train/val pool",
  "playground.x1.from_test": "the test pool",
  "playground.x1.kept": "kept",
  "playground.x1.dropped": "dropped",
  "playground.x1.not_stated": "not stated by the source",
  "playground.x1.difference": "Difference",
  "playground.x1.no_difference": "not both stated as counts",
  "playground.x1.equals": "This equals:",
  "playground.x1.unexplained": "No sentence of the sources states this difference.",
  "playground.x1.disjoint_yes": "validation is disjoint from test",
  "playground.x1.disjoint_no": "validation drawn from the test pool",
  "playground.x1.disjoint_unknown": "whether validation overlaps test is not stated by the source",
  "playground.x1.sources": "Sources",
```

`zh-TW.json`:

```json
  "playground.x1.release": "發布版本",
  "playground.x1.compare": "比較對象",
  "playground.x1.split": "切分",
  "playground.x1.train": "訓練集",
  "playground.x1.val": "驗證集",
  "playground.x1.test": "測試集",
  "playground.x1.pool": "來源影像總數",
  "playground.x1.val_from": "驗證集來源",
  "playground.x1.zero_relation": "無關係之影像",
  "playground.x1.from_trainval": "訓練／驗證影像池",
  "playground.x1.from_test": "測試影像池",
  "playground.x1.kept": "保留",
  "playground.x1.dropped": "剔除",
  "playground.x1.not_stated": "來源未載明",
  "playground.x1.difference": "差值",
  "playground.x1.no_difference": "未同時以張數載明",
  "playground.x1.equals": "此值等於：",
  "playground.x1.unexplained": "來源中並無語句載明此差值。",
  "playground.x1.disjoint_yes": "驗證集與測試集互不重疊",
  "playground.x1.disjoint_no": "驗證集取自測試影像池",
  "playground.x1.disjoint_unknown": "驗證集是否與測試集重疊，來源未載明",
  "playground.x1.sources": "出處",
```

- [ ] **Step 2: Write the failing component tests**

```tsx
// frontend/src/playgrounds/X1/test/SplitReleases.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { SplitReleases } from '../SplitReleases';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m01${search}`]}>
      <SplitReleases />
    </MemoryRouter>,
  );
}

describe('X1', () => {
  it('opens on the project\'s own release against the canonical protocol', () => {
    at();
    expect(screen.getByTestId('x1-train-a')).toHaveTextContent('68,538');
    expect(screen.getByTestId('x1-train-b')).toHaveTextContent('57,723');
    expect(screen.getByTestId('x1-train-diff')).toHaveTextContent('10,815');
  });

  it('names the sentence of the sources each difference equals', () => {
    at();
    const train = screen.getByTestId('x1-equality-train');
    expect(train).toHaveAttribute('data-explained', 'true');
    expect(train).toHaveTextContent('68,538 − 57,723 = 10,815');
    expect(train).toHaveTextContent("v2's training images with no relation, kept");
    expect(screen.getByTestId('x1-equality-test')).toHaveTextContent("v2's test images with no relation, kept");
  });

  it('v1 against v2: five thousand into train, 4,844 out of test', () => {
    at('?X1.r=sgb-v1&X1.vs=sgb-v2');
    expect(screen.getByTestId('x1-equality-train')).toHaveTextContent('the canonical validation set, folded into v1\'s train');
    expect(screen.getByTestId('x1-test-diff')).toHaveTextContent('−4,844');
    expect(screen.getByTestId('x1-equality-test')).toHaveTextContent('drawn from the test pool');
    expect(screen.getByTestId('x1-disjoint-a')).toHaveTextContent('validation drawn from the test pool');
  });

  it('a difference no sentence states is reported as such, not explained', () => {
    at('?X1.r=sgb-v1&X1.vs=canonical');
    expect(screen.getByTestId('x1-equality-test')).toHaveAttribute('data-explained', 'false');
    expect(screen.getByTestId('x1-equality-test')).toHaveTextContent('No sentence of the sources states this difference.');
  });

  it('Xu states shares, not counts, and the playground never multiplies them out', () => {
    const { container } = at('?X1.r=xu-2017&X1.vs=canonical');
    expect(screen.getByTestId('x1-train-a')).toHaveTextContent('70%');
    expect(screen.getByTestId('x1-val-a')).toHaveTextContent('not stated by the source');
    expect(screen.getByTestId('x1-train-diff')).toHaveTextContent('not both stated as counts');
    expect(screen.queryByTestId('x1-equality-train')).toBeNull();
    expect(screen.getByTestId('x1-row-pool')).toHaveTextContent('108,077');
    expect(container.textContent ?? '').not.toMatch(/75,6\d\d/);
  });

  it('an unknown release in the URL falls back to the default', () => {
    at('?X1.r=vg150');
    expect(screen.getByTestId('x1-train-a')).toHaveTextContent('68,538');
  });

  it('a release compared with itself differs by nothing and claims no explanation', () => {
    at('?X1.r=canonical&X1.vs=canonical');
    expect(screen.getByTestId('x1-train-diff')).toHaveTextContent(/^0/);
    expect(screen.queryByTestId('x1-equality-train')).toBeNull();
  });

  it('every figure shown carries a numbered source', () => {
    at();
    for (const cell of ['x1-train-a', 'x1-train-b', 'x1-val-a', 'x1-test-b']) {
      expect(screen.getByTestId(cell).querySelector('sup')?.textContent, cell).toMatch(/^\d+$/);
    }
    expect(screen.getByTestId('x1-sources')).toHaveTextContent('vg150-sgb card, Dataset statistics');
  });

  it('labels follow the locale', () => {
    setLocale('zh-TW');
    at();
    expect(screen.getByTestId('X1.r')).toHaveTextContent('SGG-Benchmark 發布版本 v2');
  });
});
```

Run: `npx vitest run frontend/src/playgrounds/X1`
Expected: FAIL, `SplitReleases` does not exist.

- [ ] **Step 3: Implement the component**

```tsx
// frontend/src/playgrounds/X1/SplitReleases.tsx
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame } from '../controls';
import { explain, splitDifference, valDisjointFromTest } from '../logic';
import { RELEASES, releaseById, type Figure, type Release, type Split } from '../splits';

/**
 * X1 — VG150 指涉數個發布版本.
 *
 * Every figure is shown with where it was read, and a figure no source states is shown as not
 * stated. The playground computes two things only: the difference between two stated counts, and
 * whether a release's validation set can overlap its test set. Where a sentence of the sources
 * states the same number as a difference, it names that sentence; where none does, it says so.
 * It never turns Xu's 70% of 108,077 into a count, because Xu et al. do not.
 */
const SPLITS: Split[] = ['train', 'val', 'test'];
const COUNT = new Intl.NumberFormat('en-US');
const DEFAULT_A = 'sgb-v2';
const DEFAULT_B = 'canonical';
const CODED: Record<string, string> = {
  trainval: 'playground.x1.from_trainval',
  test: 'playground.x1.from_test',
  kept: 'playground.x1.kept',
  dropped: 'playground.x1.dropped',
};

function signed(d: number): string {
  return d < 0 ? `−${COUNT.format(-d)}` : COUNT.format(d);
}

export function SplitReleases() {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'X1.r': DEFAULT_A, 'X1.vs': DEFAULT_B });
  const fallback = releaseById(DEFAULT_A) ?? RELEASES[0]!;
  const a = releaseById(params['X1.r']) ?? fallback;
  const b = releaseById(params['X1.vs']) ?? releaseById(DEFAULT_B) ?? fallback;
  const label = (r: Release) => (locale === 'en' ? r.label_en : r.label_zh);

  const shown = (f: Figure | undefined): string => {
    if (!f || f.value === null) return t('playground.x1.not_stated');
    if (typeof f.value === 'number') return COUNT.format(f.value);
    return CODED[f.value] ? t(CODED[f.value]!) : f.value;
  };

  const equalities = SPLITS.flatMap((split) => {
    const d = splitDifference(a, b, split);
    if (d === null || d === 0) return [];
    return [{
      split, d,
      x: a.figures[split]!.value as number,
      y: b.figures[split]!.value as number,
      note: explain(d, [a, b]),
    }];
  });

  const hasPool = Boolean(a.figures.pool || b.figures.pool);
  const rows: ('pool' | 'val_from' | 'zero_relation')[] = hasPool
    ? ['pool', 'val_from', 'zero_relation']
    : ['val_from', 'zero_relation'];

  // One footnote per distinct source and locator, numbered in the order the figures appear.
  const used: (Figure | undefined)[] = [
    ...SPLITS.flatMap((s) => [a.figures[s], b.figures[s]]),
    ...rows.flatMap((row) => [a.figures[row], b.figures[row]]),
    ...equalities.map((e) => e.note),
  ];
  const footnotes = [
    ...new Set(used.flatMap((f) => (f ? [`${f.source}, ${f.locator}`] : []))),
  ];
  const mark = (f: Figure | undefined) =>
    f ? <sup>{footnotes.indexOf(`${f.source}, ${f.locator}`) + 1}</sup> : null;

  const disjoint = (r: Release) => {
    const v = valDisjointFromTest(r);
    return t(v === true ? 'playground.x1.disjoint_yes' : v === false ? 'playground.x1.disjoint_no' : 'playground.x1.disjoint_unknown');
  };

  const options = RELEASES.map((r) => ({ value: r.id, label: label(r) }));
  const controls = (
    <>
      <Choice id="X1.r" label={t('playground.x1.release')} value={a.id} options={options} onChange={(next) => setParams({ 'X1.r': next })} />
      <Choice id="X1.vs" label={t('playground.x1.compare')} value={b.id} options={options} onChange={(next) => setParams({ 'X1.vs': next })} />
    </>
  );

  const cell = 'px-2 py-1 text-left align-top';

  return (
    <PlaygroundFrame title="X1" controls={controls}>
      <div className="flex flex-col gap-3">
        <table data-testid="x1-table" className="w-full border-collapse text-[1em] text-slate-900">
          <thead>
            <tr className="text-slate-700">
              <th scope="col" className={cell}>{t('playground.x1.split')}</th>
              <th scope="col" className={cell}>{label(a)}</th>
              <th scope="col" className={cell}>{label(b)}</th>
              <th scope="col" className={cell}>{t('playground.x1.difference')}</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {SPLITS.map((split) => {
              const d = splitDifference(a, b, split);
              return (
                <tr key={split}>
                  <th scope="row" className={`${cell} font-sans`}>{t(`playground.x1.${split}`)}</th>
                  <td data-testid={`x1-${split}-a`} className={cell}>{shown(a.figures[split])}{mark(a.figures[split])}</td>
                  <td data-testid={`x1-${split}-b`} className={cell}>{shown(b.figures[split])}{mark(b.figures[split])}</td>
                  <td data-testid={`x1-${split}-diff`} className={cell}>
                    {d === null ? <span className="font-sans text-slate-700">{t('playground.x1.no_difference')}</span> : signed(d)}
                  </td>
                </tr>
              );
            })}
            {rows.map((row) => (
              <tr key={row} data-testid={`x1-row-${row}`}>
                <th scope="row" className={`${cell} font-sans`}>{t(`playground.x1.${row}`)}</th>
                <td className={`${cell} font-sans`}>{shown(a.figures[row])}{mark(a.figures[row])}</td>
                <td className={`${cell} font-sans`}>{shown(b.figures[row])}{mark(b.figures[row])}</td>
                <td className={cell} />
              </tr>
            ))}
          </tbody>
        </table>
        {equalities.map((e) => (
          <p key={e.split} data-testid={`x1-equality-${e.split}`} data-explained={String(Boolean(e.note))} className="text-[1em] text-slate-700">
            <span className="font-mono text-slate-900">
              {t(`playground.x1.${e.split}`)}: {COUNT.format(e.x)} − {COUNT.format(e.y)} = {signed(e.d)}
            </span>{' '}
            {e.note ? (
              <>{t('playground.x1.equals')} {locale === 'en' ? e.note.text_en : e.note.text_zh}{mark(e.note)}</>
            ) : (
              t('playground.x1.unexplained')
            )}
          </p>
        ))}
        <p data-testid="x1-disjoint-a" className="text-[1em] text-slate-700">{label(a)}: {disjoint(a)}</p>
        <p data-testid="x1-disjoint-b" className="text-[1em] text-slate-700">{label(b)}: {disjoint(b)}</p>
        <div className="text-[0.875em] text-slate-700">
          <span className="font-medium">{t('playground.x1.sources')}</span>
          <ol data-testid="x1-sources" className="list-decimal pl-6">
            {footnotes.map((f) => <li key={f}>{f}</li>)}
          </ol>
        </div>
      </div>
    </PlaygroundFrame>
  );
}
```

- [ ] **Step 4: Register it, and run**

`mounts.tsx`: import `SplitReleases` from `./X1/SplitReleases`; add `X1: SplitReleases,` after `F8`. `Playground.test.tsx`: `['F1', 'F2', 'F6', 'F7', 'F8', 'X1']`.

Run: `npx vitest run frontend/src/playgrounds`
Expected: PASS.

- [ ] **Step 5: Add X1's golden cases and dispatch**

Append to `playground_golden.json`:

```json
    {
      "id": "pg-X1-v2-canonical-train",
      "kp": "X1",
      "scope": "sources",
      "knobs": { "r": "sgb-v2", "vs": "canonical", "split": "train" },
      "expect": { "difference": 10815, "explained_by": 10815 },
      "why": "v2 states 68,538 training images and the canonical protocol 57,723: 68,538 - 57,723 = 10,815, which is the card's own count of v2 training images kept with no relation."
    },
    {
      "id": "pg-X1-v2-canonical-test",
      "kp": "X1",
      "scope": "sources",
      "knobs": { "r": "sgb-v2", "vs": "canonical", "split": "test" },
      "expect": { "difference": 5430, "explained_by": 5430 },
      "why": "v2 states 31,876 test images and the canonical protocol 26,446: 31,876 - 26,446 = 5,430, the card's count of v2 test images kept with no relation."
    },
    {
      "id": "pg-X1-v1-v2-train",
      "kp": "X1",
      "scope": "sources",
      "knobs": { "r": "sgb-v1", "vs": "sgb-v2", "split": "train" },
      "expect": { "difference": 5000, "explained_by": 5000 },
      "why": "Issue 94 gives v1 73,538 training images against v2's 68,538: 73,538 - 68,538 = 5,000, the canonical validation set the card says v1 folded into train."
    },
    {
      "id": "pg-X1-v1-v2-test",
      "kp": "X1",
      "scope": "sources",
      "knobs": { "r": "sgb-v1", "vs": "sgb-v2", "split": "test" },
      "expect": { "difference": -4844, "explained_by": 4844 },
      "why": "v1 has 27,032 test images and v2 31,876: 27,032 - 31,876 = -4,844. The 4,844 are the images the card says v1 took from the test pool for its validation set."
    },
    {
      "id": "pg-X1-xu-canonical-train",
      "kp": "X1",
      "scope": "sources",
      "knobs": { "r": "xu-2017", "vs": "canonical", "split": "train" },
      "expect": { "difference": null, "explained_by": null },
      "why": "Xu et al. state 70% of 108,077 images and no count, so there is no count to subtract from 57,723. Multiplying 0.7 by 108,077 would assert a split size the paper never states."
    }
```

`golden.test.ts`: import `explain, splitDifference` and `releaseById, type Split`, and add:

```ts
  it.each(cases.filter((c) => c.kp === 'X1'))('$id', (c) => {
    const a = releaseById(c.knobs.r as string)!;
    const b = releaseById(c.knobs.vs as string)!;
    const d = splitDifference(a, b, c.knobs.split as Split);
    expect(d).toBe(c.expect.difference);
    expect(d === null ? null : explain(d, [a, b])?.value ?? null).toBe(c.expect.explained_by);
  });
```

Run: `npx vitest run frontend/src/playgrounds/test/golden.test.ts && npm run lint:content`
Expected: PASS; `22 playground cases`.

- [ ] **Step 6: Commit**

```bash
npm run ci
git add frontend/src/playgrounds frontend/src/i18n ../data/content/playground_golden.json
git commit -m "feat(sgs): X1, where every figure names its passage and a difference names its sentence"
```

---

## Task 8: M1's three playground steps

**Files:**
- Modify: `frontend/src/content/m01.en.mdx`, `frontend/src/content/m01.zh-TW.mdx`
- Modify: `frontend/src/content/test/registry.test.tsx`

**Interfaces:**
- Consumes: the three registered components.
- Produces: M1 steps `s1`…`s9`: prose, math, **playground F6**, math, **playground F7**, prose, **playground X1**, lab L1, checkpoint. Lecture indices 2, 4 and 6 are the playgrounds.

- [ ] **Step 1: Pin the new shape in the registry test (failing)**

In `frontend/src/content/test/registry.test.tsx`, in `describe('the playground step kind', …)`, add:

```tsx
  it('M1 carries its three playgrounds, after the steps that teach them', () => {
    const meta = getMeta('m01', 'en')!;
    expect(meta.steps.map((s) => `${s.id}:${s.kind}${s.kp ? `/${s.kp}` : ''}`)).toEqual([
      's1:prose', 's2:math', 's3:playground/F6', 's4:math', 's5:playground/F7',
      's6:prose', 's7:playground/X1', 's8:lab', 's9:checkpoint',
    ]);
    const steps = getModule('m01', 'zh-TW')!;
    for (const step of steps.filter((s) => s.kind === 'playground')) {
      const mounted = render(<MemoryRouter initialEntries={['/m/m01']}>{step.node}</MemoryRouter>);
      expect(within(mounted.container).getByTestId('playground-frame')).toBeInTheDocument();
      expect(mounted.container.querySelector('[data-testid="playground-unknown"]')).toBeNull();
      mounted.unmount();
    }
  });
```

Run: `npx vitest run frontend/src/content/test/registry.test.tsx`
Expected: FAIL on the step list.

- [ ] **Step 2: Renumber the body tags, highest first**

In both locale files, in this order so no two tags share an id mid-edit: `<Step id="s6">` → `s9`, `<Step id="s5">` → `s8`, `<Step id="s4">` → `s6`, `<Step id="s3">` → `s4`. Do the same to the frontmatter `- id:` lines.

- [ ] **Step 3: Insert the three steps' frontmatter**

`m01.en.mdx`, after the `s2` entry:

```yaml
  - id: s3
    kind: playground
    kp: F6
    seconds_budget: 180
    presenter_notes_en: "Three minutes. Tick the predicate merge first and read the class count fall from 36 to 33 while the merged class's triplet count becomes the written sum. Then choose frame 228, glass sitting on table, with on substituted: not recorded in E, and recorded in E′ once the merge is ticked. Say that the model did not move. If time allows, frame 2008 carries both on and sitting on for the same pillow and bed, which is what an annotator does when no hierarchy says which to write."
```

after the (renumbered) `s4` entry:

```yaml
  - id: s5
    kind: playground
    kp: F7
    seconds_budget: 180
    presenter_notes_en: "Three minutes. Start at s = 0 and show that the head share is exactly k/C; that is the case in which s4 proved R = mR. Raise s and watch the head take the distribution. Turn on the overlay: this slice's top predicate holds 382 of 892 triplets, 42.8%. Let the room move s until the model's head share matches by eye, and say that no exponent is fitted. What recall does on this shape is L3's."
```

after the (renumbered) `s6` entry:

```yaml
  - id: s7
    kind: playground
    kp: X1
    seconds_budget: 180
    presenter_notes_en: "Three minutes. Open on vg150-sgb v2, this project's own release, compared with the canonical protocol: train differs by 10,815 and test by 5,430, and both equal the card's count of images kept with no relation. Then compare v1 with v2: 4,844 images moved from test into validation, which is the leak the card's changelog records. Xu et al. state a 70/30 split and no counts, and the playground says so rather than multiplying. The point is not which release is right but that a number is comparable only when its paper names the release."
```

`m01.zh-TW.mdx`, at the same three positions:

```yaml
  - id: s3
    kind: playground
    kp: F6
    seconds_budget: 180
    presenter_notes_zh: "三分鐘。先勾選 predicate 合併，說明類別數由 36 降為 33，而合併後類別之三元組數即為畫面所列之加總。其後選擇影像 228 之 glass sitting on table，以 on 替換：未合併時未收錄於 E，勾選合併後即收錄於 E′。須明確說明模型並未改變。時間允許時，可示範影像 2008：同一組 pillow 與 bed 同時標有 on 與 sitting on，此即詞彙缺乏階層時標註者之實際作法。"
```

```yaml
  - id: s5
    kind: playground
    kp: F7
    seconds_budget: 180
    presenter_notes_zh: "三分鐘。自 s = 0 開始，說明頭部比例恰為 k/C，此即 s4 證明 R = mR 之情形。其後調高 s，觀察頭部逐漸占據分布。開啟疊加：本切片最常見之 predicate 占 892 條三元組中之 382 條，即 42.8%。可請現場調整 s 使模型之頭部比例與之目測相符，並說明未作任何指數擬合。召回率於此分布下之表現屬 L3 之範圍。"
```

```yaml
  - id: s7
    kind: playground
    kp: X1
    seconds_budget: 180
    presenter_notes_zh: "三分鐘。先開啟本專案所用之 vg150-sgb v2，並與標準協定比較：訓練集相差 10,815，測試集相差 5,430，兩者皆等於資料卡所載保留之無關係影像數。其後比較 v1 與 v2：有 4,844 張影像自測試集移入驗證集，即資料卡變更紀錄所述之洩漏。Xu 等人僅載明 70／30 比例而未列張數，本步驟據實標示，不自行換算。重點不在於何者正確，而在於唯有論文載明所用版本，數值方可比較。"
```

Also, in both files, the renumbered `s4` (formerly s3) notes mention "M04 與 L3" and need no change; the L1 note mentions s1, which did not move.

- [ ] **Step 4: Insert the three step bodies**

`m01.en.mdx`, after `</Step>` of `s2`:

```mdx
<Step id="s3">

## Merging synonyms, counted

Two independent boxes over the 80 annotated frames of this project's `vg150-sgb` slice: one merges
four spatial predicates, one merges three names for people. The boxes are independent because the
vocabulary has no hierarchy; whether `above` means `on` is a decision, and two papers deciding
differently report numbers that cannot be compared.

Each merge moves a class count and a triplet count. The lower panel substitutes a synonym into one
annotated edge: not recorded without the merge, recorded with it, and neither the annotation nor
the model moved.

<Playground kp="F6" />

</Step>
```

after `</Step>` of the renumbered `s4`:

```mdx
<Step id="s5">

## The shape of the tail

$s$ shapes the distribution, $C$ sets how many classes share it, and $k$ marks the head. Every
readout is a ratio of counts: the share of all triplets held by the $k$ most frequent classes, and
the rarest class as a fraction of the most frequent. At $s = 0$ the head holds exactly $k/C$.

The overlay places this slice's own predicate counts, ranked, beside the model. What a model's
recall does on such a distribution is scored in L3, not here.

<Playground kp="F7" />

</Step>
```

after `</Step>` of the renumbered `s6`:

```mdx
<Step id="s7">

## Four releases, one name

Choose a release and a second to compare it with. Every figure is shown with the passage it was
read from, and a figure no source states is shown as not stated. The differences are computed;
where a sentence of the sources states the same number, the playground names it.

<Playground kp="X1" />

</Step>
```

`m01.zh-TW.mdx`, at the same positions:

```mdx
<Step id="s3">

## 同義詞合併之計數

範圍為本專案 `vg150-sgb` 切片之 80 張已標註影像，設有兩個彼此獨立之勾選項：一為合併四個空間 predicate，一為合併三個指稱人之物件名稱。兩者彼此獨立，因詞彙本身並無階層；above 是否等同 on 屬於決定而非事實，兩篇論文決定不同，所報數值即無從比較。

每次合併皆改變類別數與三元組數。下方面板以同義詞替換一條已標註邊之 predicate：未合併時未收錄，合併後即收錄，而標註與模型皆未改變。

<Playground kp="F6" />

</Step>
```

```mdx
<Step id="s5">

## 長尾之形狀

$s$ 決定分布形狀，$C$ 決定類別數，$k$ 標定頭部範圍。各讀數皆為計數之比：前 $k$ 個最常見類別所占三元組之比例，以及最罕見類別相對最常見類別之比。$s = 0$ 時頭部比例恰為 $k/C$。

疊加選項將本切片實際之 predicate 計數依次數排序，並列於模型旁。模型召回率於此類分布下之表現由 L3 評分，不在本步驟計算。

<Playground kp="F7" />

</Step>
```

```mdx
<Step id="s7">

## 四個發布版本，一個名稱

選擇一個發布版本，並選擇另一版本作為比較對象。每一數值皆附其出處段落；來源未載明者即標示為未載明。差值由計算而得；若來源中某一語句載明相同數值，則一併列出該語句。

<Playground kp="X1" />

</Step>
```

- [ ] **Step 5: Run the lint and the tests**

```bash
npm run lint:content
npx vitest run frontend/src/content
```

Expected: content lint clean over 15 modules, with 98 steps' presenter notes; the registry test passes.

- [ ] **Step 6: Commit**

```bash
npm run ci
git add frontend/src/content
git commit -m "feat(sgs): M1 gains its three playground steps, 6 to 9"
```

---

## Task 9: M1 in Chromium

**Files:**
- Modify: `e2e/lecture.spec.ts`, `e2e/projector.spec.ts`, `e2e/perf.spec.ts`

**Interfaces:**
- Consumes: M1 lecture indices 2 (F6), 4 (F7), 6 (X1); the test ids of Tasks 5–7.

- [ ] **Step 1: Stop any stale preview before measuring**

`npm run check:perf` and `npm run test:e2e` need port 4173 free. A `vite preview` left by a backgrounded run produces failures unrelated to the diff.

```powershell
Get-NetTCPConnection -LocalPort 4173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Confirm:$false }
```

- [ ] **Step 2: Extend `lecture.spec.ts`**

Append inside the file's top-level describe, beside the M0 playground tests:

```ts
test('M1\'s playgrounds compute with no backend running', async ({ page }) => {
  await page.goto('/lecture/m/m01/2');
  await expect(page.getByTestId('readout-F6.predicates-value')).toHaveText('36');
  await page.goto('/lecture/m/m01/4');
  await expect(page.getByTestId('readout-F7.head-value')).toHaveText(/%$/);
  await page.goto('/lecture/m/m01/6');
  await expect(page.getByTestId('x1-train-a')).toContainText('68,538');
});

test('M1\'s knobs work from the keyboard and never advance the deck', async ({ page }) => {
  const cases = [
    { step: 2, knob: 'F6.mp', key: 'Space', watch: 'readout-F6.predicates-value' },
    { step: 4, knob: 'F7.s', key: 'ArrowRight', watch: 'readout-F7.head-value' },
    // ArrowUp, not ArrowDown: the default, sgb-v2, is the last option, so ArrowDown would change
    // nothing and the test would report a keyboard failure that is really the end of the list.
    { step: 6, knob: 'X1.r', key: 'ArrowUp', watch: 'x1-train-a' },
  ];
  for (const c of cases) {
    await page.goto(`/lecture/m/m01/${c.step}`);
    const position = page.getByTestId('position');
    const before = await position.textContent();
    const watched = page.getByTestId(c.watch);
    const was = await watched.textContent();
    await page.getByTestId(c.knob).focus();
    await page.keyboard.press(c.key);
    await expect(watched, `${c.knob} moved nothing`).not.toHaveText(was ?? '');
    await expect(position, `${c.knob} advanced the deck`).toHaveText(before ?? '');
  }
});

test('M1\'s knobs write the address bar', async ({ page }) => {
  await page.goto('/lecture/m/m01/2');
  await page.getByTestId('F6.mp').click();
  await expect(page).toHaveURL(/F6\.mp=1/);
  await page.goto('/lecture/m/m01/4');
  await page.getByTestId('F7.measured').click();
  await expect(page).toHaveURL(/F7\.measured=1/);
  await page.goto('/lecture/m/m01/6');
  await page.getByTestId('X1.r').selectOption('sgb-v1');
  await expect(page).toHaveURL(/X1\.r=sgb-v1/);
  const shared = page.url();
  await page.goto('about:blank');
  await page.goto(shared);
  await expect(page.getByTestId('x1-train-a')).toContainText('73,538');
});
```

In the existing `'no playground takes focus when its step opens'`, replace the loop with:

```ts
  for (const [module, index] of [['m00', 1], ['m00', 3], ['m00', 4], ['m01', 2], ['m01', 4], ['m01', 6]] as const) {
    await page.goto(`/lecture/m/${module}/${index}`);
```

and in `'the study shell renders all three playgrounds in one column'` add, after the M0 assertions:

```ts
  await page.goto('/m/m01');
  await expect(page.getByTestId('playground-frame')).toHaveCount(3);
```

Run: `npx playwright test e2e/lecture.spec.ts`
Expected: PASS.

- [ ] **Step 3: Extend `projector.spec.ts` to M1**

In `'every painted word meets NFR-5 …'`, replace `for (const step of [2, 1, 3, 4])` and its `floor` table with a list of pages:

```ts
      const pages: { module: string; step: number; floor: number }[] = [
        { module: 'm00', step: 2, floor: 150 },
        { module: 'm00', step: 1, floor: 25 },
        { module: 'm00', step: 3, floor: 18 },
        { module: 'm00', step: 4, floor: 12 },
        { module: 'm01', step: 2, floor: 9999 },
        { module: 'm01', step: 4, floor: 9999 },
        { module: 'm01', step: 6, floor: 9999 },
      ];
      for (const { module, step, floor } of pages) {
        await page.goto(`/lecture/m/${module}/${step}`);
```

using `floor` in place of `floor[step]!` and `${module}/${step}` in the messages. The 9999 floors are placeholders for one run only: run `npx playwright test e2e/projector.spec.ts -g "NFR-5"`, read the measured row count for each M1 step from the three failure messages (`… N rows measured, fewer than the 9999 …`) at each panel size, and set each floor to three quarters of the smallest of its three counts, rounded down. Re-run: PASS, with `skipped` empty.

In `'no word on a slide falls below the deck's 18 px floor'`, replace `for (const step of [0, 1, 2, 3, 4, 5, 6])` with

```ts
      for (const [module, step] of [
        ...[0, 1, 2, 3, 4, 5, 6].map((s) => ['m00', s] as const),
        ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((s) => ['m01', s] as const),
      ]) {
        await page.goto(`/lecture/m/${module}/${step}`);
```

and use `${module} step ${step}` in the message.

In `'a playground step fits the panel, with its controls reachable'`, wrap the body in a loop over `['m00/1', 'm00/3', 'm00/4', 'm01/2', 'm01/4', 'm01/6']`, visiting `/lecture/m/${where}`.

Run: `npx playwright test e2e/projector.spec.ts`
Expected: PASS at XGA, WXGA and 1920×1080. If a type-floor or fit assertion fails on an M1 step, fix the component (sizes are `em`; controls above the visual), not the test.

- [ ] **Step 4: Measure M1's overflow at XGA**

Using the same method `projector.spec.ts` records for M0 (scroll height of `[data-testid="step"]` minus its client height, per step, at 1024×768, after `document.fonts.ready`), record the nine M1 figures for VERIFICATION §17. A playground step with non-zero overflow is recorded as a decision in D93, not fixed silently.

- [ ] **Step 5: Extend `perf.spec.ts`**

Add `module: string` to the `PLAYGROUND_CASES` element type, `module: 'm00'` to the three existing cases, and three more:

```ts
  {
    module: 'm01',
    kp: 'F6',
    step: 2,
    act: { kind: 'click', testid: 'F6.mp' },
    readout: '[data-testid="playground-frame"] [data-testid^="readout-"]',
    why: 'merging the four predicates recounts the classes',
  },
  {
    module: 'm01',
    kp: 'F7',
    step: 4,
    act: { kind: 'set', testid: 'F7.s', value: '2' },
    readout: '[data-testid="playground-frame"] [data-testid^="readout-"]',
    why: 'moving s re-divides the head share',
  },
  {
    module: 'm01',
    kp: 'X1',
    step: 6,
    act: { kind: 'set', testid: 'X1.r', value: 'sgb-v1' },
    readout: '[data-testid^="x1-"]',
    why: 'choosing another release re-reads every figure and every difference',
  },
```

In the loop, `page.goto(`/lecture/m/${c.module}/${c.step}`)`. The count test becomes `'all six playgrounds were actually measured'`, expecting `6` with the message `M0 and M1 carry six`.

Run: `npm run check:perf`
Expected: 20 passed. Record the six playground lines it prints (wall and "work") for VERIFICATION §17 exactly as printed: a work figure below the floor is reported as below the floor, never as zero (D91).

- [ ] **Step 6: Run the whole browser suite and commit**

```bash
npm run test:e2e
npm run ci
git add e2e
git commit -m "test(sgs): M1's playgrounds in Chromium, at three panels, with no backend"
```

Expected: `test:e2e` exit 0, and its count recorded for §17.

---

## Task 10: The records, the mutation run, and the gate

**Files:**
- Modify: `../DEVIATIONS.md`, `docs/VERIFICATION.md`, `docs/INDEX.md`, `../CLAUDE.md`, `../README.md`, `../docs/superpowers/specs/2026-09-15-scene-graph-studio-contracts.md` (§2.4), `../docs/superpowers/specs/2026-09-19-playgrounds-design.md` (§2.4)

- [ ] **Step 1: The contract text**

Contracts §2.4: change "eleven rules — eight over the step and its body, three over the golden file" to "eleven rules over the step, its body and the golden file (rule 9 amended on 2026-09-26: a case carries `image_id` or a `scope`), and a twelfth over `data/content/vg150_splits.json`". Playground design §2.4: rule 9 gains "…and exactly one of `image_id` or `scope` ∈ {`slice`, `model`, `sources`} (amended 2026-09-26, M1 design §6)"; add rule 12 under it with the M1 design's wording.

- [ ] **Step 2: Run the mutation check over all twelve rules**

Write the harness to the session scratchpad, not the repository. It addresses each rule by a unique fragment of its message rather than by line number, so it holds across edits:

```js
// scratchpad/mutate12.mjs — run from scene-graph-studio/system
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'tools/content_lint.mjs';
const original = readFileSync(FILE, 'utf-8');
// [name, fragment, occurrence, where the push sits]: 'before' for a fragment of the message, which
// lies inside the push; 'after' for an anchor the push follows. Two fragments occur twice in the
// file, once for the engine's golden vectors and once for the playgrounds', hence the occurrence.
const RULES = [
  ['r1 no kp', 'is a playground and names no kp', 1, 'before'],
  ['r2 not in kp.json', "names kp '${step.kp}', not in kp.json", 1, 'before'],
  ['r3 owned or cited', 'neither owns nor cites', 1, 'before'],
  ['r4 unregistered', 'no component is registered for', 1, 'before'],
  ['r5 body mismatch', 'but its body', 1, 'before'],
  ['r6 undeclared tag', 'which no step in', 1, 'before'],
  ['r7 cross-locale', 'A playground must be the same playground', 1, 'before'],
  ['r8 per-module', 'is mounted more than once in this module', 1, 'before'],
  ['r8 corpus-wide', 'playground steps: ', 1, 'before'],
  ['r9 no id', 'a playground golden case has no id', 1, 'before'],
  ['r9 duplicate', 'duplicate playground golden case id', 1, 'before'],
  ['r9 missing', "['kp', 'knobs', 'expect']", 1, 'after'],
  ['r9 scope unknown', 'is not one of', 1, 'before'],
  ['r9 image_id xor scope', "'both image_id and a scope'", 1, 'before'],
  ['r9 empty expect', "'expect' is empty", 1, 'before'],
  ['r10 why', "'why' must write out", 2, 'before'],
  ['r11 golden unregistered', 'which has no registered component', 1, 'before'],
  ['r12 uncited', 'X1 shows where every figure was read', 1, 'before'],
  ['r12 digits', 'does not appear in its quote', 1, 'before'],
  ['r12 measured', 'rows but carries', 1, 'before'],
  ['r12 note value', 'a note needs a numeric value', 1, 'before'],
  ['r12 labels', "problems.push(`${r.id}: no '${key}'`)", 1, 'before'],
  ['r12 no releases', 'vg150_splits.json: no releases', 1, 'before'],
];
function locate(fragment, occurrence, where) {
  let at = -1;
  for (let i = 0; i < occurrence; i += 1) {
    at = original.indexOf(fragment, at + 1);
    if (at < 0) return -1;
  }
  return where === 'after' ? original.indexOf('problems.push(', at) : original.lastIndexOf('problems.push(', at);
}
const results = [];
try {
  for (const [name, fragment, occurrence, where] of RULES) {
    const push = locate(fragment, occurrence, where);
    if (push < 0) { results.push(`NOT FOUND ${name}`); continue; }
    writeFileSync(FILE, original.slice(0, push) + '(() => {})(' + original.slice(push + 'problems.push('.length));
    let out;
    try {
      out = execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tools/test/content_lint.test.mjs'], { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, NO_COLOR: '1' } });
    } catch (e) { out = `${e.stdout}${e.stderr}`; }
    const failed = /(\d+) failed/.exec(out)?.[1] ?? '0';
    results.push(`${failed === '0' ? 'MISSED' : 'CAUGHT'}  ${name.padEnd(26)} ${failed} failed`);
  }
} finally {
  writeFileSync(FILE, original);
}
console.log(results.join('\n'));
```

Run: `node <scratchpad>/mutate12.mjs` and then `git status --short tools/` (expected: clean).
Expected: every line `CAUGHT`. A `MISSED` line means a test is missing: add it to `content_lint.test.mjs` and re-run until none is missed. A `NOT FOUND` line means the fragment drifted: correct the fragment, not the rule.

- [ ] **Step 3: Run the full gate and record every count**

```bash
npm run ci
npm run test:e2e
npm run check:perf
git status --short
```

Record from the output: pytest passed/skipped, vitest tests and files, parity, i18n keys, the content lint line (golden cases, playground cases, release figures, modules, points, symbols), standalone equations, frontend modules, e2e count, perf count and its six playground lines. `git status --short` must be clean apart from the records being written.

- [ ] **Step 4: Write D93**

Append `## D93 — M1's three playgrounds, and the premise X1 could not be built on` to `../DEVIATIONS.md`, with these paragraphs, each stating measured facts only:

1. **Plan and spec**, with paths.
2. **The premise.** The four findings of spec §2, one paragraph each, with the quotations and the files corrected in Task 3 (M1 s4 and its notes, kp X1, the frozen X1, D-09, SRS §10, design §2.3, the adapter docstring). State that issue #94 was re-read verbatim through the GitHub API and matched.
3. **The metric boundary held**: F6 without mR and F7 without γ, R or mR, and why (spec §1).
4. **Rule 9 amended and rule 12 added**, with the three breaks watched failing in Task 2 Step 8 and their messages.
5. **The mutation run**: the table from Task 10 Step 2.
6. **M1's overflow at XGA**, the nine figures, and any accepted as a decision.
7. **Verification**: the counts from Step 3.
8. **Not done, and why**: spec §9's list.

- [ ] **Step 5: Write VERIFICATION §17**

Append `## 17. The M1 playgrounds — measured, <date>` to `docs/VERIFICATION.md`, in §15's shape: the gate table, `test:e2e` with the delta from 39 and its reason, the contrast walk's row counts for M1's three steps at three panels with `skipped` empty, the type floor, the six `check:perf` playground lines as printed, the mutation table, and "What this section does not claim" (this machine, not the ARM64 target; the contrast is the browser's computed value).

- [ ] **Step 6: Update the counts everywhere they are quoted**

In `docs/INDEX.md`: header date; §1 rows for `specs/2026-09-26-playgrounds-m1-design.md` and `plans/2026-09-26-playgrounds-m1.md` (**executed**); D1…D93; VERIFICATION through §17; §4 "its eleven lint rules" → "its twelve lint rules"; §5 a paragraph "M1's three playgrounds landed <date>" and the Verification paragraph's counts; §6 a trap row: "A binding decision can describe an artefact the project never obtained, and nothing compares the two | `DEVIATIONS.md` D93". In `../CLAUDE.md`: "3 playgrounds" → "6 playgrounds", "All 95 steps … 190 notes" → "All 98 steps … 196 notes", "M0 carries three (F1, F2, F8); 25 live knowledge points have none" → "M0 carries three (F1, F2, F8) and M1 three (F6, F7, X1); 22 live knowledge points have none", the e2e and perf counts, "five labs and three playgrounds" → "five labs and six playgrounds", `D1…D93`, "all 93 logged deviations", and §17 in the VERIFICATION list. In `../README.md`: the Status paragraph's counts, pointing at §17.

- [ ] **Step 7: Check the documents agree with the run**

```bash
grep -nE "vitest|TypeScript tests|test:e2e|check:perf|D1…D|logged deviations|playgrounds|steps carry|notes" ../CLAUDE.md ../README.md docs/INDEX.md | grep -E "[0-9]"
```

Every figure in the output matches Step 3's record; any that does not is corrected before the commit.

- [ ] **Step 8: Commit**

```bash
git add ../DEVIATIONS.md docs ../CLAUDE.md ../README.md ../docs/superpowers/specs
git commit -m "docs(sgs): D93, VERIFICATION §17, and the counts M1's run produced"
```

- [ ] **Step 9: Review before handing back**

Dispatch a fresh reviewer over `git diff fix/sgs-lint-test-gaps...feat/playgrounds-m1` with three questions: is every figure X1 shows traceable to a quote the lint checks; does any playground compute a metric; does any document quote a count the Step 3 run did not produce. Verify each finding before acting on it. Do not merge.
