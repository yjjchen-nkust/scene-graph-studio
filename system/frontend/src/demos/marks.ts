/**
 * Figure 6's marks, the one definition D-T part 4 and D-V parts 3 and 5 draw with.
 *
 * The paper's Figure 6 dots the edges that disappeared and draws the new ones in blue. Here a
 * triplet that was added sits on a solid `blue-700` rule and one that was removed on a dotted
 * `slate-700` rule, so the two differ by shape as well as by colour (NFR-5); a kept triplet has
 * none. The rule is a 3 px text underline, which adds nothing to a row's height. The colour is the
 * rule's alone: the sign and the words keep the text's ink, `slate-900`, or `slate-700` for a
 * removed triplet, which the room reads as gone.
 *
 * The rule runs unbroken under the descenders (`text-decoration-skip-ink: none`). The browser's
 * default breaks it around every g, p and y, and a dotted rule broken there reads as neither kind.
 */

/** What became of a triplet from one list to the next. */
export type Change = 'kept' | 'added' | 'removed';

const RULE = 'underline decoration-[3px] underline-offset-2 [text-decoration-skip-ink:none]';

export const MARK: Record<Change, string> = {
  kept: 'text-slate-900',
  added: `text-slate-900 ${RULE} decoration-solid decoration-blue-700`,
  removed: `text-slate-700 ${RULE} decoration-dotted decoration-slate-700`,
};

/** The sign before a marked triplet, a kept one has none. */
export const SIGN: Record<Change, string> = { kept: '', added: '+ ', removed: '− ' };
