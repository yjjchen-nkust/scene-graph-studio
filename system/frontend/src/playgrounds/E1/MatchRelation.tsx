import type { ReactNode } from 'react';
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
import { E1_DEFECTS, E1_FRAME, E1_RELATIONSHIP } from './setup';

/** The photograph's height at most, in viewport heights. */
const PICTURE_VH = 34;

const COUNT = new Intl.NumberFormat('en-US');

const DEFECTS = ['cs', 'co', 'p', 'bs', 'bo'] as const;

/** A box shift as its nonzero axes, "Δx 45 px"; the axis is part of the defect (D101). */
function shiftText({ dx, dy }: { dx: number; dy: number }): string {
  return [dx !== 0 && `Δx ${dx} px`, dy !== 0 && `Δy ${dy} px`].filter(Boolean).join(', ');
}

/** The five conjuncts in M3 s2's order and notation, which both locales share. */
const ROWS: { key: keyof Conjuncts; label: ReactNode }[] = [
  { key: 'cs', label: <>c<sub>ŝ</sub> = c<sub>s</sub></> },
  { key: 'co', label: <>c<sub>ô</sub> = c<sub>o</sub></> },
  { key: 'p', label: 'p̂ = p' },
  { key: 'is', label: <>IoU<sub>s</sub> ≥ τ</> },
  { key: 'io', label: <>IoU<sub>o</sub> ≥ τ</> },
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
 *
 * Two parts (D96): the defects on the photograph and the five conjuncts, then the two halves, the
 * relation and what the diff says. As one step it ran 229 px past a 1024×768 panel with every
 * toggle on. Both parts read all five toggles, so both show them. Mounted without a part, as its
 * unit tests mount it, it is both.
 */
export function MatchRelation({ part }: PlaygroundProps = {}) {
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
  const pred = withDefects(gt, defects, E1_DEFECTS);
  const holds = conjuncts(pred, gt, XU_TAU);
  const relation = Object.values(holds).every(Boolean);
  const mode = failureMode(holds);
  const halves = { cls: holds.cs && holds.co && holds.p, loc: holds.is && holds.io };
  const conjunctView = part !== 2;
  const verdictView = part !== 1;
  const verdict = frameVerdict(pred, frame, XU_TAU);
  const counts = {
    is: iouCounts(pred.subject.box, gt.subject.box),
    io: iouCounts(pred.object.box, gt.object.box),
  };
  // Each toggle names what it changes from the annotation and `E1_DEFECTS`, not from literals in
  // the strings, which had repeated 45 and 55 in both locales (D101).
  const fills: Record<(typeof DEFECTS)[number], Record<string, string>> = {
    cs: { from: gt.subject.name, to: E1_DEFECTS.subject },
    co: { from: gt.object.name, to: E1_DEFECTS.object },
    p: { from: gt.predicate, to: E1_DEFECTS.predicate },
    bs: { shift: shiftText(E1_DEFECTS.subjectShift) },
    bo: { shift: shiftText(E1_DEFECTS.objectShift) },
  };
  const label = (d: (typeof DEFECTS)[number]) =>
    Object.entries(fills[d]).reduce((text, [key, value]) => text.replace(`{${key}}`, value), t(`playground.e1.${d}`));

  const controls = (
    <>
      {DEFECTS.map((d) => (
        <Toggle
          key={d}
          id={`E1.${d}`}
          label={label(d)}
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
        {conjunctView && (
          <PhotoMarks
            frame={frame}
            marks={[
              { box: gt.subject.box, line: 'solid', stroke: MARK_ANNOTATED, testid: 'e1-gt-s' },
              { box: gt.object.box, line: 'solid', stroke: MARK_ANNOTATED, testid: 'e1-gt-o' },
              { box: pred.subject.box, line: 'dashed', stroke: MARK_PREDICTED, testid: 'e1-pred-s' },
              { box: pred.object.box, line: 'dashed', stroke: MARK_PREDICTED, testid: 'e1-pred-o' },
            ]}
            maxVh={PICTURE_VH}
            alt={t('playground.e1.picture')
              .replace('{frame}', E1_FRAME)
              .replace('{triplet}', `${gt.subject.name} ${gt.predicate} ${gt.object.name}`)}
            testid="e1-picture"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {conjunctView && (
            <table data-testid="e1-conjuncts" className="font-mono text-[1em]">
              <tbody>
                {ROWS.map(({ key, label }) => {
                  const pair = key === 'is' || key === 'io' ? counts[key] : null;
                  return (
                    <tr key={key} data-testid={`e1-c-${key}`} data-holds={String(holds[key])}>
                      <td className="whitespace-nowrap pr-4 text-slate-900">{label}</td>
                      <td className={holds[key] ? 'whitespace-nowrap pr-4 text-emerald-900' : 'whitespace-nowrap pr-4 text-slate-700'}>
                        {t(holds[key] ? 'playground.e1.holds' : 'playground.e1.fails')}
                      </td>
                      <td className="whitespace-nowrap text-[0.875em] text-slate-700">
                        {pair && `${truncatedRatio(pair[0], pair[1])} = ${COUNT.format(pair[0])} / ${COUNT.format(pair[1])}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {/* Beside the conjuncts rather than under the photograph: there it took two lines in
              English, and the first part ran 43 px past a 1024×768 panel (D100). */}
          {conjunctView && (
            <p data-testid="e1-legend" className="text-[0.875em] text-slate-700">{t('playground.e1.legend')}</p>
          )}
          {verdictView && (
            <>
              {(['cls', 'loc'] as const).map((h) => (
                <p
                  key={h}
                  data-testid={`e1-phi-${h}`}
                  data-holds={String(halves[h])}
                  className="font-mono text-[1em] text-slate-900"
                >
                  Φ<sub>{h}</sub>{' '}
                  <span className={halves[h] ? 'text-emerald-900' : 'text-slate-700'}>
                    {t(halves[h] ? 'playground.e1.holds' : 'playground.e1.fails')}
                  </span>
                </p>
              ))}
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
            </>
          )}
        </div>
      </div>
    </PlaygroundFrame>
  );
}
