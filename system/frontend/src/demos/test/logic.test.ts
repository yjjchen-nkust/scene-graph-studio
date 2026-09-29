import { describe, expect, it } from 'vitest';
import type { Triplet, TraditionalFrame } from '../data';
import {
  BADGE_SEARCH_MAX,
  badgePlaces,
  candidateTriplets,
  churn,
  churnFraction,
  countText,
  distinct,
  fallbackCauses,
  orderedPairs,
  outsideVocabulary,
  predicateHistogram,
  relationSources,
  revisionDiff,
  rowChange,
  bySubject,
  traditionalTriplets,
  tripletKey,
  uncoveredClasses,
} from '../logic';

/** `app/vlm/prompts.py`'s two vocabularies, written out so these cases do not read the recording. */
const O_ISG = [
  'hand', 'beam', 'brace', 'block', 'wheel', 'axle', 'pin', 'nut', 'washer', 'assembly',
  'instruction sheet', 'workbench',
];
const P_ISG = ['holding', 'assembling', 'attached to', 'inserted into', 'on', 'near', 'reaching for'];

const a: Triplet = ['hand', 'holding', 'wheel'];
const b: Triplet = ['wheel', 'on', 'workbench'];
const c: Triplet = ['hand', 'reaching for', 'nut'];

describe('the counts of the pair explosion', () => {
  it('n(n − 1) ordered pairs, none for zero or one object', () => {
    expect(orderedPairs(0)).toBe(0);
    expect(orderedPairs(1)).toBe(0);
    expect(orderedPairs(4)).toBe(12);
  });

  it('n(n − 1)·|P| candidate triplets', () => {
    expect(candidateTriplets(4, 50)).toBe(600);
    expect(candidateTriplets(1, 50)).toBe(0);
  });
});

describe('triplets as a set', () => {
  it('keys a triplet so that no two different triplets share a key', () => {
    expect(tripletKey(['a b', 'c', 'd'])).not.toBe(tripletKey(['a', 'b c', 'd']));
    expect(tripletKey(['a', 'b', 'c'])).toBe(tripletKey(['a', 'b', 'c']));
  });

  it('keeps the first occurrence of each triplet, in order', () => {
    expect(distinct([b, a, b, c, a])).toEqual([b, a, c]);
  });

  it('counts churn over distinct triplets: kept, added, removed, |Δ| and |∪|', () => {
    const result = churn([a, b, b], [b, c]);
    expect(result).toEqual({ kept: [b], added: [c], removed: [a], delta: 2, union: 3 });
    expect(churnFraction(result)).toBe('0.67');
  });

  it('defines churn over two empty sets, and shows no fraction where |∪| is 0', () => {
    const empty = churn([], []);
    expect(empty).toEqual({ kept: [], added: [], removed: [], delta: 0, union: 0 });
    expect(churnFraction(empty)).toBe('—');
    expect(churnFraction(churn([], [a]))).toBe('1.00');
    expect(churnFraction(churn([a], [a]))).toBe('0.00');
  });
});

describe('the vocabulary and the revisions', () => {
  it('flags each term outside O or P, and only those', () => {
    expect(outsideVocabulary(['hand', 'screwing', 'nut'], O_ISG, P_ISG)).toEqual({
      subject: false, predicate: true, object: false,
    });
    expect(outsideVocabulary(['left_hand', 'holding', 'wrench'], O_ISG, P_ISG)).toEqual({
      subject: true, predicate: false, object: true,
    });
  });

  it('reads a deletion and an addition on one subject and object as a rewrite', () => {
    const screwing: Triplet = ['hand', 'screwing', 'nut'];
    const assembling: Triplet = ['hand', 'assembling', 'nut'];
    const wrench: Triplet = ['wrench', 'on', 'bench'];
    const beam: Triplet = ['beam', 'on', 'bench'];
    expect(revisionDiff([screwing, wrench], [assembling, beam])).toEqual({
      deleted: [wrench],
      added: [beam],
      rewritten: [{ from: screwing, to: assembling }],
    });
  });

  it('diffs distinct triplets, so a repeated row is neither deleted nor added', () => {
    expect(revisionDiff([a, a, b], [b, a])).toEqual({ deleted: [], added: [], rewritten: [] });
  });

  it('pairs each addition with at most one deletion, in the order of the draft', () => {
    const first: Triplet = ['hand', 'holding', 'axle'];
    const second: Triplet = ['hand', 'near', 'axle'];
    const only: Triplet = ['hand', 'inserted into', 'axle'];
    expect(revisionDiff([first, second], [only])).toEqual({
      deleted: [second],
      added: [],
      rewritten: [{ from: first, to: only }],
    });
  });
});

describe('a revision\'s rows against the draft\'s', () => {
  const a: Triplet = ['hand', 'holding', 'wheel'];
  const b: Triplet = ['wheel', 'on', 'workbench'];
  const c: Triplet = ['axle', 'inserted into', 'wheel'];

  it('is identical only when the rows agree one for one, in order', () => {
    expect(rowChange([a, b], [a, b])).toBe('identical');
    expect(rowChange([], [])).toBe('identical');
  });

  it('tells the same rows in another order from the same triplets repeated differently', () => {
    expect(rowChange([a, b], [b, a])).toBe('reordered');
    expect(rowChange([a, b], [a, b, a])).toBe('repeats');
    expect(rowChange([a, a, b], [a, b])).toBe('repeats');
  });

  it('is changed when a triplet is deleted, added or rewritten', () => {
    expect(rowChange([a, b], [a])).toBe('changed');
    expect(rowChange([a], [a, c])).toBe('changed');
    expect(rowChange([a, b], [a, ['wheel', 'near', 'workbench']])).toBe('changed');
  });
});

describe('rows grouped by subject', () => {
  it('names each subject once, in first-appearance order, with its rows in order, repeats kept', () => {
    const a: Triplet = ['hand', 'holding', 'wheel'];
    const b: Triplet = ['wheel', 'on', 'workbench'];
    const c: Triplet = ['hand', 'near', 'assembly'];
    expect(bySubject([a, b, c, a])).toEqual([
      { subject: 'hand', rows: [a, c, a] },
      { subject: 'wheel', rows: [b] },
    ]);
    expect(bySubject([])).toEqual([]);
  });
});

describe('the predicate histogram', () => {
  it('counts rows, most frequent first, ties by name', () => {
    const rows: Triplet[] = [
      ['x', 'on', 'y'], ['x', 'on', 'y'], ['y', 'near', 'x'], ['x', 'holding', 'y'],
    ];
    expect(predicateHistogram(rows)).toEqual([['on', 2], ['holding', 1], ['near', 1]]);
  });

  it('is empty over no rows', () => {
    expect(predicateHistogram([])).toEqual([]);
  });
});

describe("D-T's counts", () => {
  const box = { x: 0, y: 0, w: 1, h: 1 };
  const frame: TraditionalFrame = {
    image_id: 'f', t: 90, keyframe: true, width: 10, height: 10,
    detections: [
      { object_id: 0, label: 'person', score: 0.9, bbox: box },
      { object_id: 1, label: 'remote', score: 0.8, bbox: box },
      { object_id: 2, label: 'book', score: 0.7, bbox: box },
      { object_id: 3, label: 'remote', score: 0.6, bbox: box },
    ],
    relations: [
      { subject_id: 0, object_id: 2, predicate: 'near', from: 'prior' },
      { subject_id: 2, object_id: 0, predicate: 'on', from: 'fallback' },
      { subject_id: 0, object_id: 1, predicate: 'on', from: 'fallback' },
      { subject_id: 3, object_id: 1, predicate: 'on', from: 'fallback' },
    ],
  };
  const classMap = { person: 'person', book: 'book', remote: null };

  it('prints a count with its thousands grouped', () => {
    expect(countText(11200)).toBe('11,200');
    expect(countText(0)).toBe('0');
  });

  it('lists the O_ISG classes COCO has no category for, in order', () => {
    expect(uncoveredClasses({ hand: null, workbench: 'dining table', nut: null })).toEqual(['hand', 'nut']);
    expect(uncoveredClasses({})).toEqual([]);
  });

  it('counts the pairs the prior classified and the pairs that fell back', () => {
    expect(relationSources(frame)).toEqual({ prior: 1, fallback: 3 });
    expect(relationSources({ ...frame, relations: [] })).toEqual({ prior: 0, fallback: 0 });
  });

  it('tells a fallback over an unmapped class from a mapped pair the prior never saw', () => {
    expect(fallbackCauses(frame, classMap)).toEqual({ unmapped: 2, unseen: 1, classes: ['remote'] });
    // A label the map does not list is as unmapped as one it maps to null.
    expect(fallbackCauses(frame, { person: 'person', book: 'book' }).unmapped).toBe(2);
  });
});

describe('where a box\'s badge sits', () => {
  const badge = { w: 100, h: 80 };
  const W = 1280;

  it('sits above a lone box, from its left corner, and never inside it', () => {
    expect(badgePlaces([{ x: 200, y: 300, w: 50 }], W, badge)).toEqual([{ side: 'above', left: 200 }]);
    expect(badgePlaces([], W, badge)).toEqual([]);
  });

  it('sits above and to the left where above would cross the right edge', () => {
    expect(badgePlaces([{ x: 1200, y: 300, w: 50 }], W, badge)).toEqual([{ side: 'above-left', left: 1100 }]);
  });

  it('moves one of two close badges to the left rather than overlap them', () => {
    // 090's person and donut: corners 32 px apart, less than a badge.
    expect(badgePlaces([{ x: 1005, y: 347, w: 30 }, { x: 1037, y: 349, w: 30 }], W, badge)).toEqual([
      { side: 'above-left', left: 905 }, { side: 'above', left: 1037 },
    ]);
    // Far enough apart, neither moves.
    expect(badgePlaces([{ x: 100, y: 300, w: 50 }, { x: 400, y: 300, w: 50 }], W, badge)).toEqual([
      { side: 'above', left: 100 }, { side: 'above', left: 400 },
    ]);
  });

  it('ends a badge at its box\'s right edge where both boxes start at the frame\'s left edge', () => {
    // 092's two persons, both at x = 0: neither can go left, so the second ends at its right edge.
    expect(badgePlaces([{ x: 0, y: 69, w: 972 }, { x: 0, y: 129, w: 376 }], W, badge)).toEqual([
      { side: 'above', left: 0 }, { side: 'above-end', left: 276 },
    ]);
  });

  it('slides the later badge right past the one it still overlaps', () => {
    // Three boxes on one corner: no choice of sides keeps three badges apart, so the second slides.
    const three = [0, 1, 2].map(() => ({ x: 500, y: 300, w: 10 }));
    expect(badgePlaces(three, W, badge)).toEqual([
      { side: 'above', left: 500 }, { side: 'above', left: 600 }, { side: 'above-left', left: 400 },
    ]);
  });

  it('slides left instead where the right edge leaves no room', () => {
    const three = [0, 1, 2].map(() => ({ x: 1170, y: 300, w: 10 }));
    expect(badgePlaces(three, W, badge)).toEqual([
      { side: 'above', left: 1170 }, { side: 'above', left: 1070 }, { side: 'above-left', left: 970 },
    ]);
  });

  it('takes the first side that fits past BADGE_SEARCH_MAX boxes', () => {
    // One row each, so the slide has nothing to do.
    const many = Array.from(
      { length: BADGE_SEARCH_MAX + 1 },
      (_, i) => ({ x: i === 0 ? 1250 : 10 * i, y: 100 * (i + 1), w: 10 }),
    );
    expect(badgePlaces(many, W, badge)).toEqual(
      many.map((b, i) => (i === 0 ? { side: 'above-left', left: 1150 } : { side: 'above', left: b.x })),
    );
  });
});

describe("D-T's triplets", () => {
  it('names each relation by its two detections\' COCO labels, one row per relation', () => {
    const box = { x: 0, y: 0, w: 1, h: 1 };
    const frame: TraditionalFrame = {
      image_id: 'f', t: 90, keyframe: true, width: 10, height: 10,
      detections: [
        { object_id: 0, label: 'person', score: 0.9, bbox: box },
        { object_id: 1, label: 'book', score: 0.8, bbox: box },
        { object_id: 2, label: 'person', score: 0.7, bbox: box },
      ],
      relations: [
        { subject_id: 0, object_id: 1, predicate: 'on', from: 'fallback' },
        { subject_id: 2, object_id: 1, predicate: 'on', from: 'fallback' },
        { subject_id: 1, object_id: 0, predicate: 'near', from: 'prior' },
      ],
    };
    expect(traditionalTriplets(frame)).toEqual([
      ['person', 'on', 'book'], ['person', 'on', 'book'], ['book', 'near', 'person'],
    ]);
  });
});
