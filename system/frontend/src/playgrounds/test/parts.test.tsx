import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { Playground } from '../Playground';
import { PLAYGROUND_PARTS } from '../mounts';

beforeEach(() => setLocale('en'));

/** One part as a lecture step mounts it: through `<Playground>`, the part a string from MDX. */
function part(kp: string, n?: string, search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m01${search}`]}>
      <Playground kp={kp} part={n} />
    </MemoryRouter>,
  );
}

const shown = (...ids: string[]) => ids.filter((id) => screen.queryByTestId(id) !== null);

describe('a playground split across steps', () => {
  it('registers the eleven playgrounds too long for one panel, X1 in three parts and the rest in two', () => {
    expect(PLAYGROUND_PARTS).toEqual({
      E1: 2, E10: 2, E3: 2, E4: 2, E7: 2, F1: 2, F3: 2, F6: 2, F7: 2, T2: 2, X1: 3,
    });
  });

  it('F1: the picture and its layers, then the density, the vocabulary and the readouts', () => {
    const one = part('F1', '1');
    expect(shown('F1.img', 'F1.labels', 'F1.boxes', 'F1.rel', 'F1.density', 'F1.P', 'readout-F1.ratio'))
      .toEqual(['F1.img', 'F1.labels', 'F1.boxes', 'F1.rel']);
    expect(one.container.querySelector('img')).not.toBeNull();
    one.unmount();

    const two = part('F1', '2');
    expect(shown('F1.img', 'F1.labels', 'F1.density', 'F1.P', 'readout-F1.candidates', 'readout-F1.ratio'))
      .toEqual(['F1.img', 'F1.density', 'F1.P', 'readout-F1.candidates', 'readout-F1.ratio']);
    expect(two.container.querySelector('img')).toBeNull();
  });

  it('F1 part 1 draws every annotated edge, since its density slider is on the other part', () => {
    const cut = part('F1', '1', '?F1.density=0');
    expect(cut.container.querySelectorAll('[data-testid^="edge-"]').length).toBeGreaterThan(0);
  });

  it('E1: the defects and the five conjuncts, then the two halves and what the diff says', () => {
    const all = [
      'E1.cs', 'E1.co', 'E1.p', 'E1.bs', 'E1.bo', 'e1-picture', 'e1-conjuncts',
      'e1-phi-cls', 'e1-phi-loc', 'e1-relation', 'e1-mode', 'e1-verdict',
    ];
    const one = part('E1', '1', '?E1.bs=1');
    expect(shown(...all)).toEqual(['E1.cs', 'E1.co', 'E1.p', 'E1.bs', 'E1.bo', 'e1-picture', 'e1-conjuncts']);
    one.unmount();

    // The second part reads every toggle, so it shows them all again, as F6's second part does.
    part('E1', '2', '?E1.bs=1');
    expect(shown(...all)).toEqual([
      'E1.cs', 'E1.co', 'E1.p', 'E1.bs', 'E1.bo', 'e1-phi-cls', 'e1-phi-loc', 'e1-relation', 'e1-mode', 'e1-verdict',
    ]);
    expect(screen.getByTestId('e1-phi-cls')).toHaveAttribute('data-holds', 'true');
    expect(screen.getByTestId('e1-phi-loc')).toHaveAttribute('data-holds', 'false');
    expect(screen.getByTestId('e1-verdict')).toHaveTextContent('localization');
  });

  it('E10: what the protocol hands over, then the vocabulary and the three counts', () => {
    const all = ['E10.pr', 'E10.voc', 'e10-picture', 'e10-given', 'e10-inclusion', 'e10-counts', 'e10-vocabulary'];
    const one = part('E10', '1', '?E10.pr=sgcls');
    expect(shown(...all)).toEqual(['E10.pr', 'e10-picture', 'e10-given', 'e10-inclusion']);
    one.unmount();

    // The counts mark the protocol chosen on the first part, so the second part shows that knob too.
    part('E10', '2', '?E10.pr=sgcls');
    expect(shown(...all)).toEqual(['E10.pr', 'E10.voc', 'e10-inclusion', 'e10-counts', 'e10-vocabulary']);
    expect(screen.getByTestId('e10-row-sgcls')).toHaveAttribute('aria-current', 'true');
  });

  it('E3: the row on its photograph and its line, then the ranked list and its two counts', () => {
    const all = [
      'E3.k', 'E3.row', 'e3-pair', 'e3-row-line', 'e3-list-table', 'readout-E3.in_top', 'readout-E3.truths',
    ];
    const one = part('E3', '1');
    expect(shown(...all)).toEqual(['E3.k', 'E3.row', 'e3-pair', 'e3-row-line']);
    one.unmount();

    // The k slider is unconditional, so part 2 shows it too, beside the list and its two counts.
    part('E3', '2');
    expect(shown(...all)).toEqual(['E3.k', 'e3-list-table', 'readout-E3.in_top', 'readout-E3.truths']);
  });

  it('E4: the mode, the row on its photograph, its line and the pool, then the mode, k and the three counts', () => {
    const all = [
      'E4.mode', 'E4.k', 'E4.row', 'e4-pair', 'e4-row-line', 'e4-list-table',
      'readout-E4.pool', 'readout-E4.truths', 'readout-E4.truths_none',
    ];
    const one = part('E4', '1');
    expect(shown(...all)).toEqual(['E4.mode', 'E4.row', 'e4-pair', 'e4-row-line', 'readout-E4.pool']);
    one.unmount();

    // The mode selector is unconditional, so part 2 shows it too, beside k, the list and the counts.
    part('E4', '2');
    expect(shown(...all)).toEqual([
      'E4.mode', 'E4.k', 'e4-list-table', 'readout-E4.pool', 'readout-E4.truths', 'readout-E4.truths_none',
    ]);
  });

  it('E7: m, the row on its photograph, its line and the pool, then m, k and the two counts', () => {
    const all = [
      'E7.m', 'E7.k', 'E7.row', 'e7-pair', 'e7-row-line', 'e7-list-table', 'readout-E7.pool', 'readout-E7.truths',
    ];
    const one = part('E7', '1');
    expect(shown(...all)).toEqual(['E7.m', 'E7.row', 'e7-pair', 'e7-row-line', 'readout-E7.pool']);
    one.unmount();

    // The m slider is unconditional, so part 2 shows it too, beside k, the list and the counts.
    part('E7', '2');
    expect(shown(...all)).toEqual(['E7.m', 'E7.k', 'e7-list-table', 'readout-E7.pool', 'readout-E7.truths']);
  });

  it('F3: the box moved and counted, then the threshold and the membership', () => {
    const all = [
      'F3.dx', 'F3.dy', 'F3.lambda', 'F3.tau', 'f3-picture', 'f3-legend',
      'readout-F3.intersection', 'readout-F3.union', 'readout-F3.iou', 'readout-F3.bound',
      'f3-member', 'f3-unreachable',
    ];
    const one = part('F3', '1', '?F3.lambda=1.5');
    expect(shown(...all)).toEqual([
      'F3.dx', 'F3.dy', 'F3.lambda', 'f3-picture', 'f3-legend',
      'readout-F3.intersection', 'readout-F3.union', 'readout-F3.iou', 'readout-F3.bound',
    ]);
    one.unmount();

    // The two numbers τ is compared with stand beside it, so the membership is read, not recalled.
    part('F3', '2', '?F3.lambda=1.5');
    expect(shown(...all)).toEqual([
      'F3.tau', 'readout-F3.iou', 'readout-F3.bound', 'f3-member', 'f3-unreachable',
    ]);
  });

  it('F6: the merges and the class counts, then the membership of one edge', () => {
    const one = part('F6', '1', '?F6.mp=1');
    expect(shown('F6.mp', 'F6.mo', 'F6.img', 'readout-F6.group', 'f6-collapsed', 'f6-status'))
      .toEqual(['F6.mp', 'F6.mo', 'readout-F6.group', 'f6-collapsed']);
    one.unmount();

    part('F6', '2', '?F6.mp=1');
    expect(shown('F6.mp', 'F6.mo', 'F6.img', 'F6.rel', 'F6.sub', 'readout-F6.group', 'f6-status'))
      .toEqual(['F6.mp', 'F6.img', 'F6.rel', 'F6.sub', 'f6-status']);
    expect(screen.getByTestId('f6-status')).toHaveAttribute('data-recorded', 'true');
  });

  it('F7: the model alone, then the slice against it, with no toggle left to forget', () => {
    const one = part('F7', '1', '?F7.measured=1');
    expect(shown('F7.s', 'F7.C', 'F7.k', 'F7.measured', 'readout-F7.head', 'readout-F7.tail', 'readout-F7.measured'))
      .toEqual(['F7.s', 'F7.C', 'F7.k', 'readout-F7.head', 'readout-F7.tail']);
    one.unmount();

    part('F7', '2');
    expect(shown('F7.s', 'F7.C', 'F7.k', 'F7.measured', 'readout-F7.head', 'readout-F7.measured', 'f7-bars'))
      .toEqual(['F7.s', 'F7.C', 'F7.k', 'readout-F7.head', 'readout-F7.measured', 'f7-bars']);
    expect(screen.getByTestId('readout-F7.measured')).toHaveTextContent('353 / 684');
  });

  it('X1: the counts, then the sentences their differences equal, then where validation comes from', () => {
    const ids = ['X1.r', 'X1.vs', 'x1-train-a', 'x1-test-diff', 'x1-equality-train', 'x1-disjoint-a', 'x1-sources'];
    const one = part('X1', '1');
    expect(shown(...ids)).toEqual(['X1.r', 'X1.vs', 'x1-train-a', 'x1-test-diff', 'x1-sources']);
    one.unmount();

    const two = part('X1', '2');
    expect(shown(...ids)).toEqual(['X1.r', 'X1.vs', 'x1-equality-train', 'x1-sources']);
    two.unmount();

    part('X1', '3');
    expect(shown(...ids)).toEqual(['X1.r', 'X1.vs', 'x1-disjoint-a', 'x1-sources']);
    // One line a release, saying where validation is drawn from and what happens to an image
    // with no relation, each with its own source.
    expect(screen.getByTestId('x1-disjoint-a')).toHaveTextContent(
      /^SGG-Benchmark release, v2 .*: validation is disjoint from test\d; images with no relation: kept\d$/,
    );
  });

  it('X1 keeps Xu\'s pool with the counts, since it is one', () => {
    part('X1', '1', '?X1.r=xu-2017&X1.vs=canonical');
    expect(screen.getByTestId('x1-row-pool')).toHaveTextContent('108,077');
  });

  it('X1 part 2 says why there is no difference to explain, and cites nothing', () => {
    // Xu states shares, so nothing can be subtracted; that is not the counts agreeing.
    const xu = part('X1', '2', '?X1.r=xu-2017&X1.vs=canonical');
    expect(screen.getByTestId('x1-no-equality')).toHaveTextContent('No split is stated as a count by both releases.');
    expect(screen.queryByTestId('x1-sources')).toBeNull();
    xu.unmount();
    part('X1', '2', '?X1.r=canonical&X1.vs=canonical');
    expect(screen.getByTestId('x1-no-equality')).toHaveTextContent('Where both releases state a count, the counts are equal.');
  });

  it('X1 numbers the sources of each part from one, citing only what that part shows', () => {
    // v1 against v2: the counts cite issue #94 and the card's statistics; the explanations cite
    // the card's changelog, which part 1 shows nothing from.
    const one = part('X1', '1', '?X1.r=sgb-v1&X1.vs=sgb-v2');
    expect(screen.getByTestId('x1-sources')).not.toHaveTextContent('Changelog');
    expect(screen.getByTestId('x1-train-a').querySelector('sup')?.textContent).toBe('1');
    one.unmount();

    const two = part('X1', '2', '?X1.r=sgb-v1&X1.vs=sgb-v2');
    expect(screen.getByTestId('x1-sources')).toHaveTextContent('Changelog');
    two.unmount();

    part('X1', '3', '?X1.r=sgb-v1&X1.vs=sgb-v2');
    expect(screen.getByTestId('x1-disjoint-a').querySelector('sup')?.textContent).toBe('1');
  });

  it('gives each part its own control ids, so every label names its own control', () => {
    // The study page renders every step, so the parts of one playground share a page, and a
    // repeated id left each later label naming the first part's control (WCAG 1.3.1, 4.1.2).
    const { container } = render(
      <MemoryRouter initialEntries={['/m/m01']}>
        {['1', '2', '3'].map((n) => <Playground key={n} kp="X1" part={n} />)}
        {['1', '2'].map((n) => <Playground key={`F7.${n}`} kp="F7" part={n} />)}
      </MemoryRouter>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size, `repeated: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`).toBe(ids.length);
    const labels = [...container.querySelectorAll('label')];
    const named = labels.map((l) => container.querySelector(`[id="${l.htmlFor}"]`));
    expect(named.every((el) => el !== null)).toBe(true);
    expect(new Set(named).size).toBe(labels.length);
    // The test ids stay the knob's name, which is what the suites and the URL address.
    expect(screen.getAllByTestId('X1.r')).toHaveLength(3);
  });

  it('names a part a playground does not have, rather than guessing one', () => {
    const beyond = part('X1', '4');
    expect(screen.getByTestId('playground-unknown')).toHaveTextContent('X1 part 4');
    beyond.unmount();
    part('F2', '1');
    expect(screen.getByTestId('playground-unknown')).toHaveTextContent('F2 part 1');
  });
});
