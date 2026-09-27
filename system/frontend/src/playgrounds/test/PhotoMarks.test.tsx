import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MARK_ANNOTATED, MARK_PREDICTED, PhotoMarks } from '../PhotoMarks';
import { frameById } from '../slice';

const frame = frameById('ph-001')!;
const box = { x: 250, y: 240, w: 90, h: 70 };
const moved = { x: 268, y: 240, w: 90, h: 70 };

function draw(hatch: { box: typeof box; testid: string } | null = null) {
  return render(
    <PhotoMarks
      frame={frame}
      marks={[
        { box, line: 'solid', stroke: MARK_ANNOTATED, testid: 'gt' },
        { box: moved, line: 'dashed', stroke: MARK_PREDICTED, testid: 'pred' },
      ]}
      hatch={hatch}
      maxVh={34}
      alt="ph-001"
      testid="picture"
    >
      <p data-testid="caption">ph-001</p>
    </PhotoMarks>,
  );
}

describe('PhotoMarks', () => {
  it('each mark stands on a white under-stroke drawn first', () => {
    draw();
    for (const id of ['gt', 'pred']) {
      const line = screen.getByTestId(id);
      const halo = screen.getByTestId(`${id}-halo`);
      for (const k of ['x', 'y', 'width', 'height']) {
        expect(halo.getAttribute(k), `${id} ${k}`).toBe(line.getAttribute(k));
      }
      expect(halo.getAttribute('stroke')).toBe('#ffffff');
      expect(Number(halo.getAttribute('stroke-width'))).toBeGreaterThan(Number(line.getAttribute('stroke-width')));
      expect(halo.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('a dashed mark\'s under-stroke is dashed too, and a solid one\'s is not', () => {
    draw();
    expect(screen.getByTestId('pred-halo').getAttribute('stroke-dasharray')).toBe(
      screen.getByTestId('pred').getAttribute('stroke-dasharray'),
    );
    expect(screen.getByTestId('pred').getAttribute('stroke-dasharray')).toBeTruthy();
    expect(screen.getByTestId('gt').getAttribute('stroke-dasharray')).toBeNull();
  });

  it('the photograph states its size before it loads', () => {
    draw();
    const img = screen.getByTestId('picture').querySelector('img')!;
    expect(img.getAttribute('width')).toBe('640');
    expect(img.getAttribute('height')).toBe('480');
  });

  it('draws the hatch only when given one', () => {
    const plain = draw();
    expect(screen.queryByTestId('shared')).toBeNull();
    plain.unmount();
    draw({ box: { x: 268, y: 240, w: 72, h: 70 }, testid: 'shared' });
    expect(screen.getByTestId('shared').getAttribute('fill')).toMatch(/^url\(#/);
  });

  it('puts badges on the photograph as HTML, at each box\'s corner in percent of the frame', () => {
    render(
      <PhotoMarks
        frame={frame}
        marks={[]}
        badges={[{ box, text: '#3', testid: 'badge-3' }]}
        maxVh={34}
        alt="ph-001"
        testid="picture"
      />,
    );
    const badge = screen.getByTestId('badge-3');
    expect(badge).toHaveTextContent('#3');
    expect(badge.closest('svg')).toBeNull();
    expect(badge.style.left).toBe(`${(250 / 640) * 100}%`);
    expect(badge.style.top).toBe(`${(240 / 480) * 100}%`);
  });

  it('sets a badge above its box, outside it, unless told to sit inside or above and to the left', () => {
    render(
      <PhotoMarks
        frame={frame}
        marks={[]}
        badges={[
          { box, text: '#1', testid: 'badge-above' },
          { box, text: '#2', testid: 'badge-inside', place: 'inside' },
          { box, text: '#3', testid: 'badge-left', place: 'above-left' },
        ]}
        maxVh={34}
        alt="ph-001"
        testid="picture"
      />,
    );
    expect(screen.getByTestId('badge-above').style.transform).toBe('translateY(-100%)');
    expect(screen.getByTestId('badge-inside').style.transform).toBe('');
    expect(screen.getByTestId('badge-left').style.transform).toBe('translate(-100%, -100%)');
  });

  it('renders what it is given beneath the picture, and no text inside it', () => {
    draw();
    expect(screen.getByTestId('caption')).toBeInTheDocument();
    expect(screen.getByTestId('picture').querySelector('svg text')).toBeNull();
  });
});
