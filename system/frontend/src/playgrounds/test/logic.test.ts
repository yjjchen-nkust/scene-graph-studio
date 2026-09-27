import { describe, expect, it } from 'vitest';
import type { SceneGraph } from 'sgg-metrics';
import { boxIou } from 'sgg-metrics';
import golden from '../../../../../data/content/playground_golden.json';
import { FRAMES, SLICE_CLASS_COUNT, frameById } from '../slice';
import { RELEASES, type Release, type Split } from '../splits';
import { E1_FRAME, E1_RELATIONSHIP } from '../E1/setup';
import { F3_FRAME, F3_OBJECT } from '../F3/setup';
import {
  annotatedTriplet, area, candidateSpace, conjuncts, failureMode, frameVerdict, hypothesisSpace, iouCounts,
  canonical, clamp, classCounts, densityCut, explain, flag, formatRatio, harmonic,
  headShare, intersection, isInE, isInMergedE, measuredHeadShare, mergeMap, pairsWithSeveral, predicateLabels,
  ranked, ratio, scaleBound, scaledBox, snap, splitDifference, tailToHead, tripletKey, truncatedRatio, unionArea,
  valPool, wholePixelBoxes, withDefects,
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

// A frame with chosen edges, built from a real one so every required field is present and
// nothing is cast: the construction the reversed-triplet test above already uses. `tsc -b`
// type-checks this file, since `tsconfig.app.json` includes all of `src`.
const graph = (rels: [number, string, number][]): SceneGraph => ({
  ...ph001,
  relationships: rels.map(([subject_id, predicate, object_id], relationship_id) => ({
    ...ph001.relationships[0]!,
    relationship_id,
    subject_id,
    predicate,
    object_id,
  })),
});

describe('F6: merging classes', () => {
  it('maps every member of a group to its first member, and nothing else', () => {
    const m = mergeMap([['on', 'above', 'over']]);
    expect(canonical('above', m)).toBe('on');
    expect(canonical('on', m)).toBe('on');
    expect(canonical('near', m)).toBe('near');
  });

  it('counts classes before and after a merge', () => {
    const labels = ['on', 'above', 'on', 'near', 'over'];
    expect(classCounts(labels, new Map()).size).toBe(4);
    const merged = classCounts(labels, mergeMap([['on', 'above', 'over']]));
    expect(merged.size).toBe(2);
    expect(merged.get('on')).toBe(4);
  });

  it('a group member absent from the vocabulary adds no class', () => {
    expect(classCounts(['on', 'near'], mergeMap([['on', 'sitting on']])).size).toBe(2);
  });

  it('merged membership: absent before, present after, and direction still counts', () => {
    const g = graph([[1, 'sitting on', 2]]);
    const t = { subject_id: 1, predicate: 'on', object_id: 2 };
    expect(isInMergedE(g, t, new Map())).toBe(false);
    expect(isInMergedE(g, t, mergeMap([['on', 'sitting on']]))).toBe(true);
    expect(isInMergedE(g, { ...t, subject_id: 2, object_id: 1 }, mergeMap([['on', 'sitting on']]))).toBe(false);
  });
});

describe('predicate labels: E is a set', () => {
  it('counts a triplet a frame annotates twice once, and the reversed pair on its own', () => {
    const g = graph([[1, 'on', 2], [1, 'on', 2], [2, 'on', 1]]);
    expect(predicateLabels([g])).toEqual(['on', 'on']);
  });

  it('counts the same ids in two frames twice, since they are two scenes', () => {
    const g = graph([[1, 'on', 2]]);
    expect(predicateLabels([g, g])).toEqual(['on', 'on']);
  });

  it('counts the pairs that carry more than one member of a group, once each', () => {
    // Three members on one pair make one pair, where the rows a merge removes are two.
    const g = graph([[1, 'on', 2], [1, 'above', 2], [1, 'over', 2], [3, 'on', 4], [3, 'on', 4], [5, 'near', 6]]);
    expect(pairsWithSeveral([g], ['on', 'above', 'over'])).toBe(1);
    expect(pairsWithSeveral([g, g], ['on', 'above', 'over'])).toBe(2);
    expect(pairsWithSeveral([g], ['near', 'by'])).toBe(0);
  });

  it('merges before it counts: two members on one pair are one triplet of E′', () => {
    const g = graph([[1, 'on', 2], [1, 'sitting on', 2], [3, 'sitting on', 4]]);
    expect(predicateLabels([g])).toEqual(['on', 'sitting on', 'sitting on']);
    expect(predicateLabels([g], mergeMap([['on', 'sitting on']]))).toEqual(['on', 'on']);
  });
});

describe('F7: the shape of a Zipf distribution', () => {
  it('H_4 at s = 1 is 25/12', () => {
    expect(harmonic(4, 1)).toBeCloseTo(25 / 12, 12);
  });

  it('the head share is k/C exactly when s = 0', () => {
    expect(headShare(3, 36, 0)).toBeCloseTo(3 / 36, 12);
  });

  it('one class of four at s = 1 holds 12/25', () => {
    expect(headShare(1, 4, 1)).toBeCloseTo(12 / 25, 12);
    expect(tailToHead(4, 1)).toBeCloseTo(0.25, 12);
  });

  it('clamps k into [1, C] and rounds C, so the share stays in (0, 1]', () => {
    expect(headShare(0, 4, 0)).toBeCloseTo(1 / 4, 12);
    expect(headShare(9, 4, 1)).toBe(1);
    expect(headShare(2, 3.6, 0)).toBeCloseTo(2 / 4, 12);
    expect(Number.isNaN(headShare(Number.NaN, 4, 1))).toBe(false);
  });

  it('ranks by count, ties by label, and measures the head share of the ranking', () => {
    const rank = ranked(['b', 'a', 'a', 'c', 'b', 'a']);
    expect(rank).toEqual([
      { label: 'a', count: 3 }, { label: 'b', count: 2 }, { label: 'c', count: 1 },
    ]);
    expect(measuredHeadShare(rank, 2)).toBeCloseTo(5 / 6, 12);
    expect(measuredHeadShare([], 2)).toBe(0);
  });
});

const release = (id: string, train: number | string | null, notes: { value: number; split: Split; text_en: string }[] = []): Release => {
  const cite = { source: 's', url: 'u', locator: 'l', quote: 'q' };
  return {
    id, label_en: id, label_zh: id,
    figures: { train: { value: train, ...cite }, val_from: { value: id === 'leaky' ? 'test' : 'trainval', ...cite } },
    notes: notes.map((n) => ({ ...cite, text_zh: n.text_en, ...n })),
  };
};

describe('X1: differences between releases', () => {
  it('subtracts only two stated counts', () => {
    expect(splitDifference(release('a', 68538), release('b', 57723), 'train')).toBe(10815);
    expect(splitDifference(release('xu', '70%'), release('b', 57723), 'train')).toBeNull();
    expect(splitDifference(release('xu', null), release('b', 57723), 'train')).toBeNull();
  });

  it('finds the note a difference equals, in either direction', () => {
    const a = release('a', 68538, [{ value: 10815, split: 'train', text_en: 'kept' }]);
    const b = release('b', 57723);
    expect(explain(10815, 'train', [a, b])?.text_en).toBe('kept');
    expect(explain(-10815, 'train', [b, a])?.text_en).toBe('kept');
    expect(explain(586, 'train', [a, b])).toBeUndefined();
  });

  it('a note explains only the split it is about, whatever the magnitude', () => {
    const a = release('a', 68538, [{ value: 10815, split: 'train', text_en: 'kept' }]);
    expect(explain(10815, 'test', [a, a])).toBeUndefined();
  });

  it('a zero difference claims no explanation, even when a note has value zero', () => {
    const a = release('a', 5000, [{ value: 0, split: 'train', text_en: 'zero' }]);
    expect(explain(0, 'train', [a, a])).toBeUndefined();
  });

  it('every note of the release file explains the difference of some pair on its own split', () => {
    // A note tagged with the wrong split would explain nothing, and X1 would show its difference
    // as one no sentence states.
    for (const owner of RELEASES) {
      for (const note of owner.notes) {
        const reached = RELEASES.some((other) => {
          const d = splitDifference(owner, other, note.split);
          return d !== null && explain(d, note.split, [owner, other]) === note;
        });
        expect(reached, `${owner.id} ${note.value}`).toBe(true);
      }
    }
  });

  it('names the pool validation was drawn from, and says nothing it was not told', () => {
    // v1's validation and test partition one pool (27,032 + 4,844 = 31,876), so "not disjoint"
    // would be a claim no source makes; the pool is what the card states.
    expect(valPool(release('a', 1))).toBe('trainval');
    expect(valPool(release('leaky', 1))).toBe('test');
    const unstated = release('x', 1);
    unstated.figures.val_from = { value: null, source: 's', url: 'u', locator: 'l', quote: 'q' };
    expect(valPool(unstated)).toBeNull();
  });
});

describe('F3: one box against its annotation', () => {
  const GT = frameById(F3_FRAME)!.objects.find((o) => o.object_id === F3_OBJECT)!.bbox;

  it('reads the annotated box it is built on', () => {
    expect(GT).toEqual({ x: 250, y: 240, w: 90, h: 70 });
  });

  it('scales about the centre and rounds to whole pixels', () => {
    expect(scaledBox(GT, 0, 0, 1.4)).toEqual({ x: 232, y: 226, w: 126, h: 98 });
    expect(scaledBox(GT, 0, 0, 1.5)).toEqual({ x: 228, y: 223, w: 135, h: 105 });
    expect(scaledBox(GT, 0, 0, 0.5)).toEqual({ x: 273, y: 258, w: 45, h: 35 });
  });

  it('counts the intersection and the union in pixels', () => {
    const p = scaledBox(GT, 18, 0, 1);
    expect(intersection(GT, p)).toEqual({ x: 268, y: 240, w: 72, h: 70 });
    expect(unionArea(GT, p)).toBe(7560);
  });

  it('shares no pixel with a box whose edge only touches it', () => {
    // Half-open boxes, as sgg-metrics' boxIou and backend/app/eval/iou.py treat them.
    expect(intersection(GT, scaledBox(GT, 90, 0, 1))).toBeNull();
  });

  it('bounds IoU by the ratio of the two areas', () => {
    expect(scaleBound(GT, scaledBox(GT, 0, 0, 1.5))).toBeCloseTo(6300 / 14175, 12);
  });

  it('never lets IoU exceed the bound, on or off the λ grid', () => {
    // 1.45 and 0.73 are what a hand-typed URL can carry: the sizes round to whole pixels and
    // the bound is taken from those rounded areas, so the two readouts cannot contradict.
    for (const lambda of [0.5, 0.73, 1, 1.4, 1.45, 1.5, 2]) {
      for (const dx of [-120, -30, 0, 30, 120]) {
        for (const dy of [-100, 0, 100]) {
          const p = scaledBox(GT, dx, dy, lambda);
          const i = intersection(GT, p);
          const iou = ratio(i ? area(i) : 0, unionArea(GT, p));
          expect(iou).toBeLessThanOrEqual(scaleBound(GT, p) + 1e-12);
        }
      }
    }
  });

  it('keeps the prediction inside the photograph at every extreme of the knobs', () => {
    for (const dx of [-120, 120]) {
      for (const dy of [-100, 100]) {
        const p = scaledBox(GT, dx, dy, 2);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(640);
        expect(p.y + p.h).toBeLessThanOrEqual(480);
      }
    }
  });
});

describe('snap', () => {
  it('clamps to the range and lands on the step, as the slider thumb does', () => {
    expect(snap(-999, -120, 120, 2)).toBe(-120);
    expect(snap(31, -120, 120, 2)).toBe(32);
    expect(snap(1.45, 0.5, 2, 0.1)).toBe(1.5);
    expect(snap(9, 0.5, 2, 0.1)).toBe(2);
    expect(snap(Number.NaN, 0.05, 0.95, 0.05)).toBe(0.05);
  });

  it('lands exactly on the decimal, so IoU = 0.5 still meets τ = 0.5', () => {
    // 10 x 0.05 in binary floating point is not guaranteed to be the double nearest 0.5; a τ one
    // ulp above 0.5 would turn the at-threshold case into a rejection.
    expect(snap(0.5000000001, 0.05, 0.95, 0.05)).toBe(0.5);
    expect(snap(0.55, 0.05, 0.95, 0.05)).toBe(0.55);
    expect(snap(1.4000000000000001, 0.5, 2, 0.1)).toBe(1.4);
  });
});

describe('F3 against the engine', () => {
  it("F3's IoU equals the engine's boxIou on every golden case", () => {
    // The one value import from sgg-metrics under playgrounds/: F3 counts pixels itself so the
    // screen can show both counts, and this holds its quotient to the engine's, which
    // lint:parity holds to backend/app/eval/iou.py.
    const cases = (golden as unknown as { cases: { kp: string; image_id?: string; knobs: Record<string, number> }[] }).cases
      .filter((c) => c.kp === 'F3');
    expect(cases).toHaveLength(8);
    for (const c of cases) {
      const gt = frameById(c.image_id!)!.objects.find((o) => o.object_id === F3_OBJECT)!.bbox;
      const p = scaledBox(gt, c.knobs.dx!, c.knobs.dy!, c.knobs.lambda!);
      const shared = intersection(gt, p);
      expect(ratio(shared ? area(shared) : 0, unionArea(gt, p))).toBeCloseTo(boxIou(gt, p), 12);
    }
  });
});

describe('truncatedRatio', () => {
  it('cuts to three places rather than rounding, so a printed value never overstates the quotient', () => {
    expect(truncatedRatio(3800, 7603)).toBe('0.499');
    expect(truncatedRatio(5040, 7560)).toBe('0.666');
    expect(truncatedRatio(4200, 8400)).toBe('0.500');
    expect(truncatedRatio(6300, 6300)).toBe('1.000');
    expect(truncatedRatio(0, 12600)).toBe('0.000');
    expect(truncatedRatio(0, 0)).toBe('0.000');
  });

  it('says a share below 0.001 is below it, rather than printing zero over a visible sliver', () => {
    expect(truncatedRatio(1, 2000)).toBe('< 0.001');
  });

  it('agrees with the membership beside it at every τ on the slider', () => {
    const GT = frameById(F3_FRAME)!.objects.find((o) => o.object_id === F3_OBJECT)!.bbox;
    const taus = Array.from({ length: 19 }, (_, i) => Number((0.05 * (i + 1)).toFixed(2)));
    const disagree: string[] = [];
    for (let l = 5; l <= 20; l++) {
      for (let dx = -120; dx <= 120; dx += 10) {
        for (let dy = -100; dy <= 100; dy += 2) {
          const p = scaledBox(GT, dx, dy, l / 10);
          const shared = intersection(GT, p);
          const inter = shared ? area(shared) : 0;
          const union = unionArea(GT, p);
          const printed = truncatedRatio(inter, union);
          const shown = printed.startsWith('<') ? 0 : Number(printed);
          for (const tau of taus) {
            if (shown >= tau !== ratio(inter, union) >= tau) {
              disagree.push(`λ ${l / 10} (${dx}, ${dy}) τ ${tau}: ${printed}`);
            }
          }
        }
      }
    }
    // One assertion over the walk rather than 767,676 of them, which ran past vitest's five
    // seconds under the full suite.
    expect(disagree).toEqual([]);
  });
});

describe('E1: one defect at a time', () => {
  const frame = frameById(E1_FRAME)!;
  const t = annotatedTriplet(frame, E1_RELATIONSHIP);
  const none = { cs: false, co: false, p: false, bs: false, bo: false };

  it('reads box#3 on table#1', () => {
    expect(t).toEqual({
      subject: { name: 'box', box: { x: 250, y: 240, w: 90, h: 70 } },
      predicate: 'on',
      object: { name: 'table', box: { x: 60, y: 300, w: 420, h: 110 } },
    });
  });

  it('each defect falsifies exactly its own conjunct', () => {
    const keys = [['cs', 'cs'], ['co', 'co'], ['p', 'p'], ['bs', 'is'], ['bo', 'io']] as const;
    for (const [defect, conj] of keys) {
      const c = conjuncts(withDefects(t, { ...none, [defect]: true }), t, 0.5);
      expect(Object.entries(c).filter(([, v]) => !v).map(([k]) => k), defect).toEqual([conj]);
    }
  });

  it('the shifted boxes keep a third of their overlap', () => {
    expect(iouCounts(t.subject.box, withDefects(t, { ...none, bs: true }).subject.box)).toEqual([3150, 9450]);
    expect(iouCounts(t.object.box, withDefects(t, { ...none, bo: true }).object.box)).toEqual([23100, 69300]);
  });

  it('names the failure as s2 does', () => {
    expect(failureMode(conjuncts(withDefects(t, none), t, 0.5))).toBe('none');
    expect(failureMode(conjuncts(withDefects(t, { ...none, p: true }), t, 0.5))).toBe('name');
    expect(failureMode(conjuncts(withDefects(t, { ...none, bs: true }), t, 0.5))).toBe('place');
    expect(failureMode(conjuncts(withDefects(t, { ...none, p: true, bo: true }), t, 0.5))).toBe('both');
  });

  it('gives a wrong name spurious wherever its box sits', () => {
    expect(frameVerdict(withDefects(t, { ...none, cs: true }), frame, 0.5)).toBe('spurious');
    expect(frameVerdict(withDefects(t, { ...none, cs: true, bs: true }), frame, 0.5)).toBe('spurious');
    expect(frameVerdict(withDefects(t, { ...none, bs: true, bo: true }), frame, 0.5)).toBe('localization');
    expect(frameVerdict(withDefects(t, none), frame, 0.5)).toBe('match');
  });
});

describe('E10: what each protocol leaves to search', () => {
  const B = wholePixelBoxes(640, 480);

  it('counts whole-pixel boxes in 640 x 480', () => {
    expect(B).toBe(205120n * 115440n);
    expect(B).toBe(23679052800n);
  });

  it("counts one triplet's hypotheses per protocol, exactly", () => {
    expect(hypothesisSpace('predcls', 6, 10, 16, B)).toBe(480n);
    expect(hypothesisSpace('sgcls', 6, 10, 16, B)).toBe(48000n);
    expect(hypothesisSpace('sgdet', 6, 10, 16, B).toLocaleString('en-US')).toBe('897,116,066,370,414,059,520,000');
    expect(hypothesisSpace('predcls', 6, 150, 50, B)).toBe(1500n);
    expect(hypothesisSpace('sgcls', 6, 150, 50, B)).toBe(33750000n);
    expect(hypothesisSpace('sgdet', 6, 150, 50, B).toLocaleString('en-US')).toBe('630,784,734,166,697,385,600,000,000');
  });

  it('orders the three by inclusion, on either vocabulary', () => {
    for (const [c, p] of [[10, 16], [150, 50]] as const) {
      const [a, b, d] = (['predcls', 'sgcls', 'sgdet'] as const).map((pr) => hypothesisSpace(pr, 6, c, p, B));
      expect(a! < b! && b! < d!).toBe(true);
    }
  });

  it("counts the slice's own classes", () => {
    expect(SLICE_CLASS_COUNT).toBe(10);
  });
});
