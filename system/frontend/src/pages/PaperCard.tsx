import { MetricReadout } from '../components/MetricReadout';
import { useLocale } from '../i18n/useLocale';
import { byKey, type PaperCardData } from './papers';

/**
 * One paper, with its numbers and where they came from.
 *
 * Every figure goes through `MetricReadout`, which will not take a bare number, so a recall
 * figure on this page carries its k, its protocol and its constraint mode exactly as one in a lab
 * does. `fidelity` is `published` and `source` is the paper the table sits in — which is not
 * always this card's own paper, because a figure for MOTIFS printed in IndVisSGG's Table 2 is a
 * figure IndVisSGG reports. The row says so.
 *
 * There is no unverified tier (D-21). A number this project has not read off a named table is not
 * here at all, so `verified` is true on every row and the absence of numbers on a card is the
 * honest statement that nobody has opened its table yet.
 */
export function PaperCard({ paper }: { paper: PaperCardData }) {
  const { locale, t } = useLocale();
  const en = locale === 'en';
  const predecessor = paper.predecessor ? byKey(paper.predecessor) : undefined;

  return (
    <article data-testid={`paper-${paper.key}`} data-tier={paper.tier} className="space-y-4">
      <header>
        <h2 className="font-mono text-xl text-slate-900">{paper.key}</h2>
        <p className="text-sm text-slate-600">
          {paper.venue} · {paper.year} ·{' '}
          <span data-testid="tier">{t(paper.tier === 'A' ? 'paper.tier_a' : 'paper.tier_b')}</span>
        </p>
      </header>

      <p className="text-slate-800">{en ? paper.core_idea_en : paper.core_idea_zh}</p>

      {predecessor ? (
        <p data-testid="predecessor" className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="text-slate-600">{t('paper.fixes')} </span>
          <span className="font-mono">{predecessor.key}</span>
          {': '}
          {en ? paper.defect_fixed_en : paper.defect_fixed_zh}
        </p>
      ) : null}

      {paper.caveat_en ? (
        <p data-testid="caveat" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {en ? paper.caveat_en : paper.caveat_zh}
        </p>
      ) : null}

      {paper.reported.length === 0 ? (
        <p data-testid="no-numbers" className="text-sm text-slate-600">
          {t('paper.no_numbers')}
        </p>
      ) : (
        <section>
          {/* Not a leaderboard. The rows are from different tables under different conditions and
              nothing here ranks them; contracts §3.2 and M11 §9 both say why. */}
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t('paper.reported')}
          </h3>
          <p className="mb-3 text-xs text-amber-800">{t('paper.not_comparable')}</p>
          <ul className="space-y-2">
            {paper.reported.map((r, i) => (
              <li key={`${r.dataset}-${r.metric}-${r.k}-${r.source}-${i}`} className="text-sm">
                <MetricReadout
                  value={{
                    value: r.value / 100,
                    metric: r.metric,
                    k: r.k,
                    protocol: r.protocol as 'predcls' | 'sgcls' | 'sgdet',
                    constraint: r.constraint as 'graph' | 'none' | 'semi',
                    source: `${r.source} ${r.source_table}`,
                    verified: r.verified,
                    fidelity: 'published',
                  }}
                />
                <span className="ml-2 text-slate-600">{r.dataset}</span>
                {r.note_en ? (
                  <span className="ml-2 text-xs text-slate-500">{en ? r.note_en : r.note_zh}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap gap-4 text-sm">
        {paper.url ? (
          <a href={paper.url} className="text-blue-700 underline" rel="noreferrer" target="_blank">
            {paper.doi ? `doi:${paper.doi}` : `arXiv:${paper.arxiv}`}
          </a>
        ) : null}
        {paper.modules.length ? (
          <span className="text-slate-600">
            {t('paper.taught_in')}: <span className="font-mono">{paper.modules.join(', ')}</span>
          </span>
        ) : null}
      </footer>
    </article>
  );
}
