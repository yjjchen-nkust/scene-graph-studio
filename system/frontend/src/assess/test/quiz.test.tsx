import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SceneGraph } from 'sgg-metrics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { loadSchedule } from '../../store/persist';
import { itemsFor, Quiz } from '../quiz';

const GT: SceneGraph = {
  image_id: 'q-001',
  dataset: 'placeholder',
  width: 640,
  height: 480,
  objects: [
    { object_id: 1, names: ['table'], bbox: { x: 60, y: 300, w: 420, h: 110 } },
    { object_id: 2, names: ['cup'], bbox: { x: 200, y: 240, w: 60, h: 70 } },
    { object_id: 3, names: ['person'], bbox: { x: 40, y: 60, w: 150, h: 340 } },
  ],
  relationships: [
    { relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on' },
    { relationship_id: 2, subject_id: 3, object_id: 2, predicate: 'holding' },
    { relationship_id: 3, subject_id: 3, object_id: 1, predicate: 'near' },
  ],
  provenance: { kind: 'ground_truth', fidelity: 'measured' },
};

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
});

function mount(count = 1) {
  const items = itemsFor('m00', 's4', GT, count);
  render(<Quiz items={items} />);
  return items;
}

describe('itemsFor', () => {
  it('gives every item a stable id built from where it came from', () => {
    expect(itemsFor('m00', 's4', GT, 3).map((i) => i.id)).toEqual([
      'm00:s4:0',
      'm00:s4:1',
      'm00:s4:2',
    ]);
  });

  it('produces the same items for the same module and step, every time', () => {
    expect(itemsFor('m00', 's4', GT, 3)).toEqual(itemsFor('m00', 's4', GT, 3));
  });

  it('produces different items for a different step', () => {
    // Otherwise every checkpoint in the course asks the same question.
    const a = itemsFor('m00', 's4', GT, 3).map((i) => i.corruptedIndex + i.kind);
    const b = itemsFor('m07', 's9', GT, 3).map((i) => i.corruptedIndex + i.kind);
    expect(a).not.toEqual(b);
  });

  it('asks for no more items than the graph can carry', () => {
    expect(itemsFor('m00', 's4', GT, 99)).toHaveLength(GT.relationships.length);
  });
});

describe('Quiz', () => {
  it('offers one answer per relationship in the perturbed graph', () => {
    mount();
    expect(screen.getAllByTestId(/^option-/)).toHaveLength(GT.relationships.length);
  });

  it('does not say which is wrong before an answer is given', () => {
    mount();
    expect(screen.queryByTestId('verdict')).not.toBeInTheDocument();
  });

  it('accepts the corrupted triplet as the right answer', () => {
    const [item] = mount();
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
  });

  it('rejects another triplet and names the one that was wrong', () => {
    const [item] = mount();
    const other = (item!.corruptedIndex + 1) % GT.relationships.length;
    fireEvent.click(screen.getByTestId(`option-${other}`));

    const verdict = screen.getByTestId('verdict');
    expect(verdict).toHaveAttribute('data-correct', 'false');
    // The corrected triplet, so a wrong answer teaches rather than only scores.
    expect(within(verdict).getByTestId('answer')).toHaveTextContent(
      GT.relationships[item!.corruptedIndex]!.predicate,
    );
  });

  it('says how the relation was corrupted, not merely that it was', () => {
    const [item] = mount();
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    expect(screen.getByTestId('verdict')).toHaveTextContent(
      item!.kind === 'reversed' ? /direction/i : /predicate/i,
    );
  });

  it('schedules a correct answer further out than a wrong one', () => {
    const [item] = mount();
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    const good = loadSchedule().cards[item!.id]!.due;

    // Two mounts in one test: the second must not see the first's buttons, and `cleanup` only
    // runs between tests.
    cleanup();
    localStorage.clear();
    const [again] = mount();
    fireEvent.click(screen.getByTestId(`option-${(again!.corruptedIndex + 1) % 3}`));
    const bad = loadSchedule().cards[again!.id]!.due;

    expect(new Date(good).getTime()).toBeGreaterThan(new Date(bad).getTime());
  });

  it('closes the options once one is given, so an item is graded once', () => {
    const [item] = mount();
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    const first = loadSchedule().cards[item!.id]!;

    // The disabled attribute is the mechanism, so it is what is asserted. Asserting only the
    // unchanged card would pass for any reason the second click failed to land.
    for (let i = 0; i < GT.relationships.length; i += 1) {
      expect(screen.getByTestId(`option-${i}`)).toBeDisabled();
    }
    fireEvent.click(screen.getByTestId('option-0'));
    expect(loadSchedule().cards[item!.id]!.reps).toBe(first.reps);
  });

  it('moves to the next item and reports the score at the end', () => {
    const items = mount(2);
    fireEvent.click(screen.getByTestId(`option-${items[0]!.corruptedIndex}`));
    fireEvent.click(screen.getByTestId('next'));

    expect(screen.getByTestId('item-position')).toHaveTextContent('2 / 2');
    fireEvent.click(screen.getByTestId(`option-${items[1]!.corruptedIndex}`));
    fireEvent.click(screen.getByTestId('next'));
    expect(screen.getByTestId('quiz-score')).toHaveTextContent('2 / 2');
  });

  it('still works when storage is blocked, as in a private window', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const [item] = mount();
    expect(() =>
      fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`)),
    ).not.toThrow();
    expect(screen.getByTestId('verdict')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('says so rather than rendering an empty quiz when there are no items', () => {
    render(<Quiz items={[]} />);
    expect(screen.getByTestId('quiz-empty')).toBeInTheDocument();
  });
});
