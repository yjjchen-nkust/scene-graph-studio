import type { RLEMask } from './types.js';

// Mirrors backend/app/eval/rle.py line for line. COCO's compressed RLE: 5-bit groups, low
// group first, offset by 48; 0x20 continues, 0x10 on the final group is the sign bit; from
// the fourth run onward the stored value is a delta against the run two positions earlier.

export function decodeCounts(counts: string): number[] {
  const out: number[] = [];
  let i = 0;
  const n = counts.length;
  while (i < n) {
    let value = 0;
    let shift = 0;
    let more = true;
    while (more) {
      const char = counts.charCodeAt(i) - 48;
      i += 1;
      value |= (char & 0x1f) << shift;
      shift += 5;
      more = (char & 0x20) !== 0;
      if (!more && (char & 0x10) !== 0) value |= -1 << shift;
    }
    if (out.length > 2) value += out[out.length - 2]!;
    out.push(value);
  }
  return out;
}

export function encodeCounts(values: number[]): string {
  const out: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    let value = index > 2 ? values[index]! - values[index - 2]! : values[index]!;
    let more = true;
    while (more) {
      let char = value & 0x1f;
      value >>= 5;
      more = (char & 0x10) !== 0 ? value !== -1 : value !== 0;
      if (more) char |= 0x20;
      out.push(String.fromCharCode(char + 48));
    }
  }
  return out.join('');
}

export function decode(mask: RLEMask): number[] {
  const [height, width] = mask.size;
  const bitmap: number[] = [];
  let value = 0;
  for (const run of decodeCounts(mask.counts)) {
    for (let i = 0; i < run; i += 1) bitmap.push(value);
    value ^= 1;
  }
  const expected = height * width;
  while (bitmap.length < expected) bitmap.push(0);
  return bitmap.slice(0, expected);
}

export function maskIou(a: RLEMask, b: RLEMask): number {
  if (a.size[0] !== b.size[0] || a.size[1] !== b.size[1]) {
    throw new Error(`mask sizes differ: ${a.size} vs ${b.size}`);
  }
  const pa = decode(a);
  const pb = decode(b);
  let inter = 0;
  let union = 0;
  for (let i = 0; i < pa.length; i += 1) {
    if (pa[i] && pb[i]) inter += 1;
    if (pa[i] || pb[i]) union += 1;
  }
  return union ? inter / union : 0;
}
