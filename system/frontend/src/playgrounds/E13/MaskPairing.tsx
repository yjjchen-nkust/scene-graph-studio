import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { PlaygroundFrame, Readout, Slider, Toggle } from '../controls';
import { admitByMask, capPerPair, flag, matchedByMask, snap } from '../logic';
import { M4_FRAME } from '../M4/ranking';
import type { PlaygroundProps } from '../mounts';
import { frameById } from '../slice';
import { e13Copies, type MaskRow } from './setup';

/** d runs 1 to 5: `E13_COPIES` names only that many scores. */
const D_MAX = 5;
const D_DEFAULT = 3;

/** The ground truth this playground watches for: relationship 4, person(2) holding wrench(5). */
const G4_ID = 4;

/**
 * E13 — predictions admitted at one mask pair.
 *
 * `d` copies of ph-001's person–wrench mask pair (`e13Copies`), each its own pair of object ids
 * but every one keyed on the same mask pair, run through the engine's own order: the pairing
 * first (`admitByMask`, SingleMPO keeps the first copy of a mask pair, MultiMPO keeps every one),
 * then the graph constraint (`capPerPair(..., 1)`, which drops nothing here since each admitted
 * copy is its own object pair), then whether g4 -- person holding wrench -- is found among what
 * is kept (`matchedByMask`). No photograph: ph-001 carries no masks, so the copies are drawn as a
 * list rather than boxes.
 *
 * Computes three counts and one membership. No metric. One part: unlike E3, E4 and E7, nothing
 * here is a photograph plus a list, so there is nothing D96 would split.
 */
export function MaskPairing(_: PlaygroundProps = {}) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'E13.multi': 0, 'E13.d': D_DEFAULT });

  const multi = flag(params['E13.multi'], false);
  const d = snap(params['E13.d'], 1, D_MAX, 1);

  const emitted: MaskRow[] = e13Copies(d);
  const admitted = admitByMask(emitted, multi);
  const admittedSet = new Set(admitted);
  const kept = capPerPair(admitted, 1);

  const frame = frameById(M4_FRAME)!;
  const matchedIds = matchedByMask(kept, frame.relationships);
  const g4 = matchedIds.includes(G4_ID);
  // What the yes/no rests on: the predicates the graph constraint actually kept, in score order,
  // so the note varies with the value rather than repeating the label's own words.
  const separator = locale === 'zh-TW' ? '、' : ', ';
  const g4Note = t('playground.e13.g4_note').replace('{predicates}', kept.map((row) => row.predicate).join(separator));

  const controls = (
    <>
      <Toggle
        id="E13.multi"
        label={t('playground.e13.multi')}
        checked={multi}
        onChange={(on) => setParams({ 'E13.multi': on ? 1 : 0 })}
      />
      <Slider
        id="E13.d"
        label={t('playground.e13.d')}
        value={d}
        min={1}
        max={D_MAX}
        step={1}
        onChange={(next) => setParams({ 'E13.d': next })}
        valueLabel={String(d)}
      />
    </>
  );

  return (
    <PlaygroundFrame title="E13" controls={controls} clip={false}>
      <div className="flex flex-col gap-2">
        <table data-testid="e13-copies" className="w-full font-mono text-[0.75em] leading-none">
          <caption className="text-left font-sans text-[1em] leading-none text-slate-700">
            {t('playground.e13.list')}
          </caption>
          <tbody>
            {emitted.map((row, index) => {
              const i = index + 1;
              const isAdmitted = admittedSet.has(row);
              return (
                <tr
                  key={`e13-copy-${i}`}
                  data-testid={`e13-copy-${i}`}
                  data-admitted={String(isAdmitted)}
                  className={isAdmitted ? 'text-slate-900' : 'text-slate-700 line-through'}
                >
                  <th scope="row" className="py-0 pl-2 pr-4 text-left font-sans">{i}</th>
                  <td className="py-0 pr-4">{row.predicate}</td>
                  <td className="py-0 pr-4 text-right tabular-nums">{row.score.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <Readout id="E13.emitted" label={t('playground.e13.emitted')} value={String(emitted.length)} note="d" />
          <Readout
            id="E13.admitted"
            label={t('playground.e13.admitted')}
            value={String(admitted.length)}
            note={t('playground.e13.admitted_note')}
          />
          <Readout
            id="E13.kept"
            label={t('playground.e13.kept')}
            value={String(kept.length)}
            note={t('playground.e13.kept_note')}
          />
          <Readout
            id="E13.g4"
            label={t('playground.e13.g4')}
            value={t(g4 ? 'playground.e13.yes' : 'playground.e13.no')}
            note={g4Note}
          />
        </div>
        <p className="text-[0.875em] leading-tight text-slate-700">{t('playground.e13.masks')}</p>
      </div>
    </PlaygroundFrame>
  );
}
