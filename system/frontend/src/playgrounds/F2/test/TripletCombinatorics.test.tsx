import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { TripletCombinatorics } from '../TripletCombinatorics';

beforeEach(() => setLocale('en'));

function mount(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/m/m00${search}`]}>
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
    expect(screen.getByTestId('readout-F2.candidates-value')).toHaveTextContent('480');
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('0');
  });

  it('counts an edge the student builds', () => {
    mount();
    addEdge('1', '2');
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('1');
  });

  // Review Focus 2.
  it('refuses a self-pair and says why, rather than counting it', () => {
    mount();
    fireEvent.click(screen.getByTestId('node-1'));
    fireEvent.click(screen.getByTestId('node-1'));
    expect(screen.getByTestId('f2-notice')).toHaveTextContent('two different objects');
    fireEvent.click(screen.getByRole('button', { name: 'Add edge' }));
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('0');
  });

  // Review Focus 3.
  it('counts a repeated triplet once, so built can never exceed the candidate space', () => {
    mount();
    addEdge('1', '2');
    addEdge('1', '2');
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('1');
    expect(screen.getByTestId('f2-notice')).toHaveTextContent('already built');
  });

  it('halves the candidate space when direction is discarded', () => {
    mount();
    fireEvent.click(screen.getByLabelText('Directed arrows'));
    expect(screen.getByTestId('readout-F2.candidates-value')).toHaveTextContent('240');
  });

  it('names the edges that become indistinguishable once direction is discarded', () => {
    mount();
    addEdge('1', '2', 'on');
    addEdge('2', '1', 'on');
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('2');

    fireEvent.click(screen.getByLabelText('Directed arrows'));
    expect(screen.getByTestId('f2-collapsed')).toHaveTextContent('on');
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('1');
  });

  // Spec §4.3: knob state lives in the query string, so a shared link restores the whole
  // configuration. The predicate was held in useState until 2026-09-20 and the URL was ignored.
  it('opens on the predicate the URL names, so a shared link restores the knob', () => {
    mount('?F2.predicate=near');
    expect(screen.getByLabelText('Predicate')).toHaveValue('near');
    fireEvent.click(screen.getByTestId('node-1'));
    fireEvent.click(screen.getByTestId('node-2'));
    fireEvent.click(screen.getByRole('button', { name: 'Add edge' }));
    expect(screen.getByText(/table —near→ person/)).toBeInTheDocument();
  });

  it('falls back to the vocabulary when the URL names a predicate that is not in it', () => {
    // A predicate outside |P| was never counted into the candidate space the panel displays.
    mount('?F2.predicate=teleporting%20above');
    expect(screen.getByLabelText('Predicate')).toHaveValue('above');
  });

  // Both presenter notes promise the panel lists which edges became indistinguishable. Naming
  // one of a merged pair is half the claim.
  it('names both edges of a collapsed pair, not just the second', () => {
    mount();
    addEdge('1', '2', 'on');
    addEdge('2', '1', 'on');
    fireEvent.click(screen.getByLabelText('Directed arrows'));
    const panel = screen.getByTestId('f2-collapsed');
    expect(panel).toHaveTextContent('table on person');
    expect(panel).toHaveTextContent('person on table');
  });

  // Two merged pairs, which is the case the s4 presenter note scripts: it tells the professor
  // three or four edges is enough. With one separator doing both jobs the panel reads as four
  // edges in a row and the pairing -- the whole claim -- is gone.
  it('keeps the pairs apart when more than one pair collapses', () => {
    mount();
    addEdge('1', '2', 'on');
    addEdge('2', '1', 'on');
    addEdge('3', '4', 'near');
    addEdge('4', '3', 'near');
    fireEvent.click(screen.getByLabelText('Directed arrows'));

    const text = screen.getByTestId('f2-collapsed').textContent ?? '';
    // Each pair is joined internally by "and"; the two pairs are separated from each other.
    expect(text).toContain('table on person and person on table');
    expect(text).toContain('box near glove and glove near box');
    expect(text).not.toContain('person on table and box near glove');
  });

  it('says why nothing happened when Add edge is pressed with no pair chosen', () => {
    // A control that accepts a press and does nothing is the silent non-response this codebase
    // legislates against everywhere else.
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add edge' }));
    expect(screen.getByTestId('f2-notice')).toHaveTextContent('subject and an object');
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('0');
  });

  it('reads a direction value the URL invented as the default, not as its opposite', () => {
    mount('?F2.directed=2');
    expect(screen.getByTestId('readout-F2.candidates-value')).toHaveTextContent('480');
  });

  // The edges were a list beneath six buttons until 2026-10-02: a graph whose edges were never
  // drawn. The drawing counts what |E| counts, so the picture and the readout cannot disagree.
  it('draws every edge it counts, each with its arrowhead', () => {
    mount();
    expect(screen.queryAllByTestId(/^f2-edge-/)).toHaveLength(0);
    addEdge('1', '2', 'on');
    addEdge('2', '1', 'on');
    addEdge('3', '4', 'near');
    const edges = screen.getAllByTestId(/^f2-edge-/);
    expect(edges).toHaveLength(3);
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('3');
    for (const edge of edges) expect(edge).toHaveAttribute('marker-end');
  });

  it('draws two opposite arrows as one line once direction is discarded', () => {
    mount();
    addEdge('1', '2', 'on');
    addEdge('2', '1', 'on');
    fireEvent.click(screen.getByLabelText('Directed arrows'));
    const edges = screen.getAllByTestId(/^f2-edge-/);
    expect(edges).toHaveLength(1);
    expect(edges[0]).not.toHaveAttribute('marker-end');
    expect(screen.getByTestId('readout-F2.built-value')).toHaveTextContent('1');
  });

  it('draws the chosen pair as a pending edge until it is added', () => {
    mount();
    fireEvent.click(screen.getByTestId('node-1'));
    expect(screen.queryByTestId('f2-pending')).toBeNull();
    fireEvent.click(screen.getByTestId('node-2'));
    expect(screen.getByTestId('f2-pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add edge' }));
    expect(screen.queryByTestId('f2-pending')).toBeNull();
    expect(screen.getAllByTestId(/^f2-edge-/)).toHaveLength(1);
  });

  it('keeps the drawing out of the accessibility tree, since the list beneath says the same', () => {
    mount();
    addEdge('1', '2', 'on');
    expect(screen.getByTestId('f2-edges')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(/table —on→ person/)).toBeInTheDocument();
  });

  it('does not take focus when it mounts', () => {
    mount();
    expect(document.activeElement).toBe(document.body);
  });
});
