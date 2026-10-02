import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SceneGraph } from 'sgg-metrics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/useLocale';
import { GT as CHECKPOINT_GRAPH } from '../../labs/L2/fixture';
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

// A fresh memory of answers by default, as a reload would give: otherwise the module's own would
// carry one test's answers into the next.
function mount(count = 1, answered = new Map<string, number>()) {
  const items = itemsFor('m00', 's4', GT, count);
  render(<Quiz items={items} answered={answered} />);
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

  it('never asks about one relation twice in a checkpoint', () => {
    // Each item was seeded alone, so two items of one checkpoint could corrupt the same relation,
    // and m03:s11 and m08:s5 drew one item twice outright. Swept over the graph every checkpoint
    // uses, at the three items `StudyShell` asks for.
    for (let m = 0; m < 15; m += 1) {
      for (let s = 0; s < 30; s += 1) {
        const moduleId = `m${String(m).padStart(2, '0')}`;
        const asked = itemsFor(moduleId, `s${s}`, CHECKPOINT_GRAPH, 3).map((i) => i.corruptedIndex);
        expect(new Set(asked).size, `${moduleId}:s${s} asked ${asked.join(', ')}`)
          .toBe(asked.length);
      }
    }
  });

  it('never marks a true reversal wrong', () => {
    // `man near window` reversed is `window near man`, which is as true as the original. Four of
    // the course's forty-five items were built that way and had no wrong answer to find.
    for (let m = 0; m < 15; m += 1) {
      for (let s = 0; s < 30; s += 1) {
        const moduleId = `m${String(m).padStart(2, '0')}`;
        for (const item of itemsFor(moduleId, `s${s}`, CHECKPOINT_GRAPH, 3)) {
          if (item.original.predicate !== 'near') continue;
          expect(item.kind, item.id).toBe('predicate');
        }
      }
    }
  });

  it('holds the course’s forty-five items fixed, because the FSRS schedule is keyed by their ids', () => {
    // Each checkpoint of the fifteen modules, at the three items `StudyShell` asks for: the
    // relation corrupted and the predicate it became, or `reversed`. Thirty are the items the
    // generator drew before it refused true corruptions and repeated relations; fifteen changed
    // with that rule. A change here changes what a reader's stored schedule refers to.
    const course: Record<string, string[]> = {
      'm00:s17': ['0 reversed', '3 in front of', '2 on'],
      'm01:s13': ['0 reversed', '1 in front of', '2 on'],
      'm02:s8': ['3 in front of', '1 near', '0 near'],
      'm03:s11': ['0 on', '3 near', '1 reversed'],
      'm04:s19': ['0 reversed', '3 near', '1 reversed'],
      'm05:s9': ['2 on', '3 in front of', '1 in front of'],
      'm06:s5': ['3 in front of', '2 in front of', '1 near'],
      'm07:s5': ['1 in front of', '0 reversed', '2 on'],
      'm08:s5': ['1 reversed', '0 reversed', '3 in front of'],
      'm09:s4': ['3 in front of', '1 reversed', '0 reversed'],
      'm10:s6': ['3 reversed', '0 on', '2 in front of'],
      'm11:s10': ['1 reversed', '0 reversed', '2 in front of'],
      'm12:s5': ['2 on', '1 near', '3 near'],
      'm13:s5': ['2 in front of', '0 near', '1 near'],
      'm14:s7': ['1 reversed', '2 on', '3 near'],
    };
    for (const [checkpoint, expected] of Object.entries(course)) {
      const [moduleId, stepId] = checkpoint.split(':') as [string, string];
      const drawn = itemsFor(moduleId, stepId, CHECKPOINT_GRAPH, 3).map((i) =>
        i.kind === 'reversed'
          ? `${i.corruptedIndex} reversed`
          : `${i.corruptedIndex} ${i.graph.relationships[i.corruptedIndex]!.predicate}`,
      );
      expect(drawn, checkpoint).toEqual(expected);
    }
  });

  it('stops at the relations that can be made wrong, rather than throwing or repeating one', () => {
    const nearOnly: SceneGraph = {
      ...GT,
      relationships: [
        { relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on' },
        { relationship_id: 3, subject_id: 3, object_id: 1, predicate: 'near' },
        { relationship_id: 4, subject_id: 1, object_id: 3, predicate: 'near' },
      ],
    };
    // `person near table` and `table near person` can each be rewritten to `on`, and `cup on
    // table` to `near`, so three items; a graph of two mutual `near`s alone admits none.
    expect(itemsFor('m00', 's4', nearOnly, 3)).toHaveLength(3);
    const mutual = { ...nearOnly, relationships: nearOnly.relationships.slice(1) };
    expect(itemsFor('m00', 's4', mutual, 3)).toHaveLength(0);
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

  it('does not grade an item again when the checkpoint is mounted again', () => {
    // Leaving the page and coming back unmounts the quiz. Its answers lived in component state,
    // so the remount offered the item afresh and graded it a second time: a right answer then
    // moved the card from due in ten minutes to due in two days.
    const session = new Map<string, number>();
    const [item] = mount(1, session);
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    const once = loadSchedule().cards[item!.id];

    cleanup();
    mount(1, session);
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    expect(loadSchedule().cards[item!.id]).toEqual(once);
  });

  it('shows the earlier answer when the checkpoint is mounted again', () => {
    const session = new Map<string, number>();
    const [item] = mount(1, session);
    const wrong = (item!.corruptedIndex + 1) % GT.relationships.length;
    fireEvent.click(screen.getByTestId(`option-${wrong}`));

    cleanup();
    mount(1, session);
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-correct', 'false');
    expect(screen.getByTestId(`option-${wrong}`)).toBeDisabled();
  });

  it('does not count a second answer before the item is due, even on a fresh page', () => {
    // A reload forgets the page's answers, and the options open again. The schedule's due date is
    // what decides whether an answer is a review, so the reader gets a verdict and the card stays.
    const [item] = mount(1);
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    const once = loadSchedule().cards[item!.id];

    cleanup();
    mount(1);
    fireEvent.click(screen.getByTestId(`option-${item!.corruptedIndex}`));
    expect(screen.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
    expect(loadSchedule().cards[item!.id]).toEqual(once);
  });

  it('says so rather than rendering an empty quiz when there are no items', () => {
    render(<Quiz items={[]} />);
    expect(screen.getByTestId('quiz-empty')).toBeInTheDocument();
  });
});
