import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SceneGraph } from 'sgg-metrics';
import { applyConstraint, applyPairing, boxIou, classify, encodeCounts, evaluate, rank, toTriplets } from 'sgg-metrics';
import golden from '../../../../../data/content/playground_golden.json';
import { FRAMES, SLICE_CLASS_COUNT, frameById } from '../slice';
import { RELEASES, type Release, type Split } from '../splits';
import { E1_DEFECTS, E1_FRAME, E1_RELATIONSHIP } from '../E1/setup';
import { F3_FRAME, F3_OBJECT, F3_RANGES } from '../F3/setup';
import { M4_CAPS, M4_FRAME, M4_K_MAX, M4_RANKING } from '../M4/ranking';
import { VRD_PREDICATES, e13Copies } from '../E13/setup';
import {
  admitByMask, annotatedTriplet, area, byScore, candidateSpace, capPerPair, conjuncts, failureMode, frameVerdict,
  hypothesisSpace, iouCounts, canonical, clamp, classCounts, densityCut, explain, flag, formatRatio, harmonic,
  headShare, idRun, intersection, isInE, isInMergedE, matchedByMask, matchedRanks, matchedTruths, measuredHeadShare, mergeMap,
  pairsWithSeveral, predicateLabels, ranked, ratio, scaleBound, scaledBox, snap, splitDifference, tailToHead, topK,
  tripletKey, truncatedRatio, unionArea, valPool, wholePixelBoxes, withDefects, type BoxTriplet,
} from '../logic';

/** The engine's triplet, which `sgg-metrics` does not export by name. */
type Triplet = Parameters<typeof classify>[0];

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

  it("F3's IoU equals the engine's boxIou at every setting of the three placement knobs", () => {
    // 121 values of dx, 101 of dy and 16 of λ: 195,536 placements, every disagreement reported once.
    const gt = frameById(F3_FRAME)!.objects.find((o) => o.object_id === F3_OBJECT)!.bbox;
    const values = ([min, max, step]: readonly [number, number, number]) =>
      Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => snap(min + i * step, min, max, step));
    const disagreements: string[] = [];
    let placements = 0;
    for (const dx of values(F3_RANGES.dx)) {
      for (const dy of values(F3_RANGES.dy)) {
        for (const lambda of values(F3_RANGES.lambda)) {
          const p = scaledBox(gt, dx, dy, lambda);
          const shared = intersection(gt, p);
          const ours = ratio(shared ? area(shared) : 0, unionArea(gt, p));
          if (Math.abs(ours - boxIou(gt, p)) > 1e-12) disagreements.push(`dx ${dx}, dy ${dy}, λ ${lambda}`);
          placements += 1;
        }
      }
    }
    expect(placements).toBe(195_536);
    expect(disagreements).toEqual([]);
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
      const c = conjuncts(withDefects(t, { ...none, [defect]: true }, E1_DEFECTS), t, 0.5);
      expect(Object.entries(c).filter(([, v]) => !v).map(([k]) => k), defect).toEqual([conj]);
    }
  });

  it('injects what the table it is given names', () => {
    const table = {
      subject: 'cup', object: 'shelf', predicate: 'under',
      subjectShift: { dx: 10, dy: 0 }, objectShift: { dx: 0, dy: -5 },
    };
    const p = withDefects(t, { cs: true, co: true, p: true, bs: true, bo: true }, table);
    expect([p.subject.name, p.predicate, p.object.name]).toEqual(['cup', 'under', 'shelf']);
    expect(p.subject.box).toEqual({ ...t.subject.box, x: t.subject.box.x + 10 });
    expect(p.object.box).toEqual({ ...t.object.box, y: t.object.box.y - 5 });
  });

  it('the shared module imports no playground of its own', () => {
    // A path given through a variable: Vite rewrites a literal in new URL(..., import.meta.url).
    const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    expect(source('../logic.ts')).not.toMatch(/from '\.\/[A-Z]\d+\//);
  });

  it('the shifted boxes keep a third of their overlap', () => {
    expect(iouCounts(t.subject.box, withDefects(t, { ...none, bs: true }, E1_DEFECTS).subject.box)).toEqual([3150, 9450]);
    expect(iouCounts(t.object.box, withDefects(t, { ...none, bo: true }, E1_DEFECTS).object.box)).toEqual([23100, 69300]);
  });

  it('names the failure as s2 does', () => {
    expect(failureMode(conjuncts(withDefects(t, none, E1_DEFECTS), t, 0.5))).toBe('none');
    expect(failureMode(conjuncts(withDefects(t, { ...none, p: true }, E1_DEFECTS), t, 0.5))).toBe('name');
    expect(failureMode(conjuncts(withDefects(t, { ...none, bs: true }, E1_DEFECTS), t, 0.5))).toBe('place');
    expect(failureMode(conjuncts(withDefects(t, { ...none, p: true, bo: true }, E1_DEFECTS), t, 0.5))).toBe('both');
  });

  it('gives a wrong name spurious wherever its box sits', () => {
    expect(frameVerdict(withDefects(t, { ...none, cs: true }, E1_DEFECTS), frame, 0.5)).toBe('spurious');
    expect(frameVerdict(withDefects(t, { ...none, cs: true, bs: true }, E1_DEFECTS), frame, 0.5)).toBe('spurious');
    expect(frameVerdict(withDefects(t, { ...none, bs: true, bo: true }, E1_DEFECTS), frame, 0.5)).toBe('localization');
    expect(frameVerdict(withDefects(t, none, E1_DEFECTS), frame, 0.5)).toBe('match');
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

describe('E1 against the engine', () => {
  const frame = frameById(E1_FRAME)!;
  const t = annotatedTriplet(frame, E1_RELATIONSHIP);
  const states = Array.from({ length: 32 }, (_, n) => ({
    cs: Boolean(n & 1), co: Boolean(n & 2), p: Boolean(n & 4), bs: Boolean(n & 8), bo: Boolean(n & 16),
  }));
  const asEngine = (b: BoxTriplet): Triplet => ({
    index: 0,
    relationship_id: 0,
    subject_id: 3,
    object_id: 1,
    subject_name: b.subject.name,
    predicate: b.predicate,
    object_name: b.object.name,
    subject_bbox: b.subject.box,
    object_bbox: b.object.box,
    subject_mask: null,
    object_mask: null,
    score: null,
  });

  it("E1's verdict equals the engine's classify in all 32 toggle states", () => {
    // The one value import from sgg-metrics beside F3's boxIou: E1 restates the engine's rule for
    // one prediction, and this holds the restatement to the rule.
    const gts = toTriplets(frame);
    for (const s of states) {
      const pred = withDefects(t, s, E1_DEFECTS);
      const engine = classify(asEngine(pred), gts, gts.map(() => false), 0.5, false)[0];
      expect(frameVerdict(pred, frame, 0.5), JSON.stringify(s)).toBe(engine);
    }
  });

  it('no toggle state names another annotated triplet of ph-001', () => {
    const annotated = new Set(toTriplets(frame).map((g) => `${g.subject_name}|${g.predicate}|${g.object_name}`));
    const named = new Set(states.map((s) => withDefects(t, s, E1_DEFECTS)).map((p) => `${p.subject.name}|${p.predicate}|${p.object.name}`));
    expect(named.size).toBe(8);
    expect([...named].filter((k) => annotated.has(k))).toEqual(['box|on|table']);
  });
});

describe('idRun', () => {
  // E10 wrote "boxes #1 to #n" on the assumption that a frame's ids run 1 to n (D102).
  it('gives the first and last id when the ids run without a gap, in any order', () => {
    expect(idRun([1, 2, 3, 4, 5, 6])).toEqual({ first: 1, last: 6 });
    expect(idRun([4, 2, 3])).toEqual({ first: 2, last: 4 });
  });
  it('gives null where a gap or a repeat breaks the run, or there is nothing to run', () => {
    expect(idRun([1, 2, 4])).toBeNull();
    expect(idRun([1, 1, 2])).toBeNull();
    expect(idRun([])).toBeNull();
  });
  it("runs over ph-001's six objects from 1 to 6", () => {
    expect(idRun(ph001.objects.map((o) => o.object_id))).toEqual({ first: 1, last: 6 });
  });
});

describe('M4: one ranked list, capped and cut', () => {
  const frame = frameById(M4_FRAME)!;
  const ranked = byScore(M4_RANKING);
  const counts = (cap: number) => Array.from({ length: 12 }, (_, i) =>
    matchedTruths(topK(capPerPair(ranked, cap), i + 1), frame.relationships).length);
  it('ranks the twelve by score', () => {
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('keeps 7, 11 and 12 under caps 1, 2 and 3 and any cap above', () => {
    expect([1, 2, 3, 10, Infinity].map((c) => capPerPair(ranked, c).length)).toEqual([7, 11, 12, 12, 12]);
  });
  it('counts the ground truths of spec §4.1 at every k', () => {
    expect(counts(1)).toEqual([1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(counts(2)).toEqual([1, 1, 2, 2, 3, 4, 4, 4, 5, 5, 5, 5]);
    expect(counts(3)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5]);
    expect(counts(Infinity)).toEqual(counts(3));
  });
  it('names what it matches', () => {
    expect(matchedTruths(topK(capPerPair(ranked, 1), 2), frame.relationships)).toEqual([1, 4]);
    expect(matchedTruths(topK(capPerPair(ranked, Infinity), 12), frame.relationships)).toEqual([1, 2, 3, 4, 5]);
  });
  it('names the ranks that match, the same rule read the other way round', () => {
    expect(matchedRanks(topK(capPerPair(ranked, 1), 4), frame.relationships)).toEqual(new Set([1, 3, 5]));
    expect(matchedRanks(topK(capPerPair(ranked, Infinity), 12), frame.relationships)).toEqual(new Set([1, 3, 5, 7, 10]));
  });
});

describe('E13: copies of one mask pair', () => {
  const frame = frameById(M4_FRAME)!;
  it('SingleMPO admits one copy, MultiMPO every copy', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(admitByMask(e13Copies(d), false)).toHaveLength(1);
      expect(admitByMask(e13Copies(d), true)).toHaveLength(d);
    }
  });
  it('the graph constraint keeps every admitted copy', () => {
    expect(capPerPair(admitByMask(e13Copies(5), true), 1)).toHaveLength(5);
  });
  it('matches person holding wrench only once the second copy is admitted', () => {
    expect(matchedByMask(admitByMask(e13Copies(5), false), frame.relationships)).toEqual([]);
    expect(matchedByMask(admitByMask(e13Copies(1), true), frame.relationships)).toEqual([]);
    expect(matchedByMask(admitByMask(e13Copies(2), true), frame.relationships)).toEqual([4]);
  });
});

describe('X2: VRD per-pair count on ph-001', () => {
  it('pools 30, 300 and 2,100 candidates', () => {
    expect([1, 10, 70].map((m) => candidateSpace(6, Math.min(m, VRD_PREDICATES), true))).toEqual([30, 300, 2100]);
  });
});

describe('M4 against the engine', () => {
  const frame = frameById(M4_FRAME)!;
  const ranked = byScore(M4_RANKING);
  const ks = Array.from({ length: M4_K_MAX }, (_, i) => i + 1);
  const pred: SceneGraph = {
    ...frame,
    relationships: M4_RANKING.map((r) => ({
      relationship_id: r.rank,
      subject_id: r.subject,
      object_id: r.object,
      predicate: r.predicate,
      score: r.score,
    })),
    provenance: { kind: 'model', fidelity: 'reconstructed', model: 'm4' },
  };

  it('the cap agrees with applyConstraint at every cap from 1 to 10', () => {
    for (let cap = 1; cap <= 10; cap += 1) {
      const engine = applyConstraint(rank(toTriplets(pred)), cap === 1 ? 'graph' : 'semi', cap);
      const ours = capPerPair(ranked, cap);
      expect(engine.map((t) => t.relationship_id)).toEqual(ours.map((r) => r.rank));
    }
    const engineNone = applyConstraint(rank(toTriplets(pred)), 'none', 1);
    const oursNone = capPerPair(ranked, M4_CAPS.none);
    expect(engineNone.map((t) => t.relationship_id)).toEqual(oursNone.map((r) => r.rank));
  });

  it('the counts agree with evaluate at every k and cap', () => {
    const counts = (cap: number) => ks.map((k) =>
      matchedTruths(topK(capPerPair(ranked, cap), k), frame.relationships).length);
    const cases: { cap: number; constraint: 'graph' | 'semi' | 'none'; semiMax: number }[] = [
      { cap: M4_CAPS.graph, constraint: 'graph', semiMax: M4_CAPS.graph },
      { cap: M4_CAPS.semi, constraint: 'semi', semiMax: M4_CAPS.semi },
      { cap: 3, constraint: 'semi', semiMax: 3 },
      { cap: M4_CAPS.none, constraint: 'none', semiMax: 1 },
    ];
    for (const { cap, constraint, semiMax } of cases) {
      const expected = counts(cap);
      const result = evaluate({
        gt: frame,
        pred,
        protocol: 'predcls',
        constraint,
        semi_constraint_max_per_pair: semiMax,
        k: ks,
        iou_thresh: 0.5,
        mask_pairing: 'single_mpo',
      });
      for (const k of ks) {
        const r = result.metrics.find((m) => m.metric === 'R' && m.k === k)!.value!;
        expect(Math.round(r * 6)).toBe(expected[k - 1]);
      }
    }
  });
});

describe('E13 against the engine', () => {
  const frame = frameById(M4_FRAME)!;
  const maskFor = (id: number): { counts: string; size: [number, number] } => ({
    counts: encodeCounts([id, 1, 15 - id]),
    size: [4, 4],
  });
  const gtObjects = frame.objects.map((o) => ({ ...o, mask: maskFor(o.object_id) }));
  const gt: SceneGraph = { ...frame, objects: gtObjects };
  const object2 = gtObjects.find((o) => o.object_id === 2)!;
  const object5 = gtObjects.find((o) => o.object_id === 5)!;

  const predFor = (d: number): SceneGraph => {
    const copies: typeof gtObjects = [];
    for (let i = 2; i <= d; i += 1) {
      copies.push({ ...object2, object_id: 10 + i });
      copies.push({ ...object5, object_id: 20 + i });
    }
    const rows = e13Copies(d);
    return {
      ...frame,
      objects: [...gtObjects, ...copies],
      relationships: rows.map((row, index) => ({
        relationship_id: index + 1,
        subject_id: row.subject,
        object_id: row.object,
        predicate: row.predicate,
        score: row.score,
      })),
      provenance: { kind: 'model', fidelity: 'reconstructed', model: 'm4' },
    };
  };

  it('applyPairing agrees with admitByMask at every d and every mode', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      const pred = predFor(d);
      for (const mode of ['single_mpo', 'multi_mpo'] as const) {
        const engine = applyPairing(rank(toTriplets(pred)), mode);
        const ours = admitByMask(e13Copies(d), mode === 'multi_mpo');
        expect(engine).toHaveLength(ours.length);
      }
    }
  });

  it('matched_count agrees with matchedByMask under the graph constraint', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      const pred = predFor(d);
      for (const mode of ['single_mpo', 'multi_mpo'] as const) {
        const result = evaluate({
          gt,
          pred,
          protocol: 'predcls',
          constraint: 'graph',
          k: [20],
          iou_thresh: 0.5,
          mask_pairing: mode,
        });
        const admitted = admitByMask(e13Copies(d), mode === 'multi_mpo');
        expect(result.matched_count).toBe(matchedByMask(admitted, frame.relationships).length);
      }
    }
  });
});
