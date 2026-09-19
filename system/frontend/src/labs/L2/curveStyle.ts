import { VERDICT_STYLE } from '../../graph/palette';

/**
 * R solid, mR dashed.
 *
 * The same two-channel rule the diff palette follows (NFR-5): the two curves are told apart
 * by their dash pattern as well as their hue, so the gap between them survives a projector
 * and a greyscale printout. mR borrows the `localization` amber rather than inventing a
 * fifth colour, because the palette is where this project's colours live.
 */
export const CURVE_STYLE = {
  R: { colour: '#1d4ed8', dash: '' },
  mR: { colour: VERDICT_STYLE.localization.stroke, dash: '5 3' },
} as const;
