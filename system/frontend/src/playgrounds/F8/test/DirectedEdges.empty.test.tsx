import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneGraph } from 'sgg-metrics';
import { setLocale } from '../../../i18n/useLocale';

/**
 * A frame carrying no annotated relationships.
 *
 * In its own file because it replaces the slice module, and the rest of F8's tests want the real
 * one. No committed frame is empty today, so the case is pinned by a fixture rather than by the
 * data — the same construction `logic.test.ts` uses for the reversed triplet that no frame has.
 * Regenerating the slice with one unannotated frame is all it would take to reach it, and the
 * component used to dereference `relationships[0]` and blank the step.
 */
const EMPTY: SceneGraph = {
  image_id: 'ph-empty',
  width: 640,
  height: 480,
  objects: [
    { object_id: 1, names: ['table'], bbox: [0, 0, 10, 10] },
    { object_id: 2, names: ['person'], bbox: [5, 5, 15, 15] },
  ],
  relationships: [],
} as unknown as SceneGraph;

vi.mock('../../slice', () => ({
  FRAMES: [EMPTY],
  frameById: (id: string) => (id === 'ph-empty' ? EMPTY : undefined),
  PREDICATES: ['on', 'near'],
  SLICE_PREDICATE_COUNT: 2,
}));

const { DirectedEdges } = await import('../DirectedEdges');

beforeEach(() => setLocale('en'));

describe('F8 on a frame with nothing annotated', () => {
  it('says the frame carries no relationships instead of rendering a blank step', () => {
    render(
      <MemoryRouter initialEntries={['/m/m00']}>
        <DirectedEdges />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('f8-empty')).toHaveTextContent('no annotated relationships');
    // The sentence cannot be built, so it must not be claimed to exist.
    expect(screen.queryByTestId('f8-sentence')).toBeNull();
    expect(screen.queryByTestId('f8-status')).toBeNull();
    // The frame chooser stays, or the step is a dead end.
    expect(screen.getByLabelText('Frame')).toBeInTheDocument();
  });
});
