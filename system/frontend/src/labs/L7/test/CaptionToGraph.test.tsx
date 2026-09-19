import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { VERDICT_STYLE } from '../../../graph/palette';
import { setLocale } from '../../../i18n/useLocale';
import { CaptionToGraph } from '../CaptionToGraph';

beforeEach(() => {
  setLocale('en');
});

function Address() {
  const location = useLocation();
  return <output data-testid="address">{location.search}</output>;
}

function mount(initial = '/lab/L7') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <CaptionToGraph />
      <Address />
    </MemoryRouter>,
  );
}

const type = (text: string) =>
  fireEvent.change(screen.getByTestId('caption'), { target: { value: text } });

describe('CaptionToGraph', () => {
  it('grows the graph as the sentence is typed', () => {
    mount();
    type('the person');
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(1);
    expect(screen.queryAllByTestId(/^edge-/)).toHaveLength(0);

    type('the person is holding a box');
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/^edge-/)).toHaveLength(1);

    type('the person is holding a box on the table');
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^edge-/)).toHaveLength(2);
  });

  it('puts the sentence in the URL, so a caption is a link', () => {
    mount();
    type('a robot arm is above the conveyor');
    const query = new URLSearchParams(screen.getByTestId('address').textContent ?? '');
    expect(query.get('s')).toBe('a robot arm is above the conveyor');
  });

  it('restores the sentence from the URL', () => {
    mount('/lab/L7?s=the+worker+is+knocking+on+the+panel');
    expect(screen.getByTestId('caption')).toHaveValue('the worker is knocking on the panel');
    expect(screen.getAllByTestId(/^edge-/)).toHaveLength(1);
  });

  it('draws an out-of-vocabulary predicate in the spurious style, not a style of its own', () => {
    mount();
    type('the person is taping the panel');
    const edge = screen.getByTestId('edge-1');
    expect(edge.getAttribute('data-oov')).toBe('true');
    expect(edge.getAttribute('data-stroke')).toBe(VERDICT_STYLE.spurious.stroke);
  });

  it('draws a legal predicate in no verdict style at all', () => {
    mount();
    type('the person is holding a box');
    const edge = screen.getByTestId('edge-1');
    expect(edge.getAttribute('data-oov')).toBe('false');
    expect(edge.getAttribute('data-stroke')).not.toBe(VERDICT_STYLE.spurious.stroke);
  });

  it('states the two-fold cost beside the offending predicate', () => {
    // L10: the error is counted twice -- a wasted rank and a relation left unmatched. A lab that
    // merely coloured it red would teach that it is bad, not that it is bad twice over.
    mount();
    type('the person is taping the panel');
    const cost = screen.getByTestId('oov-cost');
    expect(cost.textContent).toMatch(/taping/);
    expect(cost.textContent).toMatch(/twice/i);
  });

  it('says nothing about cost when every predicate is legal', () => {
    mount();
    type('the person is holding a box');
    expect(screen.queryByTestId('oov-cost')).toBeNull();
  });

  it('surfaces a structural complaint rather than swallowing it', () => {
    mount();
    type('the person and the table');
    expect(within(screen.getByTestId('warnings')).getByText(/no relation/i)).toBeTruthy();
  });

  it('shows the vocabularies, because a closed vocabulary a student cannot see is a trap', () => {
    mount();
    expect(screen.getByTestId('vocab-O').textContent).toContain('conveyor');
    expect(screen.getByTestId('vocab-P').textContent).toContain('knocking on');
  });

  it('says the boxes are placeholders', () => {
    mount();
    type('the person is holding a box');
    expect(screen.getByTestId('geometry-note').textContent).toMatch(/placeholder/i);
  });

  it('renders an empty state rather than an empty graph', () => {
    mount();
    expect(screen.getByTestId('idle')).toBeTruthy();
    expect(screen.queryAllByTestId(/^node-/)).toHaveLength(0);
  });
});
