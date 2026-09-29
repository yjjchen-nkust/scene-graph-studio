import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale, type Locale } from '../../i18n/useLocale';
import { MARK_PREDICTED } from '../../playgrounds/PhotoMarks';
import { Demo } from '../Demo';
import { FRAME_IDS, TRADITIONAL, VLM, frameUrl, type TraditionalFrame } from '../data';

/**
 * D-T in its four parts, each mounted through `Demo` as a step mounts it, in both locales.
 *
 * Every expected figure is computed here from the recorded artefact by arithmetic and by string
 * sets, not through `logic.ts`, so a part that miscounted would disagree with the test rather than
 * with itself. The recording has no frame of zero or one detection and no pair the prior
 * classified; those states are reached by replacing frames through `fixture`, which each test
 * empties after it runs, so every other test reads the recording as it is.
 */
const fixture = vi.hoisted(() => ({ frames: new Map<string, TraditionalFrame>() }));

vi.mock('../data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data')>();
  const recorded = actual.TRADITIONAL;
  return {
    ...actual,
    TRADITIONAL: {
      ...recorded,
      get frames() {
        return recorded.frames.map((f) => fixture.frames.get(f.image_id) ?? f);
      },
    },
  };
});

afterEach(() => fixture.frames.clear());

const renderPart = (part: number, query = '') =>
  render(
    <MemoryRouter initialEntries={[`/lecture/m/m00/7${query}`]}>
      <Demo id="DT" part={String(part)} />
    </MemoryRouter>,
  );

const frameOf = (id: string) => TRADITIONAL.frames.find((f) => f.image_id === id)!;
const value = (id: string) => screen.getByTestId(`readout-${id}-value`).textContent;
const count = (n: number) => n.toLocaleString('en-US');

/** A frame's class-level triplets as strings, one per relation. */
const rows = (f: TraditionalFrame) => {
  const label = new Map(f.detections.map((d) => [d.object_id, d.label]));
  return f.relations.map((r) => `${label.get(r.subject_id)}|${r.predicate}|${label.get(r.object_id)}`);
};

/** A recorded frame cut to its first `n` detections and the relations among them. */
const cut = (id: string, n: number): TraditionalFrame => {
  const f = frameOf(id);
  const kept = new Set(f.detections.slice(0, n).map((d) => d.object_id));
  return {
    ...f,
    detections: f.detections.slice(0, n),
    relations: f.relations.filter((r) => kept.has(r.subject_id) && kept.has(r.object_id)),
  };
};

const LOCALES: Locale[] = ['en', 'zh-TW'];

describe.each(LOCALES)('D-T in %s', (locale) => {
  it('part 1 draws one dashed mark per detection, on the frame it names', () => {
    setLocale(locale);
    renderPart(1, '?DT.frame=m0-demo-096');
    const frame = frameOf('m0-demo-096');
    const photo = screen.getByTestId('dt-photo');
    const marks = [...photo.querySelectorAll('rect[data-testid^="dt-det-"]')].filter(
      (m) => !m.getAttribute('data-testid')!.endsWith('-halo'),
    );
    expect(marks).toHaveLength(frame.detections.length);
    for (const d of frame.detections) {
      const mark = within(photo).getByTestId(`dt-det-${d.object_id}`);
      expect(mark.getAttribute('stroke')).toBe(MARK_PREDICTED);
      expect(mark.getAttribute('stroke-dasharray')).toBeTruthy();
      expect(Number(mark.getAttribute('x'))).toBe(d.bbox.x);
      expect(Number(mark.getAttribute('y'))).toBe(d.bbox.y);
      expect(Number(mark.getAttribute('width'))).toBe(d.bbox.w);
      expect(Number(mark.getAttribute('height'))).toBe(d.bbox.h);
    }
    expect(photo.querySelector('svg text')).toBeNull();
    expect(photo.querySelector('img')!.getAttribute('src')).toBe(frameUrl('m0-demo-096'));
    expect(value('DT.detections')).toBe(String(frame.detections.length));
    expect(screen.getByTestId('demo-tick-m0-demo-096')).toHaveAttribute('aria-pressed', 'true');
  });

  it('part 1 numbers each box #n and names every number in the legend', () => {
    setLocale(locale);
    for (const id of FRAME_IDS) {
      renderPart(1, `?DT.frame=${id}`);
      const frame = frameOf(id);
      const photo = screen.getByTestId('dt-photo');
      const legend = screen.getByTestId('dt-legend');
      expect(legend.querySelectorAll('li'), id).toHaveLength(frame.detections.length);
      for (const d of frame.detections) {
        // The badge is HTML over the photograph, never SVG text (D98), and only a number (D100).
        const badge = within(photo).getByTestId(`dt-badge-${d.object_id}`);
        expect(badge.tagName).toBe('SPAN');
        expect(badge.textContent, id).toBe(`#${d.object_id + 1}`);
        expect(within(legend).getByTestId(`dt-legend-${d.object_id}`).textContent, id).toBe(
          `#${d.object_id + 1} ${d.label} ${d.score.toFixed(2)}`,
        );
      }
      cleanup();
    }
  });

  it('part 1 sets no badge inside its box, and one near the right edge above and to its left', () => {
    setLocale(locale);
    const ABOVE = 'translateY(-100%)';
    const ABOVE_LEFT = 'translate(-100%, -100%)';
    for (const id of FRAME_IDS) {
      renderPart(1, `?DT.frame=${id}`);
      for (const d of frameOf(id).detections) {
        // PhotoMarks draws `inside` with no transform at all.
        expect([ABOVE, ABOVE_LEFT], `${id} #${d.object_id + 1}`).toContain(
          screen.getByTestId(`dt-badge-${d.object_id}`).style.transform,
        );
      }
      cleanup();
    }
    const f = frameOf('m0-demo-094');
    const [first, ...rest] = f.detections;
    fixture.frames.set('m0-demo-094', {
      ...f,
      detections: [{ ...first!, bbox: { ...first!.bbox, x: f.width - 20, w: 20 } }, ...rest],
    });
    renderPart(1, '?DT.frame=m0-demo-094');
    expect(screen.getByTestId(`dt-badge-${first!.object_id}`).style.transform).toBe(ABOVE_LEFT);
  });

  it('part 1 counts the O_ISG classes COCO cannot name', () => {
    setLocale(locale);
    renderPart(1);
    const entries = Object.entries(TRADITIONAL.o_isg_coco);
    const uncovered = entries.filter(([, coco]) => coco === null);
    expect(entries).toHaveLength(12);
    expect(value('DT.uncovered')).toBe(`${uncovered.length} / ${entries.length}`);
    for (const [cls, coco] of entries) {
      const item = screen.getByTestId(`dt-oisg-${cls}`);
      if (coco === null) {
        expect(within(screen.getByTestId('dt-oisg-uncovered')).getByTestId(`dt-oisg-${cls}`)).toBe(item);
        expect(item.textContent).toBe(cls);
      } else {
        expect(within(screen.getByTestId('dt-oisg-covered')).getByTestId(`dt-oisg-${cls}`)).toBe(item);
        expect(item.textContent).toBe(`${cls} ✓ ${coco}`);
      }
    }
  });

  it('part 1 picks a frame from the clip\'s ticks and carries it in the URL', () => {
    setLocale(locale);
    renderPart(1);
    fireEvent.click(screen.getByTestId('demo-tick-m0-demo-102'));
    expect(screen.getByTestId('dt-photo').querySelector('img')!.getAttribute('src')).toBe(frameUrl('m0-demo-102'));
    expect(value('DT.detections')).toBe(String(frameOf('m0-demo-102').detections.length));
  });

  it('part 2 states n(n−1) and n(n−1)·50 for the chosen frame', () => {
    setLocale(locale);
    for (const id of ['m0-demo-090', 'm0-demo-096']) {
      renderPart(2, `?DT.frame=${id}`);
      const n = frameOf(id).detections.length;
      expect(screen.getByTestId('DT.frame')).toHaveValue(id);
      expect(value('DT.objects')).toBe(String(n));
      expect(value('DT.pairs')).toBe(count(n * (n - 1)));
      expect(screen.getByTestId('readout-DT.pairs')).toHaveTextContent('n(n−1)');
      expect(value('DT.candidates')).toBe(count(n * (n - 1) * 50));
      expect(screen.getByTestId('readout-DT.candidates')).toHaveTextContent('n(n−1)·|P|, |P| = 50');
      const all = TRADITIONAL.frames.reduce((sum, f) => sum + f.detections.length * (f.detections.length - 1) * 50, 0);
      expect(value('DT.candidates_all')).toBe(count(all));
      // n × n cells: the diagonal is an object with itself, every other cell an ordered pair.
      const grid = screen.getByTestId('dt-grid');
      const ids = frameOf(id).detections.map((d) => d.object_id);
      for (const s of ids) {
        for (const o of ids) {
          expect(within(grid).getByTestId(`dt-pair-${s}-${o}`).textContent).toBe(s === o ? '—' : '✓');
        }
      }
      expect(grid.querySelectorAll('[data-testid^="dt-pair-"]')).toHaveLength(n * n);
      // Rows carry part 1's badge numbers, #1 for the first detection.
      expect([...grid.querySelectorAll('tbody th')].map((th) => th.textContent)).toEqual(
        frameOf(id).detections.map((d) => `#${d.object_id + 1} ${d.label}`),
      );
      cleanup();
    }
  });

  it('part 2 draws no grid and no NaN for a frame of zero or one detection', () => {
    setLocale(locale);
    for (const n of [1, 0]) {
      fixture.frames.set('m0-demo-090', cut('m0-demo-090', n));
      renderPart(2);
      expect(value('DT.objects')).toBe(String(n));
      expect(value('DT.pairs')).toBe('0');
      expect(value('DT.candidates')).toBe('0');
      expect(screen.queryByTestId('dt-grid')).toBeNull();
      expect(screen.getByTestId('dt-grid-none')).toBeInTheDocument();
      expect(screen.getByTestId('demo-frame').textContent).not.toMatch(/NaN|undefined/);
      cleanup();
    }
  });

  it('part 2 names the grid it will not draw for more than eight objects', () => {
    setLocale(locale);
    const f = frameOf('m0-demo-090');
    const nine = Array.from({ length: 9 }, (_, i) => ({ ...f.detections[0]!, object_id: i }));
    fixture.frames.set('m0-demo-090', { ...f, detections: nine, relations: [] });
    renderPart(2);
    expect(screen.queryByTestId('dt-grid')).toBeNull();
    expect(screen.getByTestId('dt-grid-large')).toHaveTextContent('81');
    expect(value('DT.pairs')).toBe('72');
  });

  it('part 3 marks each P_ISG predicate present or absent over the ten frames', () => {
    setLocale(locale);
    renderPart(3);
    const produced = new Set(TRADITIONAL.frames.flatMap((f) => f.relations.map((r) => r.predicate)));
    expect(VLM.P).toHaveLength(7);
    for (const p of VLM.P) {
      const row = screen.getByTestId(`dt-pisg-${p}`);
      expect(row.getAttribute('data-present'), p).toBe(String(produced.has(p)));
      expect(row.textContent, p).toContain(produced.has(p) ? '✓' : '—');
    }
  });

  it('part 3 tabulates the predicates of this frame and of all ten, row by row', () => {
    setLocale(locale);
    renderPart(3, '?DT.frame=m0-demo-092');
    const tally = (fs: readonly TraditionalFrame[]) => {
      const out = new Map<string, number>();
      for (const f of fs) for (const r of f.relations) out.set(r.predicate, (out.get(r.predicate) ?? 0) + 1);
      return out;
    };
    for (const [table, frames] of [['frame', [frameOf('m0-demo-092')]], ['all', TRADITIONAL.frames]] as const) {
      const expected = tally(frames);
      const body = screen.getByTestId(`dt-hist-${table}`);
      expect(body.querySelectorAll('tbody tr')).toHaveLength(expected.size);
      for (const [p, n] of expected) {
        expect(within(body).getByTestId(`dt-hist-${table}-${p}`).textContent).toBe(count(n));
      }
    }
  });

  it('part 3 tells the pairs over a class the slice lacks from the pairs its frames never show', () => {
    setLocale(locale);
    for (const id of FRAME_IDS) {
      renderPart(3, `?DT.frame=${id}`);
      const f = frameOf(id);
      const label = new Map(f.detections.map((d) => [d.object_id, d.label]));
      const lacks = (oid: number) => TRADITIONAL.class_map[label.get(oid)!] == null;
      const fallback = f.relations.filter((r) => r.from === 'fallback');
      const unmapped = fallback.filter((r) => lacks(r.subject_id) || lacks(r.object_id)).length;
      const unseen = fallback.length - unmapped;
      for (const [testid, n] of [['dt-fallback-unmapped', unmapped], ['dt-fallback-unseen', unseen]] as const) {
        if (n === 0) expect(screen.queryByTestId(testid), `${id} ${testid}`).toBeNull();
        else expect(screen.getByTestId(`${testid}-count`).textContent, `${id} ${testid}`).toBe(count(n));
      }
      const classes = [...new Set(f.detections.map((d) => d.label))].filter((l) => TRADITIONAL.class_map[l] == null);
      if (unmapped > 0) {
        for (const c of classes) expect(screen.getByTestId('dt-fallback-unmapped'), `${id} ${c}`).toHaveTextContent(c);
      }
      // The predicate is quoted, never a bare word in the sentence.
      const quoted = locale === 'en' ? `“${TRADITIONAL.prior.fallback}”` : `「${TRADITIONAL.prior.fallback}」`;
      expect(screen.getByTestId('dt-prior-none'), id).toHaveTextContent(quoted);
      cleanup();
    }
  });

  it('part 3 counts the pairs each source classified, and says so when the prior classified none', () => {
    setLocale(locale);
    renderPart(3, '?DT.frame=m0-demo-094');
    const f = frameOf('m0-demo-094');
    const by = (source: string) => f.relations.filter((r) => r.from === source).length;
    expect(value('DT.prior')).toBe(String(by('prior')));
    expect(value('DT.fallback')).toBe(String(by('fallback')));
    expect(value('DT.fallback')).toBe(String(f.detections.length * (f.detections.length - 1)));
    expect(screen.getByTestId('dt-prior-none')).toBeInTheDocument();
    cleanup();

    // A pair the prior did classify: the sentence goes, and the count moves.
    const first = f.relations[0]!;
    fixture.frames.set('m0-demo-094', {
      ...f,
      relations: [{ ...first, predicate: 'near', from: 'prior' }, ...f.relations.slice(1)],
    });
    renderPart(3, '?DT.frame=m0-demo-094');
    expect(value('DT.prior')).toBe('1');
    expect(value('DT.fallback')).toBe(String(by('fallback') - 1));
    expect(screen.queryByTestId('dt-prior-none')).toBeNull();
    expect(screen.getByTestId('dt-fallback-some')).toBeInTheDocument();
    expect(screen.getByTestId('dt-pisg-near')).toHaveAttribute('data-present', 'true');
    cleanup();

    // No pair at all: the histogram is empty and says so, and nothing is claimed of the prior.
    fixture.frames.set('m0-demo-094', cut('m0-demo-094', 1));
    renderPart(3, '?DT.frame=m0-demo-094');
    expect(screen.getByTestId('dt-hist-frame-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('dt-prior-none')).toBeNull();
    expect(screen.getByTestId('dt-no-pairs')).toBeInTheDocument();
  });

  it('part 4 shows |Δ| and |∪| between each consecutive pair of frames, and — where |∪| is 0', () => {
    setLocale(locale);
    renderPart(4);
    const sets = TRADITIONAL.frames.map((f) => new Set(rows(f)));
    for (const [i, id] of FRAME_IDS.entries()) {
      expect(screen.getByTestId(`dt-edges-${id}`).textContent).toBe(`|E| = ${sets[i]!.size}`);
      if (i === 0) {
        expect(screen.queryByTestId(`dt-churn-${id}`)).toBeNull();
        continue;
      }
      const [a, b] = [sets[i - 1]!, sets[i]!];
      const union = new Set([...a, ...b]).size;
      const delta = [...a].filter((t) => !b.has(t)).length + [...b].filter((t) => !a.has(t)).length;
      expect(screen.getByTestId(`dt-churn-${id}-delta`).textContent, id).toBe(`Δ ${delta}`);
      expect(screen.getByTestId(`dt-churn-${id}-union`).textContent, id).toBe(`∪ ${union}`);
      expect(screen.getByTestId(`dt-churn-${id}-fraction`).textContent, id).toBe((delta / union).toFixed(2));
    }
    cleanup();

    fixture.frames.set('m0-demo-088', cut('m0-demo-088', 0));
    fixture.frames.set('m0-demo-090', cut('m0-demo-090', 1));
    renderPart(4);
    expect(screen.getByTestId('dt-edges-m0-demo-090').textContent).toBe('|E| = 0');
    expect(screen.getByTestId('dt-churn-m0-demo-090-delta').textContent).toBe('Δ 0');
    expect(screen.getByTestId('dt-churn-m0-demo-090-union').textContent).toBe('∪ 0');
    expect(screen.getByTestId('dt-churn-m0-demo-090-fraction').textContent).toBe('—');
    expect(screen.getByTestId('dt-triplets-none')).toBeInTheDocument();
    expect(screen.getByTestId('demo-frame').textContent).not.toMatch(/NaN|undefined/);
  });

  it('part 4 lists the chosen frame\'s triplets, + on a solid blue rule and − on a dotted one', () => {
    setLocale(locale);
    renderPart(4, '?DT.frame=m0-demo-092');
    const [before, after] = [new Set(rows(frameOf('m0-demo-090'))), new Set(rows(frameOf('m0-demo-092')))];
    const items = [...screen.getByTestId('dt-triplets').querySelectorAll('li')];
    const read = (change: string) =>
      items
        .filter((li) => li.getAttribute('data-change') === change)
        .map((li) => li.getAttribute('data-triplet'))
        .sort();
    expect(read('kept')).toEqual([...after].filter((t) => before.has(t)).sort());
    expect(read('added')).toEqual([...after].filter((t) => !before.has(t)).sort());
    expect(read('removed')).toEqual([...before].filter((t) => !after.has(t)).sort());
    for (const li of items) {
      const change = li.getAttribute('data-change');
      if (change === 'added') {
        expect(li.textContent!.startsWith('+')).toBe(true);
        expect(li).toHaveClass('border-solid', 'border-blue-700');
      } else if (change === 'removed') {
        expect(li.textContent!.startsWith('−')).toBe(true);
        expect(li).toHaveClass('border-dotted', 'border-slate-700');
      } else {
        expect(li.textContent!.startsWith('+') || li.textContent!.startsWith('−')).toBe(false);
      }
    }
    expect(screen.getByTestId('dt-thumb-m0-demo-092')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('dt-thumb-m0-demo-088'));
    expect(screen.getByTestId('dt-thumb-m0-demo-088')).toHaveAttribute('aria-pressed', 'true');
    // The first frame has nothing before it: every triplet is listed, none marked.
    expect(screen.getByTestId('dt-changes')).toHaveAttribute('data-first', 'true');
    const first = [...screen.getByTestId('dt-triplets').querySelectorAll('li')];
    expect(first.map((li) => li.getAttribute('data-change'))).toEqual(
      [...new Set(rows(frameOf('m0-demo-088')))].map(() => 'kept'),
    );
  });

  it('an invented frame falls back to m0-demo-090', () => {
    setLocale(locale);
    const n = frameOf('m0-demo-090').detections.length;
    for (const query of ['?DT.frame=m0-demo-999', '?DT.frame=']) {
      renderPart(1, query);
      expect(screen.getByTestId('dt-photo').querySelector('img')!.getAttribute('src'), query).toBe(frameUrl('m0-demo-090'));
      expect(screen.getByTestId('demo-tick-m0-demo-090'), query).toHaveAttribute('aria-pressed', 'true');
      expect(value('DT.detections'), query).toBe(String(n));
      cleanup();
      for (const part of [2, 3]) {
        renderPart(part, query);
        expect(screen.getByTestId('DT.frame'), `${query} part ${part}`).toHaveValue('m0-demo-090');
        cleanup();
      }
      renderPart(4, query);
      expect(screen.getByTestId('dt-thumb-m0-demo-090'), query).toHaveAttribute('aria-pressed', 'true');
      cleanup();
    }
  });

  it('no readout reads NaN or undefined in any part at any frame', () => {
    setLocale(locale);
    for (const id of FRAME_IDS) {
      for (const part of [1, 2, 3, 4]) {
        renderPart(part, `?DT.frame=${id}`);
        const where = `${id} part ${part}`;
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

  it('names the model, the date, the fidelity and the prior\'s frames beneath every part', () => {
    setLocale(locale);
    for (const part of [1, 2, 3, 4]) {
      renderPart(part);
      const line = screen.getByTestId('demo-provenance').textContent ?? '';
      expect(line).toContain(TRADITIONAL.provenance.model);
      expect(line).toContain(TRADITIONAL.provenance.generated_at.slice(0, 10));
      expect(line).toContain(locale === 'en' ? 'measured' : '量測所得');
      expect(line).toContain(String(TRADITIONAL.prior.frames));
      cleanup();
    }
  });
});
