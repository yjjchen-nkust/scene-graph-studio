import { fireEvent, render } from '@testing-library/react';
import type { RLEMask } from 'sgg-metrics';
import { encodeCounts } from 'sgg-metrics';
import { describe, expect, it, vi } from 'vitest';
import { ImageOverlay } from '../ImageOverlay';

const objects = [
  { object_id: 1, names: ['person'], bbox: { x: 10, y: 10, w: 40, h: 60 } },
  { object_id: 2, names: ['table'], bbox: { x: 80, y: 90, w: 50, h: 30 } },
];

const base = { imageUrl: '/images/x.png', width: 200, height: 150, objects, mode: 'view' as const };

/** A 400x300 client rect over a 200x150 image: scale 2, no letterbox. */
function renderedAt(svg: SVGSVGElement, width: number, height: number, left = 0, top = 0) {
  svg.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect;
}

describe('ImageOverlay', () => {
  it('sets a viewBox in intrinsic image pixels so boxes need no scaling', () => {
    const { container } = render(<ImageOverlay {...base} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 200 150');
    expect(container.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe(
      'xMidYMid meet',
    );
  });

  it('renders one rect per object, as a real DOM node', () => {
    const { container } = render(<ImageOverlay {...base} />);
    expect(container.querySelectorAll('rect[data-object-id]').length).toBe(2);
  });

  it('draws edges between box centroids', () => {
    const { container } = render(
      <ImageOverlay
        {...base}
        relationships={[{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }]}
      />,
    );
    const path = container.querySelector('path[data-relationship-id="1"]');
    expect(path?.getAttribute('d')).toContain('M 30 40'); // centroid of object 1
    expect(path?.getAttribute('d')).toContain('105 105'); // centroid of object 2
  });

  it('styles an edge by its verdict, with a dash pattern as well as a colour', () => {
    const { container } = render(
      <ImageOverlay
        {...base}
        relationships={[{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'on' }]}
        verdicts={[
          {
            pred_index: 0,
            gt_index: null,
            verdict: 'localization',
            iou_subject: 0.2,
            iou_object: 0.9,
            rank: 1,
            entered_top_k: { '20': true },
          },
        ]}
      />,
    );
    const path = container.querySelector('path[data-relationship-id="1"]');
    expect(path?.getAttribute('stroke')).toBe('#b54708');
    expect(path?.getAttribute('stroke-dasharray')).toBe('2 3');
  });

  it('reports a drawn box in image pixels, not client pixels', () => {
    const onBoxDrawn = vi.fn();
    const { container } = render(<ImageOverlay {...base} mode="draw" onBoxDrawn={onBoxDrawn} />);
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300); // rendered at 2x
    fireEvent.pointerDown(svg, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 80 });
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 80 });
    expect(onBoxDrawn).toHaveBeenCalledWith({ x: 10, y: 10, w: 50, h: 30 });
  });

  it('never emits a zero-area box', () => {
    const onBoxDrawn = vi.fn();
    const { container } = render(<ImageOverlay {...base} mode="draw" onBoxDrawn={onBoxDrawn} />);
    const svg = container.querySelector('svg')!;
    // Stubbed for the same reason as above: jsdom lays nothing out, so without this the scale
    // is 0/200 and every mapped coordinate is Infinity. The box would then be rejected for
    // being NaN rather than for being empty, and the test would pass without testing the rule.
    renderedAt(svg, 400, 300);
    fireEvent.pointerDown(svg, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(svg, { clientX: 20, clientY: 20 });
    expect(onBoxDrawn).not.toHaveBeenCalled();
  });

  // ── the behaviour the plan's prose specifies but its six tests do not reach ──────────────

  it('subtracts the letterbox before mapping a pointer to image pixels', () => {
    const onBoxDrawn = vi.fn();
    const { container } = render(<ImageOverlay {...base} mode="draw" onBoxDrawn={onBoxDrawn} />);
    const svg = container.querySelector('svg')!;
    // 400x400 over a 4:3 image: scale 2, and 50px of dead space above and below.
    renderedAt(svg, 400, 400);
    fireEvent.pointerDown(svg, { clientX: 20, clientY: 70 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 130 });
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 130 });
    expect(onBoxDrawn).toHaveBeenCalledWith({ x: 10, y: 10, w: 50, h: 30 });
  });

  it('draws nothing in view mode, however hard it is dragged', () => {
    const onBoxDrawn = vi.fn();
    const { container } = render(<ImageOverlay {...base} onBoxDrawn={onBoxDrawn} />);
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300);
    fireEvent.pointerDown(svg, { clientX: 20, clientY: 20 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 80 });
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 80 });
    expect(onBoxDrawn).not.toHaveBeenCalled();
  });

  it('clamps a box dragged past the edge to the image, which is all there is to annotate', () => {
    const onBoxDrawn = vi.fn();
    const { container } = render(<ImageOverlay {...base} mode="draw" onBoxDrawn={onBoxDrawn} />);
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300);
    fireEvent.pointerDown(svg, { clientX: -100, clientY: -100 });
    fireEvent.pointerMove(svg, { clientX: 900, clientY: 700 });
    fireEvent.pointerUp(svg, { clientX: 900, clientY: 700 });
    expect(onBoxDrawn).toHaveBeenCalledWith({ x: 0, y: 0, w: 200, h: 150 });
  });

  it('renders a mask as a path when one is present, and no path when it is not', () => {
    // Column-major runs over a 4x3 image: 3 off, then 3 on (all of column 1), then 6 off.
    const mask: RLEMask = { counts: encodeCounts([3, 3, 6]), size: [3, 4] };
    const withMask = [{ ...objects[0]!, object_id: 1, mask }, objects[1]!];
    const { container } = render(
      <ImageOverlay {...base} width={4} height={3} objects={withMask} />,
    );
    const paths = container.querySelectorAll('path[data-mask-for]');
    expect(paths.length).toBe(1);
    expect(paths[0]?.getAttribute('data-mask-for')).toBe('1');
    // one run, one column: x from 1 to 2, y from 0 to 3
    expect(paths[0]?.getAttribute('d')).toBe('M 1 0 h 1 v 3 h -1 Z');
  });

  it('reports a click on a box by object id', () => {
    const onSelect = vi.fn();
    const { container } = render(<ImageOverlay {...base} onSelect={onSelect} />);
    fireEvent.click(container.querySelector('rect[data-object-id="2"]')!);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('reports a click inside a box, not only on its outline', () => {
    // D75. A `<rect fill="none">` is hit-tested on its outline, so aiming at the middle of an
    // object selected nothing and there was no way to tell why. The svg carries the handler now
    // and answers with `pickObjectAt`.
    const onSelect = vi.fn();
    const { container } = render(<ImageOverlay {...base} onSelect={onSelect} />);
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300);
    // Object 2 is at (80,90,50x30) in image pixels, so its centre is (105,105) — twice that on
    // screen, and nowhere near its outline.
    fireEvent.click(svg, { clientX: 210, clientY: 210 });
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('selects the smaller box when the click is inside both', () => {
    const onSelect = vi.fn();
    const nested = [
      { object_id: 1, names: ['person'], bbox: { x: 0, y: 0, w: 200, h: 150 } },
      { object_id: 2, names: ['hand'], bbox: { x: 90, y: 70, w: 20, h: 20 } },
    ];
    const { container } = render(
      <ImageOverlay {...base} objects={nested} onSelect={onSelect} />,
    );
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300);
    fireEvent.click(svg, { clientX: 200, clientY: 160 });
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('reports nothing for a click on no box at all', () => {
    const onSelect = vi.fn();
    const { container } = render(<ImageOverlay {...base} onSelect={onSelect} />);
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300);
    fireEvent.click(svg, { clientX: 380, clientY: 20 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not report a selection twice when the click lands on an outline', () => {
    // The rect keeps its own handler so the existing tests still describe the existing
    // behaviour. Both firing would call `onSelect` twice, which in L1 names a subject and then
    // immediately clears it -- a click that undoes itself.
    const onSelect = vi.fn();
    const { container } = render(<ImageOverlay {...base} onSelect={onSelect} />);
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300);
    fireEvent.click(container.querySelector('rect[data-object-id="2"]')!, {
      clientX: 210,
      clientY: 210,
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('ignores a click in draw mode, where the drag owns the pointer', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ImageOverlay {...base} mode="draw" onSelect={onSelect} />,
    );
    const svg = container.querySelector('svg')!;
    renderedAt(svg, 400, 300);
    fireEvent.click(svg, { clientX: 210, clientY: 210 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows a pointer cursor over the whole scene when the scene is selectable', () => {
    // The cursor was on the rects, which are hit-tested on their outlines, so it appeared over
    // the 2 px stroke and nowhere else. The promise and the behaviour now cover the same area.
    const { container } = render(<ImageOverlay {...base} onSelect={vi.fn()} />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('cursor-pointer');
  });

  it('shows no pointer cursor when nothing is selectable', () => {
    const { container } = render(<ImageOverlay {...base} />);
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('cursor-pointer');
  });

  it('marks the selected subject and object so the roles are distinguishable', () => {
    const { container } = render(
      <ImageOverlay {...base} selection={{ subject: 1, object: 2 }} />,
    );
    expect(container.querySelector('rect[data-object-id="1"]')?.getAttribute('data-role')).toBe(
      'subject',
    );
    expect(container.querySelector('rect[data-object-id="2"]')?.getAttribute('data-role')).toBe(
      'object',
    );
  });

  it('leaves an edge unstyled when no verdict names it, rather than guessing one', () => {
    const { container } = render(
      <ImageOverlay
        {...base}
        relationships={[{ relationship_id: 7, subject_id: 1, object_id: 2, predicate: 'on' }]}
        verdicts={[]}
      />,
    );
    const path = container.querySelector('path[data-relationship-id="7"]');
    expect(path?.getAttribute('data-verdict')).toBeNull();
    expect(path?.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('skips a relationship naming an object the overlay was not given', () => {
    const { container } = render(
      <ImageOverlay
        {...base}
        relationships={[{ relationship_id: 9, subject_id: 1, object_id: 404, predicate: 'on' }]}
      />,
    );
    expect(container.querySelector('path[data-relationship-id="9"]')).toBeNull();
  });
});
