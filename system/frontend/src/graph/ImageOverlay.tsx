import type { BBox, SGObject, SGRelationship, Verdict, VerdictKind } from 'sgg-metrics';
import { useId, useRef, useState } from 'react';
import { useLocale } from '../i18n/useLocale';
import {
  centroid,
  clampToImage,
  clientToImage,
  maskPath,
  pickObjectAt,
  rectBetween,
} from './geometry';
import { VERDICT_ORDER, VERDICT_STYLE } from './palette';

export interface ImageOverlayProps {
  imageUrl: string;
  /** Intrinsic pixels. These are the viewBox, and the units every bbox and mask is written in. */
  width: number;
  height: number;
  objects: SGObject[];
  relationships?: SGRelationship[];
  /** Present → four-colour diff mode. `pred_index` is a position in `relationships`. */
  verdicts?: Verdict[];
  mode: 'view' | 'draw';
  onBoxDrawn?: (bbox: BBox) => void;
  selection?: { subject?: number; object?: number };
  onSelect?: (objectId: number) => void;
  className?: string;
  /**
   * Which layers to draw. Absent keeps exactly what every caller before F1 got: boxes and
   * relationships drawn, object names only in a `<title>` tooltip and never as visible text.
   * F1 opts into `labels` because its whole claim is that a label is not a structure, and you
   * cannot make that claim about something the reader cannot see.
   */
  layers?: { boxes?: boolean; relationships?: boolean; labels?: boolean };
}

/** Below this, a drag is a click that moved. Emitting it would put noise in the annotations. */
const MIN_DRAWN_SIDE = 1;

/**
 * The scene, its boxes, its masks and its edges, drawn in the image's own coordinates.
 *
 * One `<img>` and one absolutely positioned `<svg viewBox="0 0 width height">` (contracts §2.6).
 * The viewBox is the point: every annotation is already written in intrinsic image pixels, so
 * putting the SVG in those units means no bbox is ever scaled by this component. Display size
 * changes, the numbers do not, and a box cannot drift from the thing it measures.
 *
 * `preserveAspectRatio="xMidYMid meet"` letterboxes the SVG exactly as `object-contain`
 * letterboxes the `<img>`, which is what keeps the two layers registered. Pointer input crosses
 * back through `clientToImage`, in one place, so the letterbox is subtracted once.
 *
 * Every colour and dash comes from `VERDICT_STYLE`. A verdict carries three channels — hue, dash
 * and stroke width — because NFR-5 forbids hue being the only one, and an edge no verdict names
 * gets a neutral stroke rather than a guessed verdict: "not evaluated" and "matched" are
 * different claims, and only one of them is ever safe to invent.
 */
export function ImageOverlay({
  imageUrl,
  width,
  height,
  objects,
  relationships = [],
  verdicts,
  mode,
  onBoxDrawn,
  selection,
  onSelect,
  className = '',
  layers,
}: ImageOverlayProps) {
  const { t } = useLocale();
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [band, setBand] = useState<BBox | null>(null);

  const show = {
    boxes: layers?.boxes ?? true,
    relationships: layers?.relationships ?? true,
    labels: layers?.labels ?? false,
  };

  const byId = new Map(objects.map((o) => [o.object_id, o]));
  const verdictAt = new Map<number, VerdictKind>();
  for (const v of verdicts ?? []) {
    // A `missed` verdict carries pred_index -1: it names a ground-truth triplet that is not in
    // this graph at all, so there is no edge here to style. It belongs to the other overlay.
    if (v.pred_index >= 0) verdictAt.set(v.pred_index, v.verdict);
  }

  const pointer = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    return svg ? clientToImage(event, svg, width, height) : { x: Number.NaN, y: Number.NaN };
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (mode !== 'draw') return;
    const p = pointer(event);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    startRef.current = p;
    setBand(null);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = startRef.current;
    if (start === null) return;
    const p = pointer(event);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    setBand(clampToImage(rectBetween(start, p), width, height));
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = startRef.current;
    startRef.current = null;
    setBand(null);
    if (start === null) return;
    const p = pointer(event);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const box = clampToImage(rectBetween(start, p), width, height);
    if (box.w > MIN_DRAWN_SIDE && box.h > MIN_DRAWN_SIDE) onBoxDrawn?.(box);
  };

  /**
   * A click anywhere on the scene, resolved to an object — D75.
   *
   * The handler is on the svg rather than on each box because a `<rect fill="none">` is
   * hit-tested on its outline only: the 2 px stroke responded and the whole interior did not,
   * while the pointer cursor promised otherwise. Giving the rects `pointer-events: all` instead
   * would hand the decision to paint order, and boxes in a scene graph nest, so `pickObjectAt`
   * makes it here: the smallest box containing the point.
   *
   * A click whose target is a box is left to that box's own handler, which still exists and is
   * what the older tests describe. Handling it twice would name a subject and clear it again in
   * one click.
   */
  const onClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (mode === 'draw' || !onSelect) return;
    if ((event.target as Element).closest?.('[data-object-id]')) return;
    const hit = pickObjectAt(objects, pointer(event));
    if (hit) onSelect(hit.object_id);
  };

  const roleOf = (objectId: number): 'subject' | 'object' | undefined => {
    if (selection?.subject === objectId) return 'subject';
    if (selection?.object === objectId) return 'object';
    return undefined;
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={imageUrl}
        alt={t('overlay.image_alt')}
        className="absolute inset-0 h-full w-full object-contain"
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        // The pointer cursor belongs on the whole scene, not on the rects: they are hit-tested
        // on their outlines, so it used to appear over a 2 px stroke and promise nothing about
        // the interior it sat inside. Now the area that responds and the area that says it
        // responds are the same area.
        className={`absolute inset-0 h-full w-full ${
          mode === 'draw' ? 'cursor-crosshair' : onSelect ? 'cursor-pointer' : ''
        }`}
        role="group"
        aria-label={t(mode === 'draw' ? 'overlay.draw_hint' : 'overlay.label')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onClick}
      >
        <defs>
          {VERDICT_ORDER.map((kind) => {
            const style = VERDICT_STYLE[kind];
            return (
              <marker
                key={kind}
                id={`${uid}-arrow-${kind}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill={style.marker === 'filled' ? style.stroke : 'white'}
                  stroke={style.stroke}
                  strokeWidth={style.marker === 'open' ? 2 : 1}
                />
              </marker>
            );
          })}
          <marker
            id={`${uid}-arrow-plain`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
        </defs>

        {/* Masks first: they are the largest shapes, and a box drawn over one stays readable. */}
        {objects.map((o) =>
          o.mask ? (
            <path
              key={`mask-${o.object_id}`}
              data-mask-for={o.object_id}
              d={maskPath(o.mask)}
              fill={roleOf(o.object_id) ? '#2563eb' : '#0f172a'}
              fillOpacity={roleOf(o.object_id) ? 0.28 : 0.18}
              stroke="none"
            />
          ) : null,
        )}

        {show.boxes &&
          objects.map((o) => (
            <rect
              key={`box-${o.object_id}`}
              data-object-id={o.object_id}
              data-testid={`box-${o.object_id}`}
              data-role={roleOf(o.object_id)}
              x={o.bbox.x}
              y={o.bbox.y}
              width={o.bbox.w}
              height={o.bbox.h}
              fill="none"
              stroke={roleOf(o.object_id) ? '#2563eb' : '#f8fafc'}
              strokeWidth={roleOf(o.object_id) ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              className={onSelect ? 'cursor-pointer' : undefined}
              onClick={onSelect ? () => onSelect(o.object_id) : undefined}
            >
              <title>{o.names[0]}</title>
            </rect>
          ))}

        {show.relationships &&
          relationships.map((r, index) => {
            const subject = byId.get(r.subject_id);
            const object = byId.get(r.object_id);
            // A dangling relationship is not drawable. The schema forbids one, but an overlay
            // handed a partial object list should show less rather than throw.
            if (!subject || !object) return null;
            const from = centroid(subject.bbox);
            const to = centroid(object.bbox);
            const kind = verdictAt.get(index);
            const style = kind ? VERDICT_STYLE[kind] : null;
            return (
              <path
                key={`rel-${r.relationship_id}`}
                data-relationship-id={r.relationship_id}
                data-testid={`edge-${r.relationship_id}`}
                data-verdict={kind}
                d={`M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`}
                fill="none"
                stroke={style ? style.stroke : '#475569'}
                strokeWidth={style ? style.width : 2}
                strokeDasharray={style?.dash || undefined}
                vectorEffect="non-scaling-stroke"
                markerEnd={`url(#${uid}-arrow-${kind ?? 'plain'})`}
              >
                <title>{`${subject.names[0]} ${r.predicate} ${object.names[0]}`}</title>
              </path>
            );
          })}

        {show.labels &&
          objects.map((o) => (
            <text
              key={`label-${o.object_id}`}
              data-testid={`label-${o.object_id}`}
              x={o.bbox.x + 4}
              y={o.bbox.y - 6}
              className="font-mono"
              fontSize={18}
              fill={VERDICT_STYLE.match.stroke}
              stroke="#ffffff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {o.names[0]}
            </text>
          ))}

        {band ? (
          <rect
            data-testid="rubber-band"
            x={band.x}
            y={band.y}
            width={band.w}
            height={band.h}
            fill="#2563eb"
            fillOpacity={0.15}
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}
