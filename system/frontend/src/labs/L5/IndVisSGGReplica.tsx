import { useMemo } from 'react';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../useLabParams';
import { AblationReplay } from './AblationReplay';
import { TABLE3 } from './tables';
import { TECEditor } from './TECEditor';
import { tripletsOf, type Example, type ReplicaRequest, type ReplicaResult } from './types';

/** The four counts Table 4 measures. Offering a fifth would put a run beside a row that is not. */
const EXPERT_COUNTS = [1, 2, 3, 5] as const;

const O_DEFAULT = ['worker', 'wrench', 'terminals', 'beam', 'panel', 'screwdriver', 'tape',
  'workbench'];
const P_DEFAULT = ['holding', 'knocking on', 'on', 'near', 'installing', 'above'];
const E_DEFAULT: Example[] = [
  {
    kind: 'positive',
    triplet: ['worker', 'knocking on', 'panel'],
    analysis: 'The hand contacts the panel repeatedly; `knocking on` is in the dictionary.',
  },
  {
    kind: 'negative',
    triplet: ['worker', 'taping', 'panel'],
    analysis: '`taping` is not in the dictionary, so this triplet cannot be scored at all.',
  },
];

/** Every prompt is readable. The paper's whole claim is that the prompt's arguments move R@20. */
function Prompt({ id, text, label }: { id: string; text: string; label: string }) {
  return (
    <details className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-sm">
      <summary className="cursor-pointer text-slate-700">{label}</summary>
      <pre data-testid={`prompt-${id}`} className="mt-2 overflow-x-auto whitespace-pre-wrap
        font-mono text-xs text-slate-800">
        {text}
      </pre>
    </details>
  );
}

/**
 * L5 — the three steps, the criteria, the expert count, and the prompts that carry them.
 *
 * The lab is a control surface over `POST /api/vlm/indvissgg`; `onRun` is the seam, so the
 * component is exercised without a backend and plan 04 wires the fetch. Nothing here computes a
 * metric: the replica's output is a triplet set, and the published numbers live in their own
 * panel under `AblationReplay`.
 */
export function IndVisSGGReplica({
  result,
  onRun,
}: {
  result: ReplicaResult | null;
  onRun: (req: ReplicaRequest) => void;
}) {
  const { locale, t } = useLocale();
  const en = locale === 'en';
  const [params, setParams] = useLabParams({
    n: 3,
    ablate: '' as string,
    provider: 'transcript' as string,
    O: '' as string,
    P: '' as string,
  });

  const ablate = useMemo(
    () =>
      params.ablate
        .split(',')
        .filter((x): x is 'O' | 'P' | 'E' => x === 'O' || x === 'P' || x === 'E'),
    [params.ablate],
  );
  const O = params.O ? params.O.split('|') : O_DEFAULT;
  const P = params.P ? params.P.split('|') : P_DEFAULT;
  const nExperts = (EXPERT_COUNTS as readonly number[]).includes(params.n)
    ? (params.n as 1 | 2 | 3 | 5)
    : 3;

  const toggle = (c: 'O' | 'P' | 'E') => {
    const next = ablate.includes(c) ? ablate.filter((x) => x !== c) : [...ablate, c];
    setParams({ ablate: next.sort().join(',') });
  };

  const own = {
    components: ['O', 'P', 'E'].filter((c) => !ablate.includes(c as 'O')).join('+'),
    // The last step that ran, which is what the student just looked at. Step 3 when the whole
    // pipeline ran, step 1 when only it was asked for.
    triplets: tripletsOf(result?.step3?.graph ?? result?.step1?.graph),
    fidelity: 'reconstructed' as const,
    note: result ? t('l5.replay_note') : null,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('l5.heading')}</h1>
        <p className="text-sm text-slate-600">{t('l5.subheading')}</p>
      </header>

      <TECEditor
        O={O}
        P={P}
        E={E_DEFAULT}
        onChange={(patch) =>
          setParams({
            ...(patch.O ? { O: patch.O.join('|') } : {}),
            ...(patch.P ? { P: patch.P.join('|') } : {}),
          })
        }
      />

      <section className="flex flex-wrap items-end gap-4 text-sm">
        <label className="space-y-1">
          <span className="block text-slate-700">{t('l5.n_experts')}</span>
          <select
            data-testid="n-experts"
            className="rounded border border-slate-300 px-2 py-1"
            value={nExperts}
            onChange={(e) => setParams({ n: Number(e.target.value) })}
          >
            {EXPERT_COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-1">
          <legend className="text-slate-700">{t('l5.ablate')}</legend>
          <div className="flex gap-3">
            {(['O', 'P', 'E'] as const).map((c) => (
              <label key={c} className="flex items-center gap-1">
                <input
                  data-testid={`ablate-${c}`}
                  type="checkbox"
                  checked={ablate.includes(c)}
                  onChange={() => toggle(c)}
                />
                <span className="font-mono">{c}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          data-testid="run"
          type="button"
          className="rounded bg-blue-700 px-4 py-2 text-white"
          onClick={() =>
            onRun({
              O,
              P,
              E: E_DEFAULT,
              n_experts: nExperts,
              ablate,
              provider: params.provider === 'claude' ? 'claude' : 'transcript',
            })
          }
        >
          {t('l5.run')}
        </button>
      </section>

      {result === null ? (
        <p data-testid="idle" className="rounded border border-slate-200 bg-slate-50 p-4 text-sm
          text-slate-600">
          {t('l5.idle')}
        </p>
      ) : (
        <section className="space-y-4">
          <p data-testid="provider-used" className="text-sm text-slate-600">
            {t('l5.provider_used')}: <span className="font-mono">{result.provider_used}</span>
          </p>

          {result.step1 ? (
            <div className="rounded border border-slate-200 p-3">
              <h2 className="text-sm font-semibold text-slate-800">{t('l5.step1')}</h2>
              <p className="text-sm text-slate-600">
                {t('l5.triplet_count')}: {result.step1.graph.relationships.length}
              </p>
              <Prompt id="step1" text={result.step1.prompt_shown} label={t('l5.show_prompt')} />
            </div>
          ) : null}

          {result.step2.map((expert) => (
            <div
              key={expert.expert_index}
              data-testid={`expert-${expert.expert_index}`}
              className="rounded border border-slate-200 p-3"
            >
              <h2 className="text-sm font-semibold text-slate-800">
                {t('l5.expert')} {expert.expert_index}
              </h2>
              <p className="text-sm text-slate-700">
                {en ? expert.analysis_en : expert.analysis_zh}
              </p>
              <Prompt
                id={`expert-${expert.expert_index}`}
                text={expert.prompt_shown}
                label={t('l5.show_prompt')}
              />
            </div>
          ))}

          {result.step3 ? (
            <div className="rounded border border-slate-200 p-3">
              <h2 className="text-sm font-semibold text-slate-800">{t('l5.step3')}</h2>
              <p className="text-sm text-slate-600">
                {t('l5.triplet_count')}: {result.step3.graph.relationships.length}
              </p>
              <Prompt id="step3" text={result.step3.prompt_shown} label={t('l5.show_prompt')} />
            </div>
          ) : null}
        </section>
      )}

      <AblationReplay published={TABLE3} own={own} />
    </div>
  );
}
