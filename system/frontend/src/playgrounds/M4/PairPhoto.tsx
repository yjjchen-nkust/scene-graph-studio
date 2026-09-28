import { useLocale } from '../../i18n/useLocale';
import { E10_BADGE_PLACES } from '../E10/setup';
import { MARK_ANNOTATED, PhotoMarks } from '../PhotoMarks';
import { frameById } from '../slice';
import { M4_FRAME, type RankedRow } from './ranking';

/** The photograph's height at most, in viewport heights, matching E1, E10 and F3. */
const PICTURE_VH = 34;

/**
 * One ranked row's pair, drawn on M4_FRAME: two solid boxes and their badges, nothing else.
 *
 * Both boxes are annotated ground-truth boxes, PredCls's own, since M4's ranking is built on
 * ph-001 exactly; there is no predicted box to draw. `E10_BADGE_PLACES` is reused rather than
 * restated: it is the same photograph and the same two boxes (the wrench's, #5, sits just above
 * the table's corner) that already made E10 move a badge off its box (D100).
 */
export function PairPhoto({ row, testid }: { row: RankedRow; testid: string }) {
  const { t } = useLocale();
  const frame = frameById(M4_FRAME)!;
  const subject = frame.objects.find((o) => o.object_id === row.subject)!;
  const object = frame.objects.find((o) => o.object_id === row.object)!;

  return (
    <PhotoMarks
      frame={frame}
      marks={[
        { box: subject.bbox, line: 'solid', stroke: MARK_ANNOTATED, testid: `${testid}-s` },
        { box: object.bbox, line: 'solid', stroke: MARK_ANNOTATED, testid: `${testid}-o` },
      ]}
      badges={[
        { box: subject.bbox, text: `#${row.subject}`, testid: `${testid}-badge-s`, place: E10_BADGE_PLACES[row.subject] },
        { box: object.bbox, text: `#${row.object}`, testid: `${testid}-badge-o`, place: E10_BADGE_PLACES[row.object] },
      ]}
      maxVh={PICTURE_VH}
      alt={t('playground.m4.picture').replace('{row}', String(row.rank))}
      testid={testid}
    />
  );
}
