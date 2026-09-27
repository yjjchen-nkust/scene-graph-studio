import { useId, type ReactNode } from 'react';
import type { BBox, SceneGraph } from 'sgg-metrics';
import { placeholderImageUrl } from './images';

/** An annotated box, drawn solid. */
export const MARK_ANNOTATED = '#0f172a';
/** A predicted box, drawn dashed. */
export const MARK_PREDICTED = '#b45309';

/**
 * Drawn under each outline. The photograph is light in places and dark in others, and no one
 * colour clears 3:1 on both: F3's amber measured 1.22:1 on the table and 1.29:1 on the person
 * (D97). On white it is 5:1 everywhere.
 */
const HALO = '#ffffff';
const STROKE_WIDTH = 4;
const HALO_WIDTH = 10;
const DASH = '12 7';

export interface Mark {
  box: BBox;
  line: 'solid' | 'dashed';
  stroke: string;
  testid: string;
}

/**
 * A placeholder photograph with boxes drawn on it, shared by F3, E1 and E10.
 *
 * The overlay is an `<svg>` on the frame's own viewBox, so it lands on the objects only if it has
 * the photograph's box exactly. The photograph is in flow inside a box nothing else sizes, and it
 * states its width and height, so that box has the photograph's proportions before it loads. In a
 * column the flex row stretched, the overlay once drew every mark 122 px below its object with
 * every readout correct (D97); an overlay of absolutely positioned children alone renders 0×0,
 * which hid F1's photograph until D96.
 *
 * Marks differ in shape as well as colour (NFR-5): solid, dashed, and a hatch for a shared
 * region. They carry no text: SVG text is scaled by the viewBox below the lecture's 18 px floor
 * while its computed size reads unscaled, so a label goes in `children`, as HTML.
 */
export function PhotoMarks({
  frame, marks, hatch = null, maxVh, alt, testid, children,
}: {
  frame: SceneGraph;
  marks: Mark[];
  hatch?: { box: BBox; testid: string } | null;
  maxVh: number;
  alt: string;
  testid: string;
  children?: ReactNode;
}) {
  const pattern = `${useId()}-hatch`;
  return (
    <div
      data-testid={testid}
      className="min-w-0 flex-1"
      style={{ maxWidth: `calc(${maxVh}vh * ${frame.width} / ${frame.height})` }}
    >
      <div className="relative">
        <img
          src={placeholderImageUrl(frame.image_id)}
          alt={alt}
          width={frame.width}
          height={frame.height}
          className="block h-auto w-full"
        />
        <svg
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <pattern id={pattern} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="10" stroke={MARK_ANNOTATED} strokeWidth="4" />
            </pattern>
          </defs>
          {hatch && (
            <rect
              data-testid={hatch.testid}
              x={hatch.box.x}
              y={hatch.box.y}
              width={hatch.box.w}
              height={hatch.box.h}
              fill={`url(#${pattern})`}
              fillOpacity={0.55}
            />
          )}
          {marks.map((m) => {
            const dash = m.line === 'dashed' ? DASH : undefined;
            const geometry = { x: m.box.x, y: m.box.y, width: m.box.w, height: m.box.h, fill: 'none' };
            return (
              <g key={m.testid}>
                <rect data-testid={`${m.testid}-halo`} {...geometry} stroke={HALO} strokeWidth={HALO_WIDTH} strokeDasharray={dash} />
                <rect data-testid={m.testid} {...geometry} stroke={m.stroke} strokeWidth={STROKE_WIDTH} strokeDasharray={dash} />
              </g>
            );
          })}
        </svg>
      </div>
      {children}
    </div>
  );
}
