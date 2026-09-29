import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { SceneGraph } from 'sgg-metrics';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale, type Locale } from '../../i18n/useLocale';
import { Demo } from '../Demo';
import {
  DEFAULT_FRAME, FRAME_IDS, KEYFRAME_IDS, TRADITIONAL, VLM, type Triplet, type VlmArtefact, type VlmFrame,
} from '../data';
import { summaryGraph } from '../DV/graph';

/**
 * D-V in its five parts, each mounted through `Demo` as a step mounts it, in both locales.
 *
 * Every expected figure is computed here from the recorded artefact by arithmetic and by string
 * sets, not through `logic.ts`, so a part that miscounted would disagree with the test rather than
 * with itself. The recording has no expert that rewrote or added a triplet, no predicate outside
 * P, no repeated draft row, no empty summary and no missing analysis; those states are reached by
 * replacing frames through `fixture`, which each test empties after it runs, so every other test
 * reads the recording as it is.
 */
const fixture = vi.hoisted(() => ({
  frames: new Map<string, VlmFrame>(),
  provenance: undefined as VlmArtefact['provenance'] | undefined,
}));

vi.mock('../data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data')>();
  const recorded = actual.VLM;
  return {
    ...actual,
    VLM: {
      ...recorded,
      get frames() {
        return recorded.frames.map((f) => fixture.frames.get(f.image_id) ?? f);
      },
      get provenance() {
        return fixture.provenance ?? recorded.provenance;
      },
    },
  };
});

/**
 * Cytoscape draws to a canvas and jsdom has none, so the graph view is stubbed, as the L1 lab's
 * test stubs it. The stub writes the graph it was handed into the DOM, so the part is still held
 * to handing the view the right graph and the right layout.
 */
vi.mock('../../graph/SceneGraphView', () => ({
  SceneGraphView: (props: { graph: SceneGraph; layout: string }) => {
    const name = new Map(props.graph.objects.map((o) => [o.object_id, o.names[0]]));
    return (
      <div
        data-testid="graph-view"
        data-layout={props.layout}
        data-image={props.graph.image_id}
        data-fidelity={props.graph.provenance.fidelity}
        data-triplets={JSON.stringify(
          props.graph.relationships.map((r) => [name.get(r.subject_id), r.predicate, name.get(r.object_id)]),
        )}
      />
    );
  },
}));

afterEach(() => {
  fixture.frames.clear();
  fixture.provenance = undefined;
});

const renderPart = (part: number, query = '') =>
  render(
    <MemoryRouter initialEntries={[`/lecture/m/m00/10${query}`]}>
      <Demo id="DV" part={String(part)} />
    </MemoryRouter>,
  );

/** The query the part wrote, so a knob is held to the URL the stepper carries between parts. */
function Address() {
  return <output data-testid="address">{useLocation().search}</output>;
}

const frameOf = (id: string) => VLM.frames.find((f) => f.image_id === id)!;
const value = (id: string) => screen.getByTestId(`readout-${id}-value`).textContent;
const key = (t: Triplet) => t.join('|');
/** Each row's key once, in first-appearance order. */
const once = (ts: readonly Triplet[]) => [...new Set(ts.map(key))];
const items = (testid: string) => [...(screen.queryByTestId(testid)?.querySelectorAll('li') ?? [])];
type AnalysisField = 'analysis_en' | 'analysis_zh';
/** The field the displayed locale reads, and the one it must never show. */
const field = (locale: Locale): AnalysisField => (locale === 'zh-TW' ? 'analysis_zh' : 'analysis_en');
const otherField = (locale: Locale): AnalysisField => (locale === 'zh-TW' ? 'analysis_en' : 'analysis_zh');

/** D-T's class-level triplets of one frame, one per relation. */
const dtRows = (id: string) => {
  const f = TRADITIONAL.frames.find((g) => g.image_id === id)!;
  const label = new Map(f.detections.map((d) => [d.object_id, d.label]));
  return f.relations.map((r) => `${label.get(r.subject_id)}|${r.predicate}|${label.get(r.object_id)}`);
};

const LOCALES: Locale[] = ['en', 'zh-TW'];

describe('summaryGraph', () => {
  it('summaryGraph mirrors to_graph', () => {
    for (const f of VLM.frames) {
      const g = summaryGraph(f);
      const order: string[] = [];
      for (const t of f.summary) for (const name of [t[0], t[2]]) if (!order.includes(name)) order.push(name);
      const id = (name: string) => order.indexOf(name) + 1;
      expect(g.objects.map((o) => o.names), f.image_id).toEqual(order.map((name) => [name]));
      expect(g.objects.map((o) => o.object_id), f.image_id).toEqual(order.map((_, i) => i + 1));
      for (const o of g.objects) expect(o.bbox, f.image_id).toEqual({ x: o.object_id, y: o.object_id, w: 1, h: 1 });
      expect(g.relationships, f.image_id).toEqual(
        f.summary.map((t, i) => ({
          relationship_id: i + 1, subject_id: id(t[0]), object_id: id(t[2]), predicate: t[1], score: null,
        })),
      );
      expect(g, f.image_id).toMatchObject({
        image_id: f.image_id,
        dataset: 'mini-isg',
        width: 1024,
        height: 768,
        provenance: { kind: 'vlm', fidelity: 'reconstructed', vlm: 'transcript' },
      });
      expect(g.provenance.note).toContain('returns triplets and no geometry');
    }
    // A repeated row is a second relationship between the same two objects, not a third object.
    const f = frameOf('m0-demo-090');
    const g = summaryGraph({ ...f, summary: [f.summary[0]!, f.summary[0]!] });
    expect(g.objects).toHaveLength(2);
    expect(g.relationships.map((r) => r.relationship_id)).toEqual([1, 2]);
    expect(summaryGraph({ ...f, summary: [] })).toMatchObject({ objects: [], relationships: [] });
  });
});

describe.each(LOCALES)('D-V in %s', (locale) => {
  it('part 1 lays out the prompt\'s parts from the recorded prompt, beside the clip', () => {
    setLocale(locale);
    renderPart(1, '?DV.frame=m0-demo-096');
    const prompt = VLM.prompt_step1;
    expect(screen.getByTestId('demo-clip')).toBeInTheDocument();
    expect(screen.getByTestId('demo-tick-m0-demo-096')).toHaveAttribute('aria-pressed', 'true');
    // INFORMATION's first line and FORMAT's line, each a line of the prompt as sent.
    const lines = prompt.split('\n');
    const information = screen.getByTestId('dv-information').textContent!;
    expect(lines[lines.indexOf('INFORMATION') + 1]).toBe(information);
    const format = screen.getByTestId('dv-format').textContent!;
    expect(lines).toContain(format);
    expect(lines.indexOf(format)).toBe(lines.length - 1);
    // O and P as chips, one to a term, in the prompt's order.
    expect(VLM.O).toHaveLength(12);
    expect(VLM.P).toHaveLength(7);
    expect([...screen.getByTestId('dv-o').querySelectorAll('li')].map((li) => li.textContent)).toEqual(VLM.O);
    expect([...screen.getByTestId('dv-p').querySelectorAll('li')].map((li) => li.textContent)).toEqual(VLM.P);
    for (const term of [...VLM.O, ...VLM.P]) expect(prompt).toContain(`- ${term}`);
    // E as its two examples, each with its analysis.
    const examples = items('dv-e');
    expect(examples).toHaveLength(VLM.E.length);
    VLM.E.forEach((e, k) => {
      expect(examples[k]!.textContent).toContain(`<${e.triplet.join(', ')}>`);
      expect(examples[k]!.textContent).toContain(e.analysis);
      expect(examples[k]!.textContent).toContain(`[${e.kind}]`);
    });
    // The whole prompt, verbatim, behind a disclosure.
    const whole = screen.getByTestId('dv-prompt-whole');
    expect(whole.tagName).toBe('DETAILS');
    expect(whole).not.toHaveAttribute('open');
    expect(within(whole).getByTestId('dv-prompt-text').textContent).toBe(prompt);
    expect(screen.getByTestId('demo-frame').textContent).toContain(
      locale === 'en' ? `each of the ${VLM.frames.length} frames` : `隨 ${VLM.frames.length} 個影格`,
    );
    // Open, the whole prompt takes the parts' place, so the part stays inside the panel; closed,
    // the parts come back.
    const details = whole as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(screen.queryByTestId('dv-parts')).toBeNull();
    expect(details).toHaveAttribute('open');
    details.open = false;
    fireEvent(details, new Event('toggle'));
    expect(screen.getByTestId('dv-parts')).toBeInTheDocument();
  });

  it('part 1 picks a frame from the clip\'s ticks and holds it in the URL', () => {
    setLocale(locale);
    render(
      <MemoryRouter initialEntries={['/lecture/m/m00/10']}>
        <Demo id="DV" part="1" />
        <Address />
      </MemoryRouter>,
    );
    expect(screen.getByTestId(`demo-tick-${DEFAULT_FRAME}`)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('demo-tick-m0-demo-102'));
    expect(screen.getByTestId('demo-tick-m0-demo-102')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('address').textContent).toBe('?DV.frame=m0-demo-102');
  });

  it('part 2 flags every term outside O or P', () => {
    setLocale(locale);
    let flagged = 0;
    for (const id of FRAME_IDS) {
      renderPart(2, `?DV.frame=${id}`);
      const draft = frameOf(id).draft;
      const rows = items('dv-draft');
      expect(rows, id).toHaveLength(draft.length);
      let outside = 0;
      draft.forEach((t, k) => {
        const expected = [
          ...(VLM.O.includes(t[0]) ? [] : ['subject:∉ O']),
          ...(VLM.P.includes(t[1]) ? [] : ['predicate:∉ P']),
          ...(VLM.O.includes(t[2]) ? [] : ['object:∉ O']),
        ];
        const flags = [...rows[k]!.querySelectorAll('[data-testid="dv-flag"]')].map(
          (f) => `${f.getAttribute('data-term')}:${f.textContent}`,
        );
        expect(flags, `${id} row ${k + 1}`).toEqual(expected);
        expect(rows[k], `${id} row ${k + 1}`).toHaveAttribute('data-outside', String(expected.length > 0));
        if (expected.length > 0) outside += 1;
      });
      expect(value('DV.outside'), id).toBe(String(outside));
      flagged += outside;
      cleanup();
    }
    // The recording's own terms outside O (left_hand, right_hand at 96 s) are among them.
    expect(flagged).toBeGreaterThan(0);

    // A predicate outside P, which the recording does not hold.
    const f = frameOf('m0-demo-090');
    fixture.frames.set('m0-demo-090', { ...f, draft: [['hand', 'tightening', 'nut'], ...f.draft] });
    renderPart(2);
    const first = items('dv-draft')[0]!;
    expect([...first.querySelectorAll('[data-testid="dv-flag"]')].map((x) => x.textContent)).toEqual(['∉ P']);
    expect(value('DV.outside')).toBe('1');
  });

  it('part 2 counts rows, duplicates included', () => {
    setLocale(locale);
    for (const id of FRAME_IDS) {
      renderPart(2, `?DV.frame=${id}`);
      expect(value('DV.emitted'), id).toBe(String(frameOf(id).draft.length));
      cleanup();
    }
    const f = frameOf('m0-demo-090');
    fixture.frames.set('m0-demo-090', { ...f, draft: [...f.draft, f.draft[0]!] });
    renderPart(2);
    expect(value('DV.emitted')).toBe(String(f.draft.length + 1));
    const rows = items('dv-draft');
    expect(rows).toHaveLength(f.draft.length + 1);
    expect(rows.at(-1)).toHaveAttribute('data-triplet', key(f.draft[0]!));
    expect(rows[0]).toHaveAttribute('data-triplet', key(f.draft[0]!));
  });

  it('part 2 sets the calls and D-T\'s candidates for the same frame beside the draft', () => {
    setLocale(locale);
    for (const id of ['m0-demo-090', 'm0-demo-096']) {
      renderPart(2, `?DV.frame=${id}`);
      const n = TRADITIONAL.frames.find((f) => f.image_id === id)!.detections.length;
      expect(screen.getByTestId('DV.frame')).toHaveValue(id);
      expect(value('DV.calls')).toBe(String(VLM.calls_per_frame));
      expect(VLM.calls_per_frame).toBe(frameOf(id).experts.length + 2);
      expect(screen.getByTestId('readout-DV.calls')).toHaveTextContent(`N + 2, N = ${frameOf(id).experts.length}`);
      expect(value('DV.dt_candidates')).toBe((n * (n - 1) * TRADITIONAL.vg150_predicate_count).toLocaleString('en-US'));
      cleanup();
    }
  });

  it('part 3 shows the chosen expert\'s rewrites, deletions and additions against the draft', () => {
    setLocale(locale);
    const check = (id: string, n: number) => {
      renderPart(3, `?DV.frame=${id}&DV.expert=${n}`);
      const where = `${id} expert ${n}`;
      const f = frameOf(id);
      const [draft, revision] = [new Set(f.draft.map(key)), new Set(f.experts[n - 1]!.revision.map(key))];
      const gone = [...draft].filter((t) => !revision.has(t)).sort();
      const came = [...revision].filter((t) => !draft.has(t)).sort();
      const rewritten = items('dv-rewritten').map((li) => [li.getAttribute('data-from')!, li.getAttribute('data-to')!]);
      const deleted = items('dv-deleted').map((li) => li.getAttribute('data-triplet')!);
      const added = items('dv-added').map((li) => li.getAttribute('data-triplet')!);
      expect([...deleted, ...rewritten.map(([from]) => from)].sort(), where).toEqual(gone);
      expect([...added, ...rewritten.map(([, to]) => to)].sort(), where).toEqual(came);
      for (const [from, to] of rewritten) {
        const [a, b] = [from.split('|'), to.split('|')];
        expect([a[0], a[2]], where).toEqual([b[0], b[2]]);
      }
      for (const li of items('dv-deleted')) expect(li.textContent!.startsWith('−'), where).toBe(true);
      for (const li of items('dv-added')) expect(li.textContent!.startsWith('+'), where).toBe(true);
      for (const li of items('dv-rewritten')) expect(li.textContent, where).toContain('→');
      if (gone.length + came.length === 0) {
        expect(screen.getByTestId('dv-no-change'), where).toBeInTheDocument();
      } else {
        expect(screen.queryByTestId('dv-no-change'), where).toBeNull();
        expect(screen.getByTestId('dv-deleted-count').textContent, where).toBe(String(deleted.length));
        expect(screen.getByTestId('dv-added-count').textContent, where).toBe(String(added.length));
        expect(screen.getByTestId('dv-rewritten-count').textContent, where).toBe(String(rewritten.length));
      }
      // Each recorded analysis, verbatim, in the displayed locale's field.
      expect(screen.getByTestId('dv-analysis').textContent, where).toBe(f.experts[n - 1]![field(locale)]);
      cleanup();
    };
    for (const id of FRAME_IDS) for (const n of [1, 2, 3]) check(id, n);

    // The recording holds deletions only; a rewrite and an addition, by hand.
    const f = frameOf('m0-demo-094');
    const [first, second, ...rest] = f.draft;
    const rewrite: Triplet = [first![0], 'reaching for', first![2]];
    const extra: Triplet = ['pin', 'inserted into', 'block'];
    fixture.frames.set('m0-demo-094', {
      ...f,
      experts: f.experts.map((e) => (e.index === 1 ? { ...e, revision: [rewrite, ...rest, extra] } : e)),
    });
    check('m0-demo-094', 1);
    renderPart(3, '?DV.frame=m0-demo-094&DV.expert=1');
    expect(items('dv-rewritten').map((li) => li.getAttribute('data-from'))).toEqual([key(first!)]);
    expect(items('dv-rewritten').map((li) => li.getAttribute('data-to'))).toEqual([key(rewrite)]);
    expect(items('dv-deleted').map((li) => li.getAttribute('data-triplet'))).toEqual([key(second!)]);
    expect(items('dv-added').map((li) => li.getAttribute('data-triplet'))).toEqual([key(extra)]);
  });

  it('part 3 states an absent analysis in the displayed locale and never shows the other', () => {
    setLocale(locale);
    const f = frameOf('m0-demo-098');
    const expert = f.experts[2]!;
    expect(expert[field(locale)].length).toBeGreaterThan(0);
    expect(expert[otherField(locale)].length).toBeGreaterThan(0);

    // Recorded: the displayed locale's analysis, labelled as model output, and not the other.
    renderPart(3, '?DV.frame=m0-demo-098&DV.expert=3');
    expect(screen.getByTestId('dv-analysis').textContent).toBe(expert[field(locale)]);
    expect(screen.getByTestId('dv-analysis-label')).toHaveTextContent(
      locale === 'en' ? 'Model output, shown verbatim' : '模型輸出，逐字呈現',
    );
    expect(screen.getByTestId('demo-frame').textContent).not.toContain(expert[otherField(locale)].slice(0, 30));
    cleanup();

    // Absent: a sentence in the displayed locale, and still not the other locale's text.
    fixture.frames.set('m0-demo-098', {
      ...f,
      experts: f.experts.map((e) => (e.index === 3 ? { ...e, [field(locale)]: '' } : e)),
    });
    renderPart(3, '?DV.frame=m0-demo-098&DV.expert=3');
    expect(screen.queryByTestId('dv-analysis')).toBeNull();
    expect(screen.getByTestId('dv-analysis-none')).toHaveTextContent(
      locale === 'en' ? 'No English analysis was recorded' : '未錄得中文分析',
    );
    expect(screen.getByTestId('demo-frame').textContent).not.toContain(expert[otherField(locale)].slice(0, 30));
  });

  it('part 3 states an expert that changed nothing', () => {
    setLocale(locale);
    // Recorded: expert 1 at 88 s returned the draft as it was.
    const recorded = frameOf('m0-demo-088');
    expect(recorded.experts[0]!.revision).toEqual(recorded.draft);
    renderPart(3, '?DV.frame=m0-demo-088&DV.expert=1');
    const sentence = locale === 'en' ? 'No change recorded' : '未錄得任何修訂';
    expect(screen.getByTestId('dv-no-change')).toHaveTextContent(sentence);
    expect(screen.queryByTestId('dv-deleted')).toBeNull();
    cleanup();

    // By hand: an expert that deleted four rows now deletes none.
    const f = frameOf('m0-demo-098');
    fixture.frames.set('m0-demo-098', {
      ...f,
      experts: f.experts.map((e) => (e.index === 3 ? { ...e, revision: [...f.draft] } : e)),
    });
    renderPart(3, '?DV.frame=m0-demo-098&DV.expert=3');
    expect(screen.getByTestId('dv-no-change')).toHaveTextContent(sentence);
    for (const group of ['rewritten', 'deleted', 'added']) expect(screen.queryByTestId(`dv-${group}`)).toBeNull();
    // The analysis is still the model's own, shown whatever the revision did.
    expect(screen.getByTestId('dv-analysis').textContent).toBe(f.experts[2]![field(locale)]);
  });

  it('an invented expert is snapped', () => {
    setLocale(locale);
    for (const [query, n] of [['7', 3], ['0', 1], ['abc', 1], ['2.6', 3], ['', 1]] as const) {
      renderPart(3, `?DV.expert=${query}`);
      expect(screen.getByTestId('DV.expert'), query).toHaveValue(String(n));
      expect(screen.getByTestId('dv-analysis').textContent, query).toBe(
        frameOf(DEFAULT_FRAME).experts[n - 1]![field(locale)],
      );
      expect(screen.getByTestId('demo-frame').textContent, query).not.toMatch(/NaN|undefined/);
      cleanup();
    }
    render(
      <MemoryRouter initialEntries={['/lecture/m/m00/12?DV.expert=7']}>
        <Demo id="DV" part="3" />
        <Address />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByTestId('DV.expert'), { target: { value: '2' } });
    expect(screen.getByTestId('dv-analysis').textContent).toBe(frameOf(DEFAULT_FRAME).experts[1]![field(locale)]);
    expect(screen.getByTestId('address').textContent).toBe('?DV.expert=2');
  });

  it('part 4 draws the summary graph and says so when it is empty', () => {
    setLocale(locale);
    for (const id of FRAME_IDS) {
      renderPart(4, `?DV.frame=${id}`);
      const view = screen.getByTestId('graph-view');
      expect(view, id).toHaveAttribute('data-layout', 'dagre');
      expect(view, id).toHaveAttribute('data-image', id);
      expect(view, id).toHaveAttribute('data-fidelity', 'reconstructed');
      expect(JSON.parse(view.getAttribute('data-triplets')!), id).toEqual(frameOf(id).summary);
      expect(screen.queryByTestId('dv-graph-none'), id).toBeNull();
      expect(screen.getByTestId('dv-no-geometry'), id).toBeInTheDocument();
      cleanup();
    }
    const f = frameOf('m0-demo-096');
    fixture.frames.set('m0-demo-096', { ...f, summary: [] });
    renderPart(4, '?DV.frame=m0-demo-096');
    expect(screen.queryByTestId('graph-view')).toBeNull();
    expect(screen.getByTestId('dv-graph-none')).toHaveTextContent(locale === 'en' ? 'no triplet' : '無三元組');
    expect(screen.getByTestId('demo-frame').textContent).not.toMatch(/NaN|undefined/);
  });

  it('part 4 tabulates the predicates of D-T\'s relations and D-V\'s summaries over the ten frames', () => {
    setLocale(locale);
    renderPart(4);
    const tally = (rows: string[]) => {
      const out = new Map<string, number>();
      for (const r of rows) {
        const p = r.split('|')[1]!;
        out.set(p, (out.get(p) ?? 0) + 1);
      }
      return out;
    };
    const dt = tally(FRAME_IDS.flatMap(dtRows));
    const dv = tally(VLM.frames.flatMap((f) => f.summary.map(key)));
    const predicates = new Set([...dt.keys(), ...dv.keys()]);
    const table = screen.getByTestId('dv-hist');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(predicates.size);
    for (const p of predicates) {
      expect(within(table).getByTestId(`dv-hist-${p}-dt`).textContent, p).toBe(String(dt.get(p) ?? 0));
      expect(within(table).getByTestId(`dv-hist-${p}-dv`).textContent, p).toBe(String(dv.get(p) ?? 0));
    }
    // One table, three columns: predicate, D-T rows, D-V rows.
    expect(table.querySelectorAll('thead th')).toHaveLength(3);
  });

  it('part 5 marks each t₂ and t₃ triplet kept, added or removed against the column before', () => {
    setLocale(locale);
    renderPart(5);
    expect(KEYFRAME_IDS).toHaveLength(3);
    const sets = KEYFRAME_IDS.map((id) => once(frameOf(id).summary));
    const read = (id: string, change: string) =>
      items(`dv-keyframe-${id}`)
        .filter((li) => li.getAttribute('data-change') === change)
        .map((li) => li.getAttribute('data-triplet'));
    // t₁ has no keyframe before it: its distinct triplets, in order, none marked.
    expect(items(`dv-keyframe-${KEYFRAME_IDS[0]}`).map((li) => li.getAttribute('data-triplet'))).toEqual(sets[0]);
    expect(items(`dv-keyframe-${KEYFRAME_IDS[0]}`).map((li) => li.getAttribute('data-change'))).toEqual(
      sets[0]!.map(() => 'kept'),
    );
    for (const k of [1, 2]) {
      const [before, after, id] = [new Set(sets[k - 1]), new Set(sets[k]), KEYFRAME_IDS[k]!];
      expect(read(id, 'kept').sort(), id).toEqual([...after].filter((t) => before.has(t)).sort());
      expect(read(id, 'added').sort(), id).toEqual([...after].filter((t) => !before.has(t)).sort());
      expect(read(id, 'removed').sort(), id).toEqual([...before].filter((t) => !after.has(t)).sort());
      // The frame's own triplets in its summary's order, then what it removed.
      expect(items(`dv-keyframe-${id}`).map((li) => li.getAttribute('data-triplet')), id).toEqual([
        ...sets[k]!, ...sets[k - 1]!.filter((t) => !after.has(t)),
      ]);
      for (const li of items(`dv-keyframe-${id}`)) {
        const change = li.getAttribute('data-change');
        if (change === 'added') {
          expect(li.textContent!.startsWith('+'), id).toBe(true);
          expect(li.className, id).toMatch(/solid/);
          expect(li.className, id).toMatch(/blue-700/);
        } else if (change === 'removed') {
          expect(li.textContent!.startsWith('−'), id).toBe(true);
          expect(li.className, id).toMatch(/dotted/);
          expect(li.className, id).toMatch(/slate-700/);
        } else {
          expect(/^[+−]/.test(li.textContent!), id).toBe(false);
        }
      }
    }
  });

  it('part 5 counts distinct triplets: a repeated summary row is listed once', () => {
    setLocale(locale);
    const f = frameOf(KEYFRAME_IDS[1]!);
    fixture.frames.set(f.image_id, { ...f, summary: [...f.summary, f.summary[0]!] });
    renderPart(5);
    expect(items(`dv-keyframe-${f.image_id}`).filter((li) => li.getAttribute('data-change') !== 'removed')).toHaveLength(
      once(f.summary).length,
    );
  });

  it('part 5 sets the churn of both pipelines side by side for each of the nine steps, and — where |∪| is 0', () => {
    setLocale(locale);
    renderPart(5);
    const dv = VLM.frames.map((f) => new Set(f.summary.map(key)));
    const dt = FRAME_IDS.map((id) => new Set(dtRows(id)));
    for (const [pipeline, sets] of [['dt', dt], ['dv', dv]] as const) {
      expect(screen.queryByTestId(`dv-churn-${pipeline}-${FRAME_IDS[0]}`)).toBeNull();
      for (let i = 1; i < FRAME_IDS.length; i += 1) {
        const [a, b, id] = [sets[i - 1]!, sets[i]!, FRAME_IDS[i]!];
        const union = new Set([...a, ...b]).size;
        const delta = [...a].filter((t) => !b.has(t)).length + [...b].filter((t) => !a.has(t)).length;
        const cell = `dv-churn-${pipeline}-${id}`;
        expect(screen.getByTestId(`${cell}-delta`).textContent, cell).toBe(String(delta));
        expect(screen.getByTestId(`${cell}-union`).textContent, cell).toBe(String(union));
        expect(screen.getByTestId(`${cell}-fraction`).textContent, cell).toBe((delta / union).toFixed(2));
      }
    }
    cleanup();

    for (const id of ['m0-demo-088', 'm0-demo-090']) fixture.frames.set(id, { ...frameOf(id), summary: [] });
    renderPart(5);
    expect(screen.getByTestId('dv-churn-dv-m0-demo-090-union').textContent).toBe('0');
    expect(screen.getByTestId('dv-churn-dv-m0-demo-090-fraction').textContent).toBe('—');
    expect(screen.getByTestId('demo-frame').textContent).not.toMatch(/NaN|undefined/);
  });

  it('part 5 states that each frame is generated independently', () => {
    setLocale(locale);
    renderPart(5);
    const caption = screen.getByTestId('dv-independent');
    for (const words of locale === 'en' ? ['independently', '(2)', '(4)', 'V_t', 'this clip'] : ['獨立', '(2)', '(4)', 'V_t', '本片段']) {
      expect(caption).toHaveTextContent(words);
    }
  });

  it('an invented frame falls back to m0-demo-090', () => {
    setLocale(locale);
    for (const query of ['?DV.frame=m0-demo-999', '?DV.frame=']) {
      renderPart(1, query);
      expect(screen.getByTestId('demo-tick-m0-demo-090'), query).toHaveAttribute('aria-pressed', 'true');
      cleanup();
      for (const part of [2, 3, 4]) {
        renderPart(part, query);
        expect(screen.getByTestId('DV.frame'), `${query} part ${part}`).toHaveValue('m0-demo-090');
        cleanup();
      }
      renderPart(2, query);
      expect(value('DV.emitted'), query).toBe(String(frameOf('m0-demo-090').draft.length));
      cleanup();
    }
  });

  it('no readout reads NaN or undefined in any part at any frame', () => {
    setLocale(locale);
    for (const id of FRAME_IDS) {
      for (const [part, query] of [
        [1, ''], [2, ''], [3, '&DV.expert=1'], [3, '&DV.expert=2'], [3, '&DV.expert=3'], [4, ''], [5, ''],
      ] as const) {
        renderPart(part, `?DV.frame=${id}${query}`);
        const where = `${id} part ${part}${query}`;
        expect(screen.queryByTestId('demo-unknown'), where).toBeNull();
        for (const readout of document.querySelectorAll('[data-testid^="readout-"][data-testid$="-value"]')) {
          expect(readout.textContent, where).not.toBe('');
          expect(readout.textContent, where).not.toMatch(/NaN|undefined|null/);
        }
        // No untranslated key and no unfilled placeholder anywhere in the part.
        expect(screen.getByTestId('demo-frame').textContent, where).not.toMatch(/NaN|undefined|⟦|\{/);
        cleanup();
      }
    }
  });

  it('names the model, the date and the served weights beneath every part, recorded and replayed', () => {
    setLocale(locale);
    const served = /weights (\S+) served by (\S+)/.exec(VLM.provenance.note_en);
    expect(served).not.toBeNull();
    for (const part of [1, 2, 3, 4, 5]) {
      renderPart(part);
      const line = screen.getByTestId('demo-provenance').textContent ?? '';
      expect(line).toContain(VLM.provenance.model);
      expect(line).toContain(VLM.provenance.generated_at.slice(0, 10));
      expect(line).toContain(served![1]!);
      expect(line).toContain(served![2]!);
      expect(line).toContain(locale === 'en' ? 'recorded' : '錄製');
      expect(line).toContain(locale === 'en' ? 'replayed' : '重播');
      // The replay is not the call: no D-V label says measured.
      expect(screen.getByTestId('demo-frame').textContent).not.toContain(locale === 'en' ? 'measured' : '量測所得');
      cleanup();
    }

    // A note that names no served weights: the line names the model and states nothing more.
    fixture.provenance = { ...VLM.provenance, note_en: 'Recorded on some server.' };
    renderPart(1);
    const line = screen.getByTestId('demo-provenance').textContent ?? '';
    expect(line).toBe(
      locale === 'en'
        ? `recorded ${VLM.provenance.generated_at.slice(0, 10)} by ${VLM.provenance.model}, replayed`
        : `${VLM.provenance.generated_at.slice(0, 10)} 由 ${VLM.provenance.model} 錄製，重播`,
    );
  });
});
