import { useLocale } from '../../i18n/useLocale';
import { Readout } from '../../playgrounds/controls';
import { TRADITIONAL, frameLabel, type TraditionalFrame } from '../data';
import { candidateTriplets, orderedPairs } from '../logic';

const COUNT = new Intl.NumberFormat('en-US');

/** The most objects whose grid of ordered pairs is drawn; past it, a sentence states its size. */
const GRID_MAX = 8;

/**
 * D-T, part 2: pair explosion.
 *
 * The chosen frame's n detections, its n(n − 1) ordered pairs and the n(n − 1)·|P| candidate
 * triplets with VG150's |P| = 50, beside the same count summed over the ten frames; then the
 * ordered pairs themselves as an n × n grid, a `✓` for each pair and `—` on the diagonal, where an
 * object would be paired with itself. Zero or one detection has no pair and no grid, and says so;
 * more than `GRID_MAX` objects is stated rather than drawn.
 */
export function Part2({ frame }: { frame: TraditionalFrame }) {
  const { t } = useLocale();
  const P = TRADITIONAL.vg150_predicate_count;
  const n = frame.detections.length;
  const all = TRADITIONAL.frames.reduce((sum, f) => sum + candidateTriplets(f.detections.length, P), 0);

  let grid;
  if (n < 2) {
    grid = (
      <p data-testid="dt-grid-none" className="text-[0.75em] leading-tight text-slate-900">
        {t('demo.dt.grid_none').replace('{n}', String(n))}
      </p>
    );
  } else if (n > GRID_MAX) {
    grid = (
      <p data-testid="dt-grid-large" className="text-[0.75em] leading-tight text-slate-900">
        {t('demo.dt.grid_large').replace('{n}', String(n)).replace('{cells}', COUNT.format(n * n))}
      </p>
    );
  } else {
    grid = (
      <>
        <p className="text-[0.75em] leading-tight text-slate-700">{t('demo.dt.grid_caption')}</p>
        <table data-testid="dt-grid" className="mt-1 border-collapse text-[0.75em] leading-tight text-slate-900">
          <thead>
            <tr className="border-b border-slate-300">
              <td />
              {frame.detections.map((o) => (
                <th key={o.object_id} scope="col" className="px-2 font-semibold tabular-nums">{`#${o.object_id}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {frame.detections.map((s) => (
              <tr key={s.object_id}>
                <th scope="row" className="whitespace-nowrap pr-3 text-left font-normal">
                  {`#${s.object_id} ${s.label}`}
                </th>
                {frame.detections.map((o) => (
                  <td
                    key={o.object_id}
                    data-testid={`dt-pair-${s.object_id}-${o.object_id}`}
                    className={s.object_id === o.object_id ? 'px-2 text-center text-slate-700' : 'px-2 text-center'}
                  >
                    {s.object_id === o.object_id ? '—' : '✓'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 lg:shrink-0">
        <Readout
          id="DT.objects"
          label={t('demo.dt.objects')}
          value={COUNT.format(n)}
          note={t('demo.dt.objects_note').replace('{time}', frameLabel(frame.image_id))}
        />
        <Readout id="DT.pairs" label={t('demo.dt.pairs')} value={COUNT.format(orderedPairs(n))} note="n(n−1)" />
        <Readout
          id="DT.candidates"
          label={t('demo.dt.candidates')}
          value={COUNT.format(candidateTriplets(n, P))}
          note={`n(n−1)·|P|, |P| = ${P}`}
        />
        <Readout
          id="DT.candidates_all"
          label={t('demo.dt.candidates_all')}
          value={COUNT.format(all)}
          note={t('demo.dt.candidates_all_note').replace('{frames}', String(TRADITIONAL.frames.length))}
        />
      </div>
      <div className="min-w-0 flex-1">{grid}</div>
    </div>
  );
}
