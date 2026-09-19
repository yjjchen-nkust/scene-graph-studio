import { isSceneGraph } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { outOfVocabulary, parse, P_DEFAULT } from '../parse';

describe('the caption parser', () => {
  it('turns nouns into nodes and verbs into edges', () => {
    const g = parse('the person is holding a box on the table');
    expect(g.objects.map((o) => o.names[0])).toEqual(['person', 'box', 'table']);
    expect(g.relationships.map((r) => r.predicate)).toEqual(['holding', 'on']);
  });

  it('chains the edges, so the object of one becomes the subject of the next', () => {
    const g = parse('the person is holding a box on the table');
    const name = new Map(g.objects.map((o) => [o.object_id, o.names[0]]));
    expect(g.relationships.map((r) => [name.get(r.subject_id), r.predicate, name.get(r.object_id)]))
      .toEqual([
        ['person', 'holding', 'box'],
        ['box', 'on', 'table'],
      ]);
  });

  it('matches a multi-word noun in full rather than its first word', () => {
    const g = parse('a robot arm is above the conveyor');
    expect(g.objects.map((o) => o.names[0])).toEqual(['robot arm', 'conveyor']);
  });

  it('matches a multi-word predicate in full', () => {
    const g = parse('the worker is knocking on the panel');
    expect(g.relationships.map((r) => r.predicate)).toEqual(['knocking on']);
  });

  it('marks a predicate outside P as out-of-vocabulary rather than dropping it', () => {
    const g = parse('the person is taping the panel', { P: ['knocking on', 'holding'] });
    expect(g.relationships[0]!.predicate).toBe('taping');
    expect(outOfVocabulary(g, ['knocking on', 'holding'])).toEqual(['taping']);
  });

  it('reports nothing out of vocabulary when every predicate is legal', () => {
    const g = parse('the person is holding a box');
    expect(outOfVocabulary(g, P_DEFAULT)).toEqual([]);
  });

  it('produces a graph that validates', () => {
    expect(isSceneGraph(parse('a robot arm is above the conveyor'))).toBe(true);
  });

  it('reuses one node when a noun is mentioned twice', () => {
    const g = parse('the person is holding a box near the person');
    expect(g.objects).toHaveLength(2);
    expect(g.relationships[1]!.object_id).toBe(g.relationships[0]!.subject_id);
  });

  it('never emits a self-loop when a noun repeats adjacently', () => {
    const g = parse('the box is on the box');
    expect(g.relationships).toEqual([]);
    expect(g.warnings).toContain('self_loop');
  });

  it('says so when a sentence names no relation at all', () => {
    const g = parse('the person and the table');
    expect(g.relationships).toEqual([]);
    expect(g.warnings).toContain('no_predicate');
  });

  it('ignores a word in neither vocabulary rather than inventing a node', () => {
    const g = parse('the quick person is holding a box');
    expect(g.objects.map((o) => o.names[0])).toEqual(['person', 'box']);
    expect(g.relationships.map((r) => r.predicate)).toEqual(['holding']);
  });

  it('is case and punctuation insensitive', () => {
    const a = parse('The person is holding a box.');
    const b = parse('the  PERSON is holding a BOX');
    expect(a.relationships.map((r) => r.predicate)).toEqual(b.relationships.map((r) => r.predicate));
    expect(a.objects.map((o) => o.names[0])).toEqual(b.objects.map((o) => o.names[0]));
  });

  it('carries a note saying the boxes are placeholders', () => {
    // A sentence has no geometry. Every graph this lab makes says so, exactly as the IndVisSGG
    // replica does, because a box that was never measured must not be computed from.
    expect(parse('the person is holding a box').provenance.note).toMatch(/placeholder/i);
  });

  it('is empty rather than broken on an empty sentence', () => {
    const g = parse('   ');
    expect(g.objects).toEqual([]);
    expect(g.relationships).toEqual([]);
    expect(isSceneGraph(g)).toBe(true);
  });
});
