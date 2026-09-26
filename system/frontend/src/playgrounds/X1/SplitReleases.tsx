import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame } from '../controls';
import type { PlaygroundProps } from '../mounts';
import { explain, splitDifference, valPool } from '../logic';
import { RELEASES, releaseById, type Figure, type Release, type Split } from '../splits';

/**
 * X1 — VG150 指涉數個發布版本.
 *
 * Every figure is shown with where it was read, and a figure no source states is shown as not
 * stated. The playground computes two things only: the difference between two stated counts, and
 * the pool a release draws its validation set from, as its source states it. Where a sentence of
 * the sources states the same number as a difference, it names that sentence; where none does, it
 * says so.
 * It never turns Xu's 70% of 108,077 into a count, because Xu et al. do not.
 */
const SPLITS: Split[] = ['train', 'val', 'test'];
const COUNT = new Intl.NumberFormat('en-US');
const DEFAULT_A = 'sgb-v2';
const DEFAULT_B = 'canonical';
const CODED: Record<string, string> = {
  kept: 'playground.x1.kept',
  dropped: 'playground.x1.dropped',
};

function signed(d: number): string {
  return d < 0 ? `−${COUNT.format(-d)}` : COUNT.format(d);
}

/** Three parts on the lecture's projector (D96), each citing only what it shows, numbered from one. */
export function SplitReleases({ part }: PlaygroundProps = {}) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'X1.r': DEFAULT_A, 'X1.vs': DEFAULT_B });
  const fallback = releaseById(DEFAULT_A) ?? RELEASES[0]!;
  const a = releaseById(params['X1.r']) ?? fallback;
  const b = releaseById(params['X1.vs']) ?? releaseById(DEFAULT_B) ?? fallback;
  const label = (r: Release) => (locale === 'en' ? r.label_en : r.label_zh);
  // Chinese takes a full-width colon with no space after it; English a colon and a space.
  const colon = locale === 'en' ? ': ' : '：';
  const gap = locale === 'en' ? ' ' : '';
  const semicolon = locale === 'en' ? '; ' : '；';
  // The source and its locator stay verbatim, being names and headings; the comma between them
  // is the locale's.
  const cite = (f: Figure) => `${f.source}${locale === 'en' ? ', ' : '，'}${f.locator}`;

  const shown = (f: Figure | undefined): string => {
    if (!f || f.value === null) return t('playground.x1.not_stated');
    if (typeof f.value === 'number') return COUNT.format(f.value);
    return CODED[f.value] ? t(CODED[f.value]!) : f.value;
  };
  // A figure is monospaced so its digits align; a sentence in its place is set in the text face,
  // where "not stated by the source" had taken three lines of a narrow column.
  const face = (f: Figure | undefined) => (f && f.value !== null ? '' : ' font-sans');

  const equalities = SPLITS.flatMap((split) => {
    const d = splitDifference(a, b, split);
    if (d === null || d === 0) return [];
    return [{
      split, d,
      x: a.figures[split]!.value as number,
      y: b.figures[split]!.value as number,
      note: explain(d, split, [a, b]),
    }];
  });

  // Three parts on the lecture's projector (D96): the counts, the sentences their differences
  // equal, and where each release draws validation from and what it does with images that carry
  // no relation. Mounted without a part, as its unit tests mount it, it is all three.
  const counts = part === undefined || part === 1;
  const reasons = part === undefined || part === 2;
  const provenance = part === undefined || part === 3;
  // Xu's pool is a count of images, so it stands with the counts.
  const countRows: (Split | 'pool')[] = a.figures.pool || b.figures.pool ? [...SPLITS, 'pool'] : SPLITS;

  // One footnote per distinct source and locator, numbered in the order the figures appear on
  // the part being shown.
  const used: (Figure | undefined)[] = [
    ...(counts ? countRows.flatMap((row) => [a.figures[row], b.figures[row]]) : []),
    ...(reasons ? equalities.map((e) => e.note) : []),
    ...(provenance ? [a, b].flatMap((r) => [r.figures.val_from, r.figures.zero_relation]) : []),
  ];
  const footnotes = [
    ...new Set(used.flatMap((f) => (f ? [cite(f)] : []))),
  ];
  const mark = (f: Figure | undefined) =>
    f ? <sup>{footnotes.indexOf(cite(f)) + 1}</sup> : null;

  // The card states the train/val pool's validation set disjoint from test, and states only the
  // pool for v1's; each key's text says no more than its source.
  const disjoint = (r: Release) => {
    const pool = valPool(r);
    return t(pool === 'trainval' ? 'playground.x1.disjoint_yes' : pool === 'test' ? 'playground.x1.disjoint_no' : 'playground.x1.disjoint_unknown');
  };

  const options = RELEASES.map((r) => ({ value: r.id, label: label(r) }));
  const controls = (
    <>
      {/* One row, not two: each part of X1 is a step that shows 561 px at 1024×768 (D96). The
          table's header names both releases in full. */}
      <Choice id="X1.r" label={t('playground.x1.release')} value={a.id} options={options} width="max-w-[20rem]" onChange={(next) => setParams({ 'X1.r': next })} />
      <Choice id="X1.vs" label={t('playground.x1.compare')} value={b.id} options={options} width="max-w-[20rem]" onChange={(next) => setParams({ 'X1.vs': next })} />
    </>
  );

  const cell = 'px-2 py-0.5 text-left align-top';
  // Figures and differences on one line; the release labels in the header wrap instead. A
  // wrapped 非皆為張數 cost a line in each of three rows at 1024 px.
  const figureCell = `${cell} whitespace-nowrap`;
  // A row's name on one line: wrapped, 訓練集 took two lines in every row at 1024 px.
  const rowHead = `${cell} whitespace-nowrap font-sans`;

  return (
    <PlaygroundFrame title="X1" controls={controls} clip={false}>
      <div className="flex flex-col gap-3">
        {counts && (
          <table data-testid="x1-table" className="w-full border-collapse text-[1em] text-slate-900">
            {/* The release labels are the longest words in the table, and a step shows 561 px. */}
            <thead className="text-[0.875em]">
              <tr className="text-slate-700">
                <th scope="col" className={cell}>{t('playground.x1.split')}</th>
                <th scope="col" className={cell}>{label(a)}</th>
                <th scope="col" className={cell}>{label(b)}</th>
                <th scope="col" className={cell}>{t('playground.x1.difference')}</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {SPLITS.map((split) => {
                const d = splitDifference(a, b, split);
                return (
                  <tr key={split}>
                    <th scope="row" className={rowHead}>{t(`playground.x1.${split}`)}</th>
                    <td data-testid={`x1-${split}-a`} className={`${figureCell}${face(a.figures[split])}`}>{shown(a.figures[split])}{mark(a.figures[split])}</td>
                    <td data-testid={`x1-${split}-b`} className={`${figureCell}${face(b.figures[split])}`}>{shown(b.figures[split])}{mark(b.figures[split])}</td>
                    <td data-testid={`x1-${split}-diff`} className={figureCell}>
                      {d === null ? <span className="font-sans text-slate-700">{t('playground.x1.no_difference')}</span> : signed(d)}
                    </td>
                  </tr>
                );
              })}
              {countRows.includes('pool') && (
                <tr data-testid="x1-row-pool">
                  <th scope="row" className={rowHead}>{t('playground.x1.pool')}</th>
                  <td className={`${figureCell}${face(a.figures.pool)}`}>{shown(a.figures.pool)}{mark(a.figures.pool)}</td>
                  <td className={`${figureCell}${face(b.figures.pool)}`}>{shown(b.figures.pool)}{mark(b.figures.pool)}</td>
                  <td className={cell} />
                </tr>
              )}
            </tbody>
          </table>
        )}
        {reasons && equalities.length === 0 && (
          // Nothing to subtract, or nothing that differs: Xu states shares, which is not agreement.
          <p data-testid="x1-no-equality" className="text-[1em] text-slate-700">
            {t(SPLITS.some((s) => splitDifference(a, b, s) !== null) ? 'playground.x1.counts_agree' : 'playground.x1.no_common_count')}
          </p>
        )}
        {reasons && equalities.map((e) => (
          <p key={e.split} data-testid={`x1-equality-${e.split}`} data-explained={String(Boolean(e.note))} className="text-[1em] text-slate-700">
            <span className="font-mono text-slate-900">
              {t(`playground.x1.${e.split}`)}{colon}{COUNT.format(e.x)} − {COUNT.format(e.y)} = {signed(e.d)}
            </span>{' '}
            {e.note ? (
              // A negative difference is matched by its magnitude (`explain`), so it says so
              // rather than claiming that −4,844 equals a count of 4,844 images.
              <>
                {t(e.d < 0 ? 'playground.x1.magnitude_equals' : 'playground.x1.equals')}
                {gap}
                {locale === 'en' ? e.note.text_en : e.note.text_zh}
                {mark(e.note)}
              </>
            ) : (
              t('playground.x1.unexplained')
            )}
          </p>
        ))}
        {provenance && [a, b].map((r, i) => (
          // One line a release: where its validation comes from, and what becomes of an image
          // with no relation. These were two table rows and a line each below them, and the
          // first row said a second time where validation is drawn from.
          <p key={i} data-testid={`x1-disjoint-${i === 0 ? 'a' : 'b'}`} className="text-[1em] text-slate-700">
            {label(r)}{colon}{disjoint(r)}{mark(r.figures.val_from)}{semicolon}
            {t('playground.x1.zero_relation')}{colon}{shown(r.figures.zero_relation)}{mark(r.figures.zero_relation)}
          </p>
        ))}
        {footnotes.length > 0 && (
          // One flowing line rather than a line a source, numbered as the marks are.
          <div className="text-[0.875em] text-slate-700">
            <span className="font-medium">{t('playground.x1.sources')}</span>{colon}
            {/* role="list": an inline list without markers loses the role in WebKit. */}
            <ol data-testid="x1-sources" role="list" className="inline">
              {footnotes.map((f, i) => <li key={f} className="mr-4 inline">{i + 1}. {f}</li>)}
            </ol>
          </div>
        )}
      </div>
    </PlaygroundFrame>
  );
}
