import { describe, expect, it } from 'vitest';
import { FRAMES, frameById } from '../slice';
import {
  candidateSpace, clamp, densityCut, flag, formatRatio, isInE, ratio, tripletKey,
} from '../logic';

const ph001 = frameById('ph-001')!;

describe('candidateSpace', () => {
  it('counts ordered pairs of distinct objects, times the predicate vocabulary', () => {
    // 6 objects -> 6 x 5 = 30 ordered pairs; 30 x 16 = 480.
    expect(candidateSpace(6, 16, true)).toBe(480);
  });

  it('halves when direction is discarded, because (s,o) and (o,s) become one pair', () => {
    expect(candidateSpace(6, 16, false)).toBe(240);
  });

  it('is zero for a graph with fewer than two objects, not negative', () => {
    expect(candidateSpace(1, 16, true)).toBe(0);
    expect(candidateSpace(0, 16, true)).toBe(0);
  });
});

describe('densityCut', () => {
  it('keeps every edge at full density', () => {
    expect(densityCut(ph001.relationships, 1)).toHaveLength(6);
  });

  it('keeps none at zero', () => {
    expect(densityCut(ph001.relationships, 0)).toHaveLength(0);
  });

  it('keeps a prefix, so the slider is reversible rather than a reshuffle', () => {
    const half = densityCut(ph001.relationships, 0.5);
    expect(half).toHaveLength(3);
    expect(half).toEqual(ph001.relationships.slice(0, 3));
  });
});

describe('ratio and formatRatio', () => {
  it('is the annotated count over the candidate count', () => {
    expect(ratio(6, 480)).toBeCloseTo(0.0125, 6);
  });

  // Review Focus 4: density at zero.
  it('is zero over a candidate space, not NaN', () => {
    expect(ratio(0, 480)).toBe(0);
    expect(formatRatio(ratio(0, 480))).toBe('0.00%');
  });

  it('is zero rather than Infinity when there is no candidate space at all', () => {
    expect(ratio(0, 0)).toBe(0);
    expect(formatRatio(ratio(0, 0))).toBe('0.00%');
  });

  it('formats to two decimals', () => {
    expect(formatRatio(0.0125)).toBe('1.25%');
  });
});

describe('tripletKey', () => {
  const ab = { subject_id: 1, predicate: 'on', object_id: 2 };
  const ba = { subject_id: 2, predicate: 'on', object_id: 1 };

  it('tells the two directions apart when direction is kept', () => {
    expect(tripletKey(ab, true)).not.toBe(tripletKey(ba, true));
  });

  it('makes them one key when direction is discarded', () => {
    expect(tripletKey(ab, false)).toBe(tripletKey(ba, false));
  });
});

describe('isInE', () => {
  it('finds a triplet the annotator wrote', () => {
    // ph-001 relationship 1: box (3) --on--> table (1).
    expect(isInE(ph001, { subject_id: 3, predicate: 'on', object_id: 1 })).toBe(true);
  });

  it('does not find its reversal', () => {
    expect(isInE(ph001, { subject_id: 1, predicate: 'on', object_id: 3 })).toBe(false);
  });

  // Review Focus 5: a frame carrying both directions. No placeholder frame has one, so the
  // behaviour is pinned by a fixture rather than left to the data.
  it('finds both directions when the annotation carries both', () => {
    const both = {
      ...ph001,
      relationships: [
        { relationship_id: 1, subject_id: 1, predicate: 'near', object_id: 2 },
        { relationship_id: 2, subject_id: 2, predicate: 'near', object_id: 1 },
      ],
    };
    expect(isInE(both, { subject_id: 1, predicate: 'near', object_id: 2 })).toBe(true);
    expect(isInE(both, { subject_id: 2, predicate: 'near', object_id: 1 })).toBe(true);
  });
});

describe('clamp', () => {
  // Review Focus 1: a knob value out of range from the URL.
  it('holds a value inside its range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('returns the low bound for a value that is not a number', () => {
    expect(clamp(Number.NaN, 0, 1)).toBe(0);
  });
});

describe('the frames this all runs on', () => {
  it('has six of them', () => {
    expect(FRAMES).toHaveLength(6);
  });
});

describe('flag', () => {
  it('reads the two values a toggle writes', () => {
    expect(flag(1, false)).toBe(true);
    expect(flag(0, true)).toBe(false);
  });

  it('returns the default for a value the URL invented, rather than the opposite of it', () => {
    // `=== 1` reads every one of these as off, so `?F2.directed=2` silently selected the state
    // opposite the default and the panel showed a halved candidate space nobody asked for.
    expect(flag(2, true)).toBe(true);
    expect(flag(-1, true)).toBe(true);
    expect(flag(7, false)).toBe(false);
    expect(flag(Number.NaN, true)).toBe(true);
  });
});

describe('formatRatio', () => {
  it('prints an ordinary share to two decimals', () => {
    expect(formatRatio(0.0125)).toBe('1.25%');
    expect(formatRatio(0)).toBe('0.00%');
  });

  it('distinguishes a share too small to print from no share at all', () => {
    // Both rendered `0.00%`, which is the one distinction an "annotated share" readout exists
    // to make. 1e-5 is 0.001%.
    expect(formatRatio(1e-5)).toBe('< 0.01%');
    expect(formatRatio(0)).toBe('0.00%');
  });
});

describe('densityCut clamps rather than indexing from the end', () => {
  const six = frameById('ph-001')!.relationships;

  it('keeps nothing for a negative density, whatever its magnitude', () => {
    // Unclamped, `Math.round(-0.5 * 6) = -3` and `slice(0, -3)` returns the first three. The
    // clamp inside densityCut is the only thing between a negative knob and half the graph.
    expect(densityCut(six, -0.5)).toHaveLength(0);
    expect(densityCut(six, -1)).toHaveLength(0);
    expect(densityCut(six, -0.1)).toHaveLength(0);
  });

  it('keeps everything for a density above one', () => {
    expect(densityCut(six, 5)).toHaveLength(6);
  });
});

