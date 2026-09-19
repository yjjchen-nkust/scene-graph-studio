/**
 * The only module in the application that touches `localStorage`. Contracts §2.3.
 *
 * Every read is wrapped and returns a typed default, because a student in a private window, or
 * one whose browser blocks site data, must still get a working application — not a blank page
 * and not a stack trace. Every write is wrapped for the same reason: a quota failure means the
 * preference does not survive a reload, which is a smaller problem than the exception.
 *
 * Keys are namespaced `sgs:` and versioned. **A version bump discards rather than migrates.**
 * Progress and a review schedule are cheap to lose and expensive to migrate wrongly, and a
 * migration that silently produced a corrupt schedule would be discovered weeks later as a
 * student's cards behaving oddly.
 *
 * `version` inside the value is checked as well as the key, and so is the shape. Trusting the
 * version alone would let a hand-edited or earlier-build entry through with `modules` as a
 * string, and every reader downstream would then fail somewhere less obvious than here.
 *
 * Every slot is JSON, including the ones holding a bare string. `i18n/useLocale.ts` wrote its
 * slot unquoted until a Playwright run seeded it in the JSON form and the application read it
 * back as the default: one key, two encodings, invisible until something wrote it both ways.
 */
const PREFIX = 'sgs:v1:';

/** Read one slot, or the default. Never throws, whatever is in storage or is blocking it. */
export function read<T>(slot: string, valid: (value: unknown) => value is T, fallback: T): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PREFIX + slot);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Write one slot. Never throws; a refusal simply means the value does not survive a reload. */
export function write(slot: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + slot, JSON.stringify(value));
  } catch {
    // Private window, blocked site data, or quota. In-memory state is unaffected.
  }
}

export function forget(slot: string): void {
  try {
    localStorage.removeItem(PREFIX + slot);
  } catch {
    // Nothing to do: the slot is unreadable anyway.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** How far a reader has got in each module: the highest step index seen, plus one. */
export interface Progress {
  version: 1;
  modules: Record<string, number>;
}

/** A fresh default each call. A shared constant would let one caller's edit reach another. */
export function emptyProgress(): Progress {
  return { version: 1, modules: {} };
}

function isProgress(value: unknown): value is Progress {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.modules)) return false;
  return Object.values(value.modules).every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function loadProgress(): Progress {
  return read('progress', isProgress, emptyProgress());
}

export function saveProgress(progress: Progress): void {
  write('progress', progress);
}

/** One FSRS card, stored as the wire shape rather than as a library object. */
export interface StoredCard {
  due: string;
  reps: number;
  stability?: number;
  difficulty?: number;
  state?: number;
  last_review?: string;
  elapsed_days?: number;
  scheduled_days?: number;
  lapses?: number;
  learning_steps?: number;
}

export interface Schedule {
  version: 1;
  cards: Record<string, StoredCard>;
}

export function emptySchedule(): Schedule {
  return { version: 1, cards: {} };
}

function isSchedule(value: unknown): value is Schedule {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.cards)) return false;
  return Object.values(value.cards).every(
    (card) => isRecord(card) && typeof card.due === 'string' && typeof card.reps === 'number',
  );
}

export function loadSchedule(): Schedule {
  return read('fsrs', isSchedule, emptySchedule());
}

export function saveSchedule(schedule: Schedule): void {
  write('fsrs', schedule);
}
