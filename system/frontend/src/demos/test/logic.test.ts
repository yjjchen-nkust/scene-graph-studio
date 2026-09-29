import { describe, expect, it } from 'vitest';
import type { Triplet, TraditionalFrame } from '../data';
import {
  candidateTriplets,
  churn,
  churnFraction,
  distinct,
  orderedPairs,
  outsideVocabulary,
  predicateHistogram,
  revisionDiff,
  traditionalTriplets,
  tripletKey,
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
