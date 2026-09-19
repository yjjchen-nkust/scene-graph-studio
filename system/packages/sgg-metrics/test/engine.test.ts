import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import { boxIou } from '../src/iou.js';
import { encodeCounts, decodeCounts, maskIou } from '../src/rle.js';

const TOL = 1e-9;
const cases = JSON.parse(
  readFileSync(new URL('../../../../data/golden/vectors.json', import.meta.url), 'utf-8'),
).cases as Array<Record<string, any>>;

describe('box iou', () => {
  it('halves correctly', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }))
      .toBeCloseTo(50 / 150, 12);
  });
  it('is zero on touching edges', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
  });
  it('is exactly one half under containment', () => {
    expect(boxIou({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 20 })).toBe(0.5);
  });
});

describe('rle', () => {
  it('round-trips counts through the delta encoding', () => {
    for (const counts of [[16], [0, 16], [2, 3, 11], [0, 100000, 1], [12345, 6789, 100]]) {
      expect(decodeCounts(encodeCounts(counts))).toEqual(counts);
    }
  });
  it('matches the python worked example', () => {
    const a = { counts: encodeCounts([0, 8, 8]), size: [4, 4] as [number, number] };
    const b = { counts: encodeCounts([4, 8, 4]), size: [4, 4] as [number, number] };
    expect(maskIou(a, b)).toBeCloseTo(4 / 12, 12);
  });
});

describe('golden vectors', () => {
  for (const c of cases) {
    it(c.id, () => {
      const body = evaluate({ gt: c.gt, pred: c.pred, ...c.params });
      const got = new Map(body.metrics.map((m) => [`${m.metric}@${m.k}`, m.value]));
      for (const [metric, byK] of Object.entries(c.expect)) {
        if (metric === 'verdicts' || metric === 'warnings') continue;
        for (const [k, want] of Object.entries(byK as Record<string, number | null>)) {
          const have = got.get(`${metric}@${k}`);
          if (want === null) expect(have, `${c.id} ${metric}@${k}`).toBeNull();
          else expect(Math.abs((have as number) - want), `${c.id} ${metric}@${k}`)
            .toBeLessThan(TOL);
        }
      }
      for (const want of (c.expect.verdicts ?? [])) {
        const row = body.verdicts.find((v) => v.pred_index === want.pred_index);
        expect(row?.verdict, `${c.id} pred ${want.pred_index}`).toBe(want.verdict);
      }
      for (const code of (c.expect.warnings ?? [])) {
        expect(body.warnings.map((w) => w.code), c.id).toContain(code);
      }
    });
  }
});
