import { useState, type ChangeEvent } from 'react';
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

  // The raw text of a field while it is being typed in. Shown from the parsed value instead, a
  // trailing space or newline would be trimmed before the next word arrived and a cleared list
  // would refill with the defaults. Each keystroke still reports the parsed value, so a run gets
  // what is typed; blur hands the field back to the parsed value.
  const [typing, setTyping] = useState<Record<string, string>>({});
  const typed = (id: string, parsed: string, report: (raw: string) => void) => ({
    value: typing[id] ?? parsed,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      setTyping((all) => ({ ...all, [id]: raw }));
      report(raw);
    },
    onBlur: () =>
      setTyping((all) => {
        const rest = { ...all };
        delete rest[id];
        return rest;
      }),
  });

  const list = (key: 'O' | 'P', values: string[], label: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        data-testid={`edit-${key}`}
        className="h-32 w-full rounded border border-slate-300 p-2 font-mono text-sm"
        {...typed(key, values.join('\n'), (raw) =>
          onChange({
            [key]: raw
              .split('\n')
              .map((x) => x.trim())
              .filter(Boolean),
          }),
        )}
      />
    </label>
  );

  const patchExample = (i: number, patch: Partial<Example>) =>
    onChange({ E: E.map((ex, j) => (j === i ? { ...ex, ...patch } : ex)) });

  // A triplet is reported only once it has three named parts: the request takes a triple, and
  // "worker, knocking" on its way to "worker, knocking on, panel" is not one.
  const patchTriplet = (i: number, raw: string) => {
    const parts = raw.split(',').map((x) => x.trim());
    if (parts.length === 3 && parts.every(Boolean)) patchExample(i, { triplet: parts as Triplet });
  };

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
                {...typed(`example-${i}-triplet`, ex.triplet.join(', '), (raw) =>
                  patchTriplet(i, raw),
                )}
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
