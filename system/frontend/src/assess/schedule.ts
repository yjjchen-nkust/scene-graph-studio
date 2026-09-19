import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import {
  emptySchedule,
  loadSchedule,
  saveSchedule,
  type Schedule,
  type StoredCard,
} from '../store/persist';

/**
 * Spaced repetition over the quiz items, PRD §6.5.
 *
 * `ts-fsrs` owns the algorithm; this module owns only the two things it does not: which slot in
 * `localStorage` the cards live in, and the conversion between the library's `Card` — which
 * carries `Date` objects — and the JSON that survives a reload.
 *
 * **Fuzz is off.** The library's default jitters each interval by a few per cent so a large deck
 * does not clump on one day. Here it would make the same answer on the same day produce a
 * different due date on each run, and a scheduler whose tests can only assert inequalities is
 * one whose bugs hide in the slack.
 */
const scheduler = fsrs({ enable_fuzz: false });

/** The four gradings, named so a caller never passes a bare integer. */
export const RATING = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const;

export type ItemRating = (typeof RATING)[keyof typeof RATING];

function toStored(card: Card): StoredCard {
  return {
    due: card.due.toISOString(),
    reps: card.reps,
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    last_review: card.last_review?.toISOString(),
  };
}

function toCard(stored: StoredCard | undefined, now: Date): Card {
  if (!stored) return createEmptyCard(now);
  const card = createEmptyCard(now);
  return {
    ...card,
    due: new Date(stored.due),
    reps: stored.reps,
    stability: stored.stability ?? card.stability,
    difficulty: stored.difficulty ?? card.difficulty,
    state: (stored.state ?? card.state) as Card['state'],
    elapsed_days: stored.elapsed_days ?? card.elapsed_days,
    scheduled_days: stored.scheduled_days ?? card.scheduled_days,
    lapses: stored.lapses ?? card.lapses,
    learning_steps: stored.learning_steps ?? card.learning_steps,
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

/**
 * Grade one item and return the whole schedule, saved.
 *
 * `now` is a parameter rather than read from the clock so the tests can place a review on the
 * day the previous one came due. A scheduler tested only at the current instant is tested on one
 * point of the curve it exists to compute.
 */
export function gradeItem(itemId: string, rating: ItemRating, now: Date): Schedule {
  const schedule = loadSchedule();
  const card = toCard(schedule.cards[itemId], now);
  const { card: next } = scheduler.next(card, now, rating as Grade);
  const updated: Schedule = {
    version: 1,
    cards: { ...schedule.cards, [itemId]: toStored(next) },
  };
  saveSchedule(updated);
  return updated;
}

/** The items due at `now`, most overdue first. Ties break on the id, so the order is stable. */
export function cardsDue(now: Date): string[] {
  const { cards } = loadSchedule();
  return Object.entries(cards)
    .filter(([, card]) => new Date(card.due).getTime() <= now.getTime())
    .sort(([idA, a], [idB, b]) => {
      const byDue = new Date(a.due).getTime() - new Date(b.due).getTime();
      return byDue !== 0 ? byDue : idA.localeCompare(idB);
    })
    .map(([id]) => id);
}

/** Discard every card. The interface offers this; a version bump does it on its own. */
export function resetSchedule(): void {
  saveSchedule(emptySchedule());
}
