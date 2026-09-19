import { useMemo } from 'react';
import type { SceneGraph } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';
import { MetricReadout } from '../../components/MetricReadout';
import { useLocale } from '../../i18n/useLocale';
import type { Column, ModelRow } from './types';

const K = 20;

/**
 * L4 — one frame, several methods, one ground truth.
 *
 * Two-stage, one-stage and the VLM pipeline stand in the same comparison, which is the lesson:
 * they are different kinds of system answering the same question, and a column that hides which
 * kind it is makes the comparison meaningless. So every column carries a provenance chip, and a
 * `reconstructed` column carries its note on the page rather than behind a click — a note a
 * reader has to ask for is a note a reader does not read.
 *
 * **The live button follows the registry, not `torch_present`.** Plan 03 Task 9 keys it on
 * `/api/health`'s torch flag; liveness needs `torch` *and* a checkpoint (DEVIATIONS D37), and the
 * registry already states the reason in both languages. Asking a second source would reproduce
 * exactly the disagreement D37 records.
 */
export function MethodComparator({
  gt,
  columns,
  models,
  onInfer,
}: {
  gt: SceneGraph;
  columns: Column[];
  models: ModelRow[];
  onInfer: (model: string) => void;
}) {
  const { locale, t } = useLocale();
  const en = locale === 'en';
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  const scored = useMemo(
    () =>
      columns.map((column) => {
        const body = evaluate({
          gt,
          pred: column.graph,
          protocol: 'sgdet',
          constraint: 'graph',
          k: [K],
          iou_thresh: 0.5,
          mask_pairing: 'single_mpo',
        });
        return { column, metrics: body.metrics.filter((m) => m.metric === 'R' || m.metric === 'mR') };
      }),
    [columns, gt],
  );

  if (columns.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l4.heading')}</h1>
        <p data-testid="no-columns" className="rounded border border-slate-200 bg-slate-50 p-4
          text-sm text-slate-600">
          {t('l4.no_columns')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l4.heading')}</h1>
        <p className="text-sm text-slate-600">{t('l4.subheading')}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scored.map(({ column, metrics }) => {
          const model = byId.get(column.model);
          const reconstructed = column.fidelity !== 'measured';
          return (
            <section
              key={column.model}
              data-testid={`column-${column.model}`}
              className={`space-y-3 rounded border-2 p-4 ${
                reconstructed ? 'border-dashed border-amber-400 bg-amber-50'
                              : 'border-slate-300 bg-white'
              }`}
            >
              <header className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  {model?.name ?? column.model}
                </h2>
                <p className="text-xs text-slate-600">
                  {model ? `${model.venue} ${model.year} · ${model.family}` : column.model}
                </p>
                <span
                  data-testid="provenance-chip"
                  data-fidelity={column.fidelity}
                  className={
                    reconstructed
                      ? 'inline-block rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900'
                      : 'inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900'
                  }
                >
                  {t(reconstructed ? 'l4.chip_reconstructed' : 'l4.chip_measured')}
                </span>
              </header>

              {reconstructed && column.note ? (
                <p data-testid="reconstructed-note" className="rounded bg-white/70 p-2 text-xs
                  text-amber-900">
                  {column.note}
                </p>
              ) : null}

              <div data-testid="metrics" className="space-y-2">
                {metrics.map((m) => (
                  <MetricReadout key={`${m.metric}@${m.k}`} value={m} />
                ))}
              </div>

              <footer className="space-y-1 border-t border-slate-200 pt-2">
                <p data-testid={`latency-${column.model}`} className="text-xs text-slate-600">
                  {model?.estimated_seconds_per_image != null
                    ? `${t('l4.latency')}: ${model.estimated_seconds_per_image.toFixed(1)} s`
                    : t('l4.latency_unmeasured')}
                </p>
                <button
                  data-testid={`infer-${column.model}`}
                  type="button"
                  disabled={!model?.live}
                  className="rounded bg-blue-700 px-3 py-1 text-sm text-white disabled:bg-slate-300
                    disabled:text-slate-600"
                  onClick={() => onInfer(column.model)}
                >
                  {t('l4.run_live')}
                </button>
                {model && !model.live ? (
                  <p data-testid={`blocked-${column.model}`} className="text-xs text-slate-600">
                    {(en ? model.live_blocked_reason_en : model.live_blocked_reason_zh) ?? ''}
                  </p>
                ) : null}
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
