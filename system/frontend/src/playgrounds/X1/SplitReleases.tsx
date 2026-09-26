import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame } from '../controls';
import { explain, splitDifference, valDisjointFromTest } from '../logic';
import { RELEASES, releaseById, type Figure, type Release, type Split } from '../splits';

/**
 * X1 — VG150 指涉數個發布版本.
 *
 * Every figure is shown with where it was read, and a figure no source states is shown as not
 * stated. The playground computes two things only: the difference between two stated counts, and
 * whether a release's validation set can overlap its test set. Where a sentence of the sources
 * states the same number as a difference, it names that sentence; where none does, it says so.
 * It never turns Xu's 70% of 108,077 into a count, because Xu et al. do not.
 */
const SPLITS: Split[] = ['train', 'val', 'test'];
const COUNT = new Intl.NumberFormat('en-US');
const DEFAULT_A = 'sgb-v2';
const DEFAULT_B = 'canonical';
const CODED: Record<string, string> = {
  trainval: 'playground.x1.from_trainval',
  test: 'playground.x1.from_test',
  kept: 'playground.x1.kept',
  dropped: 'playground.x1.dropped',
};

function signed(d: number): string {
  return d < 0 ? `−${COUNT.format(-d)}` : COUNT.format(d);
}

export function SplitReleases() {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({ 'X1.r': DEFAULT_A, 'X1.vs': DEFAULT_B });
  const fallback = releaseById(DEFAULT_A) ?? RELEASES[0]!;
  const a = releaseById(params['X1.r']) ?? fallback;
  const b = releaseById(params['X1.vs']) ?? releaseById(DEFAULT_B) ?? fallback;
  const label = (r: Release) => (locale === 'en' ? r.label_en : r.label_zh);

  const shown = (f: Figure | undefined): string => {
    if (!f || f.value === null) return t('playground.x1.not_stated');
    if (typeof f.value === 'number') return COUNT.format(f.value);
    return CODED[f.value] ? t(CODED[f.value]!) : f.value;
  };

  const equalities = SPLITS.flatMap((split) => {
    const d = splitDifference(a, b, split);
    if (d === null || d === 0) return [];
    return [{
      split, d,
      x: a.figures[split]!.value as number,
      y: b.figures[split]!.value as number,
      note: explain(d, [a, b]),
    }];
  });

  const hasPool = Boolean(a.figures.pool || b.figures.pool);
  const rows: ('pool' | 'val_from' | 'zero_relation')[] = hasPool
    ? ['pool', 'val_from', 'zero_relation']
    : ['val_from', 'zero_relation'];

  // One footnote per distinct source and locator, numbered in the order the figures appear.
  const used: (Figure | undefined)[] = [
    ...SPLITS.flatMap((s) => [a.figures[s], b.figures[s]]),
    ...rows.flatMap((row) => [a.figures[row], b.figures[row]]),
    ...equalities.map((e) => e.note),
  ];
  const footnotes = [
    ...new Set(used.flatMap((f) => (f ? [`${f.source}, ${f.locator}`] : []))),
  ];
  const mark = (f: Figure | undefined) =>
    f ? <sup>{footnotes.indexOf(`${f.source}, ${f.locator}`) + 1}</sup> : null;

  const disjoint = (r: Release) => {
    const v = valDisjointFromTest(r);
    return t(v === true ? 'playground.x1.disjoint_yes' : v === false ? 'playground.x1.disjoint_no' : 'playground.x1.disjoint_unknown');
  };

  const options = RELEASES.map((r) => ({ value: r.id, label: label(r) }));
  const controls = (
    <>
      <Choice id="X1.r" label={t('playground.x1.release')} value={a.id} options={options} onChange={(next) => setParams({ 'X1.r': next })} />
      <Choice id="X1.vs" label={t('playground.x1.compare')} value={b.id} options={options} onChange={(next) => setParams({ 'X1.vs': next })} />
    </>
  );

  const cell = 'px-2 py-1 text-left align-top';

  return (
    <PlaygroundFrame title="X1" controls={controls} clip={false}>
      <div className="flex flex-col gap-3">
        <table data-testid="x1-table" className="w-full border-collapse text-[1em] text-slate-900">
          <thead>
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
                  <th scope="row" className={`${cell} font-sans`}>{t(`playground.x1.${split}`)}</th>
                  <td data-testid={`x1-${split}-a`} className={cell}>{shown(a.figures[split])}{mark(a.figures[split])}</td>
                  <td data-testid={`x1-${split}-b`} className={cell}>{shown(b.figures[split])}{mark(b.figures[split])}</td>
                  <td data-testid={`x1-${split}-diff`} className={cell}>
                    {d === null ? <span className="font-sans text-slate-700">{t('playground.x1.no_difference')}</span> : signed(d)}
                  </td>
                </tr>
              );
            })}
            {rows.map((row) => (
              <tr key={row} data-testid={`x1-row-${row}`}>
                <th scope="row" className={`${cell} font-sans`}>{t(`playground.x1.${row}`)}</th>
                <td className={`${cell} font-sans`}>{shown(a.figures[row])}{mark(a.figures[row])}</td>
                <td className={`${cell} font-sans`}>{shown(b.figures[row])}{mark(b.figures[row])}</td>
                <td className={cell} />
              </tr>
            ))}
          </tbody>
        </table>
        {equalities.map((e) => (
          <p key={e.split} data-testid={`x1-equality-${e.split}`} data-explained={String(Boolean(e.note))} className="text-[1em] text-slate-700">
            <span className="font-mono text-slate-900">
              {t(`playground.x1.${e.split}`)}: {COUNT.format(e.x)} − {COUNT.format(e.y)} = {signed(e.d)}
            </span>{' '}
            {e.note ? (
              <>{t('playground.x1.equals')} {locale === 'en' ? e.note.text_en : e.note.text_zh}{mark(e.note)}</>
            ) : (
              t('playground.x1.unexplained')
            )}
          </p>
        ))}
        <p data-testid="x1-disjoint-a" className="text-[1em] text-slate-700">{label(a)}: {disjoint(a)}</p>
        <p data-testid="x1-disjoint-b" className="text-[1em] text-slate-700">{label(b)}: {disjoint(b)}</p>
        <div className="text-[0.875em] text-slate-700">
          <span className="font-medium">{t('playground.x1.sources')}</span>
          <ol data-testid="x1-sources" className="list-decimal pl-6">
            {footnotes.map((f) => <li key={f}>{f}</li>)}
          </ol>
        </div>
      </div>
    </PlaygroundFrame>
  );
}
