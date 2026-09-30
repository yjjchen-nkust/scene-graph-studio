import type { Triplet } from '../data';

/*
 * How D-V writes a triplet, so a term of more than one word (`instruction sheet`, `attached to`)
 * never runs into its neighbour.
 */

/** A completion's row as the completion writes it, `⟨s, p, o⟩`: parts 2 and 3, which show rows. */
export function angled(t: Triplet): string {
  return `⟨${t.join(', ')}⟩`;
}

/** A row under its subject, `p → o`: part 4, which writes each subject once above its rows. */
export function outgoing(t: Triplet): string {
  return `${t[1]} → ${t[2]}`;
}

/** A triplet by its subject, `s: p → o`: part 5, the same delimiters with the subject in line. */
export function bySubjectText(t: Triplet): string {
  return `${t[0]}: ${outgoing(t)}`;
}
