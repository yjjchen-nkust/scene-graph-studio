import { describe, expect, it } from 'vitest';
import golden from '../../../../../data/content/playground_golden.json';
import { candidateSpace, densityCut, isInE, ratio } from '../logic';
import { frameById } from '../slice';

interface Case {
  id: string;
  kp: string;
  image_id: string;
  knobs: Record<string, number | boolean>;
  expect: Record<string, number | boolean>;
  why: string;
}

const cases = (golden as unknown as { cases: Case[] }).cases;

describe('playground golden cases', () => {
  it('every case writes out its arithmetic', () => {
    for (const c of cases) {
      expect(c.why, c.id).toBeTruthy();
      expect(c.why.length, c.id).toBeGreaterThan(40);
    }
  });

  it.each(cases.filter((c) => c.kp === 'F1'))('$id', (c) => {
    const frame = frameById(c.image_id)!;
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

  it.each(cases.filter((c) => c.kp === 'F2'))('$id', (c) => {
    const frame = frameById(c.image_id)!;
    expect(
      candidateSpace(
        frame.objects.length,
        c.knobs.predicate_count as number,
        c.knobs.directed as boolean,
      ),
    ).toBe(c.expect.candidates);
  });

  it.each(cases.filter((c) => c.kp === 'F8'))('$id', (c) => {
    const frame = frameById(c.image_id)!;
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
});
