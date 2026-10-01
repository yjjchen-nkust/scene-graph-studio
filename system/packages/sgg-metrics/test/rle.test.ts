import { describe, expect, it } from 'vitest';
import { decode, decodeCounts, encodeCounts, maskIou } from '../src/rle.js';
import type { RLEMask } from '../src/types.js';

// The cross-engine RLE gaps of D120's review: the TypeScript accumulated with 32-bit bitwise
// operators where Python's integers are unbounded, and it wrote every run out pixel by pixel.

function mask(runs: number[], height: number, width: number): RLEMask {
  return { counts: encodeCounts(runs), size: [height, width] };
}

/** `decode` and `maskIou` as they stood at D120: every run pushed, then padded or cut. */
function bitmapAsBefore(m: RLEMask): number[] {
  const [height, width] = m.size;
  const bitmap: number[] = [];
  let value = 0;
  for (const run of decodeCounts(m.counts)) {
    for (let i = 0; i < run; i += 1) bitmap.push(value);
    value ^= 1;
  }
  const expected = height * width;
  while (bitmap.length < expected) bitmap.push(0);
  return bitmap.slice(0, expected);
}

function iouAsBefore(a: RLEMask, b: RLEMask): number {
  const pa = bitmapAsBefore(a);
  const pb = bitmapAsBefore(b);
  let inter = 0;
  let union = 0;
  for (let i = 0; i < pa.length; i += 1) {
    if (pa[i] && pb[i]) inter += 1;
    if (pa[i] || pb[i]) union += 1;
  }
  return union ? inter / union : 0;
}

/** mulberry32: a seeded generator, so a failing case is the same case on every run. */
function seeded(seed: number): (lo: number, hi: number) => number {
  let state = seed >>> 0;
  return (lo, hi) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return lo + Math.floor(unit * (hi - lo + 1));
  };
}

// Each written by backend/app/eval/rle.py's `encode_counts` and read back by its `decode_counts`.
const PYTHON: Array<[number[], string]> = [
  [[0, 2 ** 31], '0PPPPPP2'],
  [[0, 2 ** 32 + 5], '0UPPPPP4'],
  [[2 ** 40, 3, 2 ** 40 - 7, 1], 'PPPPPPPP13iooooooo0N'],
  [[-(2 ** 33), 5, 2 ** 31 - 1], 'PPPPPPH5oooooo1'],
  [[7, 2 ** 52, 9, 2 ** 52 + 1], '7PPPPPPPPPP491'],
];

describe('rle across 32 bits', () => {
  it("reads Python's run of 2**31 as Python does, so the two engines score it alike", () => {
    expect(decodeCounts('0PPPPPP2')).toEqual([0, 2 ** 31]);
    // Python, below the schema that now refuses it: 1.0. The 32-bit reading was -2**31, an
    // empty mask, and an IoU of 0.
    expect(maskIou({ counts: '0PPPPPP2', size: [4, 4] }, mask([0, 16], 4, 4))).toBe(1);
  });

  it('encodes and decodes every value below 2**53 exactly as Python does', () => {
    for (const [runs, python] of PYTHON) {
      expect(encodeCounts(runs), String(runs)).toBe(python);
      expect(decodeCounts(python), python).toEqual(runs);
    }
  });
});

describe('rle cost', () => {
  it('never writes out a run longer than its mask', () => {
    const full = mask([0, 2 ** 24], 4, 4);
    const half = mask([8, 8], 4, 4);
    const started = performance.now();
    const iou = maskIou(full, half);
    const bitmap = decode(full);
    const elapsed = performance.now() - started;
    expect(iou).toBe(0.5);
    expect(bitmap).toEqual(new Array<number>(16).fill(1));
    // Measured at D120 on this machine: 367 ms and 518 MiB resident for `maskIou` alone, every
    // pixel of the 2**24 pushed before the cut to sixteen. Counted by runs it is microseconds.
    expect(elapsed).toBeLessThan(50);
  });

  it('agrees with the bitmap it replaced, negative runs and short and long counts included', () => {
    const rand = seeded(20261001);
    for (let n = 0; n < 2000; n += 1) {
      const h = rand(1, 9);
      const w = rand(1, 9);
      const [a, b] = [0, 1].map(() => {
        const runs = Array.from({ length: rand(0, 9) }, () => rand(-3, h * w));
        expect(decodeCounts(encodeCounts(runs))).toEqual(runs);
        return mask(runs, h, w);
      }) as [RLEMask, RLEMask];
      expect(decode(a), a.counts).toEqual(bitmapAsBefore(a));
      expect(maskIou(a, b), `${a.counts} ${b.counts}`).toBe(iouAsBefore(a, b));
    }
  });
});
