import { useMemo } from 'react';
import type { Fidelity, SceneGraph } from 'sgg-metrics';
import { evaluate } from 'sgg-metrics';
import { MetricReadout } from '../../components/MetricReadout';
import { useLocale, type Locale } from '../../i18n/useLocale';
import { API_BASE, ApiFailure, messageOf } from '../api';
import type { Column, Failure, ModelRow } from './types';

const K = 20;

/**
 * The tier of a figure computed from a ground truth and a prediction: the weaker of the two.
 *
 * The engine tags every value `measured`, which is true of the comparison it ran and says nothing
 * of the graphs it was handed; only the caller knows those. A recall over a reconstructed
 * prediction is a reconstructed figure, and `measured` is the one tier D-07 reserves for a
 * model's own output. `published` is a figure quoted from a paper, which one computed here never
 * is, so anything short of two measured graphs is `reconstructed`.
 */
function computedFidelity(gt: SceneGraph, column: Column): Fidelity {
  return gt.provenance?.fidelity === 'measured' && column.fidelity === 'measured'
    ? 'measured'
    : 'reconstructed';
}

/**
 * The live run's refusal: the backend's sentence, then the reason its `detail` gives.
 *
 * The 503's message says only that the model cannot run here; what blocks it, `torch`, the
 * checkpoint or the wiring, is in `detail.reason_en` and `reason_zh` (contracts §1.1 names it
 * `reason`, which is read as well). The registry's reason on the column was true when the page
 * loaded, and this one is true now.
 */
function refusalText(error: unknown, locale: Locale): string {
  const detail = error instanceof ApiFailure ? (error.detail as Record<string, unknown> | null) : null;
  const reason = detail?.[locale === 'en' ? 'reason_en' : 'reason_zh'] ?? detail?.reason;
  const message = messageOf(error, locale);
  if (typeof reason !== 'string' || !reason) return message;
  // Chinese sentences close on 。 and are not spaced apart.
  return locale === 'en' ? `${message} ${reason}` : `${message}${reason}`;
}

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
 *
 * **A failed read is not an absent prediction.** `failures` are the models whose prediction could
 * not be read, a 404 excepted, and each is listed with its reason; "nothing to compare" is said
 * only when no column and no failure is left. `refusal` is the live run's failure, shown under
 * the button that asked for it. `hosted` is true on a static deployment, where the backend is a
 * small remote service with no `torch` and no checkpoint by design; the reason shown then says so,
 * rather than a missing-package sentence that reads as a fault to fix.
 */
export function MethodComparator({
  gt,
  columns,
  models,
  onInfer,
  failures = [],
  refusal = null,
  hosted = API_BASE !== '',
}: {
  gt: SceneGraph;
  columns: Column[];
  models: ModelRow[];
  onInfer: (model: string) => void;
  failures?: Failure[];
  refusal?: Failure | null;
  hosted?: boolean;
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
        const fidelity = computedFidelity(gt, column);
        return {
          column,
          metrics: body.metrics
            .filter((m) => m.metric === 'R' || m.metric === 'mR')
            .map((m) => ({ ...m, fidelity })),
        };
      }),
    [columns, gt],
  );

  const failed =
    failures.length > 0 ? (
      <ul data-testid="prediction-failures" className="space-y-1 rounded border border-amber-300
        bg-amber-50 p-3 text-sm text-amber-900">
        {failures.map(({ model, error }) => (
          <li key={model} data-testid={`prediction-failed-${model}`}>
            <span className="font-semibold">{byId.get(model)?.name ?? model}</span>
            {en
              ? `: ${t('l4.prediction_failed')} ${messageOf(error, locale)}`
              : `：${t('l4.prediction_failed')}${messageOf(error, locale)}`}
          </li>
        ))}
      </ul>
    ) : null;

  if (columns.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l4.heading')}</h1>
        {failed ?? (
          <p data-testid="no-columns" className="rounded border border-slate-200 bg-slate-50 p-4
            text-sm text-slate-600">
            {t('l4.no_columns')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l4.heading')}</h1>
        <p className="text-sm text-slate-600">{t('l4.subheading')}</p>
      </header>

      {failed}

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
                    {hosted
                      ? t('l4.live_hosted')
                      : ((en ? model.live_blocked_reason_en : model.live_blocked_reason_zh) ?? '')}
                  </p>
                ) : null}
                {refusal?.model === column.model ? (
                  <p data-testid={`refused-${column.model}`} role="alert"
                    className="text-xs text-amber-900">
                    {refusalText(refusal.error, locale)}
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
