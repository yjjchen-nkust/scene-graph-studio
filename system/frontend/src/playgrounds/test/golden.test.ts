import { describe, expect, it } from 'vitest';
import golden from '../../../../../data/content/playground_golden.json';
import { VG150_CLASSES, VG150_PREDICATES } from '../E10/setup';
import { E1_DEFECTS, E1_RELATIONSHIP } from '../E1/setup';
import { F3_FRAME, F3_OBJECT } from '../F3/setup';
import { OBJECT_GROUP, PREDICATE_GROUP } from '../F6/groups';
import {
  annotatedTriplet, area, candidateSpace, classCounts, conjuncts, failureMode, frameVerdict, hypothesisSpace, iouCounts,
  densityCut, explain, headShare, intersection, isInE, isInMergedE, measuredHeadShare, mergeMap,
  objectLabels, predicateLabels, ranked, ratio, scaleBound, scaledBox, splitDifference, tailToHead, unionArea,
  wholePixelBoxes, withDefects, type Protocol,
} from '../logic';
import { SLICE_CLASS_COUNT, SLICE_PREDICATE_COUNT, VG_FRAMES, frameById, vgFrameById } from '../slice';
import { releaseById, type Split } from '../splits';

interface Case {
  id: string;
  kp: string;
  image_id?: string;
  scope?: 'slice' | 'model' | 'sources';
  knobs: Record<string, number | boolean | string>;
  expect: Record<string, number | boolean | string | null>;
  why: string;
}

const cases = (golden as unknown as { cases: Case[] }).cases;

/**
 * Which cases each block below runs. Rule 9 accepts a case these select none of (an F6 case with
 * a model scope, an F7 case with a frame), and such a case would pass by running no assertion.
 */
const RUNS: Record<string, (c: Case) => boolean> = {
  F1: (c) => c.kp === 'F1',
  E1: (c) => c.kp === 'E1',
  E10: (c) => c.kp === 'E10',
  F2: (c) => c.kp === 'F2',
  F3: (c) => c.kp === 'F3',
  F8: (c) => c.kp === 'F8',
  'F6 slice': (c) => c.kp === 'F6' && c.scope === 'slice',
  'F6 frame': (c) => c.kp === 'F6' && Boolean(c.image_id),
  'F7 model': (c) => c.kp === 'F7' && c.scope === 'model',
  'F7 slice': (c) => c.kp === 'F7' && c.scope === 'slice',
  X1: (c) => c.kp === 'X1',
};
const run = (block: string) => cases.filter(RUNS[block]!);

describe('playground golden cases', () => {
  it('every case writes out its arithmetic', () => {
    for (const c of cases) {
      expect(c.why, c.id).toBeTruthy();
      expect(c.why.length, c.id).toBeGreaterThan(40);
    }
  });

  it('every case is run by exactly one block', () => {
    for (const c of cases) {
      const by = Object.keys(RUNS).filter((block) => RUNS[block]!(c));
      expect(by, c.id).toHaveLength(1);
    }
  });

  it.each(run('F1'))('$id', (c) => {
    const frame = frameById(c.image_id!)!;
    const kept = densityCut(frame.relationships, c.knobs.density as number);
    const candidates = candidateSpace(
      frame.objects.length,
      c.knobs.predicate_count as number,
      true,
    );
    expect(frame.objects).toHaveLength(c.expect.objects as number);
    expect(kept).toHaveLength(c.expect.annotated as number);
    expect(candidates).toBe(c.expect.candidates);
    expect(ratio(kept.length, candidates)).toBeCloseTo(c.expect.ratio as number, 6);
  });

  it.each(run('F2'))('$id', (c) => {
    const frame = frameById(c.image_id!)!;
    expect(
      candidateSpace(
        frame.objects.length,
        c.knobs.predicate_count as number,
        c.knobs.directed as boolean,
      ),
    ).toBe(c.expect.candidates);
  });

  it("pins all eight of F3's cases, so its block cannot pass by running none", () => {
    expect(run('F3')).toHaveLength(8);
  });

  it.each(run('F3'))('$id', (c) => {
    const gt = frameById(c.image_id!)!.objects.find((o) => o.object_id === F3_OBJECT)!.bbox;
    const p = scaledBox(gt, c.knobs.dx as number, c.knobs.dy as number, c.knobs.lambda as number);
    const shared = intersection(gt, p);
    const inter = shared ? area(shared) : 0;
    const union = unionArea(gt, p);
    const iou = ratio(inter, union);
    const bound = scaleBound(gt, p);
    expect(c.image_id).toBe(F3_FRAME);
    expect(inter).toBe(c.expect.intersection);
    expect(union).toBe(c.expect.union);
    expect(iou).toBeCloseTo(c.expect.iou as number, 6);
    expect(bound).toBeCloseTo(c.expect.bound as number, 6);
    expect(iou >= (c.knobs.tau as number)).toBe(c.expect.member);
    expect(bound < (c.knobs.tau as number)).toBe(c.expect.unreachable);
  });

  it.each(run('F8'))('$id', (c) => {
    const frame = frameById(c.image_id!)!;
    const rel = frame.relationships.find((r) => r.relationship_id === c.knobs.relationship_id)!;
    const swapped = c.knobs.swapped as boolean;
    expect(
      isInE(frame, {
        subject_id: swapped ? rel.object_id : rel.subject_id,
        predicate: rel.predicate,
        object_id: swapped ? rel.subject_id : rel.object_id,
      }),
    ).toBe(c.expect.recorded);
  });

  it.each(run('F6 slice'))('$id', (c) => {
    const predicates = c.knobs.group === 'predicates';
    const group = predicates ? PREDICATE_GROUP : OBJECT_GROUP;
    const merge = c.knobs.merged ? mergeMap([group]) : new Map<string, string>();
    // Predicates count distinct triplets, merged before counting; object names count objects.
    const counts = predicates
      ? classCounts(predicateLabels(VG_FRAMES, merge), new Map())
      : classCounts(objectLabels(VG_FRAMES), merge);
    expect(counts.size).toBe(c.expect.classes);
    expect(counts.get(group[0]!)).toBe(c.expect.group_count);
  });

  it.each(run('F6 frame'))('$id', (c) => {
    const frame = vgFrameById(c.image_id!)!;
    const rel = frame.relationships.find((r) => r.relationship_id === c.knobs.relationship_id)!;
    expect(rel.predicate).toBe(c.expect.annotated_predicate);
    const triplet = { subject_id: rel.subject_id, predicate: c.knobs.substitute as string, object_id: rel.object_id };
    const merge = c.knobs.merged ? mergeMap([PREDICATE_GROUP]) : new Map<string, string>();
    expect(isInMergedE(frame, triplet, merge)).toBe(c.expect.recorded);
  });

  it.each(run('F7 model'))('$id', (c) => {
    const { s, C, k } = c.knobs as { s: number; C: number; k: number };
    expect(headShare(k, C, s)).toBeCloseTo(c.expect.head_share as number, 6);
    expect(tailToHead(C, s)).toBeCloseTo(c.expect.tail_to_head as number, 6);
  });

  it.each(run('F7 slice'))('$id', (c) => {
    const rank = ranked(predicateLabels(VG_FRAMES));
    expect(measuredHeadShare(rank, c.knobs.k as number)).toBeCloseTo(c.expect.head_share as number, 6);
  });

  it('pins all six of E1\'s cases and all six of E10\'s, so neither block passes by running none', () => {
    expect(run('E1')).toHaveLength(6);
    expect(run('E10')).toHaveLength(6);
  });

  it.each(run('E1'))('$id', (c) => {
    const frame = frameById(c.image_id!)!;
    const t = annotatedTriplet(frame, E1_RELATIONSHIP);
    const pred = withDefects(t, {
      cs: c.knobs.cs as boolean, co: c.knobs.co as boolean, p: c.knobs.p as boolean,
      bs: c.knobs.bs as boolean, bo: c.knobs.bo as boolean,
    }, E1_DEFECTS);
    const [isShared, isUnion] = iouCounts(pred.subject.box, t.subject.box);
    const [ioShared, ioUnion] = iouCounts(pred.object.box, t.object.box);
    const holds = conjuncts(pred, t, 0.5);
    expect([isShared, isUnion, ioShared, ioUnion]).toEqual([
      c.expect.is_shared, c.expect.is_union, c.expect.io_shared, c.expect.io_union,
    ]);
    expect(Object.values(holds).every(Boolean)).toBe(c.expect.relation);
    expect(failureMode(holds)).toBe(c.expect.mode);
    expect(frameVerdict(pred, frame, 0.5)).toBe(c.expect.verdict);
  });

  it.each(run('E10'))('$id', (c) => {
    const frame = frameById(c.image_id!)!;
    const vg = c.knobs.vocabulary === 'vg150';
    const count = hypothesisSpace(
      c.knobs.protocol as Protocol,
      frame.objects.length,
      vg ? VG150_CLASSES : SLICE_CLASS_COUNT,
      vg ? VG150_PREDICATES : SLICE_PREDICATE_COUNT,
      wholePixelBoxes(frame.width, frame.height),
    );
    // A decimal string, since the SGDet counts exceed 2^53 and JSON has no bigint.
    expect(count.toString()).toBe(c.expect.count);
  });

  it.each(run('X1'))('$id', (c) => {
    const a = releaseById(c.knobs.r as string)!;
    const b = releaseById(c.knobs.vs as string)!;
    const d = splitDifference(a, b, c.knobs.split as Split);
    expect(d).toBe(c.expect.difference);
    expect(d === null ? null : explain(d, c.knobs.split as Split, [a, b])?.value ?? null).toBe(c.expect.explained_by);
  });
});
