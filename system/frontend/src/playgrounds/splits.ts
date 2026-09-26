import raw from '../../../../data/content/vg150_splits.json';

/**
 * X1's figures: the one place they come from.
 *
 * Every figure is a transcription, carrying the passage it was copied from, and
 * `content_lint.mjs` rule 12 refuses one that does not. A `null` value is a figure the source
 * does not state, which X1 says in words rather than estimating.
 */
export type Split = 'train' | 'val' | 'test';

export interface Figure {
  value: number | string | null;
  source: string;
  url: string;
  locator: string;
  quote: string;
  measured?: { command: string; sha256: string; rows: number; date: string };
}

export interface Note extends Figure {
  value: number;
  text_en: string;
  text_zh: string;
}

export interface Release {
  id: string;
  label_en: string;
  label_zh: string;
  figures: Partial<Record<Split | 'pool' | 'val_from' | 'zero_relation', Figure>>;
  notes: Note[];
}

export const RELEASES: Release[] = (raw as unknown as { releases: Release[] }).releases;

export function releaseById(id: string): Release | undefined {
  return RELEASES.find((r) => r.id === id);
}
