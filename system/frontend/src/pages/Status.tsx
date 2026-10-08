import { useQuery } from '@tanstack/react-query';
import { useLocale } from '../i18n/useLocale';
import { API_BASE } from '../labs/api';

interface HealthResponse {
  status: 'ok';
  version: string;
  torch_present: boolean;
  torch_version: string | null;
  cuda_available: boolean;
  device: 'cpu' | 'cuda';
  live_models: string[];
  vlm_provider: 'transcript' | 'claude';
  slices_present: Record<string, boolean>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-slate-200 py-2 last:border-0">
      <dt className="w-64 shrink-0 text-sm text-slate-600">{label}</dt>
      <dd className="font-mono text-slate-900">{children}</dd>
    </div>
  );
}

export default function Status() {
  const { locale, t, setLocale } = useLocale();
  const { data, isPending, isError } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/health`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    staleTime: Infinity,
    retry: false,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{t('app.title')}</h1>
          <p className="mt-1 text-slate-600">{t('app.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW')}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          {t('lang.toggle')}
        </button>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('health.heading')}
        </h2>
        {isPending && <p className="text-slate-500">{t('health.loading')}</p>}
        {isError && (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t('health.error')}
          </p>
        )}
        {data && (
          <dl>
            <Row label={t('health.version')}>{data.version}</Row>
            <Row label={t('health.torch')}>
              {data.torch_present ? data.torch_version : t('health.torch.absent')}
            </Row>
            <Row label={t('health.device')}>{data.device}</Row>
            <Row label={t('health.live_models')}>
              {data.live_models.length
                ? data.live_models.join(', ')
                : t('health.live_models.none')}
            </Row>
            <Row label={t('health.vlm')}>{data.vlm_provider}</Row>
          </dl>
        )}
      </section>

      {data && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('slices.heading')}
          </h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-3">
            {Object.entries(data.slices_present).map(([ds, present]) => (
              <li key={ds} className="flex items-baseline justify-between gap-2">
                <span className="text-slate-800">{ds}</span>
                <span className={present ? 'text-emerald-700' : 'text-slate-400'}>
                  {present ? t('slices.present') : t('slices.absent')}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-600">{t('slices.hint')}</p>
        </section>
      )}

      <footer className="border-t border-slate-200 pt-4 text-sm text-slate-600">
        {t('offline.note')}
      </footer>
    </main>
  );
}
