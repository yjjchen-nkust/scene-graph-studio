# Plan 02 — Graph, Labs L1–L2, Content Corpus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student can open an image, build a scene graph by clicking boxes, submit it, and read a four-colour diff whose numbers move when they drag K or flip the graph constraint — inside a bilingual fifteen-module corpus seeded from the frozen knowledge map.

**Architecture:** A Cytoscape wrapper and a hand-rolled SVG overlay render one `SceneGraph`; both accept an optional `Verdict[]` and switch into diff mode. L1 and L2 are thin: they assemble those two components plus the `sgg-metrics` engine from plan 01 and keep their whole state in the URL. The content corpus is harvested mechanically from `system/web/knowledge-map` and then authored into MDX.

**Tech Stack:** React 19 · Cytoscape 3.34.3 · cytoscape-dagre 4.0.1 · D3 7.9.0 · MDX · KaTeX 0.18.7 · Vitest

**Spec:** `../specs/2026-09-15-scene-graph-studio-SRS.md` §2.1, §11 · `…-PRD.md` §6.2, §6.3, §6.4, §7
**Decisions:** D-13 (harvest), D-14 (the `evaluate()` hazard), D-07 (provenance rendering)
**Contracts:** §2.4 shells, §2.6 components, §2.7 i18n, §3 content schema

## Global Constraints

See `2026-09-15-00-master.md` § Global constraints. The four that bite hardest here:

- **The overlay is hand-rolled SVG.** One `<img>`, one absolutely positioned `<svg>`, every box and edge a real DOM node. No canvas library. SRS §2.1 gives the reasoning; Konva enters only if alpha-blended mask compositing proves necessary, and that is a decision to re-open, not to assume.
- **The diff palette distinguishes verdicts by dash pattern and marker as well as hue** (NFR-5). A reviewer must be able to read the diff in greyscale.
- **No component formats a bare number as a metric.** The renderer accepts `MetricValue` only.
- **`pg.js evaluate()` is not the engine** (D-14). The harvest takes `CLUSTERS`, `MATH` and `DERIV`, and nothing else.

---

## File structure

| File | Responsibility |
|---|---|
| `system/tools/harvest.mjs` | Parses `kp-data.js` and `pg.js`, emits three JSON corpora |
| `system/frontend/src/graph/SceneGraphView.tsx` | Cytoscape wrapper; diff mode |
| `system/frontend/src/graph/ImageOverlay.tsx` | SVG overlay; view and draw modes |
| `system/frontend/src/graph/palette.ts` | The four verdict styles, one definition shared by both components |
| `system/frontend/src/graph/DiffLegend.tsx` | The legend, so a colour is never unexplained |
| `system/frontend/src/components/MetricReadout.tsx` | The only component that renders a `MetricValue` |
| `system/frontend/src/labs/L1/TripletBuilder.tsx` | Click two boxes, choose a predicate, submit |
| `system/frontend/src/labs/L2/MetricExplorer.tsx` | K, constraint, protocol, τ; four metrics move |
| `system/frontend/src/content/m00…m14.{zh-TW,en}.mdx` | The fifteen modules |
| `system/frontend/src/content/registry.ts` | Module id → compiled `ModuleStep[]`, both locales |
| `system/frontend/src/content/math/{Intuition,Formal,Worked,Implications}.tsx` | The four-part contract as components |
| `data/content/{kp,math,deriv}.json` | Harvest output |
| `data/content/papers.json` | 35 paper cards |
| `data/content/leaderboards.json` | Frozen per-paper tables |
| `system/frontend/src/pages/FieldMap.tsx` | Filterable branch map over `papers.json` |
| `system/web/knowledge-map/FROZEN.md` | The freeze notice |

---

### Task 1: Harvest the knowledge map, then freeze it

**Files:**
- Create: `system/tools/harvest.mjs`, `data/content/kp.json`, `data/content/math.json`, `data/content/deriv.json`, `system/web/knowledge-map/FROZEN.md`, `system/tools/test/harvest.test.mjs`

**Interfaces:**
- Produces: `KnowledgePoint[]` per contracts §3.4, plus `Record<string, string>` for `math` and `deriv`, keyed by knowledge-point id.

- [ ] **Step 1: Write the failing test**

`system/tools/test/harvest.test.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const kp = JSON.parse(readFileSync('data/content/kp.json', 'utf-8'));
const math = JSON.parse(readFileSync('data/content/math.json', 'utf-8'));
const deriv = JSON.parse(readFileSync('data/content/deriv.json', 'utf-8'));

describe('harvest', () => {
  it('carries all 93 knowledge points across 12 clusters', () => {
    expect(kp.length).toBe(93);
    expect(new Set(kp.map((k) => k.cluster)).size).toBe(12);
  });

  it('gives every point both languages and a control surface', () => {
    for (const k of kp) {
      expect(k.title_en, k.id).toBeTruthy();
      expect(k.title_zh, k.id).toBeTruthy();
      expect(k.knobs, k.id).toBeTruthy();
      expect(['live', 'spec']).toContain(k.status);
    }
  });

  it('keys every formula to a knowledge point that exists', () => {
    const ids = new Set(kp.map((k) => k.id));
    for (const id of [...Object.keys(math), ...Object.keys(deriv)]) {
      expect(ids.has(id), `${id} has a formula but no knowledge point`).toBe(true);
    }
  });

  it('leaves no display math with a stray line break outside an alignment', () => {
    // The failure audit.js exists to catch: \\ inside \[ ... \] renders as a red MathJax error.
    for (const [id, tex] of Object.entries({ ...math, ...deriv })) {
      const bare = tex.replace(/\\begin\{(aligned|gathered|array|cases)\}[\s\S]*?\\end\{\1\}/g, '');
      expect(bare.includes('\\\\'), `${id} has \\\\ outside an alignment`).toBe(false);
    }
  });

  it('did not harvest the teaching-toy evaluator', () => {
    const all = JSON.stringify({ kp, math, deriv });
    expect(all.includes('function evaluate')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tools/test/harvest.test.mjs`
Expected: FAIL with `ENOENT` on `data/content/kp.json`

- [ ] **Step 3: Write the harvester**

`system/tools/harvest.mjs` reads the two source files as text and evaluates only their data declarations in a `node:vm` context with no globals, so that `pg.js`'s DOM-touching immediately-invoked functions never run:

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const SRC = 'web/knowledge-map';

function extract(file, declarations) {
  const text = readFileSync(`${SRC}/${file}`, 'utf-8');
  const picked = declarations.map((name) => {
    const start = text.indexOf(`${name === 'CLUSTERS' ? 'const' : 'var'} ${name}=`) >= 0
      ? text.indexOf(`${name === 'CLUSTERS' ? 'const' : 'var'} ${name}=`)
      : text.indexOf(`var ${name} =`);
    if (start < 0) throw new Error(`${name} not found in ${file}`);
    // Balance braces/brackets from the first delimiter after the '='.
    const open = text.indexOf(text[text.indexOf('=', start) + 1] === '[' ? '[' : '{',
                              text.indexOf('=', start));
    const close = matchDelimiter(text, open);
    return `const ${name} = ${text.slice(open, close + 1)};`;
  }).join('\n');
  const context = vm.createContext(Object.create(null));
  vm.runInContext(`${picked}\nresult = { ${declarations.join(', ')} };`, context);
  return context.result;
}

function matchDelimiter(text, open) {
  const pairs = { '[': ']', '{': '}' };
  const close = pairs[text[open]];
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'") { i = skipString(text, i); continue; }
    if (ch === text[open]) depth += 1;
    else if (ch === close) { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error('unbalanced');
}

function skipString(text, start) {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === quote) return i;
  }
  throw new Error('unterminated string');
}

const { CLUSTERS } = extract('kp-data.js', ['CLUSTERS']);
const { MATH, DERIV } = extract('pg.js', ['MATH', 'DERIV']);

const kp = CLUSTERS.flatMap((c) =>
  c.kps.map(([id, en, zh, knobs, status]) => ({
    id, cluster: c.id, cluster_en: c.en, cluster_zh: c.zh,
    title_en: en, title_zh: zh, knobs, status,
    ...(MATH[id] ? { math: MATH[id] } : {}),
    ...(DERIV[id] ? { deriv: DERIV[id] } : {}),
  })));

mkdirSync('data/content', { recursive: true });
writeFileSync('data/content/kp.json', JSON.stringify(kp, null, 2));
writeFileSync('data/content/math.json', JSON.stringify(MATH, null, 2));
writeFileSync('data/content/deriv.json', JSON.stringify(DERIV, null, 2));
console.log(`harvested ${kp.length} knowledge points, ${Object.keys(MATH).length} formulas, ` +
            `${Object.keys(DERIV).length} derivations`);
```

- [ ] **Step 4: Run the harvest, then the test**

```bash
node tools/harvest.mjs
npx vitest run tools/test/harvest.test.mjs
```

Expected: `harvested 93 knowledge points, 28 formulas, 22 derivations`, then 5 passed.

- [ ] **Step 5: Freeze the page and commit**

`system/web/knowledge-map/FROZEN.md`:

```markdown
# Frozen

This page is frozen as of 2026-09-15. Its knowledge-point inventory, its `MATH` map and its
`DERIV` map were harvested into `data/content/` by `system/tools/harvest.mjs` and are now authored
in the MDX corpus under `system/frontend/src/content/`.

**Do not extend this page.** Content changes belong in `data/content/` and the MDX modules.
It is kept because it is the only artefact that runs with no Node toolchain at all, which
makes it the last-resort offline fallback, and because `system/tools/audit.js` and `system/tools/check.js`
still gate it in CI so it cannot rot silently.

`pg.js`'s `evaluate()` is a teaching instrument over fifteen hard-coded rows. It is not the
evaluation engine and was deliberately excluded from the harvest — see decision D-14.
```

```bash
git add tools/harvest.mjs tools/test/harvest.test.mjs data/content web/knowledge-map/FROZEN.md
git commit -m "feat(sgs): harvest 93 knowledge points and 50 LaTeX blocks; freeze the static page"
```

---

### Task 2: The verdict palette and the metric readout

**Files:**
- Create: `system/frontend/src/graph/palette.ts`, `system/frontend/src/graph/DiffLegend.tsx`, `system/frontend/src/components/MetricReadout.tsx`, `system/frontend/src/components/test/MetricReadout.test.tsx`

**Interfaces:**
- Produces: `VERDICT_STYLE: Record<VerdictKind, VerdictStyle>` where `VerdictStyle` is `{ stroke, dash, marker, labelKey }`. Both graph components and the legend read it; no component hard-codes a colour.

- [ ] **Step 1: Write the failing test**

`system/frontend/src/components/test/MetricReadout.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MetricValue } from 'sgg-metrics';
import { MetricReadout } from '../MetricReadout';

const base: MetricValue = {
  value: 0.275, metric: 'R', k: 50, protocol: 'sgdet', constraint: 'graph',
  source: 'engine', verified: true, fidelity: 'measured',
};

describe('MetricReadout', () => {
  it('always shows the protocol and the constraint beside the number', () => {
    render(<MetricReadout value={base} />);
    expect(screen.getByText(/27\.5/)).toBeTruthy();
    expect(screen.getByText(/sgdet/i)).toBeTruthy();
    expect(screen.getByText(/graph/i)).toBeTruthy();
  });

  it('renders a null value as an em dash with a reason, never as zero', () => {
    render(<MetricReadout value={{ ...base, value: null }} />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('marks an unverified figure distinctly', () => {
    const { container } = render(<MetricReadout value={{ ...base, verified: false }} />);
    expect(container.querySelector('[data-verified="false"]')).toBeTruthy();
  });

  it('marks a reconstructed figure distinctly from a measured one', () => {
    const { container } = render(
      <MetricReadout value={{ ...base, fidelity: 'reconstructed' }} />);
    expect(container.querySelector('[data-fidelity="reconstructed"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run frontend/src/components`
Expected: FAIL — cannot resolve `../MetricReadout`

- [ ] **Step 3: Implement the palette and the readout**

`system/frontend/src/graph/palette.ts`:

```typescript
import type { VerdictKind } from 'sgg-metrics';

export interface VerdictStyle {
  stroke: string;
  dash: string;          // SVG stroke-dasharray; '' is solid
  width: number;
  marker: 'filled' | 'open' | 'hollow';
  labelKey: string;      // i18n key for the legend
}

/** NFR-5: hue is never the only channel. Dash and marker carry the same information. */
export const VERDICT_STYLE: Record<VerdictKind, VerdictStyle> = {
  match:        { stroke: '#1b7f4b', dash: '',    width: 2, marker: 'filled', labelKey: 'diff.match' },
  spurious:     { stroke: '#b42318', dash: '',    width: 4, marker: 'open',   labelKey: 'diff.spurious' },
  missed:       { stroke: '#667085', dash: '6 4', width: 2, marker: 'open',   labelKey: 'diff.missed' },
  localization: { stroke: '#b54708', dash: '2 3', width: 3, marker: 'hollow', labelKey: 'diff.localization' },
};
```

`system/frontend/src/components/MetricReadout.tsx`:

```typescript
import type { MetricValue } from 'sgg-metrics';
import { useLocale } from '../i18n/useLocale';

const LABEL: Record<MetricValue['metric'], string> = {
  R: 'R', mR: 'mR', ngR: 'ng-R', zR: 'zR',
};

export function MetricReadout({ value, reason }: { value: MetricValue; reason?: string }) {
  const { t } = useLocale();
  const shown = value.value === null ? '—' : (value.value * 100).toFixed(1);
  const title = value.value === null
    ? (reason ?? t('metric.not_applicable'))
    : `${t('metric.source')}: ${value.source}`;
  return (
    <span
      className="inline-flex items-baseline gap-2"
      data-verified={value.verified}
      data-fidelity={value.fidelity}
      title={title}
    >
      <span className="font-mono text-2xl">{shown}</span>
      <span className="text-sm text-slate-600">
        {LABEL[value.metric]}@{value.k} · {value.protocol} · {value.constraint}
      </span>
    </span>
  );
}
```

The component takes `MetricValue` and there is no overload taking `number`. Contracts §1.0 makes that refusal the enforcement of SRS §4.5.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run frontend/src/components`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/graph/palette.ts frontend/src/graph/DiffLegend.tsx frontend/src/components
git commit -m "feat(sgs): colour-blind-safe verdict palette; the only component that renders a metric"
```

---

### Task 3: The SVG image overlay

**Files:**
- Create: `system/frontend/src/graph/ImageOverlay.tsx`, `system/frontend/src/graph/geometry.ts`, `system/frontend/src/graph/test/ImageOverlay.test.tsx`

**Interfaces:**
- Consumes: `SGObject`, `SGRelationship`, `Verdict`, `VERDICT_STYLE`.
- Produces: the props interface in contracts §2.6, plus `centroid(bbox): {cx, cy}` and `clientToImage(event, svg): {x, y}` in `geometry.ts`.

- [ ] **Step 1: Write the failing test**

`system/frontend/src/graph/test/ImageOverlay.test.tsx`:

```typescript
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageOverlay } from '../ImageOverlay';

const objects = [
  { object_id: 1, names: ['person'], bbox: { x: 10, y: 10, w: 40, h: 60 } },
  { object_id: 2, names: ['table'], bbox: { x: 80, y: 90, w: 50, h: 30 } },
];

const base = { imageUrl: '/images/x.png', width: 200, height: 150, objects, mode: 'view' as const };

describe('ImageOverlay', () => {
  it('sets a viewBox in intrinsic image pixels so boxes need no scaling', () => {
    const { container } = render(<ImageOverlay {...base} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 200 150');
    expect(container.querySelector('svg')?.getAttribute('preserveAspectRatio'))
      .toBe('xMidYMid meet');
  });

  it('renders one rect per object, as a real DOM node', () => {
    const { container } = render(<ImageOverlay {...base} />);
    expect(container.querySelectorAll('rect[data-object-id]').length).toBe(2);
  });

  it('draws edges between box centroids', () => {
    const { container } = render(
      <ImageOverlay {...base}
        relationships={[{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }]} />);
    const path = container.querySelector('path[data-relationship-id="1"]');
    expect(path?.getAttribute('d')).toContain('M 30 40');   // centroid of object 1
    expect(path?.getAttribute('d')).toContain('105 105');   // centroid of object 2
  });

  it('styles an edge by its verdict, with a dash pattern as well as a colour', () => {
    const { container } = render(
      <ImageOverlay {...base}
        relationships={[{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }]}
        verdicts={[{ pred_index: 0, gt_index: null, verdict: 'localization',
                     iou_subject: 0.2, iou_object: 0.9, rank: 1, entered_top_k: { '20': true } }]} />);
    const path = container.querySelector('path[data-relationship-id="1"]');
    expect(path?.getAttribute('stroke')).toBe('#b54708');
    expect(path?.getAttribute('stroke-dasharray')).toBe('2 3');
  });

  it('reports a drawn box in image pixels, not client pixels', () => {
    const onBoxDrawn = vi.fn();
    const { container } = render(
      <ImageOverlay {...base} mode="draw" onBoxDrawn={onBoxDrawn} />);
    const svg = container.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 300 }) as DOMRect;   // rendered at 2x
    fireEvent.pointerDown(svg, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 80 });
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 80 });
    expect(onBoxDrawn).toHaveBeenCalledWith({ x: 10, y: 10, w: 50, h: 30 });
  });

  it('never emits a zero-area box', () => {
    const onBoxDrawn = vi.fn();
    const { container } = render(
      <ImageOverlay {...base} mode="draw" onBoxDrawn={onBoxDrawn} />);
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    expect(onBoxDrawn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run frontend/src/graph`
Expected: FAIL — cannot resolve `../ImageOverlay`

- [ ] **Step 3: Implement**

`system/frontend/src/graph/geometry.ts`:

```typescript
import type { BBox } from 'sgg-metrics';

export function centroid(b: BBox): { cx: number; cy: number } {
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

/** Convert a pointer event to intrinsic image pixels, honouring xMidYMid meet letterboxing. */
export function clientToImage(
  event: { clientX: number; clientY: number },
  svg: SVGSVGElement,
  width: number,
  height: number,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / width, rect.height / height);
  const padX = (rect.width - width * scale) / 2;
  const padY = (rect.height - height * scale) / 2;
  return {
    x: (event.clientX - rect.left - padX) / scale,
    y: (event.clientY - rect.top - padY) / scale,
  };
}
```

`ImageOverlay.tsx` renders the `<img>` and an absolutely positioned `<svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">`; `<rect data-object-id>` per object; `<path data-relationship-id>` per relationship, `d` built from the two centroids; masks as `<path>` when `mask` is present. In `draw` mode it tracks pointer down, move and up through `clientToImage`, renders a live rubber-band rect, and calls `onBoxDrawn` only when `w > 1 && h > 1`. Verdict styling reads `VERDICT_STYLE`, never a literal.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run frontend/src/graph`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/graph/ImageOverlay.tsx frontend/src/graph/geometry.ts frontend/src/graph/test
git commit -m "feat(sgs): SVG image overlay with draw mode and verdict styling"
```

---

### Task 4: The Cytoscape graph view

**Files:**
- Create: `system/frontend/src/graph/SceneGraphView.tsx`, `system/frontend/src/graph/cyStyle.ts`, `system/frontend/src/graph/test/SceneGraphView.test.tsx`

**Interfaces:**
- Consumes: `SceneGraph`, `Verdict[]`, `VERDICT_STYLE`.
- Produces: the props interface in contracts §2.6.

- [ ] **Step 1: Write the failing test**

Assert: one Cytoscape node per object and one edge per relationship; `missed` verdicts add a ghost edge that exists in no `relationships` array; the dagre layout is used when `layout === 'dagre'` and node positions are pinned to box centroids when `layout === 'preset'`; `onEdgeClick` fires with the `relationship_id`; and the instance is destroyed on unmount, asserted by spying on `cy.destroy`.

```typescript
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildElements } from '../SceneGraphView';

const graph = {
  image_id: 'i', dataset: 'vg150-sgb' as const, width: 10, height: 10,
  objects: [
    { object_id: 1, names: ['person'], bbox: { x: 0, y: 0, w: 4, h: 4 } },
    { object_id: 2, names: ['table'], bbox: { x: 6, y: 6, w: 4, h: 4 } },
  ],
  relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }],
  provenance: { kind: 'user' as const, fidelity: 'measured' as const },
};

describe('buildElements', () => {
  it('produces one node per object and one edge per relationship', () => {
    const els = buildElements(graph, undefined, []);
    expect(els.filter((e) => e.group === 'nodes').length).toBe(2);
    expect(els.filter((e) => e.group === 'edges').length).toBe(1);
  });

  it('adds a ghost edge for every missed ground-truth relationship', () => {
    const els = buildElements(graph, graph, [
      { pred_index: -1, gt_index: 0, verdict: 'missed', iou_subject: null,
        iou_object: null, rank: 0, entered_top_k: {} },
    ]);
    const ghosts = els.filter((e) => e.data?.verdict === 'missed');
    expect(ghosts.length).toBe(1);
  });

  it('pins node positions at box centroids under the preset layout', () => {
    const els = buildElements(graph, undefined, [], 'preset');
    const node = els.find((e) => e.data?.id === 'o1');
    expect(node?.position).toEqual({ x: 2, y: 2 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run frontend/src/graph/test/SceneGraphView.test.tsx`
Expected: FAIL — `buildElements` is not exported

- [ ] **Step 3: Implement**

Export `buildElements(pred, gt, verdicts, layout)` as a pure function so the element construction is testable without a DOM-mounted Cytoscape instance. The component then mounts Cytoscape in a `useEffect`, registers `cytoscape-dagre` once at module scope, applies `cyStyle.ts` — which maps `data(verdict)` to `VERDICT_STYLE`'s `stroke`, `dash`, `width` and arrow shape — and calls `cy.destroy()` in the effect's cleanup.

Ghost edges for `missed` verdicts carry `data.verdict = 'missed'` and an id prefixed `ghost-`, so a click handler can tell a prediction from an unmatched ground truth.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run frontend/src/graph`
Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/graph/SceneGraphView.tsx frontend/src/graph/cyStyle.ts
git commit -m "feat(sgs): Cytoscape graph view with ghost edges for missed ground truth"
```

---

### Task 5: L1 Triplet Builder

**Files:**
- Create: `system/frontend/src/labs/L1/TripletBuilder.tsx`, `system/frontend/src/labs/useLabParams.ts`, `system/frontend/src/labs/L1/test/TripletBuilder.test.tsx`

**Interfaces:**
- Consumes: `ImageOverlay`, `SceneGraphView`, `MetricReadout`, `evaluate` from `sgg-metrics`.
- Produces: `useLabParams<T>(defaults)` — reads and writes lab state as URL search parameters, per contracts §2.2.

- [ ] **Step 1: Write the failing test**

Assert: clicking a box selects a subject; clicking a second selects an object; the predicate dropdown is populated from the dataset's predicate list; Submit produces a diff whose verdict counts match `evaluate`'s; the URL carries the selection after submit; and the graph the student built validates as a `SceneGraph` with `provenance.kind === 'user'`.

```typescript
it('scores the student graph with the same engine as the backend', async () => {
  render(<TripletBuilder gt={GT} />);
  fireEvent.click(screen.getByTestId('box-1'));
  fireEvent.click(screen.getByTestId('box-2'));
  fireEvent.change(screen.getByLabelText(/predicate/i), { target: { value: 'on' } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  const expected = evaluate({ gt: GT, pred: expectedStudentGraph(), ...DEFAULT_PARAMS });
  expect(await screen.findByTestId('matched-count'))
    .toHaveTextContent(String(expected.matched_count));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run frontend/src/labs/L1`
Expected: FAIL — cannot resolve `../TripletBuilder`

- [ ] **Step 3: Implement**

`useLabParams` wraps `useSearchParams` and codes each value with a per-key serializer, so `/lab/L1?ds=vg150-sgb&img=2317469&s=1&o=2&p=on` fully determines the view. The lab holds no local copy of that state.

The component composes the two graph components already built: `ImageOverlay` in `view` mode with `selection` driven by the two clicks, `SceneGraphView` in `dagre` layout for the graph the student is building, and — after Submit — both in diff mode with the `Verdict[]` from `evaluate`.

Scoring runs in the browser through `sgg-metrics`, not through `/api/eval`. Both engines are held identical by plan 01's parity harness, so the choice is about latency: NFR-8 allows 100 ms for a lab interaction and a round trip does not fit reliably.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run frontend/src/labs/L1`
Expected: all green

- [ ] **Step 5: Commit**

```bash
git add frontend/src/labs
git commit -m "feat(sgs): L1 Triplet Builder — ground, relate, submit, diff"
```

---

### Task 6: L2 Metric Explorer

**Files:**
- Create: `system/frontend/src/labs/L2/MetricExplorer.tsx`, `system/frontend/src/labs/L2/MetricCurve.tsx`, `system/frontend/src/labs/L2/test/MetricExplorer.test.tsx`

**Interfaces:**
- Consumes: `evaluate`, `MetricReadout`, D3 for the curve.
- Produces: nothing other labs depend on.

- [ ] **Step 1: Write the failing test**

The three assertions that matter are invariants, not pixels:

```typescript
it('R@K is monotone in K', () => {
  const values = [20, 50, 100].map((k) => metricFor(k, 'R', 'graph'));
  expect(values[0]!).toBeLessThanOrEqual(values[1]!);
  expect(values[1]!).toBeLessThanOrEqual(values[2]!);
});

it('dropping the graph constraint cannot lower recall', () => {
  expect(metricFor(50, 'R', 'none')).toBeGreaterThanOrEqual(metricFor(50, 'R', 'graph'));
});

it('the protocol ordering invariant holds on this fixture', () => {
  // SRS §11.2: R_SGDet <= R_SGCls <= R_PredCls, for every model and every fixture
  expect(metricFor(50, 'R', 'graph', 'sgdet'))
    .toBeLessThanOrEqual(metricFor(50, 'R', 'graph', 'sgcls'));
  expect(metricFor(50, 'R', 'graph', 'sgcls'))
    .toBeLessThanOrEqual(metricFor(50, 'R', 'graph', 'predcls'));
});

it('raising tau cannot raise recall', () => {
  expect(metricFor(50, 'R', 'graph', 'sgdet', 0.75))
    .toBeLessThanOrEqual(metricFor(50, 'R', 'graph', 'sgdet', 0.5));
});
```

These are the invariants SRS §11.2 says are asserted in the test suite. Asserting them in the lab's own tests — over the lab's own fixture — is what makes a regression in the engine visible as a broken lesson.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run frontend/src/labs/L2`
Expected: FAIL — cannot resolve `../MetricExplorer`

- [ ] **Step 3: Implement**

Controls: a K slider over {1…100} with ticks at 20, 50, 100; a three-way constraint knob; a three-way protocol knob; a τ slider labelled with SRS §4.1's note that 0.5 is field convention and not stated in `METRICS.md`; and a `single_mpo`/`multi_mpo` toggle that is disabled with a reason when the loaded image carries no masks.

The four metrics render through `MetricReadout`. `MetricCurve` draws R and mR against K with D3, both curves on one axis, so the gap between them is the visible object rather than a number to compare.

Every control writes to the URL through `useLabParams`.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run frontend/src/labs/L2`
Expected: all green

- [ ] **Step 5: Commit**

```bash
git add frontend/src/labs/L2
git commit -m "feat(sgs): L2 Metric Explorer with the monotonicity and protocol invariants under test"
```

---

### Task 7: The MDX pipeline and the four-part contract

**Files:**
- Create: `system/frontend/src/content/math/{Intuition,Formal,Worked,Implications}.tsx`, `system/frontend/src/content/registry.ts`, `system/frontend/src/content/m00.{zh-TW,en}.mdx`
- Modify: `system/frontend/vite.config.ts`, `system/tools/content_lint.mjs`

**Interfaces:**
- Produces: `getModule(id, locale) -> ModuleStep[]`, per contracts §2.4.

- [ ] **Step 1: Extend the content lint first, and watch it fail**

Add to `system/tools/content_lint.mjs`:

- every module exists in both locales;
- the two locales' `steps` arrays have equal length and identical `id`s in order;
- every `math` step's body contains `<Intuition>`, `<Formal>`, `<Worked>` and `<Implications>`, in that order;
- every entry in `claims` carries `source`, `source_table`, `constraint`, `protocol` and `verified`;
- the union of every module's `symbols` contains no `sym` with two different glosses;
- every `knowledge_points` entry resolves to an id in `data/content/kp.json`.

Run: `node tools/content_lint.mjs` → FAIL, because no modules exist yet.

- [ ] **Step 2: Wire the pipeline**

```typescript
import mdx from '@mdx-js/rollup';
import rehypeKatex from 'rehype-katex';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

// in plugins, before react():
mdx({
  remarkPlugins: [remarkFrontmatter, [remarkMdxFrontmatter, { name: 'meta' }], remarkMath],
  rehypePlugins: [rehypeKatex],
}),
```

Import `katex/dist/katex.min.css` once in `main.tsx`. The fonts come from npm and are bundled; nothing is fetched at run time, which is what NFR-1 requires.

- [ ] **Step 3: Write the four contract components and M0 in both locales**

The four components are deliberately thin — a heading drawn from `t()` and a styled container — because their value is structural. `content_lint.mjs` can only check the contract if the contract has names.

`m00.zh-TW.mdx` and `m00.en.mdx` carry the frontmatter of contracts §3.1 and the same four `steps`. M0 is "Why scene graphs — from labels to structure", anchored on the field map, drawing knowledge points `F1`, `F2`, `F5` and `F8` from the harvest.

- [ ] **Step 4: Run the lint and the app**

```bash
node tools/content_lint.mjs
cd frontend && npm run dev
```

Expected: the lint passes for M0; `/m/m00` renders in both locales; the mathematics is typeset, not ASCII; and switching the locale swaps the text without a reload.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/content frontend/vite.config.ts tools/content_lint.mjs
git commit -m "feat(sgs): MDX pipeline with build-time KaTeX and the four-part math contract enforced"
```

---

### Task 8: The remaining fourteen modules

**Files:**
- Create: `system/frontend/src/content/m01…m14.{zh-TW,en}.mdx`

This is authoring, not engineering. It is one task because each module follows the identical shape established in Task 7, and splitting it into fourteen would produce fourteen near-identical task bodies.

**Write them in the order M1, M2, M3, M4, M11, then the rest.** M11 is the anchor and is written early so the corpus is checked against the paper before fourteen modules exist to revise.

**M11 has a source document.** `../specs/2026-09-16-indvissgg-reading.md` is a full primary-source reading of the anchor paper, already in the four-part shape SRS §11.2 requires, with every figure quoted against its named table. Authoring M11 is a transcription of that document into MDX, not a fresh reading of the paper. Its §10 carries the curriculum position, the opening thesis, the knowledge points to attach, and the two errors an earlier summary contained — do not reintroduce them.

- [ ] **Step 1: Assign every knowledge point to a module**

Fill the `module` field of every record in `data/content/kp.json`. All 93 must be assigned; `content_lint.mjs` reports the unassigned count, and reaching zero is this step's exit condition.

The cluster-to-module mapping follows PRD §7: `F` → M0–M2, `E` → M3–M4, `T` → M5, `D` → M6, `O` → M7, `V` → M9, `L` → M10–M11, `S` → M12, `G` → M13, `X` → threaded through every module at the point where the hazard would otherwise mislead, per SRS §10.

- [ ] **Step 2: Write each module against the harvested material**

For each module: the frontmatter of contracts §3.1; a symbol table; one `math` step per assigned knowledge point that has a `math` entry, using the harvested LaTeX verbatim as `<Formal>` and the harvested `deriv` as `<Worked>`/`<Implications>`; `<Intuition>` written fresh, because the harvest has no intuition slot.

**Verbatim means verbatim.** The harvested LaTeX was audited by `system/tools/audit.js` for the stray-`\\` failure mode. Re-typing it re-introduces that risk.

- [ ] **Step 3: Write the Chinese to the project register**

Formal written Chinese. Titles are noun phrases, never sentences or questions. No second person. Technical terms stay in English inside Chinese prose — `scene graph`, `predicate`, `Recall@K`, `graph constraint`. Chinese punctuation throughout: 、。：「」（）／.

- [ ] **Step 4: Run the lint after each module**

Run: `node tools/content_lint.mjs`

A module is not finished until the lint passes for it. Writing all fifteen and then linting produces a pile of symbol-table conflicts that is far harder to resolve than fifteen small ones.

- [ ] **Step 5: Commit per module**

```bash
git commit -m "docs(sgs): module M04 — metrics, bilingual, 6 knowledge points"
```

---

### Task 9: Paper cards and the field map

**Files:**
- Create: `data/content/papers.json`, `system/frontend/src/pages/FieldMap.tsx`, `system/frontend/src/pages/PaperCard.tsx`, `system/tools/test/papers.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
const papers = JSON.parse(readFileSync('data/content/papers.json', 'utf-8'));

it('gives every paper an identifier a reader can chase', () => {
  for (const p of papers) expect(p.doi || p.arxiv, p.key).toBeTruthy();
});

it('tags every reported number with its protocol, constraint and source table', () => {
  for (const p of papers) {
    for (const r of p.reported) {
      expect(r.protocol, `${p.key}`).toBeTruthy();
      expect(r.constraint, `${p.key}`).toBeTruthy();
      expect(r.source_table, `${p.key}`).toBeTruthy();
    }
  }
});

// D-21: two tiers, and no unverified tier.
const TIER_A = ['imp', 'neural-motifs', 'vctree', 'motifs-tde', 'reltr', 'egtr', 'sgtr',
  'psgformer', 'psgtr', 'hilo', 'sttran', 'indvissgg'];

it('gives every scored method at least one reported number', () => {
  for (const key of TIER_A) {
    const card = papers.find((p) => p.key.replace(/-\d{4}$/, '') === key);
    expect(card, `missing tier-A card ${key}`).toBeTruthy();
    expect(card.reported.length, `${key} is tier A but carries no numbers`).toBeGreaterThan(0);
  }
});

it('carries no unverified number anywhere, in either tier', () => {
  for (const p of papers) {
    for (const r of p.reported) {
      expect(r.verified, `${p.key}: an unverified number is not carried at all`).toBe(true);
    }
  }
});

it('resolves every predecessor to a paper that exists', () => {
  const keys = new Set(papers.map((p) => p.key));
  for (const p of papers) {
    if (p.predecessor) expect(keys.has(p.predecessor), `${p.key} → ${p.predecessor}`).toBe(true);
  }
});

it('states the defect fixed wherever a predecessor is named', () => {
  for (const p of papers) {
    if (p.predecessor) expect(p.defect_fixed_en, p.key).toBeTruthy();
  }
});

it('covers every method named in the curriculum', () => {
  const required = ['imp', 'neural-motifs', 'vctree', 'gps-net', 'tde', 'cogtree', 'dlfe',
    'nice', 'ietrans', 'st-sgg', 'pe-net', 'ra-sgg', 'fcsgg', 'reltr', 'sgtr', 'egtr',
    'dsgg', 'speaq', 'hydra-sgg', 'react', 'psgformer', 'vs3', 'ovsgtr', 'pgsg',
    'sttran', 'tempura', 'oed', 'diffvsgg', 'uno', '3dssg', 'hydra', 'conceptgraphs',
    'clio', 'sayplan', 'indvissgg'];
  const keys = new Set(papers.map((p) => p.key.replace(/-\d{4}$/, '')));
  for (const r of required) expect(keys.has(r), `missing ${r}`).toBe(true);
});
```

The last assertion is the one that keeps the corpus honest against PRD §7: every method the curriculum names must have a card.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tools/test/papers.test.mjs` → FAIL, `ENOENT`.

- [ ] **Step 3: Author the corpus**

**35 cards across the eight branches, in two tiers (decision D-21).** Write them branch by branch, in curriculum order, and run the test after each branch.

**Tier A — ~12 scored methods.** IMP, Neural Motifs (which carries FREQ), VCTree, MOTIFS-TDE, RelTR, EGTR, SGTR, PSGFormer, PSGTR, HiLo, STTran, IndVisSGG. Full `reported` arrays, every entry read off the table named in `source_table`.

**Tier B — the remaining ~23.** Venue, year, DOI or arXiv, core idea, predecessor, and the defect it fixes. `reported: []`. These serve PRD §4's G3 — place any paper on the taxonomy, name its predecessor and the defect it fixes — which needs no numbers. G1, G2 and G4 need numbers, and those live on tier A.

**There is no unverified tier.** `verified` means the figure was read from the table named beside it. A number carried over from a survey, a blog post, or another paper's comparison table is not carried at all. Rendering it in a distinct style and hoping is weaker than leaving it out, and D-21 chose leaving it out.

- [ ] **Step 4: Build the field map**

`FieldMap.tsx` renders the eight branches as columns, cards as items, `predecessor` as an arrow. Filters: branch, year range, dataset, whether the paper has committed predictions. Clicking a card opens `PaperCard`, which links to its module.

- [ ] **Step 5: Commit**

```bash
git add data/content/papers.json frontend/src/pages tools/test/papers.test.mjs
git commit -m "feat(sgs): 35 paper cards with predecessor links, and the field map"
```

---

### Task 10: Frozen leaderboards

**Files:**
- Create: `data/content/leaderboards.json`, `system/frontend/src/pages/Leaderboards.tsx`, `system/tools/test/leaderboards.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
it('names the backbone, the codebase and the epoch budget on every row', () => {
  for (const lb of boards) {
    for (const row of lb.rows) {
      expect(row.detector_backbone, `${lb.id}/${row.paper_key}`).toBeTruthy();
      expect(row.codebase).toBeTruthy();
      expect(row.epoch_budget).toBeTruthy();
    }
  }
});

it('carries a non-comparability banner in both languages', () => {
  for (const lb of boards) {
    expect(lb.banner_en).toBeTruthy();
    expect(lb.banner_zh).toBeTruthy();
  }
});

it('records the dated end of the only public leaderboard', () => {
  for (const lb of boards) {
    expect(lb.dead_leaderboard_notice_en).toContain('2025');
  }
});

it('never mixes protocols or constraint modes inside one board', () => {
  for (const lb of boards) {
    expect(typeof lb.protocol).toBe('string');
    expect(typeof lb.constraint).toBe('string');
  }
});

it('exports no function that merges two boards', async () => {
  const module = await import('../../frontend/src/pages/Leaderboards.tsx');
  expect(Object.keys(module).some((k) => /merge|combine|rank/i.test(k))).toBe(false);
});
```

The last assertion enforces PRD §6.4 the only way it can be enforced: the capability does not exist.

- [ ] **Step 2: Run it and watch it fail, then author the boards**

One board per (dataset, protocol, constraint) combination the curriculum uses. Each row quotes one paper's reported numbers from that paper's own table.

- [ ] **Step 3: Render them**

Each board renders its banner above the table, never beside it or below it, and the banner is not collapsible.

- [ ] **Step 4: Run the lint and the tests**

Run: `npm run ci`

- [ ] **Step 5: Commit**

```bash
git add data/content/leaderboards.json frontend/src/pages/Leaderboards.tsx tools/test/leaderboards.test.mjs
git commit -m "feat(sgs): frozen per-paper leaderboards, never merged, always bannered"
```

---

## Self-review

**Spec coverage.** PRD §6.2 L1 and L2 — Tasks 5, 6; the shared scoring view — Tasks 2, 3, 4. §6.3 field map and paper cards — Task 9. §6.4 frozen leaderboards — Task 10. §7 curriculum — Tasks 7, 8. SRS §2.1 dependency choices — Tasks 3, 4. §11.1 mathematics as a first-class content type — Task 7. §11.2 the four-part contract — Task 7, enforced by the lint. §11.3 build-time KaTeX — Task 7. §11.4 global symbol table — Task 7's lint, Task 8's authoring. NFR-5 colour-blind-safe palette — Task 2. NFR-6 bilingual parity — Task 7's lint.

**Not covered here, by design:** L3 through L8 (plans 03 and 04), the lecture shell (plan 04), assessment (plan 04).

**Type consistency check.** `VERDICT_STYLE` is keyed by `VerdictKind` from `sgg-metrics`, which is the same union the engine emits — Tasks 2, 3 and 4 all read it and none redeclares it. `buildElements` in Task 4 and `centroid` in Task 3 both take `BBox` from `sgg-metrics`. `useLabParams` in Task 5 is consumed by Task 6 under the same signature.

---

## Done when

A student can open `/lab/L1`, ground two objects on a placeholder frame, assert `⟨person, on, table⟩`, submit, and see a green edge — then open `/lab/L2`, drag K from 20 to 100, watch R rise and mR rise more slowly, flip the graph constraint off, and watch both jump. And `npm run ci` is green with fifteen modules and roughly seventy cards in the corpus.
