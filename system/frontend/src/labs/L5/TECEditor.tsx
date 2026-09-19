import { useLocale } from '../../i18n/useLocale';
import type { Example, Triplet } from './types';

/**
 * The Triplets Extraction Criteria, as three editable lists.
 *
 * `E` is a list of examples **each carrying its analysis**, and the editor refuses to let one go
 * quietly missing. SRS §6 makes examples-with-analysis the third ablation dimension of Table 3,
 * so an example stripped of its analysis is not a smaller `E`; it is a different `E`, and the
 * paper measured neither. A blank analysis therefore draws a warning rather than being accepted
 * as an empty string.
 */
export function TECEditor({
  O,
  P,
  E,
  onChange,
}: {
  O: string[];
  P: string[];
  E: Example[];
  onChange: (patch: { O?: string[]; P?: string[]; E?: Example[] }) => void;
}) {
  const { t } = useLocale();

  const list = (key: 'O' | 'P', values: string[], label: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        data-testid={`edit-${key}`}
        className="h-32 w-full rounded border border-slate-300 p-2 font-mono text-sm"
        value={values.join('\n')}
        onChange={(e) =>
          onChange({
            [key]: e.target.value
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean),
          })
        }
      />
    </label>
  );

  const patchExample = (i: number, patch: Partial<Example>) =>
    onChange({ E: E.map((ex, j) => (j === i ? { ...ex, ...patch } : ex)) });

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {list('O', O, t('l5.objects'))}
      {list('P', P, t('l5.predicates'))}

      <div className="md:col-span-2 space-y-3">
        <h3 className="text-sm font-medium text-slate-700">{t('l5.examples')}</h3>
        {E.length === 0 ? <p className="text-sm text-slate-500">{t('l5.no_examples')}</p> : null}
        {E.map((ex, i) => (
          <div key={i} className="space-y-1 rounded border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-sm">
              <select
                data-testid={`example-${i}-kind`}
                className="rounded border border-slate-300 px-2 py-1"
                value={ex.kind}
                onChange={(e) =>
                  patchExample(i, { kind: e.target.value as Example['kind'] })
                }
              >
                <option value="positive">{t('l5.positive')}</option>
                <option value="negative">{t('l5.negative')}</option>
              </select>
              <input
                data-testid={`example-${i}-triplet`}
                className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono"
                value={ex.triplet.join(', ')}
                onChange={(e) =>
                  patchExample(i, {
                    triplet: e.target.value.split(',').map((x) => x.trim()) as Triplet,
                  })
                }
              />
            </div>
            <textarea
              data-testid={`example-${i}-analysis`}
              className="w-full rounded border border-slate-300 p-2 text-sm"
              value={ex.analysis}
              onChange={(e) => patchExample(i, { analysis: e.target.value })}
            />
            {ex.analysis.trim() ? null : (
              <p
                data-testid={`example-${i}-warning`}
                className="rounded bg-amber-50 p-2 text-xs text-amber-900"
              >
                {t('l5.analysis_required')}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
