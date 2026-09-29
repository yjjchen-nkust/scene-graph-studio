import { Fragment } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { Readout } from '../../playgrounds/controls';
import { MARK_PREDICTED, PhotoMarks, type BadgePlace } from '../../playgrounds/PhotoMarks';
import { ClipPlayer } from '../ClipPlayer';
import { CLIP_SIZE, TRADITIONAL, frameUrl, type Detection, type TraditionalFrame } from '../data';

/** The clip's and the photograph's height at most, in viewport heights. */
const PICTURE_VH = 28;

/**
 * A badge sits above its box (D100), except where the box starts within this fraction of the
 * frame's height from its top edge: there a badge above would leave the photograph, so it sits
 * inside the corner instead. One badge line is about a tenth of the photograph's height at the
 * projector sizes.
 */
const TOP_BAND = 0.12;

function badgePlace(d: Detection, height: number): BadgePlace {
  return d.bbox.y < height * TOP_BAND ? 'inside' : 'above';
}

/**
 * D-T, part 1: closed vocabulary.
 *
 * The clip beside the chosen frame, each detection a dashed box (a detection is a prediction) with
 * its COCO label and score as an HTML badge; then the twelve `O_ISG` classes under the class map,
 * `✓` and the COCO category for a class COCO names, and the rest under `— no COCO class`.
 *
 * Three columns from 1024 px, so the part fits a 1024×768 panel with no row below the pictures:
 * the clip narrow up to 1280 px, since its ticks are the knob and the photograph carries the
 * part; the photograph with the detection count beneath it; the vocabulary with the count of
 * classes COCO cannot name above it.
 */
export function Part1({ frame, onPick }: { frame: TraditionalFrame; onPick: (id: string) => void }) {
  const { t, locale } = useLocale();
  const classes = Object.entries(TRADITIONAL.o_isg_coco);
  const covered = classes.filter((entry): entry is [string, string] => entry[1] !== null);
  const uncovered = classes.filter(([, coco]) => coco === null).map(([cls]) => cls);
  const separator = locale === 'zh-TW' ? '、' : ', ';
  const colon = locale === 'zh-TW' ? '：' : ': ';

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
      <PhotoMarks
        frame={frame}
        imageUrl={frameUrl(frame.image_id)}
        marks={frame.detections.map((d) => ({
          box: d.bbox,
          line: 'dashed',
          stroke: MARK_PREDICTED,
          testid: `dt-det-${d.object_id}`,
        }))}
        badges={frame.detections.map((d) => ({
          box: d.bbox,
          text: `${d.label} ${d.score.toFixed(2)}`,
          testid: `dt-badge-${d.object_id}`,
          place: badgePlace(d, frame.height),
        }))}
        maxVh={PICTURE_VH}
        alt={t('demo.dt.picture').replace('{frame}', frame.image_id)}
        testid="dt-photo"
      >
        <div className="mt-1">
          <Readout
            id="DT.detections"
            label={t('demo.dt.detections')}
            value={String(frame.detections.length)}
            note={t('demo.dt.detections_note').replace('{threshold}', String(TRADITIONAL.detector.threshold))}
          />
        </div>
      </PhotoMarks>
      <div className="flex min-w-0 flex-col gap-2 lg:w-72 lg:shrink-0">
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
