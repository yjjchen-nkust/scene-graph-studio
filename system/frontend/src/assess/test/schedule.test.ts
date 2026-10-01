import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSchedule } from '../../store/persist';
import { cardsDue, gradeItem, isDue, RATING, resetSchedule } from '../schedule';

const NOW = new Date('2026-09-18T09:00:00.000Z');

beforeEach(() => {
  localStorage.clear();
});

describe('gradeItem', () => {
  it('creates a card the first time an item is answered', () => {
    const after = gradeItem('m00:s4:0', RATING.good, NOW);
    expect(Object.keys(after.cards)).toEqual(['m00:s4:0']);
    expect(after.cards['m00:s4:0']!.reps).toBe(1);
  });

  it('persists, so a reload keeps the schedule', () => {
    gradeItem('m00:s4:0', RATING.good, NOW);
    expect(Object.keys(loadSchedule().cards)).toEqual(['m00:s4:0']);
  });

  it('schedules a remembered item further out than a forgotten one', () => {
    const good = gradeItem('a', RATING.easy, NOW).cards['a']!;
    resetSchedule();
    const bad = gradeItem('a', RATING.again, NOW).cards['a']!;
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(bad.due).getTime());
  });

  it('moves a card forward on a second good answer rather than restarting it', () => {
    const first = gradeItem('a', RATING.good, NOW).cards['a']!;
    const later = new Date(first.due);
    const second = gradeItem('a', RATING.good, later).cards['a']!;
    expect(second.reps).toBe(2);
    expect(new Date(second.due).getTime()).toBeGreaterThan(new Date(first.due).getTime());
  });

  it('does not grade an item again before it is due', () => {
    // Measured with this scheduler: a right answer to a new item is due ten minutes later, a
    // learning step. Graded again at once it was due in two days, and a third time in three, so
    // a reader clicking through a page they know pushed the card out with no review in between.
    const first = gradeItem('a', RATING.good, NOW).cards['a']!;
    const early = new Date(new Date(first.due).getTime() - 1000);
    expect(gradeItem('a', RATING.good, NOW).cards['a']).toEqual(first);
    expect(gradeItem('a', RATING.good, early).cards['a']).toEqual(first);
    expect(loadSchedule().cards['a']).toEqual(first);
  });

  it('never throws when storage is blocked; the session still schedules', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => gradeItem('a', RATING.good, NOW)).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('isDue', () => {
  it('holds for an item never answered, and for one whose review has come due', () => {
    expect(isDue('a', NOW)).toBe(true);
    const due = new Date(gradeItem('a', RATING.again, NOW).cards['a']!.due);
    expect(isDue('a', NOW)).toBe(false);
    expect(isDue('a', due)).toBe(true);
  });
});

describe('cardsDue', () => {
  it('is empty before anything is answered', () => {
    expect(cardsDue(NOW)).toEqual([]);
  });

  it('does not list a card before its due date', () => {
    gradeItem('a', RATING.easy, NOW);
    expect(cardsDue(NOW)).toEqual([]);
  });

  it('lists a card once its due date has passed', () => {
    const state = gradeItem('a', RATING.again, NOW);
    const due = new Date(new Date(state.cards['a']!.due).getTime() + 1000);
    expect(cardsDue(due)).toEqual(['a']);
  });

  it('orders the due cards by how overdue they are, most first', () => {
    gradeItem('a', RATING.again, NOW);
    gradeItem('b', RATING.again, new Date(NOW.getTime() + 60_000));
    const far = new Date(NOW.getTime() + 30 * 24 * 3600_000);
    expect(cardsDue(far)).toEqual(['a', 'b']);
  });
});
