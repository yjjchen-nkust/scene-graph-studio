# Playgrounds — M0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `playground` step kind to the module contract and build the three playgrounds that complete M0 — F1, F2 and F8 — so that a knob a student turns moves a quantity the module has just defined.

**Architecture:** A playground is a React component registered by knowledge-point id in `PLAYGROUND_MOUNTS`, mounted from an MDX step body through a `<Playground kp="F1" />` tag that the registry supplies the way it already supplies `<Step>`. All data is imported at build time from the committed `placeholder` slice, so a playground computes with no backend, no network and no corpus. Nothing a playground computes is a metric.

**Tech Stack:** TypeScript, React 19, Vite 8, MDX, vitest (jsdom), Playwright (Chromium), Node ≥ 22.12.

**Spec:** `docs/superpowers/specs/2026-09-19-playgrounds-design.md`

## Global Constraints

- **Working directory is `AI-LLM/scene-graph-studio/system/`.** Every `npm` command runs there.
- **Python is `py12`.** Never the bare `python` on PATH. Node scripts resolve it through `tools/py.mjs`.
- **No P0 feature may depend on `torch`, on CUDA, on the network, or on an API key.** A playground fetches nothing at runtime.
- **A playground computes a count, a bound, or a set membership. Never a metric.** Nothing in `frontend/src/playgrounds/` may import from `sgg-metrics` except its *types*.
- **`pg.js evaluate()` from `system/web/knowledge-map/` is never promoted** (D-14). Do not read it, do not port it.
- **`system/web/knowledge-map/` is frozen** (D-13). Do not edit it.
- **Bilingual parity, no fallback locale** (NFR-6). Every new i18n key exists in `en.json` and `zh-TW.json`. Every new MDX step exists in `m00.en.mdx` and `m00.zh-TW.mdx` with the same id, the same `kind`, the same `kp` and its own locale's presenter notes.
- **Type-size and legibility:** the lecture shell renders at ≥ 24 px base type. Colour is never the only channel (NFR-5).
- **Chinese output is formal written Chinese (書面語):** noun-phrase headings, no second person, no colloquialisms.
- **`npm run ci` is the gate** and must exit 0 before any commit.
- **Every lint rule is watched failing before it is kept.**

## Review Focus

Five conditions the spec implies that no task's happy path exercises. Each has its test added to the task that owns the code.

1. **A knob value arriving out of range from the URL** — `?F1.density=5`, `?F1.P=0`, `?F1.density=-1`. `useLabParams` falls back only when a value fails to parse as a number, not when it parses and is absurd, so an out-of-range value reaches the component. Expected: clamped to the legal range, never a `NaN` and never a negative count. *(Task 2 for `clamp`, Task 6 for F1's use of it)*
2. **A self-pair in F2** — the same node chosen as subject and object. The bound is |V|(|V|−1)|𝒫|, which counts ordered pairs of *distinct* objects, so a self-loop is outside the space the counter measures. Expected: refused, with the reason stated, not silently counted. *(Task 7)*
3. **A duplicate edge in F2** — the same ⟨s,p,o⟩ proposed twice. Expected: counted once, so the built count can never exceed the candidate count it is displayed against. *(Task 7)*
4. **Density at zero in F1** — |E| becomes 0 and the ratio is 0/480. Expected: `0.00%`, not `NaN%`, and the bound still displayed. *(Task 2 for `ratio`, Task 6 for F1, Task 9 for the golden case)*
5. **A frame where the reversed triplet is also in E** — F8 must report 「此邊收錄於 E」 for both directions rather than assuming a reversal is always absent. No placeholder frame has such a pair today, so the behaviour is pinned by a fixture rather than by the data. *(Task 2, `isInE`)*

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/playgrounds/slice.ts` | **Create.** Imports the committed placeholder annotations once, types them, exposes the six frames and the predicate vocabulary. No other file opens a data file. |
| `frontend/src/playgrounds/controls.tsx` | **Create.** The shared control kit — `Toggle`, `Slider`, `Choice`, `Readout`. Real form controls, so the lecture shell's existing keyboard policy applies unchanged. |
| `frontend/src/playgrounds/Playground.tsx` | **Create.** The dispatcher the MDX body mounts, plus `UnknownPlayground`. |
| `frontend/src/playgrounds/mounts.tsx` | **Create.** `PLAYGROUND_MOUNTS` keyed by knowledge-point id; `PLAYGROUND_IDS` derived from it. |
| `frontend/src/playgrounds/F1/LabelsToStructure.tsx` | **Create.** Three overlays, a density slider, a \|𝒫\| choice; computes \|V\|, \|E\|, the bound and the ratio. |
| `frontend/src/playgrounds/F2/TripletCombinatorics.tsx` | **Create.** Six `<button>` nodes, a predicate choice, a direction toggle; computes built edges against the candidate space. |
| `frontend/src/playgrounds/F8/DirectedEdges.tsx` | **Create.** A triplet choice and a swap toggle; reports membership in E. |
| `frontend/src/playgrounds/logic.ts` | **Create.** The arithmetic, free of React, so the golden file tests it directly. |
| `frontend/src/graph/ImageOverlay.tsx` | **Modify.** One additive `layers` prop; visible labels behind it. Existing callers unchanged. |
| `frontend/src/content/registry.tsx` | **Modify.** `kind` gains `'playground'`; `kp?: string`; `getModule` supplies `Playground`. |
| `frontend/src/shells/lecture/PresenterWindow.tsx` | **Modify.** Append `kp` beside `lab`. |
| `frontend/src/i18n/en.json`, `zh-TW.json` | **Modify.** The playground keys, both locales. |
| `frontend/src/content/m00.zh-TW.mdx`, `m00.en.mdx` | **Modify.** Three new steps, 4 → 7. |
| `data/content/playground_golden.json` | **Create.** One case per playground configuration, each with its arithmetic written out. |
| `tools/content_lint.mjs` | **Modify.** Seven rules for the playground contract, plus the golden file's `why` rule. |
| `e2e/lecture.spec.ts`, `e2e/projector.spec.ts` | **Modify.** Interaction in Chromium, computation with no backend, overflow at three resolutions. |

---

## Task 1: The slice loader

**Files:**
- Create: `frontend/src/playgrounds/slice.ts`
- Test: `frontend/src/playgrounds/test/slice.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FRAMES: SceneGraph[]` (six, in manifest order), `frameById(id: string): SceneGraph | undefined`, `PREDICATES: string[]` (sorted, deduplicated across all six), `SLICE_PREDICATE_COUNT: number` (16).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/playgrounds/test/slice.test.ts
import { describe, expect, it } from 'vitest';
import { FRAMES, PREDICATES, SLICE_PREDICATE_COUNT, frameById } from '../slice';

describe('the placeholder slice, imported at build time', () => {
  it('carries the six committed frames', () => {
    expect(FRAMES).toHaveLength(6);
    expect(FRAMES.map((f) => f.image_id)).toEqual([
      'ph-001', 'ph-002', 'ph-003', 'ph-004', 'ph-005', 'ph-006',
    ]);
  });

  it('every frame has six objects and six relationships', () => {
    for (const frame of FRAMES) {
      expect(frame.objects).toHaveLength(6);
      expect(frame.relationships).toHaveLength(6);
    }
  });

  it('exposes the predicate vocabulary counted from the slice, not asserted', () => {
    // 16 is the number F1 offers as its "this slice" preset. It is counted here so that
    // regenerating the slice moves the number rather than making the label a lie.
    expect(SLICE_PREDICATE_COUNT).toBe(PREDICATES.length);
    expect(SLICE_PREDICATE_COUNT).toBe(16);
    expect(PREDICATES).toEqual([...PREDICATES].sort());
    expect(new Set(PREDICATES).size).toBe(PREDICATES.length);
  });

  it('finds a frame by id and says nothing rather than guessing', () => {
    expect(frameById('ph-003')?.objects).toHaveLength(6);
    expect(frameById('ph-999')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/playgrounds/test/slice.test.ts`
Expected: FAIL — `Failed to resolve import "../slice"`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/playgrounds/slice.ts
import type { SceneGraph } from 'sgg-metrics';
import raw from '../../../../data/slices/placeholder/annotations.json';

/**
 * The one place a playground's data comes from.
 *
 * Imported at build time, as `pages/papers.ts` and `labs/L5/tables.ts` already import from
 * `data/content/`. Nothing is fetched, so a playground computes with no backend running, no
 * network and no corpus unpacked — which is a stronger guarantee than the labs have, and
 * deliberately so: a playground sits inside the lecture, and a hall with nothing running is the
 * case NFR-1 exists for.
 *
 * The images are imported by the components that draw them, through Vite's asset pipeline, for
 * the same reason.
 */
const parsed = raw as unknown as { dataset: string; graphs: SceneGraph[] };

export const FRAMES: SceneGraph[] = parsed.graphs;

export function frameById(imageId: string): SceneGraph | undefined {
  return FRAMES.find((frame) => frame.image_id === imageId);
}

/**
 * The predicate vocabulary, counted from the slice rather than written down.
 *
 * F1 offers this as its "this slice" preset against VG-150's 50. A literal here would be a
 * number whose origin is a developer's memory, which is the defect D54 recorded for a contrast
 * ratio; counting it means regenerating the slice moves the label rather than falsifying it.
 */
export const PREDICATES: string[] = [
  ...new Set(FRAMES.flatMap((frame) => frame.relationships.map((r) => r.predicate))),
].sort();

export const SLICE_PREDICATE_COUNT = PREDICATES.length;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:ts -- frontend/src/playgrounds/test/slice.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/playgrounds/slice.ts frontend/src/playgrounds/test/slice.test.ts
git commit -m "feat(sgs): the playground slice loader, imported at build time"
```

---

## Task 2: The arithmetic, free of React

**Files:**
- Create: `frontend/src/playgrounds/logic.ts`
- Test: `frontend/src/playgrounds/test/logic.test.ts`

**Interfaces:**
- Consumes: `SceneGraph`, `SGRelationship` types from `sgg-metrics`.
- Produces:
  - `candidateSpace(objectCount: number, predicateCount: number, directed: boolean): number`
  - `densityCut(relationships: SGRelationship[], density: number): SGRelationship[]`
  - `ratio(annotated: number, candidates: number): number`
  - `formatRatio(value: number): string`
  - `type Triplet = { subject_id: number; predicate: string; object_id: number }`
  - `tripletKey(t: Triplet, directed: boolean): string`
  - `isInE(graph: SceneGraph, t: Triplet): boolean`
  - `clamp(value: number, low: number, high: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/playgrounds/test/logic.test.ts
import { describe, expect, it } from 'vitest';
import { FRAMES, frameById } from '../slice';
import {
  candidateSpace, clamp, densityCut, formatRatio, isInE, ratio, tripletKey,
} from '../logic';

const ph001 = frameById('ph-001')!;

describe('candidateSpace', () => {
  it('counts ordered pairs of distinct objects, times the predicate vocabulary', () => {
    // 6 objects -> 6 x 5 = 30 ordered pairs; 30 x 16 = 480.
    expect(candidateSpace(6, 16, true)).toBe(480);
  });

  it('halves when direction is discarded, because (s,o) and (o,s) become one pair', () => {
    expect(candidateSpace(6, 16, false)).toBe(240);
  });

  it('is zero for a graph with fewer than two objects, not negative', () => {
    expect(candidateSpace(1, 16, true)).toBe(0);
    expect(candidateSpace(0, 16, true)).toBe(0);
  });
});

describe('densityCut', () => {
  it('keeps every edge at full density', () => {
    expect(densityCut(ph001.relationships, 1)).toHaveLength(6);
  });

  it('keeps none at zero', () => {
    expect(densityCut(ph001.relationships, 0)).toHaveLength(0);
  });

  it('keeps a prefix, so the slider is reversible rather than a reshuffle', () => {
    const half = densityCut(ph001.relationships, 0.5);
    expect(half).toHaveLength(3);
    expect(half).toEqual(ph001.relationships.slice(0, 3));
  });
});

describe('ratio and formatRatio', () => {
  it('is the annotated count over the candidate count', () => {
    expect(ratio(6, 480)).toBeCloseTo(0.0125, 6);
  });

  // Review Focus 4: density at zero.
  it('is zero over a candidate space, not NaN', () => {
    expect(ratio(0, 480)).toBe(0);
    expect(formatRatio(ratio(0, 480))).toBe('0.00%');
  });

  it('is zero rather than Infinity when there is no candidate space at all', () => {
    expect(ratio(0, 0)).toBe(0);
    expect(formatRatio(ratio(0, 0))).toBe('0.00%');
  });

  it('formats to two decimals', () => {
    expect(formatRatio(0.0125)).toBe('1.25%');
  });
});

describe('tripletKey', () => {
  const ab = { subject_id: 1, predicate: 'on', object_id: 2 };
  const ba = { subject_id: 2, predicate: 'on', object_id: 1 };

  it('tells the two directions apart when direction is kept', () => {
    expect(tripletKey(ab, true)).not.toBe(tripletKey(ba, true));
  });

  it('makes them one key when direction is discarded', () => {
    expect(tripletKey(ab, false)).toBe(tripletKey(ba, false));
  });
});

describe('isInE', () => {
  it('finds a triplet the annotator wrote', () => {
    // ph-001 relationship 1: box (3) --on--> table (1).
    expect(isInE(ph001, { subject_id: 3, predicate: 'on', object_id: 1 })).toBe(true);
  });

  it('does not find its reversal', () => {
    expect(isInE(ph001, { subject_id: 1, predicate: 'on', object_id: 3 })).toBe(false);
  });

  // Review Focus 5: a frame carrying both directions. No placeholder frame has one, so the
  // behaviour is pinned by a fixture rather than left to the data.
  it('finds both directions when the annotation carries both', () => {
    const both = {
      ...ph001,
      relationships: [
        { relationship_id: 1, subject_id: 1, predicate: 'near', object_id: 2 },
        { relationship_id: 2, subject_id: 2, predicate: 'near', object_id: 1 },
      ],
    };
    expect(isInE(both, { subject_id: 1, predicate: 'near', object_id: 2 })).toBe(true);
    expect(isInE(both, { subject_id: 2, predicate: 'near', object_id: 1 })).toBe(true);
  });
});

describe('clamp', () => {
  // Review Focus 1: a knob value out of range from the URL.
  it('holds a value inside its range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('returns the low bound for a value that is not a number', () => {
    expect(clamp(Number.NaN, 0, 1)).toBe(0);
  });
});

describe('the frames this all runs on', () => {
  it('has six of them', () => {
    expect(FRAMES).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/playgrounds/test/logic.test.ts`
Expected: FAIL — `Failed to resolve import "../logic"`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/playgrounds/logic.ts
import type { SceneGraph, SGRelationship } from 'sgg-metrics';

/**
 * The arithmetic every M0 playground displays, with no React in it.
 *
 * Separate from the components because `data/content/playground_golden.json` tests these
 * functions directly: a golden case states knobs and an expected number, and a component test
 * would have to render to check one. `labs/L3/freq.ts` is split from its lab for the same
 * reason.
 *
 * Nothing here is a metric. A count, a bound and a set membership are quantities M0's own
 * definitions contain; R@K is a lab's business and belongs to `sgg-metrics`.
 */

export interface Triplet {
  subject_id: number;
  predicate: string;
  object_id: number;
}

/**
 * |V|(|V|-1)|P| — ordered pairs of *distinct* objects, times the predicate vocabulary.
 *
 * Distinct because a scene graph edge joins two objects: ⟨s,p,s⟩ is not a relation between two
 * things. Discarding direction identifies (s,o) with (o,s) and halves the space, which is the
 * claim F2's toggle exists to make visible.
 */
export function candidateSpace(objectCount: number, predicateCount: number, directed: boolean): number {
  if (objectCount < 2) return 0;
  const orderedPairs = objectCount * (objectCount - 1);
  const pairs = directed ? orderedPairs : orderedPairs / 2;
  return pairs * predicateCount;
}

/**
 * The first `density` fraction of the edges, as a prefix rather than a sample.
 *
 * A prefix so the slider is reversible: dragging back restores exactly what dragging forward
 * removed. A random sample would reshuffle on every render and make the picture flicker while
 * teaching nothing the fraction does not already say.
 */
export function densityCut(relationships: SGRelationship[], density: number): SGRelationship[] {
  const keep = Math.round(clamp(density, 0, 1) * relationships.length);
  return relationships.slice(0, keep);
}

/** Annotated over candidates. Zero rather than NaN when there are no candidates at all. */
export function ratio(annotated: number, candidates: number): number {
  if (candidates <= 0) return 0;
  return annotated / candidates;
}

export function formatRatio(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** A triplet's identity. With direction discarded, the two endpoints are sorted into one key. */
export function tripletKey(t: Triplet, directed: boolean): string {
  if (directed) return `${t.subject_id}|${t.predicate}|${t.object_id}`;
  const [a, b] = [t.subject_id, t.object_id].sort((x, y) => x - y);
  return `${a}|${t.predicate}|${b}`;
}

/**
 * Whether this exact triplet is one the annotator wrote.
 *
 * Deliberately named for what it checks. M0's third implication is 已標註者不等於為真者, so
 * "in E" is the only claim this function is entitled to make, and F8 must report it in those
 * words rather than as true and false.
 */
export function isInE(graph: SceneGraph, t: Triplet): boolean {
  return graph.relationships.some(
    (r) => r.subject_id === t.subject_id && r.object_id === t.object_id && r.predicate === t.predicate,
  );
}

/** A knob arriving from the URL is not necessarily in range; `useLabParams` only rejects NaN. */
export function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(Math.max(value, low), high);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:ts -- frontend/src/playgrounds/test/logic.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/playgrounds/logic.ts frontend/src/playgrounds/test/logic.test.ts
git commit -m "feat(sgs): the playground arithmetic, with no React in it"
```

---

## Task 3: The control kit

**Files:**
- Create: `frontend/src/playgrounds/controls.tsx`
- Modify: `frontend/src/i18n/en.json`, `frontend/src/i18n/zh-TW.json`
- Test: `frontend/src/playgrounds/test/controls.test.tsx`

**Interfaces:**
- Consumes: `useLocale` from `../i18n/useLocale`.
- Produces:
  - `Toggle({ id, label, checked, onChange }): JSX.Element` — an `<input type="checkbox">` with a `<label>`.
  - `Slider({ id, label, value, min, max, step, onChange, valueLabel }): JSX.Element` — an `<input type="range">`.
  - `Choice({ id, label, value, options, onChange }): JSX.Element` — a `<select>`; `options: { value: string; label: string }[]`.
  - `Readout({ label, value, note }): JSX.Element` — one displayed quantity with its origin.
  - `PlaygroundFrame({ title, controls, children }): JSX.Element` — controls above, visual below with a max height.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/playgrounds/test/controls.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Choice, PlaygroundFrame, Readout, Slider, Toggle } from '../controls';

describe('the control kit is made of real form controls', () => {
  it('Toggle is a checkbox with a label that focuses it', () => {
    const onChange = vi.fn();
    render(<Toggle id="boxes" label="Boxes" checked={false} onChange={onChange} />);
    const box = screen.getByLabelText('Boxes');
    expect(box.tagName).toBe('INPUT');
    expect(box).toHaveAttribute('type', 'checkbox');
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Slider is a range input, so a focused slider keeps its arrow keys', () => {
    // `isTextEntry` in useStepper returns true for INPUT of every type, which is what stops the
    // deck from stealing the arrows while the professor is dragging this.
    const onChange = vi.fn();
    render(
      <Slider id="density" label="Density" value={0.5} min={0} max={1} step={0.1}
              onChange={onChange} valueLabel="50%" />,
    );
    const slider = screen.getByLabelText('Density');
    expect(slider).toHaveAttribute('type', 'range');
    fireEvent.change(slider, { target: { value: '0.8' } });
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it('Choice is a select', () => {
    const onChange = vi.fn();
    render(
      <Choice id="P" label="|P|" value="16"
              options={[{ value: '16', label: '16' }, { value: '50', label: '50' }]}
              onChange={onChange} />,
    );
    const select = screen.getByLabelText('|P|');
    expect(select.tagName).toBe('SELECT');
    fireEvent.change(select, { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith('50');
  });

  it('Readout shows a number beside where it came from', () => {
    render(<Readout label="Candidates" value="480" note="6 x 5 x 16" />);
    expect(screen.getByTestId('readout-Candidates')).toHaveTextContent('480');
    expect(screen.getByTestId('readout-Candidates')).toHaveTextContent('6 x 5 x 16');
  });

  it('PlaygroundFrame puts the controls before the visual in document order', () => {
    render(
      <PlaygroundFrame title="F1" controls={<button type="button">knob</button>}>
        <p>visual</p>
      </PlaygroundFrame>,
    );
    const root = screen.getByTestId('playground-frame');
    const controls = screen.getByTestId('playground-controls');
    const visual = screen.getByTestId('playground-visual');
    expect(root).toContainElement(controls);
    expect(controls.compareDocumentPosition(visual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('nothing in the kit takes focus on mount', () => {
    render(
      <PlaygroundFrame title="F1" controls={<Toggle id="b" label="Boxes" checked onChange={() => {}} />}>
        <p>visual</p>
      </PlaygroundFrame>,
    );
    expect(document.activeElement).toBe(document.body);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/playgrounds/test/controls.test.tsx`
Expected: FAIL — `Failed to resolve import "../controls"`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/playgrounds/controls.tsx
import type { ReactNode } from 'react';

/**
 * The knobs, as real form controls.
 *
 * Every one of these is a `<input>`, `<select>` or `<button>` rather than a styled `div`, and
 * that is a requirement rather than a preference. The lecture shell's keyboard policy
 * (`useStepper.ts`) decides what a key belongs to by looking at the focused element:
 * `isTextEntry` gives every key to a focused `INPUT` of any type, and `consumesSpace` gives
 * Space to a focused `BUTTON`. A knob built from a div would receive neither rule, and the
 * professor would find out by skipping a slide in the room.
 *
 * Nothing here autofocuses. A playground that took focus on mount would hold the arrow keys for
 * the rest of the step.
 */

const LABEL = 'text-base font-medium text-slate-700';
const FIELD = 'rounded border border-slate-300 bg-white px-2 py-1 text-base';

export function Toggle({
  id, label, checked, onChange,
}: { id: string; label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
      <label htmlFor={id} className={LABEL}>{label}</label>
    </span>
  );
}

export function Slider({
  id, label, value, min, max, step, onChange, valueLabel,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (next: number) => void; valueLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="font-mono text-base tabular-nums text-slate-600">{valueLabel}</span>
    </span>
  );
}

export function Choice({
  id, label, value, options, onChange,
}: {
  id: string; label: string; value: string;
  options: { value: string; label: string }[]; onChange: (next: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </span>
  );
}

/**
 * One quantity with its origin beside it.
 *
 * `note` is not decoration. NFR-2 requires a number to carry where it came from, and in a
 * playground that source is arithmetic the student can check rather than a citation they must
 * trust — so the note holds the arithmetic.
 */
export function Readout({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div data-testid={`readout-${label}`} className="flex flex-col">
      <span className="text-sm uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-mono text-2xl tabular-nums text-slate-900">{value}</span>
      <span className="font-mono text-sm text-slate-500">{note}</span>
    </div>
  );
}

/**
 * Controls above, visual below, visual clipped.
 *
 * D71 records 25 of 92 slides already running past the bottom of a 1024x768 panel. When the
 * panel is short something has to give, and it must be the picture: a professor who cannot see
 * the whole photograph can still turn the knob and read the number, while one who cannot reach
 * the knob has no playground at all.
 */
export function PlaygroundFrame({
  title, controls, children,
}: { title: string; controls: ReactNode; children: ReactNode }) {
  return (
    <section
      data-testid="playground-frame"
      className="my-6 rounded-lg border border-slate-200 bg-slate-50 p-4"
      aria-label={title}
    >
      <div data-testid="playground-controls" className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {controls}
      </div>
      <div
        data-testid="playground-visual"
        className="mt-4 max-h-[46vh] overflow-hidden"
      >
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:ts -- frontend/src/playgrounds/test/controls.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the i18n keys, both locales**

In `frontend/src/i18n/en.json`, after the `presenter.*` block:

```json
  "playground.unknown": "No playground is registered for this knowledge point:",
  "playground.layer_labels": "Labels",
  "playground.layer_boxes": "Boxes",
  "playground.layer_relations": "Relations",
  "playground.density": "Annotation density",
  "playground.predicate_vocabulary": "|P|",
  "playground.vocab_slice": "16 — counted from this slice",
  "playground.vocab_vg150": "50 — VG-150",
  "playground.objects": "Objects",
  "playground.annotated": "Annotated edges",
  "playground.candidates": "Candidate triplets",
  "playground.ratio": "Annotated share",
  "playground.frame": "Frame",
  "playground.directed": "Directed arrows",
  "playground.predicate": "Predicate",
  "playground.built": "Edges built",
  "playground.add_edge": "Add edge",
  "playground.reset": "Clear",
  "playground.self_pair": "A relation joins two different objects, so this pair is outside the candidate space.",
  "playground.duplicate": "That triplet is already built.",
  "playground.collapsed": "Indistinguishable once direction is discarded:",
  "playground.swap": "Swap subject and object",
  "playground.in_e": "Recorded in E",
  "playground.not_in_e": "Not recorded in E",
  "playground.not_in_e_note": "Not recorded is not the same claim as false.",
  "playground.triplet": "Triplet",
```

In `frontend/src/i18n/zh-TW.json`, at the same position:

```json
  "playground.unknown": "此知識點尚未註冊對應的互動元件：",
  "playground.layer_labels": "標籤",
  "playground.layer_boxes": "邊界框",
  "playground.layer_relations": "關係",
  "playground.density": "標註密度",
  "playground.predicate_vocabulary": "|P|",
  "playground.vocab_slice": "16 —— 取自本切片實計",
  "playground.vocab_vg150": "50 —— VG-150",
  "playground.objects": "物件數",
  "playground.annotated": "已標註邊數",
  "playground.candidates": "候選三元組數",
  "playground.ratio": "已標註占比",
  "playground.frame": "影像",
  "playground.directed": "有向箭頭",
  "playground.predicate": "關係詞",
  "playground.built": "已建立邊數",
  "playground.add_edge": "加入邊",
  "playground.reset": "清除",
  "playground.self_pair": "關係連接兩個相異物件，此配對不在候選空間之內。",
  "playground.duplicate": "此三元組已建立。",
  "playground.collapsed": "捨棄方向後無法區辨者：",
  "playground.swap": "交換主體與客體",
  "playground.in_e": "此邊收錄於 E",
  "playground.not_in_e": "此邊未收錄於 E",
  "playground.not_in_e_note": "未收錄與為偽並非同一陳述。",
  "playground.triplet": "三元組",
```

- [ ] **Step 6: Run the parity check**

Run: `npm run lint:i18n`
Expected: PASS — `i18n parity: 223 keys, both locales complete`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/playgrounds/controls.tsx frontend/src/playgrounds/test/controls.test.tsx frontend/src/i18n/en.json frontend/src/i18n/zh-TW.json
git commit -m "feat(sgs): the playground control kit, made of real form controls"
```

---

## Task 4: The step contract — type, registry, mount, dispatcher

**Files:**
- Create: `frontend/src/playgrounds/mounts.tsx`, `frontend/src/playgrounds/Playground.tsx`
- Modify: `frontend/src/content/registry.tsx:20-42` (the `ModuleStepMeta` interface), `frontend/src/content/registry.tsx:110-119` (`getModule`), `frontend/src/shells/lecture/PresenterWindow.tsx:122-126`
- Test: `frontend/src/playgrounds/test/Playground.test.tsx`, `frontend/src/content/test/registry.test.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1–3 yet; the mount table starts empty and each playground task adds its own entry.
- Produces:
  - `PLAYGROUND_MOUNTS: Record<string, ComponentType>` in `mounts.tsx`
  - `PLAYGROUND_IDS: string[]` derived from it
  - `Playground({ kp }: { kp: string }): JSX.Element` in `Playground.tsx`
  - `ModuleStepMeta.kind` includes `'playground'`; `ModuleStepMeta.kp?: string`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/playgrounds/test/Playground.test.tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { Playground } from '../Playground';
import { PLAYGROUND_IDS, PLAYGROUND_MOUNTS } from '../mounts';

beforeEach(() => setLocale('en'));

describe('Playground', () => {
  it('names the knowledge point it cannot mount, rather than rendering nothing', () => {
    // A silent empty box in a lecture is the failure this codebase keeps legislating against;
    // UnknownLab is the same answer for the same reason.
    render(<Playground kp="F99" />);
    expect(screen.getByTestId('playground-unknown')).toBeInTheDocument();
    expect(screen.getByTestId('playground-unknown')).toHaveTextContent('F99');
  });

  it('derives its id list from the mount table, so neither can drift from the other', () => {
    expect(PLAYGROUND_IDS).toEqual(Object.keys(PLAYGROUND_MOUNTS).sort());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/playgrounds/test/Playground.test.tsx`
Expected: FAIL — `Failed to resolve import "../Playground"`.

- [ ] **Step 3: Write the mount table and the dispatcher**

```tsx
// frontend/src/playgrounds/mounts.tsx
import type { ComponentType } from 'react';

/**
 * Every playground, keyed by the knowledge point it demonstrates.
 *
 * One table, and `PLAYGROUND_IDS` derived from it rather than written beside it, so a component
 * without an entry cannot appear and an entry without a component cannot be missed.
 * `labs/mounts.tsx` is keyed by lab id for the same reason.
 *
 * Entries are added by the task that builds each playground. It is empty here on purpose.
 */
export const PLAYGROUND_MOUNTS: Record<string, ComponentType> = {};

export const PLAYGROUND_IDS: string[] = Object.keys(PLAYGROUND_MOUNTS).sort();
```

```tsx
// frontend/src/playgrounds/Playground.tsx
import { useLocale } from '../i18n/useLocale';
import { PLAYGROUND_MOUNTS } from './mounts';

/**
 * What `<Playground kp="F1" />` in an MDX body resolves to.
 *
 * Supplied to the MDX through the `components` prop in `content/registry.tsx`, the way `Step`
 * is, rather than imported by each module. A module is two locale files, and an import line in
 * each is two places to drift; there is one here instead.
 */
export function Playground({ kp }: { kp: string }) {
  const { t } = useLocale();
  const Mount = PLAYGROUND_MOUNTS[kp];
  if (!Mount) {
    return (
      <p data-testid="playground-unknown" className="my-6 rounded border border-amber-300 bg-amber-50 p-4 text-base">
        {t('playground.unknown')} <span className="font-mono">{kp}</span>
      </p>
    );
  }
  return <Mount />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:ts -- frontend/src/playgrounds/test/Playground.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing registry test**

Append to `frontend/src/content/test/registry.test.tsx`:

```tsx
describe('the playground step kind', () => {
  it('supplies Playground to every module body, so no MDX file imports it', () => {
    // Both locale files would otherwise carry an import line, and two import lines are two
    // places to drift. NFR-6 is about the content saying the same thing in both languages;
    // this is the same rule applied to the machinery.
    const steps = getModule('m00', 'zh-TW');
    expect(steps).not.toBeNull();
    // Rendering must not throw on a body containing <Playground/>; the tag resolves because the
    // registry supplies it.
    for (const step of steps!) {
      expect(() => render(<>{step.node}</>)).not.toThrow();
    }
  });
});
```

- [ ] **Step 6: Run it to verify it passes trivially, then make the type change**

Run: `npm run test:ts -- frontend/src/content/test/registry.test.tsx`
Expected: PASS — M0 has no playground step yet, so this asserts nothing until Task 10 adds one. It is written now so that Task 10 cannot forget it. `render` is already imported in that file.

In `frontend/src/content/registry.tsx`, change the interface:

```ts
export interface ModuleStepMeta {
  id: string;
  kind: 'prose' | 'math' | 'figure' | 'lab' | 'checkpoint' | 'playground';
  lab?: string;
  /** The knowledge point a `playground` step demonstrates. Contracts §2.4. */
  kp?: string;
  seconds_budget?: number;
```

And in `getModule`, supply the component:

```tsx
  return found.meta.steps.map((step) => {
    const Only = ({ id: stepId, children }: StepProps) =>
      stepId === step.id ? <>{children}</> : null;
    // `Playground` joins `Step` here rather than being imported by each MDX file: see the
    // component's own docstring.
    return { ...step, node: <Body components={{ Step: Only, Playground } as never} /> };
  });
```

Add the import at the top of `registry.tsx`:

```ts
import { Playground } from '../playgrounds/Playground';
```

- [ ] **Step 7: Show the presenter window which playground is on the projector**

In `frontend/src/shells/lecture/PresenterWindow.tsx`, in the `next` block and the header's `step` line, append `kp` exactly as `lab` is appended:

```tsx
          <p className="font-mono text-sm" style={{ color: LECTURE_PALETTE.muted }}>
            {step ? `${step.id} · ${step.kind}${step.kp ? ` · ${step.kp}` : ''}` : '—'}
          </p>
```

```tsx
          <p data-testid="next" className="font-mono text-lg">
            {next.id} · {next.kind}
            {next.lab ? ` · ${next.lab}` : ''}
            {next.kp ? ` · ${next.kp}` : ''}
          </p>
```

- [ ] **Step 8: Run the whole suite**

Run: `npm run test:ts`
Expected: PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/playgrounds/mounts.tsx frontend/src/playgrounds/Playground.tsx frontend/src/playgrounds/test/Playground.test.tsx frontend/src/content/registry.tsx frontend/src/content/test/registry.test.tsx frontend/src/shells/lecture/PresenterWindow.tsx
git commit -m "feat(sgs): the playground step kind, its registry and its mount"
```

---

## Task 5: `ImageOverlay` gains a layers prop

**Files:**
- Modify: `frontend/src/graph/ImageOverlay.tsx:14-28` (props), and the render body
- Test: `frontend/src/graph/test/ImageOverlay.test.tsx`

**Interfaces:**
- Consumes: the existing `ImageOverlayProps`.
- Produces: `ImageOverlayProps.layers?: { boxes?: boolean; relationships?: boolean; labels?: boolean }`, defaulting to `{ boxes: true, relationships: true, labels: false }` so every existing caller renders byte-identically.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/graph/test/ImageOverlay.test.tsx`:

```tsx
describe('layers', () => {
  const graph = {
    image_id: 'ph-001', dataset: 'placeholder' as const, width: 640, height: 480,
    objects: [
      { object_id: 1, names: ['table'], bbox: { x: 60, y: 300, w: 420, h: 110 } },
      { object_id: 3, names: ['box'], bbox: { x: 250, y: 240, w: 90, h: 70 } },
    ],
    relationships: [{ relationship_id: 1, subject_id: 3, object_id: 1, predicate: 'on' }],
  };

  it('draws boxes and relationships and no visible labels by default, as it always has', () => {
    render(
      <ImageOverlay imageUrl="/x.png" width={640} height={480}
                    objects={graph.objects} relationships={graph.relationships} mode="view" />,
    );
    expect(screen.getAllByTestId(/^box-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/^edge-/)).toHaveLength(1);
    expect(screen.queryAllByTestId(/^label-/)).toHaveLength(0);
  });

  it('turns each layer off independently', () => {
    render(
      <ImageOverlay imageUrl="/x.png" width={640} height={480}
                    objects={graph.objects} relationships={graph.relationships} mode="view"
                    layers={{ boxes: false, relationships: true, labels: false }} />,
    );
    expect(screen.queryAllByTestId(/^box-/)).toHaveLength(0);
    expect(screen.getAllByTestId(/^edge-/)).toHaveLength(1);
  });

  it('draws a visible name per object when labels are asked for', () => {
    render(
      <ImageOverlay imageUrl="/x.png" width={640} height={480}
                    objects={graph.objects} relationships={graph.relationships} mode="view"
                    layers={{ boxes: true, relationships: true, labels: true }} />,
    );
    expect(screen.getAllByTestId(/^label-/)).toHaveLength(2);
    expect(screen.getByTestId('label-1')).toHaveTextContent('table');
  });

  it('with every layer off, the photograph is still there', () => {
    render(
      <ImageOverlay imageUrl="/x.png" width={640} height={480}
                    objects={graph.objects} relationships={graph.relationships} mode="view"
                    layers={{ boxes: false, relationships: false, labels: false }} />,
    );
    expect(screen.queryAllByTestId(/^box-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^edge-/)).toHaveLength(0);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/graph/test/ImageOverlay.test.tsx`
Expected: FAIL on the label tests, and on the layers test if `data-testid` attributes are absent. If `box-`/`edge-` test ids do not exist yet, add them in Step 3 alongside the layers.

- [ ] **Step 3: Write the implementation**

Add to `ImageOverlayProps`:

```ts
  /**
   * Which layers to draw. Absent keeps exactly what every caller before F1 got: boxes and
   * relationships drawn, object names only in a `<title>` tooltip and never as visible text.
   * F1 opts into `labels` because its whole claim is that a label is not a structure, and you
   * cannot make that claim about something the reader cannot see.
   */
  layers?: { boxes?: boolean; relationships?: boolean; labels?: boolean };
```

In the component signature:

```tsx
  layers,
```

Immediately inside the body:

```tsx
  const show = {
    boxes: layers?.boxes ?? true,
    relationships: layers?.relationships ?? true,
    labels: layers?.labels ?? false,
  };
```

Wrap the existing box `<rect>` render in `{show.boxes && ...}`, the edge render in `{show.relationships && ...}`, give each `<rect>` `data-testid={`box-${o.object_id}`}` and each edge `data-testid={`edge-${r.relationship_id}`}`, and add the label layer after the boxes:

```tsx
        {show.labels &&
          objects.map((o) => (
            <text
              key={`label-${o.object_id}`}
              data-testid={`label-${o.object_id}`}
              x={o.bbox.x + 4}
              y={o.bbox.y - 6}
              className="font-mono"
              fontSize={18}
              fill={VERDICT_STYLE.match.stroke}
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {o.names[0]}
            </text>
          ))}
```

The white stroke under the fill is a halo: a label over a photograph has no contrast guarantee, and NFR-5 is about what is legible on a projector rather than what is present in the DOM.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:ts -- frontend/src/graph/test/ImageOverlay.test.tsx`
Expected: PASS, including every test that existed before.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/graph/ImageOverlay.tsx frontend/src/graph/test/ImageOverlay.test.tsx
git commit -m "feat(sgs): ImageOverlay draws its layers on request, labels included"
```

---

## Task 6: F1 — 從標籤到結構

**Files:**
- Create: `frontend/src/playgrounds/F1/LabelsToStructure.tsx`
- Modify: `frontend/src/playgrounds/mounts.tsx`
- Test: `frontend/src/playgrounds/F1/test/LabelsToStructure.test.tsx`

**Interfaces:**
- Consumes: `FRAMES`, `SLICE_PREDICATE_COUNT` from `../slice`; `candidateSpace`, `densityCut`, `ratio`, `formatRatio`, `clamp` from `../logic`; the control kit from `../controls`; `ImageOverlay` from `../../graph/ImageOverlay`; `useLabParams` from `../../labs/useLabParams`.
- Produces: `LabelsToStructure` registered as `F1`.

URL keys: `F1.img` (string, default `ph-001`), `F1.density` (number, default 1), `F1.P` (number, default 16), `F1.labels` / `F1.boxes` / `F1.rel` (number 0 or 1, default 1).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/playgrounds/F1/test/LabelsToStructure.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { LabelsToStructure } from '../LabelsToStructure';

beforeEach(() => setLocale('en'));

function at(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/m/m00${search}`]}>
      <LabelsToStructure />
    </MemoryRouter>,
  );
}

describe('F1', () => {
  it('computes the bound and the share from the frame, at full density', () => {
    at('');
    expect(screen.getByTestId('readout-Objects')).toHaveTextContent('6');
    expect(screen.getByTestId('readout-Annotated edges')).toHaveTextContent('6');
    expect(screen.getByTestId('readout-Candidate triplets')).toHaveTextContent('480');
    expect(screen.getByTestId('readout-Annotated share')).toHaveTextContent('1.25%');
  });

  it('shows the arithmetic beside the number rather than only the number', () => {
    at('');
    expect(screen.getByTestId('readout-Candidate triplets')).toHaveTextContent('6 × 5 × 16');
  });

  it('moves only the annotated count when density falls, never the bound', () => {
    at('?F1.density=0.5');
    expect(screen.getByTestId('readout-Annotated edges')).toHaveTextContent('3');
    expect(screen.getByTestId('readout-Candidate triplets')).toHaveTextContent('480');
  });

  // Review Focus 4.
  it('reports 0.00% at zero density, not NaN', () => {
    at('?F1.density=0');
    expect(screen.getByTestId('readout-Annotated edges')).toHaveTextContent('0');
    expect(screen.getByTestId('readout-Annotated share')).toHaveTextContent('0.00%');
  });

  // Review Focus 1.
  it('clamps a density the URL put out of range', () => {
    at('?F1.density=5');
    expect(screen.getByTestId('readout-Annotated edges')).toHaveTextContent('6');
    at('?F1.density=-1');
    expect(screen.getAllByTestId('readout-Annotated edges')[1]).toHaveTextContent('0');
  });

  it('falls back to the slice vocabulary when the URL names a |P| that is not on offer', () => {
    at('?F1.P=0');
    expect(screen.getByTestId('readout-Candidate triplets')).toHaveTextContent('480');
  });

  it('recomputes the bound against VG-150 when asked, and says where 50 comes from', () => {
    at('?F1.P=50');
    // 6 x 5 x 50 = 1500; 6 / 1500 = 0.40%.
    expect(screen.getByTestId('readout-Candidate triplets')).toHaveTextContent('1500');
    expect(screen.getByTestId('readout-Annotated share')).toHaveTextContent('0.40%');
    expect(screen.getByLabelText('|P|')).toHaveValue('50');
  });

  it('does not take focus when it mounts', () => {
    at('');
    expect(document.activeElement).toBe(document.body);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/playgrounds/F1`
Expected: FAIL — `Failed to resolve import "../LabelsToStructure"`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/playgrounds/F1/LabelsToStructure.tsx
import { ImageOverlay } from '../../graph/ImageOverlay';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Slider, Toggle } from '../controls';
import { candidateSpace, clamp, densityCut, formatRatio, ratio } from '../logic';
import { FRAMES, SLICE_PREDICATE_COUNT, frameById } from '../slice';

// Vite resolves these at build time and emits them as assets on this origin, so the playground
// draws a photograph with no backend running.
const IMAGES = import.meta.glob('../../../../../data/slices/placeholder/images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function imageUrl(imageId: string): string {
  const hit = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${imageId}.png`));
  return hit?.[1] ?? '';
}

/** VG-150's predicate count, which M0's own worked example computes with. */
const VG150_PREDICATES = 50;

/**
 * F1 — 從標籤到結構.
 *
 * The claim M0 opens with is that a list of labels loses the scene. Turning every layer off
 * returns the bare photograph, which is that claim as a picture. The density slider then makes
 * the second claim: the candidate space does not move when the annotation budget does, and the
 * ratio between them is why every metric in this field is a recall rather than a precision.
 *
 * Computes a count, a bound and their ratio. No metric: that boundary is what separates a
 * playground from a lab.
 */
export function LabelsToStructure() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'F1.img': FRAMES[0].image_id,
    'F1.density': 1,
    'F1.P': SLICE_PREDICATE_COUNT,
    'F1.labels': 1,
    'F1.boxes': 1,
    'F1.rel': 1,
  });

  const frame = frameById(params['F1.img']) ?? FRAMES[0];
  const density = clamp(params['F1.density'], 0, 1);
  // A |P| the URL invented is neither of the two on offer, and a bound computed from it would be
  // a number with no stated origin. Fall back rather than display it.
  const predicateCount =
    params['F1.P'] === VG150_PREDICATES ? VG150_PREDICATES : SLICE_PREDICATE_COUNT;

  const kept = densityCut(frame.relationships, density);
  const objectCount = frame.objects.length;
  const candidates = candidateSpace(objectCount, predicateCount, true);
  const share = ratio(kept.length, candidates);

  const controls = (
    <>
      <Choice
        id="F1.frame"
        label={t('playground.frame')}
        value={frame.image_id}
        options={FRAMES.map((f) => ({ value: f.image_id, label: f.image_id }))}
        onChange={(next) => setParams({ 'F1.img': next })}
      />
      <Toggle
        id="F1.labels"
        label={t('playground.layer_labels')}
        checked={params['F1.labels'] === 1}
        onChange={(on) => setParams({ 'F1.labels': on ? 1 : 0 })}
      />
      <Toggle
        id="F1.boxes"
        label={t('playground.layer_boxes')}
        checked={params['F1.boxes'] === 1}
        onChange={(on) => setParams({ 'F1.boxes': on ? 1 : 0 })}
      />
      <Toggle
        id="F1.rel"
        label={t('playground.layer_relations')}
        checked={params['F1.rel'] === 1}
        onChange={(on) => setParams({ 'F1.rel': on ? 1 : 0 })}
      />
      <Slider
        id="F1.density"
        label={t('playground.density')}
        value={density}
        min={0}
        max={1}
        step={1 / Math.max(frame.relationships.length, 1)}
        onChange={(next) => setParams({ 'F1.density': next })}
        valueLabel={`${kept.length} / ${frame.relationships.length}`}
      />
      <Choice
        id="F1.P"
        label={t('playground.predicate_vocabulary')}
        value={String(predicateCount)}
        options={[
          { value: String(SLICE_PREDICATE_COUNT), label: t('playground.vocab_slice') },
          { value: String(VG150_PREDICATES), label: t('playground.vocab_vg150') },
        ]}
        onChange={(next) => setParams({ 'F1.P': Number(next) })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F1" controls={controls}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <ImageOverlay
          imageUrl={imageUrl(frame.image_id)}
          width={frame.width}
          height={frame.height}
          objects={frame.objects}
          relationships={kept}
          mode="view"
          layers={{
            boxes: params['F1.boxes'] === 1,
            relationships: params['F1.rel'] === 1,
            labels: params['F1.labels'] === 1,
          }}
          className="max-w-2xl"
        />
        <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-1">
          <Readout label={t('playground.objects')} value={String(objectCount)} note="|V|" />
          <Readout
            label={t('playground.annotated')}
            value={String(kept.length)}
            note={`|E| / ${frame.relationships.length}`}
          />
          <Readout
            label={t('playground.candidates')}
            value={String(candidates)}
            note={`${objectCount} × ${objectCount - 1} × ${predicateCount}`}
          />
          <Readout
            label={t('playground.ratio')}
            value={formatRatio(share)}
            note={`${kept.length} / ${candidates}`}
          />
        </div>
      </div>
    </PlaygroundFrame>
  );
}
```

- [ ] **Step 4: Register it**

In `frontend/src/playgrounds/mounts.tsx`:

```tsx
import type { ComponentType } from 'react';
import { LabelsToStructure } from './F1/LabelsToStructure';

export const PLAYGROUND_MOUNTS: Record<string, ComponentType> = {
  F1: LabelsToStructure,
};

export const PLAYGROUND_IDS: string[] = Object.keys(PLAYGROUND_MOUNTS).sort();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:ts -- frontend/src/playgrounds`
Expected: PASS, F1's 8 tests plus the earlier ones.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/playgrounds/F1 frontend/src/playgrounds/mounts.tsx
git commit -m "feat(sgs): F1, the bound a scene graph's annotation lives inside"
```

---

## Task 7: F2 — 三元組與 G=(V,E,T)

**Files:**
- Create: `frontend/src/playgrounds/F2/TripletCombinatorics.tsx`
- Modify: `frontend/src/playgrounds/mounts.tsx`
- Test: `frontend/src/playgrounds/F2/test/TripletCombinatorics.test.tsx`

**Interfaces:**
- Consumes: `FRAMES`, `SLICE_PREDICATE_COUNT`, `PREDICATES` from `../slice`; `candidateSpace`, `tripletKey`, `clamp` from `../logic`; the control kit.
- Produces: `TripletCombinatorics` registered as `F2`.

**This playground does not use `SceneGraphView`.** That component draws through cytoscape onto a canvas, whose nodes are not DOM elements and therefore cannot be `<button>`s. Spec §4.2 requires every knob to be keyboard-operable, and check 8 walks the lecture by keyboard alone, so F2 renders its own six nodes as real buttons.

**The direction toggle is in the URL; the built edges are not.** Spec §4.3 puts *knob* state in the query string, and direction is a knob. The edges a student builds are their work rather than a setting, and L1 — which does put a submitted graph in its URL — is the lab that scores such a graph and therefore has to make it shareable. F2 scores nothing, so an edge list in the address bar would be a growing query string that shares an unfinished exercise. If a later cycle wants a shareable F2 configuration, that is a change to make deliberately rather than by default.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/playgrounds/F2/test/TripletCombinatorics.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { TripletCombinatorics } from '../TripletCombinatorics';

beforeEach(() => setLocale('en'));

function mount() {
  return render(
    <MemoryRouter initialEntries={['/m/m00']}>
      <TripletCombinatorics />
    </MemoryRouter>,
  );
}

function addEdge(subject: string, object: string, predicate = 'on') {
  fireEvent.click(screen.getByTestId(`node-${subject}`));
  fireEvent.click(screen.getByTestId(`node-${object}`));
  fireEvent.change(screen.getByLabelText('Predicate'), { target: { value: predicate } });
  fireEvent.click(screen.getByRole('button', { name: 'Add edge' }));
}

describe('F2', () => {
  it('offers the six objects as buttons, so the keyboard can reach them', () => {
    mount();
    const nodes = screen.getAllByTestId(/^node-/);
    expect(nodes).toHaveLength(6);
    for (const node of nodes) expect(node.tagName).toBe('BUTTON');
  });

  it('states the candidate space before a single edge is built', () => {
    mount();
    expect(screen.getByTestId('readout-Candidate triplets')).toHaveTextContent('480');
    expect(screen.getByTestId('readout-Edges built')).toHaveTextContent('0');
  });

  it('counts an edge the student builds', () => {
    mount();
    addEdge('1', '2');
    expect(screen.getByTestId('readout-Edges built')).toHaveTextContent('1');
  });

  // Review Focus 2.
  it('refuses a self-pair and says why, rather than counting it', () => {
    mount();
    fireEvent.click(screen.getByTestId('node-1'));
    fireEvent.click(screen.getByTestId('node-1'));
    expect(screen.getByTestId('f2-notice')).toHaveTextContent('two different objects');
    fireEvent.click(screen.getByRole('button', { name: 'Add edge' }));
    expect(screen.getByTestId('readout-Edges built')).toHaveTextContent('0');
  });

  // Review Focus 3.
  it('counts a repeated triplet once, so built can never exceed the candidate space', () => {
    mount();
    addEdge('1', '2');
    addEdge('1', '2');
    expect(screen.getByTestId('readout-Edges built')).toHaveTextContent('1');
    expect(screen.getByTestId('f2-notice')).toHaveTextContent('already built');
  });

  it('halves the candidate space when direction is discarded', () => {
    mount();
    fireEvent.click(screen.getByLabelText('Directed arrows'));
    expect(screen.getByTestId('readout-Candidate triplets')).toHaveTextContent('240');
  });

  it('names the edges that become indistinguishable once direction is discarded', () => {
    mount();
    addEdge('1', '2', 'on');
    addEdge('2', '1', 'on');
    expect(screen.getByTestId('readout-Edges built')).toHaveTextContent('2');

    fireEvent.click(screen.getByLabelText('Directed arrows'));
    expect(screen.getByTestId('f2-collapsed')).toHaveTextContent('on');
    expect(screen.getByTestId('readout-Edges built')).toHaveTextContent('1');
  });

  it('does not take focus when it mounts', () => {
    mount();
    expect(document.activeElement).toBe(document.body);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/playgrounds/F2`
Expected: FAIL — `Failed to resolve import "../TripletCombinatorics"`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/playgrounds/F2/TripletCombinatorics.tsx
import { useState } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { candidateSpace, tripletKey, type Triplet } from '../logic';
import { FRAMES, PREDICATES, SLICE_PREDICATE_COUNT } from '../slice';

/**
 * F2 — 三元組與 G=(V,E,T).
 *
 * The abstract graph, not the photograph. That is exactly where the boundary against L1 falls:
 * L1 keeps the image, the ground truth and PredCls scoring, and this keeps the combinatorics.
 * Nothing here is scored and nothing is compared against an answer.
 *
 * Not `SceneGraphView`, although it exists and draws a node-link diagram: it renders through
 * cytoscape onto a canvas, and a canvas node is not a DOM element, so it cannot be a `<button>`.
 * Spec §4.2 requires every knob to be reachable from the keyboard, and check 8 walks the whole
 * lecture without a mouse.
 *
 * The direction toggle is the substantive control. Discarding direction halves the candidate
 * space and merges any pair of edges that differed only by their order, and the panel names
 * which ones — M0's second implication, 方向承載語意，對稱化會使其消失, as a demonstration
 * rather than a sentence.
 */
export function TripletCombinatorics() {
  const { t } = useLocale();
  const frame = FRAMES[0];
  const [params, setParams] = useLabParams({ 'F2.directed': 1 });
  const directed = params['F2.directed'] === 1;

  const [subject, setSubject] = useState<number | null>(null);
  const [object, setObject] = useState<number | null>(null);
  const [predicate, setPredicate] = useState(PREDICATES[0]);
  const [built, setBuilt] = useState<Triplet[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const candidates = candidateSpace(frame.objects.length, SLICE_PREDICATE_COUNT, directed);

  // Under the current direction setting, two built edges that share a key are one edge. The
  // count shown is therefore the number of *distinguishable* edges, which is the quantity the
  // candidate space is a bound on.
  const keys = new Set(built.map((t) => tripletKey(t, directed)));
  const collapsed = built.filter(
    (t, i) => built.findIndex((u) => tripletKey(u, directed) === tripletKey(t, directed)) !== i,
  );

  function pick(objectId: number) {
    setNotice(null);
    if (subject === null) {
      setSubject(objectId);
      return;
    }
    if (objectId === subject) {
      setNotice(t('playground.self_pair'));
      return;
    }
    setObject(objectId);
  }

  function add() {
    if (subject === null || object === null) return;
    const triplet: Triplet = { subject_id: subject, predicate, object_id: object };
    if (built.some((t) => tripletKey(t, true) === tripletKey(triplet, true))) {
      setNotice(t('playground.duplicate'));
      return;
    }
    setBuilt([...built, triplet]);
    setSubject(null);
    setObject(null);
    setNotice(null);
  }

  const nameOf = (id: number) => frame.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);

  const controls = (
    <>
      <Choice
        id="F2.predicate"
        label={t('playground.predicate')}
        value={predicate}
        options={PREDICATES.map((p) => ({ value: p, label: p }))}
        onChange={setPredicate}
      />
      <button
        type="button"
        onClick={add}
        className="rounded border border-slate-400 bg-white px-3 py-1 text-base"
      >
        {t('playground.add_edge')}
      </button>
      <button
        type="button"
        onClick={() => { setBuilt([]); setSubject(null); setObject(null); setNotice(null); }}
        className="rounded border border-slate-300 bg-white px-3 py-1 text-base"
      >
        {t('playground.reset')}
      </button>
      <Toggle
        id="F2.directed"
        label={t('playground.directed')}
        checked={directed}
        onChange={(on) => setParams({ 'F2.directed': on ? 1 : 0 })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F2" controls={controls}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-wrap gap-2">
          {frame.objects.map((o) => {
            const role = o.object_id === subject ? 'subject' : o.object_id === object ? 'object' : 'none';
            return (
              <button
                key={o.object_id}
                type="button"
                data-testid={`node-${o.object_id}`}
                data-role={role}
                onClick={() => pick(o.object_id)}
                className={
                  role === 'none'
                    ? 'rounded-full border border-slate-400 bg-white px-4 py-2 text-base'
                    : 'rounded-full border-2 border-slate-900 bg-slate-900 px-4 py-2 text-base text-white'
                }
              >
                {/* The role is spelled out, not only coloured: NFR-5 forbids hue as the only
                    channel, and subject against object is the distinction that matters here. */}
                {o.names[0]}
                {role !== 'none' ? ` · ${role}` : ''}
              </button>
            );
          })}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-1">
          <Readout
            label={t('playground.candidates')}
            value={String(candidates)}
            note={`${frame.objects.length} × ${frame.objects.length - 1}${directed ? '' : ' / 2'} × ${SLICE_PREDICATE_COUNT}`}
          />
          <Readout label={t('playground.built')} value={String(keys.size)} note={`|E|`} />
        </div>
      </div>

      {notice && (
        <p data-testid="f2-notice" className="mt-3 text-base text-amber-700">{notice}</p>
      )}

      <ul className="mt-3 space-y-1 font-mono text-base">
        {built.map((tri, i) => (
          <li key={`${tripletKey(tri, true)}-${i}`}>
            {nameOf(tri.subject_id)} {directed ? '—' : '—'}
            {tri.predicate}
            {directed ? '→ ' : '— '}
            {nameOf(tri.object_id)}
          </li>
        ))}
      </ul>

      {!directed && collapsed.length > 0 && (
        <p data-testid="f2-collapsed" className="mt-3 text-base text-slate-700">
          {t('playground.collapsed')}{' '}
          {collapsed.map((tri) => `${nameOf(tri.subject_id)} ${tri.predicate} ${nameOf(tri.object_id)}`).join('、')}
        </p>
      )}
    </PlaygroundFrame>
  );
}
```

- [ ] **Step 4: Register it**

In `frontend/src/playgrounds/mounts.tsx`, add the import and the entry:

```tsx
import { TripletCombinatorics } from './F2/TripletCombinatorics';

export const PLAYGROUND_MOUNTS: Record<string, ComponentType> = {
  F1: LabelsToStructure,
  F2: TripletCombinatorics,
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:ts -- frontend/src/playgrounds`
Expected: PASS, F2's 8 tests included.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/playgrounds/F2 frontend/src/playgrounds/mounts.tsx
git commit -m "feat(sgs): F2, the candidate space and what symmetrising costs"
```

---

## Task 8: F8 — 有向邊與不對稱性

**Files:**
- Create: `frontend/src/playgrounds/F8/DirectedEdges.tsx`
- Modify: `frontend/src/playgrounds/mounts.tsx`
- Test: `frontend/src/playgrounds/F8/test/DirectedEdges.test.tsx`

**Interfaces:**
- Consumes: `FRAMES`, `frameById` from `../slice`; `isInE` from `../logic`; the control kit; `useLabParams`.
- Produces: `DirectedEdges` registered as `F8`.

URL keys: `F8.img` (string, default `ph-001`), `F8.rel` (number, a `relationship_id`, default 1), `F8.swap` (number 0 or 1, default 0).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/playgrounds/F8/test/DirectedEdges.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { DirectedEdges } from '../DirectedEdges';

beforeEach(() => setLocale('en'));

function at(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m00${search}`]}>
      <DirectedEdges />
    </MemoryRouter>,
  );
}

describe('F8', () => {
  it('opens on a triplet the annotator wrote, and says it is recorded', () => {
    at();
    // ph-001 relationship 1: box --on--> table.
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('box on table');
    expect(screen.getByTestId('f8-status')).toHaveTextContent('Recorded in E');
  });

  it('swapping reverses the sentence and the status', () => {
    at();
    fireEvent.click(screen.getByLabelText('Swap subject and object'));
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('table on box');
    expect(screen.getByTestId('f8-status')).toHaveTextContent('Not recorded in E');
  });

  it('never says true or false, because not recorded is a different claim', () => {
    at();
    fireEvent.click(screen.getByLabelText('Swap subject and object'));
    const status = screen.getByTestId('f8-status').textContent ?? '';
    expect(status.toLowerCase()).not.toMatch(/\bfalse\b/);
    expect(status.toLowerCase()).not.toMatch(/\btrue\b/);
    expect(screen.getByTestId('f8-note')).toHaveTextContent('not the same claim as false');
  });

  it('the symmetric-reading case is still absent from E, which is the teaching moment', () => {
    // ph-001 relationship 2: person --near--> table. `near` reads as symmetric; the annotator
    // wrote one direction.
    at('?F8.rel=2');
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('person near table');
    fireEvent.click(screen.getByLabelText('Swap subject and object'));
    expect(screen.getByTestId('f8-status')).toHaveTextContent('Not recorded in E');
  });

  it('does not take focus when it mounts', () => {
    at();
    expect(document.activeElement).toBe(document.body);
  });

  it('falls back to the frame’s first relationship when the URL names one it does not have', () => {
    at('?F8.rel=999');
    expect(screen.getByTestId('f8-sentence')).toHaveTextContent('box on table');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ts -- frontend/src/playgrounds/F8`
Expected: FAIL — `Failed to resolve import "../DirectedEdges"`.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/playgrounds/F8/DirectedEdges.tsx
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { isInE } from '../logic';
import { FRAMES, frameById } from '../slice';

/**
 * F8 — 有向邊與不對稱性.
 *
 * One control, and the wording is the whole design. M0's third implication states
 * 已標註者不等於為真者, so this reports 「此邊收錄於 E」 against 「此邊未收錄於 E」 and never
 * 真 against 偽. A playground printing "false" would contradict the module three paragraphs
 * above it, and would teach the confusion that the missed-against-spurious split later has to
 * undo.
 *
 * The case worth showing is `person near table`: the relation reads as symmetric, and its
 * reversal is still absent from E. That is the annotation-versus-truth distinction arriving as
 * a fact rather than as a caution.
 */
export function DirectedEdges() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'F8.img': FRAMES[0].image_id,
    'F8.rel': 1,
    'F8.swap': 0,
  });

  const frame = frameById(params['F8.img']) ?? FRAMES[0];
  const relationship =
    frame.relationships.find((r) => r.relationship_id === params['F8.rel']) ?? frame.relationships[0];
  const swapped = params['F8.swap'] === 1;

  const subjectId = swapped ? relationship.object_id : relationship.subject_id;
  const objectId = swapped ? relationship.subject_id : relationship.object_id;
  const nameOf = (id: number) => frame.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);

  const recorded = isInE(frame, {
    subject_id: subjectId,
    predicate: relationship.predicate,
    object_id: objectId,
  });

  const controls = (
    <>
      <Choice
        id="F8.frame"
        label={t('playground.frame')}
        value={frame.image_id}
        options={FRAMES.map((f) => ({ value: f.image_id, label: f.image_id }))}
        onChange={(next) => setParams({ 'F8.img': next, 'F8.rel': 1, 'F8.swap': 0 })}
      />
      <Choice
        id="F8.rel"
        label={t('playground.triplet')}
        value={String(relationship.relationship_id)}
        options={frame.relationships.map((r) => ({
          value: String(r.relationship_id),
          label: `${nameOf(r.subject_id)} ${r.predicate} ${nameOf(r.object_id)}`,
        }))}
        onChange={(next) => setParams({ 'F8.rel': Number(next), 'F8.swap': 0 })}
      />
      <Toggle
        id="F8.swap"
        label={t('playground.swap')}
        checked={swapped}
        onChange={(on) => setParams({ 'F8.swap': on ? 1 : 0 })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F8" controls={controls}>
      <div className="flex flex-col gap-4">
        <p data-testid="f8-sentence" className="font-mono text-3xl text-slate-900">
          {nameOf(subjectId)} <span className="text-slate-500">{relationship.predicate}</span>{' '}
          {nameOf(objectId)}
        </p>
        <p
          data-testid="f8-status"
          data-recorded={String(recorded)}
          className={recorded ? 'text-2xl text-emerald-700' : 'text-2xl text-slate-700'}
        >
          {/* The words carry the distinction, not the colour: NFR-5, and more importantly the
              reader must be able to quote this line without the palette. */}
          {recorded ? t('playground.in_e') : t('playground.not_in_e')}
        </p>
        {!recorded && (
          <p data-testid="f8-note" className="text-base text-slate-600">
            {t('playground.not_in_e_note')}
          </p>
        )}
        <Readout
          label={t('playground.annotated')}
          value={String(frame.relationships.length)}
          note={`|E| — ${frame.image_id}`}
        />
      </div>
    </PlaygroundFrame>
  );
}
```

- [ ] **Step 4: Register it**

```tsx
import { DirectedEdges } from './F8/DirectedEdges';

export const PLAYGROUND_MOUNTS: Record<string, ComponentType> = {
  F1: LabelsToStructure,
  F2: TripletCombinatorics,
  F8: DirectedEdges,
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:ts -- frontend/src/playgrounds`
Expected: PASS, F8's 6 tests included.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/playgrounds/F8 frontend/src/playgrounds/mounts.tsx
git commit -m "feat(sgs): F8, where a reversal is absent rather than false"
```

---

## Task 9: The golden file

**Files:**
- Create: `data/content/playground_golden.json`
- Test: `frontend/src/playgrounds/test/golden.test.ts`

**Interfaces:**
- Consumes: `candidateSpace`, `densityCut`, `ratio`, `isInE` from `../logic`; `frameById` from `../slice`.
- Produces: the committed golden file, read by the test and by `content_lint.mjs` in Task 11.

- [ ] **Step 1: Write the golden file**

```json
{
  "$comment": "One case per playground configuration. `why` writes out the arithmetic a reader would check, exactly as data/golden/vectors.json does for the evaluation engine: a bare expected number is a value somebody typed, and recomputing it in the test from the same annotation would mirror the implementation and prove nothing. content_lint.mjs refuses a case whose why is missing.",
  "cases": [
    {
      "id": "pg-F1-ph001-full-slice",
      "kp": "F1",
      "image_id": "ph-001",
      "knobs": { "density": 1, "predicate_count": 16 },
      "expect": { "objects": 6, "annotated": 6, "candidates": 480, "ratio": 0.0125 },
      "why": "ph-001 carries 6 objects and 6 annotated edges. Ordered pairs of distinct objects = 6 x 5 = 30. With the slice's 16 predicates the candidate space is 30 x 16 = 480. The annotated share is 6 / 480 = 0.0125."
    },
    {
      "id": "pg-F1-ph001-full-vg150",
      "kp": "F1",
      "image_id": "ph-001",
      "knobs": { "density": 1, "predicate_count": 50 },
      "expect": { "objects": 6, "annotated": 6, "candidates": 1500, "ratio": 0.004 },
      "why": "Same 30 ordered pairs, but with VG-150's 50 predicates: 30 x 50 = 1500. The annotated share is 6 / 1500 = 0.004. This is the vocabulary M0's own worked example computes with, which is why it is offered."
    },
    {
      "id": "pg-F1-ph001-half",
      "kp": "F1",
      "image_id": "ph-001",
      "knobs": { "density": 0.5, "predicate_count": 16 },
      "expect": { "objects": 6, "annotated": 3, "candidates": 480, "ratio": 0.00625 },
      "why": "Half of 6 edges is 3. The candidate space does not depend on how many edges were annotated, so it stays 480 and only the numerator moves: 3 / 480 = 0.00625. That the bound does not move is the point of the slider."
    },
    {
      "id": "pg-F1-ph001-zero",
      "kp": "F1",
      "image_id": "ph-001",
      "knobs": { "density": 0, "predicate_count": 16 },
      "expect": { "objects": 6, "annotated": 0, "candidates": 480, "ratio": 0 },
      "why": "No edges kept. 0 / 480 = 0, which is zero and not undefined: the candidate space is non-empty, so the share is a real number."
    },
    {
      "id": "pg-F2-ph001-directed",
      "kp": "F2",
      "image_id": "ph-001",
      "knobs": { "directed": true, "predicate_count": 16 },
      "expect": { "candidates": 480 },
      "why": "6 objects give 6 x 5 = 30 ordered pairs of distinct objects, times 16 predicates = 480."
    },
    {
      "id": "pg-F2-ph001-undirected",
      "kp": "F2",
      "image_id": "ph-001",
      "knobs": { "directed": false, "predicate_count": 16 },
      "expect": { "candidates": 240 },
      "why": "Discarding direction identifies (s,o) with (o,s), so 30 ordered pairs become 15 unordered ones: 15 x 16 = 240, exactly half of 480."
    },
    {
      "id": "pg-F8-ph001-forward",
      "kp": "F8",
      "image_id": "ph-001",
      "knobs": { "relationship_id": 1, "swapped": false },
      "expect": { "recorded": true },
      "why": "ph-001 relationship 1 is object 3 (box) --on--> object 1 (table). Unswapped, the triplet is the one the annotator wrote, so it is in E."
    },
    {
      "id": "pg-F8-ph001-reversed",
      "kp": "F8",
      "image_id": "ph-001",
      "knobs": { "relationship_id": 1, "swapped": true },
      "expect": { "recorded": false },
      "why": "Swapped, the triplet is table --on--> box. No relationship in ph-001 has subject 1, object 3 and predicate on, so it is not in E. Not in E is not the same claim as false."
    },
    {
      "id": "pg-F8-ph001-symmetric-reading",
      "kp": "F8",
      "image_id": "ph-001",
      "knobs": { "relationship_id": 2, "swapped": true },
      "expect": { "recorded": false },
      "why": "ph-001 relationship 2 is object 2 (person) --near--> object 1 (table). `near` reads as symmetric, but the annotator wrote one direction only, so table --near--> person is not in E. This is the case worth showing: the absence is a fact about the annotation, not about the world."
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

```ts
// frontend/src/playgrounds/test/golden.test.ts
import { describe, expect, it } from 'vitest';
import golden from '../../../../../data/content/playground_golden.json';
import { candidateSpace, densityCut, isInE, ratio } from '../logic';
import { frameById } from '../slice';

interface Case {
  id: string;
  kp: string;
  image_id: string;
  knobs: Record<string, number | boolean>;
  expect: Record<string, number | boolean>;
  why: string;
}

const cases = (golden as unknown as { cases: Case[] }).cases;

describe('playground golden cases', () => {
  it('every case writes out its arithmetic', () => {
    for (const c of cases) {
      expect(c.why, c.id).toBeTruthy();
      expect(c.why.length, c.id).toBeGreaterThan(40);
    }
  });

  it.each(cases.filter((c) => c.kp === 'F1'))('$id', (c) => {
    const frame = frameById(c.image_id)!;
    const kept = densityCut(frame.relationships, c.knobs.density as number);
    const candidates = candidateSpace(frame.objects.length, c.knobs.predicate_count as number, true);
    expect(frame.objects).toHaveLength(c.expect.objects as number);
    expect(kept).toHaveLength(c.expect.annotated as number);
    expect(candidates).toBe(c.expect.candidates);
    expect(ratio(kept.length, candidates)).toBeCloseTo(c.expect.ratio as number, 6);
  });

  it.each(cases.filter((c) => c.kp === 'F2'))('$id', (c) => {
    const frame = frameById(c.image_id)!;
    expect(
      candidateSpace(frame.objects.length, c.knobs.predicate_count as number, c.knobs.directed as boolean),
    ).toBe(c.expect.candidates);
  });

  it.each(cases.filter((c) => c.kp === 'F8'))('$id', (c) => {
    const frame = frameById(c.image_id)!;
    const rel = frame.relationships.find((r) => r.relationship_id === c.knobs.relationship_id)!;
    const swapped = c.knobs.swapped as boolean;
    expect(
      isInE(frame, {
        subject_id: swapped ? rel.object_id : rel.subject_id,
        predicate: rel.predicate,
        object_id: swapped ? rel.subject_id : rel.object_id,
      }),
    ).toBe(c.expect.recorded);
  });
});
```

- [ ] **Step 3: Run it to verify it passes**

Run: `npm run test:ts -- frontend/src/playgrounds/test/golden.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 4: Watch it fail**

Temporarily change `pg-F1-ph001-full-slice`'s `candidates` from `480` to `481`, run the test, confirm exactly one case fails and names both numbers, then restore `480`.

- [ ] **Step 5: Commit**

```bash
git add data/content/playground_golden.json frontend/src/playgrounds/test/golden.test.ts
git commit -m "feat(sgs): nine golden cases for the playgrounds, each with its arithmetic"
```

---

## Task 10: M0 gains its three playground steps

**Files:**
- Modify: `frontend/src/content/m00.zh-TW.mdx`, `frontend/src/content/m00.en.mdx`

M0 goes from 4 steps to 7, in this order: `s1` prose, **`s2` playground F1**, `s3` math (the present `s2`), **`s4` playground F2**, **`s5` playground F8**, `s6` lab (the present `s3`), `s7` checkpoint (the present `s4`).

**Renaming the existing steps changes their ids, and a step id is in the URL.** `/lecture/m/m00/2` is a position, not an id, so no link breaks; but `content_lint.mjs` requires both locales to agree on ids, so both files are edited together in this task and never separately.

- [ ] **Step 1: Renumber the existing steps in both files**

In `m00.zh-TW.mdx` and `m00.en.mdx`, in the frontmatter and in the body's `<Step id="...">` tags: `s2` → `s3`, `s3` → `s6`, `s4` → `s7`. Do the body and the frontmatter in one pass per file.

- [ ] **Step 2: Add the three playground steps to the zh-TW frontmatter**

Insert after `s1` in the `steps:` list:

```yaml
  - id: s2
    kind: playground
    kp: F1
    seconds_budget: 180
    presenter_notes_zh: "三分鐘。開場先關閉全部圖層，僅留照片，待現場指出僅憑標籤無法區辨兩張場景，再逐層開啟。密度滑桿由滿格拉至零，重點在於候選數不變而標註數改變；該比值即為本領域所有指標皆為召回率的理由。|𝒫| 切至 50 時須說明該值取自 VG-150，與本切片實計的 16 並非同一來源。"
```

Insert after the renumbered `s3`:

```yaml
  - id: s4
    kind: playground
    kp: F2
    seconds_budget: 240
    presenter_notes_zh: "四分鐘。先請現場估計六個物件可構成多少候選三元組，再顯示 480。建立三至四條邊即足夠，不必建滿。關鍵操作為關閉方向：候選數減半，且畫面會列出哪幾條邊因此無法區辨，此即對稱化使語意消失的直接證據，而非僅為陳述。"
  - id: s5
    kind: playground
    kp: F8
    seconds_budget: 120
    presenter_notes_zh: "兩分鐘。以 box on table 起始，交換後狀態轉為「未收錄於 E」。接著切至 person near table：語意上對稱，交換後仍為「未收錄於 E」。此處務必明確區分「未收錄」與「為偽」，該區別即為前一步驟第三項推論，亦為後續 missed 與 spurious 分野的基礎。"
```

- [ ] **Step 3: Add the same three steps to the en frontmatter**

```yaml
  - id: s2
    kind: playground
    kp: F1
    seconds_budget: 180
    presenter_notes_en: "Three minutes. Open with every layer off, so only the photograph shows, and wait for the room to say that labels alone do not separate the two scenes before bringing the layers up one at a time. Drag the density slider from full to zero: the candidate count does not move and the annotated count does, and that ratio is why every metric in this field is a recall. Switching |P| to 50 needs one sentence saying the number is VG-150's, not this slice's 16."
```

```yaml
  - id: s4
    kind: playground
    kp: F2
    seconds_budget: 240
    presenter_notes_en: "Four minutes. Ask the room to estimate how many candidate triplets six objects admit before showing 480. Three or four edges is enough; there is no need to fill the graph. The move that matters is turning direction off: the candidate count halves and the panel lists which built edges have become indistinguishable, which is the symmetrisation claim as evidence rather than as assertion."
  - id: s5
    kind: playground
    kp: F8
    seconds_budget: 120
    presenter_notes_en: "Two minutes. Start on box on table; the swap turns the status to not recorded in E. Then move to person near table, which reads as symmetric and whose reversal is still not recorded. Say explicitly that not recorded and false are different claims: that is the third implication of the previous step, and it is what the missed against spurious split rests on later."
```

- [ ] **Step 4: Add the three step bodies to `m00.zh-TW.mdx`**

After `s1`'s `</Step>`:

```mdx
<Step id="s2">

## 圖層與標註密度

同一張影像，分別以標籤、邊界框與關係三個圖層呈現。關閉全部圖層後所餘者即為分類器所見；逐層開啟，方得場景圖所載之結構。

密度滑桿改變的是已標註邊數，候選三元組數不隨之改變。兩者之比值即為本單元後續所有指標皆以召回率表述的理由。

<Playground kp="F1" />

</Step>
```

After the renumbered `s3`'s `</Step>`:

```mdx
<Step id="s4">

## 候選空間與方向

以六個物件為例，自行建立數條邊，並對照候選三元組總數。

關閉「有向箭頭」後，候選空間減半，且原本相異的兩條邊將合併為一。畫面所列出者，即為捨棄方向後無法區辨之邊。

<Playground kp="F2" />

</Step>

<Step id="s5">

## 交換主體與客體

任取一組三元組並交換其主體與客體，觀察其是否仍收錄於 E。

須注意者為：「未收錄於 E」與「為偽」並非同一陳述。前者為標註之事實，後者為場景之事實，兩者於本課程始終分開處理。

<Playground kp="F8" />

</Step>
```

- [ ] **Step 5: Add the three step bodies to `m00.en.mdx`**

After `s1`'s `</Step>`:

```mdx
<Step id="s2">

## Layers, and annotation density

One image, with labels, boxes and relations as three independent layers. What remains when every layer is off is what a classifier sees; bringing them up one at a time is what a scene graph adds.

The density slider moves the annotated edge count and leaves the candidate count where it is. The ratio between them is why every metric in this unit is stated as a recall.

<Playground kp="F1" />

</Step>
```

After the renumbered `s3`'s `</Step>`:

```mdx
<Step id="s4">

## The candidate space, and direction

Six objects. Build a few edges and read them against the total number of candidate triplets.

Turning off directed arrows halves the candidate space and merges two edges that were distinct into one. The panel lists the edges that can no longer be told apart.

<Playground kp="F2" />

</Step>

<Step id="s5">

## Swapping subject and object

Take a triplet, swap its subject and object, and see whether it is still recorded in E.

Note what the reading is: *not recorded in E* and *false* are different claims. The first is a fact about the annotation, the second about the scene, and this course keeps them apart throughout.

<Playground kp="F8" />

</Step>
```

- [ ] **Step 6: Run the content lint and the frontend build**

Run: `npm run lint:content && npm run build:frontend`
Expected: PASS. The lint reports 95 steps where it reported 92.

- [ ] **Step 7: Run the full suite**

Run: `npm run test:ts`
Expected: PASS. The registry test from Task 4 now has three playground steps to render and genuinely asserts that `<Playground/>` resolves.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/content/m00.zh-TW.mdx frontend/src/content/m00.en.mdx
git commit -m "feat(sgs): M0 gains its three playground steps, 4 to 7"
```

---

## Task 11: The lint rules — the spec’s seven, plus the golden file’s own

**Files:**
- Modify: `tools/content_lint.mjs` (the per-module loop, around line 280)
- Test: by watching each rule fail against a deliberately broken M0, then restoring it.

**Interfaces:**
- Consumes: `PLAYGROUND_MOUNTS`'s keys, read by regex from `frontend/src/playgrounds/mounts.tsx`; `data/content/kp.json`; `data/content/assignment.json`; `data/content/playground_golden.json`.
- Produces: eight new `problems.push` sites.

- [ ] **Step 1: Read the mount table's keys**

Near the top of `content_lint.mjs`, beside the other artefact reads:

```js
// The registered playgrounds, read from the mount table rather than from a list beside it. A
// regex over a .tsx file is crude, and the alternative is a second list that can disagree with
// the first — which is the failure this whole file exists to catch.
//
// Paths in this file are relative to system/, as every other read here is.
const REGISTERED = new Set(
  [...readFileSync('frontend/src/playgrounds/mounts.tsx', 'utf-8')
    .matchAll(/^\s{2}([A-Z]\d+):\s/gm)].map((m) => m[1]),
);

const PLAYGROUND_GOLDEN = JSON.parse(
  readFileSync('../data/content/playground_golden.json', 'utf-8'),
);
```

The existing identifiers this rule set uses are `KP` (a `Set` of knowledge-point ids, line 187) and `ASSIGNMENT` (line 192, **already** `.modules`, so index it directly). Do not invent `KP_IDS` or write `ASSIGNMENT.modules`.

- [ ] **Step 2: Add the seven step rules**

`body` is currently computed inside the math-contract block and is therefore not in scope here. Hoist it to just above the step loop, and delete the local one the math block declares:

```js
    const body = source.slice(source.indexOf('\n---', 4) + 4);
```

Then, inside the existing `for (const step of meta.steps ?? [])` loop:

```js
      if (step.kind === 'playground') {
        if (!step.kp) {
          problems.push(`${file}: step '${step.id}' is a playground and names no kp. ` +
                        `Contracts §2.4 requires one.`);
        } else {
          if (!KP.has(step.kp)) {
            problems.push(`${file}: step '${step.id}' names kp '${step.kp}', not in kp.json`);
          }
          const owned = (ASSIGNMENT[meta.id] ?? []).includes(step.kp);
          const cited = (meta.knowledge_points ?? []).includes(step.kp);
          if (!owned && !cited) {
            problems.push(`${file}: step '${step.id}' has a playground for '${step.kp}', which ` +
                          `this module neither owns nor cites. A playground for a point the ` +
                          `module does not teach is a misfiled widget.`);
          }
          if (!REGISTERED.has(step.kp)) {
            problems.push(`${file}: no component is registered for '${step.kp}' in ` +
                          `frontend/src/playgrounds/mounts.tsx`);
          }
          const tags = [...body.matchAll(/<Playground\s+kp="([^"]+)"/g)].map((m) => m[1]);
          const forThisStep = stepBody(body, step.id);
          const inStep = [...forThisStep.matchAll(/<Playground\s+kp="([^"]+)"/g)].map((m) => m[1]);
          if (inStep.length !== 1 || inStep[0] !== step.kp) {
            problems.push(`${file}: step '${step.id}' declares kp '${step.kp}' but its body ` +
                          `carries ${inStep.length === 0 ? 'no <Playground>' : inStep.join(', ')}. ` +
                          `Frontmatter and body disagreeing is the defect this catches.`);
          }
          if (tags.filter((t) => t === step.kp).length > 1) {
            problems.push(`${file}: '${step.kp}' is mounted more than once in this module`);
          }
        }
      }
```

Add the helper `stepBody` beside the other helpers:

```js
/** The slice of an MDX body between one `<Step id="…">` and the next. */
function stepBody(body, stepId) {
  const open = body.indexOf(`<Step id="${stepId}">`);
  if (open < 0) return '';
  const next = body.indexOf('<Step id="', open + 1);
  return body.slice(open, next < 0 ? body.length : next);
}
```

- [ ] **Step 3: Add the cross-locale rule**

Beside the existing notes-parity check, where both locales' step lists are already in hand:

```js
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      if (a[i].kind === 'playground' || b[i].kind === 'playground') {
        if (a[i].kind !== b[i].kind || a[i].kp !== b[i].kp) {
          problems.push(`${id}: step '${a[i].id}' is ${a[i].kind}/${a[i].kp ?? '—'} in ` +
                        `${LOCALES[0]} and ${b[i].kind}/${b[i].kp ?? '—'} in ${LOCALES[1]}. ` +
                        `A playground must be the same playground in both languages.`);
        }
      }
    }
```

- [ ] **Step 4: Add the golden-file rule**

Beside the existing golden-vector check:

```js
for (const c of PLAYGROUND_GOLDEN.cases) {
  if (!c.why || c.why.length < 40) {
    problems.push(`${c.id}: 'why' must write out the arithmetic a reader would check`);
  }
  if (!REGISTERED.has(c.kp)) {
    problems.push(`${c.id}: golden case for '${c.kp}', which has no registered component`);
  }
}
```

- [ ] **Step 5: Watch each of the eight rules fail**

For each rule in turn, break M0 or the mount table in exactly the way the rule describes, run `npm run lint:content`, confirm **one** problem is reported and that it names the right file, step and id, then restore. Record the eight messages; they go into the deviation in Task 13.

| Rule | How to break it |
|---|---|
| kp missing | delete `kp: F1` from `s2` in the zh-TW file |
| kp not in kp.json | change it to `kp: F99` |
| not owned or cited | change it to `kp: T1` |
| not registered | comment out the `F1:` entry in `mounts.tsx` |
| body disagrees | change the body tag to `<Playground kp="F2" />` |
| mounted twice | paste a second `<Playground kp="F1" />` into `s4` |
| locales disagree | change `kp: F2` to `kp: F8` in the en file only |
| golden `why` | truncate one case's `why` to `"x"` |

- [ ] **Step 6: Run the gate**

Run: `npm run ci`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add tools/content_lint.mjs
git commit -m "feat(sgs): eight lint rules for the playground contract, each watched failing"
```

---

## Task 12: The browser tests

**Files:**
- Modify: `e2e/lecture.spec.ts`, `e2e/projector.spec.ts`

Both run against `vite preview` over the production build with **no backend**, which is what makes the offline claim a fact rather than an intention.

- [ ] **Step 1: Write the interaction test**

Append inside the `in English` describe block of `e2e/lecture.spec.ts`:

```ts
test('a playground computes with no backend running', async ({ page }) => {
  // This file starts no backend. A playground that fetched its data would show nothing here,
  // which is the whole difference between the guarantee and the intention. offline.spec.ts
  // cannot make this check: it asserts nothing is fetched from *outside this origin*, and the
  // proxy makes /api same-origin.
  await page.goto('/lecture/m/m00/1');
  await expect(page.getByTestId('playground-frame')).toBeVisible();
  await expect(page.getByTestId('readout-Candidate triplets')).toContainText('480');
  await expect(page.getByTestId('readout-Annotated share')).toContainText('1.25%');
});

test('a knob is reachable by keyboard, and turning it does not advance the deck', async ({ page }) => {
  await page.goto('/lecture/m/m00/1');
  const position = page.getByTestId('position');
  const before = await position.textContent();

  // Tab into the playground rather than clicking it: a professor at the podium has a remote.
  await page.getByLabel('Annotation density').focus();
  await page.keyboard.press('ArrowLeft');

  // The slider moved...
  await expect(page.getByTestId('readout-Annotated edges')).not.toContainText('6 /');
  // ...and the deck did not. `isTextEntry` gives every key to a focused INPUT; a knob built
  // from a styled div would fail exactly here.
  await expect(position).toHaveText(before ?? '');
});

test('the node buttons of F2 take Space without advancing the slide', async ({ page }) => {
  await page.goto('/lecture/m/m00/3');
  const position = page.getByTestId('position');
  const before = await position.textContent();
  await page.getByTestId('node-1').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('node-1')).toHaveAttribute('data-role', 'subject');
  await expect(position).toHaveText(before ?? '');
});

test('the study shell renders all three playgrounds in one column', async ({ page }) => {
  // Spec §4.1 says the study shell needs no special provision, which is a claim about the
  // product rather than an absence of work: it is true only if a playground renders outside the
  // lecture shell at all. M0 has three, and the student reading alone sees every one of them.
  await page.goto('/m/m00');
  await expect(page.getByTestId('playground-frame')).toHaveCount(3);
  await expect(page.getByTestId('readout-Candidate triplets').first()).toContainText('480');
});

test('no playground takes focus when its step opens', async ({ page }) => {
  for (const index of [1, 3, 4]) {
    await page.goto(`/lecture/m/m00/${index}`);
    await expect(page.getByTestId('playground-frame')).toBeVisible();
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(tag).toBe('BODY');
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/lecture.spec.ts`
Expected: PASS, 4 new tests.

- [ ] **Step 3: Watch the keyboard test fail**

Temporarily change `Slider`'s `<input type="range">` to a `<div tabIndex={0}>`, run the keyboard test, confirm it fails because the deck advanced, then restore. This is the assertion that earns its place.

- [ ] **Step 4: Add the projector test**

In `e2e/projector.spec.ts`, inside the existing per-resolution describe:

```ts
  test('a playground step fits the panel, with its controls reachable', async ({ page }) => {
    await page.goto('/lecture/m/m00/1');
    const controls = page.getByTestId('playground-controls');
    await expect(controls).toBeInViewport();

    // D71 accepted 25 of 92 slides overflowing an XGA panel. Controls above the visual is the
    // rule that keeps a playground off that list: the picture may be clipped, the knobs may not.
    const box = await controls.boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    expect(box, 'controls have a box').not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
  });
```

- [ ] **Step 5: Run the whole browser suite**

Run: `npm run test:e2e`
Expected: PASS. 27 tests become 35.

- [ ] **Step 6: Commit**

```bash
git add e2e/lecture.spec.ts e2e/projector.spec.ts
git commit -m "test(sgs): the playgrounds in Chromium — keyboard, no backend, three panels"
```

---

## Task 13: The records

**Files:**
- Modify: `DEVIATIONS.md`, `docs/INDEX.md`, `docs/VERIFICATION.md`, `docs/superpowers/specs/2026-09-15-scene-graph-studio-contracts.md`, `README.md`

- [ ] **Step 1: Amend contracts §2.4**

After the paragraph fixing the position-message shape, add:

```markdown
**A step may be a playground.** `kind: playground` with `kp: <knowledge point id>`, and its body carries exactly one `<Playground kp="…"/>` naming the same point. `Playground` is supplied through the MDX `components` prop, as `Step` is, so no module imports it. A playground computes a count, a bound or a set membership that its own knowledge point's definition contains, and never a metric; a metric belongs to a lab. `content_lint.mjs` enforces eight rules over this, listed in `docs/superpowers/specs/2026-09-19-playgrounds-design.md` §2.4.
```

- [ ] **Step 2: Write the deviation**

Append to `DEVIATIONS.md` a `## D87` entry recording: that `ImageOverlay` had no visible labels and gained an additive `layers` prop rather than F1 duplicating the coordinate logic; that F2 does **not** reuse `SceneGraphView` because cytoscape draws to a canvas and a canvas node cannot be a `<button>`, which §4.2's keyboard rule requires; the eight lint messages watched failing in Task 11 Step 5; and the Playwright test watched failing in Task 12 Step 3 with the slider replaced by a `div`.

- [ ] **Step 3: Update the counts everywhere they are quoted**

Run `npm run ci` and `npm run test:e2e`, take the printed numbers, and update: `docs/INDEX.md` §5's verification paragraph, `README.md`'s status paragraph, and add `docs/VERIFICATION.md` §15 recording the playground work with its measured numbers. Three documents disagreed on 2026-09-19; they are updated in this commit and not later.

Also update `docs/INDEX.md`:
- §1: mark the playgrounds design **executed** and add the plan row.
- §1: the `DEVIATIONS.md` row to `D1…D87`.
- §5: a paragraph recording that M0 has 7 steps and that 25 live knowledge points remain.

- [ ] **Step 4: Run the gate one last time**

Run: `npm run ci && npm run test:e2e && npm run check:perf`
Expected: all three exit 0. `check:perf` is included because three new interactive components sit inside lecture steps and NFR-8 bounds input-to-paint at 100 ms.

- [ ] **Step 5: Commit**

```bash
git add DEVIATIONS.md docs/INDEX.md docs/VERIFICATION.md docs/superpowers/specs/2026-09-15-scene-graph-studio-contracts.md README.md
git commit -m "docs(sgs): the playground contract, D87, and the counts the run produced"
```
