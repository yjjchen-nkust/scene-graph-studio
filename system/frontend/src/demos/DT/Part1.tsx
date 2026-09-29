import { Fragment } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { Readout } from '../../playgrounds/controls';
import { MARK_PREDICTED, PhotoMarks } from '../../playgrounds/PhotoMarks';
import { ClipPlayer } from '../ClipPlayer';
import { CLIP_SIZE, TRADITIONAL, frameLabel, frameUrl, type TraditionalFrame } from '../data';
import { badgePlaces, uncoveredClasses } from '../logic';

/** The clip's and the photograph's height at most, in viewport heights. */
const PICTURE_VH = 28;

/**
 * A `#n` badge's size as a fraction of the photograph at 1024×768, where the photograph is at its
 * narrowest, 374 × 210 px (measured): 10.8 px a character of 0.75em mono, 8 px of padding and the
 * 1 px ring each side, and one 22.5 px line with its ring. A wider panel draws the photograph
 * larger and the badge the same, so there the fractions overstate the badge and err towards room.
 */
const BADGE_CHAR = 10.8 / 374;
const BADGE_PAD = 10 / 374;
const BADGE_LINE = 24.5 / 210;

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
 * pairs of them overlapped. Each sits above its box, or above and to its left where it would cross
 * the right edge or overlap another (`badgePlaces`), never inside the box. A band one badge tall
 * above the photograph holds the badges of boxes that start at its top edge.
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
  const places = badgePlaces(frame.detections.map((d) => d.bbox), frame.width, {
    w: (chars * BADGE_CHAR + BADGE_PAD) * frame.width,
    h: BADGE_LINE * frame.height,
  });
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
          badges={frame.detections.map((d, i) => ({
            box: d.bbox,
            text: badgeText(d.object_id),
            testid: `dt-badge-${d.object_id}`,
            place: places[i],
          }))}
          maxVh={PICTURE_VH}
          alt={t('demo.dt.picture').replace('{frame}', frameLabel(frame.image_id))}
          testid="dt-photo"
        >
          {frame.detections.length > 0 && (
            <ul
              data-testid="dt-legend"
              className="mt-1 grid grid-cols-2 gap-x-4 text-[0.75em] leading-tight tabular-nums text-slate-900"
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
      <div className="flex min-w-0 flex-col gap-2 lg:w-72 lg:shrink-0">
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
