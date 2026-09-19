import type { SGObject } from 'sgg-metrics';
import { describe, expect, it } from 'vitest';
import { pickObjectAt } from '../geometry';

/**
 * Which object a click at a point selects — D75.
 *
 * A box is drawn `fill="none"`, so SVG hit-tests its outline and not its interior and a click
 * aimed at the middle of an object used to select nothing. Handing the interior to the browser
 * instead (`pointer-events: all`) fixes that and creates a worse problem: hit testing then goes
 * to whichever box paints last over the point, which is document order and has nothing to do
 * with what the person meant. In a scene graph, boxes nest — a hand inside a person, a nut on a
 * beam — so "the last one drawn" selects the wrong object routinely and unpredictably.
 *
 * So the choice is made here instead of by the renderer: the smallest box containing the point.
 * A person who clicks inside the hand means the hand; if they meant the person they have the
 * whole of the person that is not the hand to click in. Nesting makes the rule unambiguous
 * rather than ambiguous, which is the opposite of what z-order does.
 */

const person: SGObject = { object_id: 1, names: ['person'], bbox: { x: 0, y: 0, w: 100, h: 100 } };
const hand: SGObject = { object_id: 2, names: ['hand'], bbox: { x: 40, y: 40, w: 20, h: 20 } };
const table: SGObject = { object_id: 3, names: ['table'], bbox: { x: 200, y: 0, w: 50, h: 50 } };

describe('pickObjectAt', () => {
  it('returns the object whose box contains the point', () => {
    expect(pickObjectAt([person, table], { x: 220, y: 20 })?.object_id).toBe(3);
  });

  it('returns null when the point is in no box at all', () => {
    expect(pickObjectAt([person, table], { x: 150, y: 150 })).toBeNull();
  });

  it('returns the smaller box when one nests inside another', () => {
    // The hand is inside the person. Document order puts the person first, and z-order would
    // give whichever paints last; neither is what the click meant.
    expect(pickObjectAt([person, hand], { x: 50, y: 50 })?.object_id).toBe(2);
    expect(pickObjectAt([hand, person], { x: 50, y: 50 })?.object_id).toBe(2);
  });

  it('returns the enclosing box for a point outside the nested one', () => {
    expect(pickObjectAt([person, hand], { x: 10, y: 10 })?.object_id).toBe(1);
  });

  it('breaks a tie on area by the lower object id, so the answer is deterministic', () => {
    // NFR-4. Two boxes of equal area over one point is rare and not impossible, and a rule that
    // depends on array order would make the same click select different things on two machines.
    const a: SGObject = { object_id: 7, names: ['a'], bbox: { x: 0, y: 0, w: 10, h: 10 } };
    const b: SGObject = { object_id: 3, names: ['b'], bbox: { x: 5, y: 5, w: 10, h: 10 } };
    expect(pickObjectAt([a, b], { x: 7, y: 7 })?.object_id).toBe(3);
    expect(pickObjectAt([b, a], { x: 7, y: 7 })?.object_id).toBe(3);
  });

  it('counts the boundary as inside, so the outline still selects what it outlines', () => {
    // The outline was the only thing that worked before this function existed. It must not stop
    // working, or the fix would be a trade rather than a repair.
    expect(pickObjectAt([table], { x: 200, y: 0 })?.object_id).toBe(3);
    expect(pickObjectAt([table], { x: 250, y: 50 })?.object_id).toBe(3);
    expect(pickObjectAt([table], { x: 250.5, y: 50 })).toBeNull();
  });

  it('returns null for a point that is not a number', () => {
    // `clientToImage` returns NaN when the element has no layout — before first paint, or in a
    // test with no stubbed rect. NaN fails every comparison, so this is what the loop already
    // does; the test is here so it stays true rather than being true by accident.
    expect(pickObjectAt([person], { x: Number.NaN, y: 50 })).toBeNull();
  });

  it('returns null when there are no objects', () => {
    expect(pickObjectAt([], { x: 0, y: 0 })).toBeNull();
  });
});
