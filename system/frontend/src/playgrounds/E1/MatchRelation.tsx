import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Toggle } from '../controls';
import { XU_TAU } from '../F3/setup';
import {
  annotatedTriplet, conjuncts, failureMode, flag, frameVerdict, iouCounts, truncatedRatio, withDefects,
  type Conjuncts,
} from '../logic';
import type { PlaygroundProps } from '../mounts';
import { MARK_ANNOTATED, MARK_PREDICTED, PhotoMarks } from '../PhotoMarks';
import { frameById } from '../slice';
import { E1_FRAME, E1_RELATIONSHIP } from './setup';

/** The photograph's height at most, in viewport heights. */
const PICTURE_VH = 34;

const COUNT = new Intl.NumberFormat('en-US');

const DEFECTS = ['cs', 'co', 'p', 'bs', 'bo'] as const;

/** The five conjuncts in M3 s2's order, as notation both locales share. */
const ROWS: { key: keyof Conjuncts; label: string }[] = [
  { key: 'cs', label: 'c(ŝ) = c(s)' },
  { key: 'co', label: 'c(ô) = c(o)' },
  { key: 'p', label: 'p̂ = p' },
  { key: 'is', label: 'IoU(ŝ, s) ≥ τ' },
  { key: 'io', label: 'IoU(ô, o) ≥ τ' },
];

/**
 * E1 — 命中關係 ≃.
 *
 * One annotated triplet of ph-001, box#3 on table#1, and five toggles, each injecting one defect
 * into the prediction and so falsifying exactly one conjunct of t̂ ≃ t. The step shows the five
 * conjuncts, the relation, which half fails, and the verdict the engine's diff gives, which
 * `logic.test.ts` holds to `classify` over all 32 settings.
 *
 * The point it makes is the table M3 s2 now carries: a right name in the wrong place is
 * `localization`, a wrong name is `spurious` wherever its box sits, and the diff does not
 * separate a wrong name in the right place from both halves wrong.
 *
 * Computes five memberships and one relation. No metric.
 */
export function MatchRelation(_props: PlaygroundProps = {}) {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'E1.cs': 0,
    'E1.co': 0,
    'E1.p': 0,
    'E1.bs': 0,
    'E1.bo': 0,
  });

  const defects = {
    cs: flag(params['E1.cs'], false),
    co: flag(params['E1.co'], false),
    p: flag(params['E1.p'], false),
    bs: flag(params['E1.bs'], false),
    bo: flag(params['E1.bo'], false),
  };

  // Committed data, pinned by `logic.test.ts`: relationship 1 of ph-001 is box#3 on table#1.
  const frame = frameById(E1_FRAME)!;
  const gt = annotatedTriplet(frame, E1_RELATIONSHIP);
  const pred = withDefects(gt, defects);
  const holds = conjuncts(pred, gt, XU_TAU);
  const relation = Object.values(holds).every(Boolean);
  const mode = failureMode(holds);
  const verdict = frameVerdict(pred, frame, XU_TAU);
  const counts = {
    is: iouCounts(pred.subject.box, gt.subject.box),
    io: iouCounts(pred.object.box, gt.object.box),
  };

  const controls = (
    <>
      {DEFECTS.map((d) => (
        <Toggle
          key={d}
          id={`E1.${d}`}
          label={t(`playground.e1.${d}`)}
          checked={defects[d]}
          onChange={(on) => setParams({ [`E1.${d}`]: on ? 1 : 0 } as Partial<typeof params>)}
        />
      ))}
      <span className="text-[0.875em] text-slate-700">{t('playground.e1.tau')}</span>
    </>
  );

  return (
    <PlaygroundFrame title="E1" controls={controls} clip={false}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <PhotoMarks
          frame={frame}
          marks={[
            { box: gt.subject.box, line: 'solid', stroke: MARK_ANNOTATED, testid: 'e1-gt-s' },
            { box: gt.object.box, line: 'solid', stroke: MARK_ANNOTATED, testid: 'e1-gt-o' },
            { box: pred.subject.box, line: 'dashed', stroke: MARK_PREDICTED, testid: 'e1-pred-s' },
            { box: pred.object.box, line: 'dashed', stroke: MARK_PREDICTED, testid: 'e1-pred-o' },
          ]}
          maxVh={PICTURE_VH}
          alt={t('playground.e1.picture')}
          testid="e1-picture"
        >
          <p className="mt-1 text-[0.875em] text-slate-700">{t('playground.e1.legend')}</p>
        </PhotoMarks>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <table data-testid="e1-conjuncts" className="font-mono text-[1em]">
            <tbody>
              {ROWS.map(({ key, label }) => {
                const pair = key === 'is' || key === 'io' ? counts[key] : null;
                return (
                  <tr key={key} data-testid={`e1-c-${key}`} data-holds={String(holds[key])}>
                    <td className="pr-4 text-slate-900">{label}</td>
                    <td className={holds[key] ? 'pr-4 text-emerald-900' : 'pr-4 text-slate-700'}>
                      {t(holds[key] ? 'playground.e1.holds' : 'playground.e1.fails')}
                    </td>
                    <td className="text-slate-700">
                      {pair && `${truncatedRatio(pair[0], pair[1])} = ${COUNT.format(pair[0])} / ${COUNT.format(pair[1])}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p
            data-testid="e1-relation"
            className={relation ? 'text-[1.5em] text-emerald-900' : 'text-[1.5em] text-slate-700'}
          >
            {t('playground.e1.relation')}
            {t(relation ? 'playground.e1.holds' : 'playground.e1.fails')}
          </p>
          <p data-testid="e1-mode" className="text-[1em] text-slate-900">
            {t(`playground.e1.mode_${mode}`)}
          </p>
          <p data-testid="e1-verdict" className="font-mono text-[1em] text-slate-900">
            {t(`playground.e1.verdict_${verdict}`)}
          </p>
        </div>
      </div>
    </PlaygroundFrame>
  );
}
