import { Fragment } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { Readout } from '../../playgrounds/controls';
import { MARK_PREDICTED, PhotoMarks } from '../../playgrounds/PhotoMarks';
import { ClipPlayer } from '../ClipPlayer';
import { CLIP_SIZE, TRADITIONAL, frameLabel, frameUrl, type TraditionalFrame } from '../data';
import { badgePlaces, uncoveredClasses } from '../logic';
import { badgeSize } from './badges';

/** The clip's and the photograph's height at most, in viewport heights. */
const PICTURE_VH = 28;

/** A detection's number on the photograph and in the legend: its object id counted from 1. */
const badgeText = (objectId: number) => `#${objectId + 1}`;

/**
 * D-T, part 1: closed vocabulary.
 *
 * The clip beside the chosen frame, each detection a dashed box (a detection is a prediction)
 * numbered by an HTML badge `#n`, with a legend beneath naming each number's COCO label and score;
 * then the twelve `O_ISG` classes under the class map, `✓` and the COCO category for a class COCO
 * names, and the rest under `— no COCO class`.
 *
 * The badges are short and the names are in the legend, as E10 numbers its boxes (D100): at a
 * 374 px photograph a `label score` badge was a third of its width, and at the default frame eight
 * pairs of them overlapped. `badgePlaces` sets each above its box, from the box's left corner or
 * towards it from either side, and slides one along its row where two would still meet; none sits
 * inside its box and none overlaps another. A badge lies on the photograph, or, only for a box
 * whose top is within one badge height of the frame's top, in the band directly above the
 * photograph and within its width: the band is this part's top padding, one badge tall.
 *
 * Three columns from 1024 px, so the part fits a 1024×768 panel with no row below the pictures:
 * the clip narrow up to 1280 px, since its ticks are the knob and the photograph carries the part;
 * the photograph and its legend; the two counts and the vocabulary.
 */
export function Part1({ frame, onPick }: { frame: TraditionalFrame; onPick: (id: string) => void }) {
  const { t, locale } = useLocale();
  const classes = Object.entries(TRADITIONAL.o_isg_coco);
  const covered = classes.filter((entry): entry is [string, string] => entry[1] !== null);
  const uncovered = uncoveredClasses(TRADITIONAL.o_isg_coco);
  const separator = locale === 'zh-TW' ? '、' : ', ';
  const colon = locale === 'zh-TW' ? '：' : ': ';

  const chars = Math.max(0, ...frame.detections.map((d) => badgeText(d.object_id).length));
  const badge = badgeSize(frame.width, chars);
  const spots = badgePlaces(frame.detections.map((d) => d.bbox), frame.width, badge);
  const photoWidth = `calc(${PICTURE_VH}vh * ${frame.width} / ${frame.height})`;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      {/* Narrow at 1024 px, so the photograph keeps its height; from 1280 px as wide as the
          player itself, and no wider, so no gap opens between the clip and the photograph. */}
      <div
        className="lg:w-56 lg:shrink-0 xl:w-auto xl:flex-1"
        style={{ maxWidth: `calc(${PICTURE_VH}vh * ${CLIP_SIZE.width} / ${CLIP_SIZE.height})` }}
      >
        <ClipPlayer value={frame.image_id} onPick={onPick} maxVh={PICTURE_VH} />
      </div>
      {/* The top padding is the band: one badge line, 0.75em at leading-tight, and its ring. */}
      <div data-testid="dt-photo-band" className="min-w-0 flex-1 pt-[1em]" style={{ maxWidth: photoWidth }}>
        <PhotoMarks
          frame={frame}
          imageUrl={frameUrl(frame.image_id)}
          marks={frame.detections.map((d) => ({
            box: d.bbox,
            line: 'dashed',
            stroke: MARK_PREDICTED,
            testid: `dt-det-${d.object_id}`,
          }))}
          badges={frame.detections.map((d, i) => {
            // PhotoMarks anchors a badge at a point: `above` by its left edge, `above-left` by its
            // right. A badge placed towards its box from the right is drawn by its right edge, so
            // it meets the box's corner exactly; either way it lies within the room `badge` gives
            // it, which is at least what it takes.
            const spot = spots[i]!;
            const byRight = spot.side !== 'above';
            return {
              box: { ...d.bbox, x: byRight ? spot.left + badge.w : spot.left },
              text: badgeText(d.object_id),
              testid: `dt-badge-${d.object_id}`,
              place: byRight ? 'above-left' as const : 'above' as const,
            };
          })}
          maxVh={PICTURE_VH}
          alt={t('demo.dt.picture').replace('{frame}', frameLabel(frame.image_id))}
          testid="dt-photo"
        >
          {frame.detections.length > 0 && (
            <ul
              data-testid="dt-legend"
              // One line to a row, so a leading a little under `leading-tight` costs no legibility
              // and keeps the English part, whose header wraps, inside 1024×768.
              className="mt-0.5 grid grid-cols-2 gap-x-4 text-[0.75em] leading-[1.15] tabular-nums text-slate-900"
            >
              {frame.detections.map((d) => (
                <li key={d.object_id} data-testid={`dt-legend-${d.object_id}`}>
                  <span className="font-mono">{badgeText(d.object_id)}</span>
                  {` ${d.label} ${d.score.toFixed(2)}`}
                </li>
              ))}
            </ul>
          )}
        </PhotoMarks>
      </div>
      <div className="flex min-w-0 flex-col gap-1 lg:w-72 lg:shrink-0">
        <Readout
          id="DT.detections"
          label={t('demo.dt.detections')}
          value={String(frame.detections.length)}
          note={t('demo.dt.detections_note').replace('{threshold}', String(TRADITIONAL.detector.threshold))}
        />
        <Readout
          id="DT.uncovered"
          label={t('demo.dt.uncovered')}
          value={`${uncovered.length} / ${classes.length}`}
          note={t('demo.dt.uncovered_note')}
        />
        <div data-testid="dt-oisg" className="text-[0.75em] leading-tight text-slate-900">
          <p className="font-semibold">{t('demo.dt.oisg')}</p>
          {covered.length > 0 && (
            <ul data-testid="dt-oisg-covered" className="mt-1">
              {covered.map(([cls, coco]) => (
                <li key={cls} data-testid={`dt-oisg-${cls}`}>{`${cls} ✓ ${coco}`}</li>
              ))}
            </ul>
          )}
          {uncovered.length > 0 && (
            <p data-testid="dt-oisg-uncovered" className="mt-1">
              {`— ${t('demo.dt.no_coco')}${colon}`}
              {uncovered.map((cls, i) => (
                <Fragment key={cls}>
                  {i > 0 && separator}
                  <span data-testid={`dt-oisg-${cls}`}>{cls}</span>
                </Fragment>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
