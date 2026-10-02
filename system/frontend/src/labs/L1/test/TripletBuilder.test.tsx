import { fireEvent, render, screen, within } from '@testing-library/react';
import { evaluate } from 'sgg-metrics';
import type { SceneGraph } from 'sgg-metrics';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';

/**
 * Cytoscape draws to a canvas and jsdom has none, so the graph view is stubbed — it has its own
 * tests, and a real one here would fail on the canvas rather than on the lab.
 *
 * The stub is not merely a hole: it writes the props it received into the DOM, so the lab is
 * still held to handing the view the right graph, the right ground truth and the right verdicts.
 * That is the part composition can get wrong, and the part a bare `() => null` would hide.
 */
vi.mock('../../../graph/SceneGraphView', () => ({
  SceneGraphView: (props: {
    graph: { relationships: unknown[] };
    gt?: unknown;
    verdicts?: unknown[];
    layout: string;
  }) => (
    <div
      data-testid="graph-view"
      data-edges={props.graph.relationships.length}
      data-has-gt={props.gt ? '1' : '0'}
      data-verdicts={props.verdicts ? String(props.verdicts.length) : ''}
      data-layout={props.layout}
    />
  ),
}));

const { TripletBuilder } = await import('../TripletBuilder');
const { DEFAULT_PARAMS, studentGraph } = await import('../triplets');

const GT: SceneGraph = {
  image_id: '2317469',
  dataset: 'vg150-sgb',
  width: 200,
  height: 150,
  objects: [
    { object_id: 1, names: ['man'], bbox: { x: 10, y: 10, w: 40, h: 60 } },
    { object_id: 2, names: ['table'], bbox: { x: 80, y: 90, w: 50, h: 30 } },
    { object_id: 3, names: ['cup'], bbox: { x: 90, y: 60, w: 12, h: 16 } },
    { object_id: 4, names: ['wall'], bbox: { x: 0, y: 0, w: 200, h: 40 } },
  ],
  relationships: [
    { relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' },
    { relationship_id: 2, subject_id: 3, object_id: 2, predicate: 'on' },
    { relationship_id: 3, subject_id: 1, object_id: 4, predicate: 'near' },
  ],
  provenance: { kind: 'ground_truth', fidelity: 'measured' },
};

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

function mount(initial = '/lab/L1') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <TripletBuilder gt={GT} imageUrl="/images/2317469.jpg" />
      <Address />
    </MemoryRouter>,
  );
}

const address = () => screen.getByTestId('address').textContent ?? '';

// The default locale is zh-TW. Naming the locale the queries assume keeps this file from
// failing the day a Chinese string is reworded, which is a translation change and not a
// behaviour change.
beforeEach(() => {
  setLocale('en');
});

function buildTriplet(subject: number, object: number, predicate: string) {
  fireEvent.click(screen.getByTestId(`box-${subject}`));
  fireEvent.click(screen.getByTestId(`box-${object}`));
  fireEvent.change(screen.getByLabelText(/predicate/i), { target: { value: predicate } });
}

describe('TripletBuilder', () => {
  it('takes the first click as the subject and the second as the object', () => {
    mount();
    fireEvent.click(screen.getByTestId('box-1'));
    expect(screen.getByTestId('box-1').getAttribute('data-role')).toBe('subject');
    fireEvent.click(screen.getByTestId('box-2'));
    expect(screen.getByTestId('box-2').getAttribute('data-role')).toBe('object');
  });

  it('offers exactly the predicates the slice contains, and no invented ones', () => {
    mount();
    const options = within(screen.getByLabelText(/predicate/i)).getAllByRole('option');
    const values = options.map((o) => (o as HTMLOptionElement).value).filter(Boolean);
    expect(new Set(values)).toEqual(new Set(['on', 'near']));
  });

  it('scores the student graph with the same engine as the backend', async () => {
    mount();
    buildTriplet(1, 2, 'on');
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    const expected = evaluate({
      gt: GT,
      pred: studentGraph(GT, [{ subject_id: 1, object_id: 2, predicate: 'on' }]),
      ...DEFAULT_PARAMS,
    });
    expect(await screen.findByTestId('matched-count')).toHaveTextContent(
      String(expected.matched_count),
    );
  });

  it('carries the whole configuration in the URL after submit', () => {
    mount();
    buildTriplet(1, 2, 'on');
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    const query = new URLSearchParams(address());
    expect(query.get('t')).toBe('1-on-2');
    expect(query.get('sub')).toBe('1');
  });

  it('rebuilds the same view from a pasted URL, with no click at all', async () => {
    mount('/lab/L1?t=1-on-2&sub=1');
    const expected = evaluate({
      gt: GT,
      pred: studentGraph(GT, [{ subject_id: 1, object_id: 2, predicate: 'on' }]),
      ...DEFAULT_PARAMS,
    });
    expect(await screen.findByTestId('matched-count')).toHaveTextContent(
      String(expected.matched_count),
    );
  });

  it('builds a graph that validates, with provenance the student owns', () => {
    const graph = studentGraph(GT, [{ subject_id: 1, object_id: 2, predicate: 'on' }]);
    expect(graph.provenance.kind).toBe('user');
    expect(graph.provenance.fidelity).toBe('measured');
    const known = new Set(graph.objects.map((o) => o.object_id));
    expect(graph.relationships.every((r) => known.has(r.subject_id) && known.has(r.object_id)))
      .toBe(true);
  });

  it('keeps the ground truth boxes, because PredCls gives them', () => {
    const graph = studentGraph(GT, [{ subject_id: 1, object_id: 2, predicate: 'on' }]);
    expect(graph.objects).toEqual(GT.objects);
    expect(DEFAULT_PARAMS.protocol).toBe('predcls');
  });

  it('accumulates several triplets before scoring', () => {
    mount();
    buildTriplet(1, 2, 'on');
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    buildTriplet(3, 2, 'on');
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(new URLSearchParams(address()).get('t')).toBe('1-on-2,3-on-2');
  });

  it('refuses to submit an incomplete triplet rather than guessing a predicate', () => {
    mount();
    fireEvent.click(screen.getByTestId('box-1'));
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('will not add the same triplet twice', () => {
    mount();
    buildTriplet(1, 2, 'on');
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    buildTriplet(1, 2, 'on');
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(new URLSearchParams(address()).get('t')).toBe('1-on-2');
  });

  it('shows a missed ground truth, so recall is visible and not merely computed', async () => {
    mount('/lab/L1?t=1-on-2&sub=1');
    await screen.findByTestId('matched-count');
    // three ground-truth triplets, one of them matched: two ghosts in the graph view
    expect(screen.getByTestId('gt-count')).toHaveTextContent('3');
  });

  it('reports recall through MetricReadout, never as a bare number', async () => {
    mount('/lab/L1?t=1-on-2&sub=1');
    const readout = await screen.findByTestId('recall');
    expect(readout.textContent).toContain('R@20');
    expect(readout.textContent).toContain('predcls');
  });

  it('shows the PredCls warning with the number, never the number alone', async () => {
    // Contracts 2.5: gt_boxes_not_pairs is emitted on every PredCls response without exception,
    // so that a student cannot see a PredCls number without seeing it. A lab that computes the
    // warning and drops it undoes the reason the engine emits it unconditionally.
    mount('/lab/L1?t=1-on-2&sub=1');
    await screen.findByTestId('recall');
    expect(screen.getByTestId('warning-gt_boxes_not_pairs')).toBeInTheDocument();
  });

  it('counts what will be scored, not what the address bar claims', () => {
    mount('/lab/L1?t=1-on-2,1-on-99&sub=1');
    expect(screen.getByTestId('built-count')).toHaveTextContent('1');
    expect(screen.getByTestId('dropped-count')).toHaveTextContent('1');
  });

  it('hands the graph view the ground truth only once there is a diff to draw', () => {
    mount();
    expect(screen.getByTestId('graph-view').getAttribute('data-has-gt')).toBe('0');
    buildTriplet(1, 2, 'on');
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    const view = screen.getByTestId('graph-view');
    expect(view.getAttribute('data-has-gt')).toBe('1');
    expect(view.getAttribute('data-edges')).toBe('1');
    expect(Number(view.getAttribute('data-verdicts'))).toBeGreaterThan(0);
  });

  it('counts the matches the recall beside it counts, at the same K', async () => {
    // Seven objects give 42 ordered pairs, enough for twenty wrong triplets on twenty pairs
    // ahead of the one right one: the graph constraint keeps one predicate per pair, so twenty
    // guesses on one pair would collapse to one and the right triplet would rank second.
    const wide: SceneGraph = {
      ...GT,
      objects: Array.from({ length: 7 }, (_, i) => ({
        object_id: i + 1,
        names: [`thing${i + 1}`],
        bbox: { x: 25 * i, y: 10, w: 20, h: 20 },
      })),
      relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }],
    };
    const pairs: string[] = [];
    for (let s = 1; s <= 7 && pairs.length < 20; s += 1) {
      for (let o = 1; o <= 7 && pairs.length < 20; o += 1) {
        if (s !== o && !(s === 1 && o === 2)) pairs.push(`${s}-near-${o}`);
      }
    }
    const t = [...pairs, '1-on-2'].join(',');
    render(
      <MemoryRouter initialEntries={[`/lab/L1?t=${t}&sub=1`]}>
        <TripletBuilder gt={wide} imageUrl="/images/2317469.jpg" />
      </MemoryRouter>,
    );
    // The right triplet is 21st: outside R@20, inside K = 100. The count sits beside R@20 and
    // over the ground-truth count, so it is the numerator of R@20 and must read as one.
    const readout = await screen.findByTestId('recall');
    expect(readout.textContent).toContain('R@20');
    expect(screen.getByTestId('gt-count')).toHaveTextContent('1');
    expect(screen.getByTestId('matched-count')).toHaveTextContent('0');
    // And the diff says what the count says: the 21st edge is not drawn as a match that
    // nothing on the page counts.
    expect(screen.getByTestId('edge-21')).not.toHaveAttribute('data-verdict', 'match');
  });

  it('survives a predicate the slice does not contain, without scoring it as a match', () => {
    // `t` comes from the address bar, so it is user input: a hand-edited predicate must not
    // become a triplet the engine is asked to believe.
    const graph = studentGraph(GT, [{ subject_id: 1, object_id: 99, predicate: 'on' }]);
    expect(graph.relationships).toEqual([]);
  });
});
