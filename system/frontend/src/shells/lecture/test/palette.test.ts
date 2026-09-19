import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  LECTURE_BASE_PX,
  LECTURE_CONTRAST_MIN,
  LECTURE_INK,
  LECTURE_PALETTE,
  relativeLuminance,
} from '../palette';

describe('contrastRatio', () => {
  it('agrees with WCAG at both extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
  });

  it('is symmetric in its arguments', () => {
    expect(contrastRatio('#1e40af', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#1e40af'), 12);
  });

  it('matches a published reference pair', () => {
    // WCAG's own worked example: #777777 on white is 4.48:1.
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('applies the sRGB transfer curve rather than a linear ramp', () => {
    // 50% grey is 21.6% luminance, not 50%. A linear implementation would return 0.5 and
    // every ratio in this file would be wrong in the same direction.
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 4);
  });

  it('refuses a colour it cannot measure rather than scoring it', () => {
    expect(() => contrastRatio('rebeccapurple', '#ffffff')).toThrow();
    expect(() => contrastRatio('#fff', '#ffffff')).toThrow();
  });
});

describe('the lecture palette', () => {
  it('meets NFR-5 on every token that carries type', () => {
    for (const token of LECTURE_INK) {
      const ratio = contrastRatio(LECTURE_PALETTE[token], LECTURE_PALETTE.background);
      expect(
        ratio,
        `${token} (${LECTURE_PALETTE[token]}) is ${ratio.toFixed(2)}:1 against the background`,
      ).toBeGreaterThanOrEqual(LECTURE_CONTRAST_MIN);
    }
  });

  it('records the measured ratios the module documents', () => {
    const measured = Object.fromEntries(
      LECTURE_INK.map((token) => [
        token,
        Number(contrastRatio(LECTURE_PALETTE[token], LECTURE_PALETTE.background).toFixed(2)),
      ]),
    );
    expect(measured).toEqual({ text: 17.74, muted: 10.35, accent: 8.72, rule: 7.58, danger: 8.66 });
  });

  it('sets the projector base size contracts §2.4 names', () => {
    expect(LECTURE_BASE_PX).toBeGreaterThanOrEqual(24);
  });
});
