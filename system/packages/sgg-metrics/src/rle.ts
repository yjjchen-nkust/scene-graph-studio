import type { RLEMask } from './types.js';

// Mirrors backend/app/eval/rle.py function for function: decodeCounts, encodeCounts, foreground,
// decode and maskIou, with the same results. COCO's compressed RLE: 5-bit groups, low group
// first, offset by 48; 0x20 continues, 0x10 on the final group is the sign bit; from the fourth
// run onward the stored value is a delta against the run two positions earlier.
//
// One difference of form. Python's integers are unbounded, so its `<<`, `|`, `&` and `>>` are
// exact at any size; JavaScript's bitwise operators truncate to 32 bits, and read a run of 2**31
// as -2**31 (D120's review). The accumulation here is therefore written with multiplication,
// addition and floor division, which agree with Python for every value below 2**53 in magnitude.
// Only the 5-bit group itself, always below 64, is taken apart with bitwise operators. Counts
// that end inside a run raise IndexError in Python and read the missing group as zero here; the
// schema refuses them before either engine sees them (D120).

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
      value += (char & 0x1f) * 2 ** shift;
      shift += 5;
      more = (char & 0x20) !== 0;
      // Python's `value |= -1 << shift`: every bit from `shift` up set, on a value below 2**shift.
      if (!more && (char & 0x10) !== 0) value -= 2 ** shift;
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
      // Python's `value & 0x1F` and `value >>= 5`: the low five bits of the two's complement, and
      // floor division, both of which hold for negative values too.
      let char = value - Math.floor(value / 32) * 32;
      value = Math.floor(value / 32);
      more = (char & 0x10) !== 0 ? value !== -1 : value !== 0;
      if (more) char |= 0x20;
      out.push(String.fromCharCode(char + 48));
    }
  }
  return out.join('');
}

/**
 * The mask's set pixels as half-open intervals of the flat column-major index, in order.
 *
 * Read exactly as the bitmap was: runs alternate from background, a negative run covers no pixel
 * but still flips the colour, counts short of `height * width` leave the rest background, and
 * counts beyond it are cut. A run is clipped before it is used, so a run of 2**24 on a 4 × 4 mask
 * costs an interval, not sixteen million pushes.
 */
export function foreground(mask: RLEMask): Array<[number, number]> {
  const [height, width] = mask.size;
  const area = height * width;
  const out: Array<[number, number]> = [];
  let start = 0;
  let value = 0;
  for (const run of decodeCounts(mask.counts)) {
    if (start >= area) break;
    const end = Math.min(start + Math.max(run, 0), area);
    if (value && end > start) out.push([start, end]);
    start = end;
    value ^= 1;
  }
  return out;
}

/** A flat column-major bitmap of length height * width. */
export function decode(mask: RLEMask): number[] {
  const [height, width] = mask.size;
  // Python's `[0] * n` is empty for a negative n, where `new Array(n)` throws.
  const bitmap = new Array<number>(Math.max(height * width, 0)).fill(0);
  for (const [start, end] of foreground(mask)) bitmap.fill(1, start, end);
  return bitmap;
}

/**
 * Counted over the two interval lists rather than two bitmaps, so the cost follows the runs and
 * not `height * width`; the counts, and so the quotient, are the bitmap's exactly.
 */
export function maskIou(a: RLEMask, b: RLEMask): number {
  if (a.size[0] !== b.size[0] || a.size[1] !== b.size[1]) {
    throw new Error(`mask sizes differ: ${a.size} vs ${b.size}`);
  }
  const fa = foreground(a);
  const fb = foreground(b);
  let inter = 0;
  let i = 0;
  let j = 0;
  while (i < fa.length && j < fb.length) {
    const [sa, ea] = fa[i]!;
    const [sb, eb] = fb[j]!;
    inter += Math.max(0, Math.min(ea, eb) - Math.max(sa, sb));
    // Advance whichever interval ends first; the other may still overlap the next one.
    if (ea <= eb) i += 1;
    else j += 1;
  }
  let union = -inter;
  for (const [s, e] of fa) union += e - s;
  for (const [s, e] of fb) union += e - s;
  return union ? inter / union : 0;
}
