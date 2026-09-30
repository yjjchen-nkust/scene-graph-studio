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

/** Where a badge sits against its box's top-left corner. */
export type BadgePlace = 'above' | 'above-left' | 'inside';

/** Above the corner and above-left of it keep the badge off its own box; inside is over it. */
const BADGE_SHIFT: Record<BadgePlace, string | undefined> = {
  above: 'translateY(-100%)',
  'above-left': 'translate(-100%, -100%)',
  inside: undefined,
};

export interface Mark {
  box: BBox;
  line: 'solid' | 'dashed';
  stroke: string;
  testid: string;
}

/**
 * A photograph with boxes drawn on it, shared by F3, E1 and E10 over the placeholder slice and by
 * the M0 demos over the clip's frames (`imageUrl`).
 *
 * The overlay is an `<svg>` on the frame's own viewBox, so it lands on the objects only if it has
 * the photograph's box exactly. The photograph is in flow inside a box nothing else sizes, and it
 * states its width and height, so that box has the photograph's proportions before it loads. In a
 * column the flex row stretched, the overlay once drew every mark
 * 122 px below its object in F3's longest state, 96.5 px at Δx = 18, with every readout correct
 * (D97); an overlay of absolutely positioned children alone renders 0×0, which hid F1's photograph
 * until D96.
 *
 * Marks differ in shape as well as colour (NFR-5): solid, dashed, and a hatch for a shared
 * region. They carry no text: SVG text is scaled by the viewBox below the lecture's 18 px floor
 * while its computed size reads unscaled. A label goes in `children`, and a badge naming a box is
 * an HTML element over the photograph, placed in percent of the frame, so the floor measures it.
 * A badge sits above its box by default: at a box's corner it hid the smallest boxes (D100).
 */
export function PhotoMarks({
  frame, imageUrl, marks, hatch = null, badges = [], maxVh, alt, testid, children,
}: {
  /** The frame's id and pixel size; the marks are drawn on its own viewBox. */
  frame: Pick<SceneGraph, 'image_id' | 'width' | 'height'>;
  /**
   * The photograph's URL, for a frame that is not a placeholder frame, such as a demo's
   * (`demos/data.ts`, `frameUrl`). Absent, the placeholder slice's photograph of `frame` is drawn.
   */
  imageUrl?: string;
  marks: Mark[];
  hatch?: { box: BBox; testid: string } | null;
  /** Short HTML labels at each box's top-left corner, such as `#3`. */
  badges?: { box: BBox; text: string; testid: string; place?: BadgePlace }[];
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
          src={imageUrl ?? placeholderImageUrl(frame.image_id)}
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
        {badges.map((b) => (
          <span
            key={b.testid}
            data-testid={b.testid}
            className="absolute bg-white px-1 font-mono text-[0.75em] leading-tight text-slate-900 ring-1 ring-slate-900"
            style={{
              left: `${(b.box.x / frame.width) * 100}%`,
              top: `${(b.box.y / frame.height) * 100}%`,
              transform: BADGE_SHIFT[b.place ?? 'above'],
            }}
          >
            {b.text}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}
