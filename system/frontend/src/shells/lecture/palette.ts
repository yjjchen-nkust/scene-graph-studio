/**
 * The lecture palette, and the function that proves it.
 *
 * NFR-5 asks for 7:1 — WCAG AAA for body text — because a projector in a lit room loses contrast
 * that a monitor keeps, and a ratio chosen by eye on a laptop is the one that fails in the hall.
 * The ratios below are measured by `contrastRatio`, not asserted by comment: the test recomputes
 * every pair on every run, so a colour edited without checking fails CI rather than the lecture.
 *
 * Measured against `background` (#ffffff), to two decimals:
 *
 * | Token | Hex | Ratio |
 * |---|---|---|
 * | `text` | `#111827` | 17.74 |
 * | `muted` | `#334155` | 10.35 |
 * | `accent` | `#1e40af` |  8.72 |
 * | `rule` | `#475569` |  7.58 |
 * | `danger` | `#912018` |  8.66 |
 *
 * The accent was `#1d4ed8` until it was measured at 6.70 and failed. That is the reason the
 * check is code: the colour looked strong, the comment claiming 7.06 was written from memory,
 * and only the arithmetic disagreed. Nothing in the lecture shell renders type in a colour
 * absent from this map.
 */
export interface LecturePalette {
  background: string;
  text: string;
  muted: string;
  accent: string;
  rule: string;
  /** A section past its budget, on the presenter window. Never the only channel: a sign leads. */
  danger: string;
}

export const LECTURE_PALETTE: LecturePalette = {
  background: '#ffffff',
  text: '#111827',
  muted: '#334155',
  accent: '#1e40af',
  rule: '#475569',
  // Not the `spurious` stroke of `graph/palette.ts`. That is `#b42318`, which measures 6.57 and
  // is correct where it lives -- an overlay stroke on an image, which NFR-5's 7:1 body-text rule
  // does not reach -- and wrong for a number a room reads off a projector.
  danger: '#912018',
};

/** Every token in `LECTURE_PALETTE` that renders type, and therefore owes 7:1. */
export const LECTURE_INK: (keyof LecturePalette)[] = ['text', 'muted', 'accent', 'rule', 'danger'];

/** NFR-5's threshold. WCAG AAA for body text; the shell has no exempt large-text tier. */
export const LECTURE_CONTRAST_MIN = 7;

/**
 * Base type size in pixels. Contracts §2.4 and NFR-5 both name 24; the shell sets it once here
 * so a component cannot quietly render a lecture step at the study shell's size.
 */
export const LECTURE_BASE_PX = 24;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a six-digit hex colour: ${hex}`);
  const n = parseInt(match[1]!, 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, in [1, 21]. Order of the arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}
