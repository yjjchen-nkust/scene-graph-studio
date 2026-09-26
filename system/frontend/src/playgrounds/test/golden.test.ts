import { describe, expect, it } from 'vitest';
import golden from '../../../../../data/content/playground_golden.json';
import { OBJECT_GROUP, PREDICATE_GROUP } from '../F6/groups';
import {
  candidateSpace, classCounts, densityCut, explain, headShare, isInE, isInMergedE, measuredHeadShare, mergeMap,
  objectLabels, predicateLabels, ranked, ratio, splitDifference, tailToHead,
} from '../logic';
import { VG_FRAMES, frameById, vgFrameById } from '../slice';
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
  F2: (c) => c.kp === 'F2',
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
    const labels = predicates ? predicateLabels(VG_FRAMES) : objectLabels(VG_FRAMES);
    const counts = classCounts(labels, c.knobs.merged ? mergeMap([group]) : new Map());
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

  it.each(run('X1'))('$id', (c) => {
    const a = releaseById(c.knobs.r as string)!;
    const b = releaseById(c.knobs.vs as string)!;
    const d = splitDifference(a, b, c.knobs.split as Split);
    expect(d).toBe(c.expect.difference);
    expect(d === null ? null : explain(d, c.knobs.split as Split, [a, b])?.value ?? null).toBe(c.expect.explained_by);
  });
});
