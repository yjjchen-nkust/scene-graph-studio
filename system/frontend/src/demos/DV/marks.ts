import type { Triplet } from '../data';

/** What became of a triplet from one list to the next. */
export type Change = 'kept' | 'added' | 'removed';

/**
 * Figure 6's marks, by shape as well as colour (NFR-5): an added triplet on a solid `blue-700`
 * rule, a removed one on a dotted `slate-700` rule, a kept one on none. D-V draws the rule as a
 * text underline rather than D-T's bottom border, which adds nothing to a row's height: part 5's
 * t₂ column lists seventeen triplets in a panel of 1024×768.
 */
export const MARK: Record<Change, string> = {
  kept: 'text-slate-900',
  added: 'text-slate-900 underline decoration-solid decoration-blue-700 decoration-[3px] underline-offset-[3px]',
  removed: 'text-slate-700 underline decoration-dotted decoration-slate-700 decoration-[3px] underline-offset-[3px]',
};

export const SIGN: Record<Change, string> = { kept: '', added: '+ ', removed: '− ' };

/** A triplet as a completion writes it, its terms delimited, since a term may hold a space. */
export function angled(t: Triplet): string {
  return `⟨${t.join(', ')}⟩`;
}
