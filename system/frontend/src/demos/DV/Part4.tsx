import { SceneGraphView } from '../../graph/SceneGraphView';
import { useLocale } from '../../i18n/useLocale';
import { TRADITIONAL, VLM, frameLabel, type VlmFrame } from '../data';
import { countText, predicateHistogram, traditionalTriplets } from '../logic';
import { summaryGraph } from './graph';

/**
 * The graph's height, in viewport heights: as tall as the panel allows beside the table at
 * 1024×768. Most summaries fit their box by its height, so Cytoscape's zoom, and with it the size
 * its canvas draws the labels at, grows with this figure.
 */
const GRAPH_VH = 38;

const CELL = 'py-0.5 pr-4';

/**
 * D-V, part 4: the summary.
 *
 * Step 3's summary for the chosen frame as a scene graph (`summaryGraph`, the counterpart of
 * `to_graph`), laid out by `dagre` from its structure alone: the method returns no geometry, so the
 * graph's placeholder boxes are never drawn and the caption says so. Beside it one table of the
 * predicates both pipelines produced over the ten frames, counted in rows: D-T's relations and the
 * rows of D-V's summaries, repeats included, as a histogram counts rows. Predicates of P come in
 * the prompt's order, which part 1 showed, then any other by its count. A summary with no triplet
 * draws no graph and says so.
 */
export function Part4({ frame }: { frame: VlmFrame }) {
  const { t } = useLocale();
  const dt = new Map(predicateHistogram(TRADITIONAL.frames.flatMap(traditionalTriplets)));
  const dv = new Map(predicateHistogram(VLM.frames.flatMap((f) => f.summary)));
  const rank = (p: string) => (VLM.P.includes(p) ? VLM.P.indexOf(p) : VLM.P.length);
  const total = (p: string) => (dt.get(p) ?? 0) + (dv.get(p) ?? 0);
  const predicates = [...new Set([...dv.keys(), ...dt.keys()])].sort(
    (a, b) => rank(a) - rank(b) || total(b) - total(a) || (a < b ? -1 : a > b ? 1 : 0),
  );

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p data-testid="dv-no-geometry" className="text-[0.75em] leading-tight text-slate-700">
          {t('demo.dv.graph_caption')
            .replace('{time}', frameLabel(frame.image_id))
            .replace('{rows}', countText(frame.summary.length))}
        </p>
        {frame.summary.length === 0 ? (
          <p data-testid="dv-graph-none" className="text-[0.75em] leading-tight text-slate-900">
            {t('demo.dv.no_triplet')}
          </p>
        ) : (
          <div
            data-testid="dv-graph"
            className="rounded border border-slate-300 bg-white"
            style={{ height: `${GRAPH_VH}vh` }}
          >
            <SceneGraphView graph={summaryGraph(frame)} layout="dagre" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 text-[0.75em] leading-tight text-slate-900 lg:shrink-0">
        <table data-testid="dv-hist" className="border-collapse">
          <caption className="whitespace-nowrap text-left font-semibold">
            {t('demo.dv.hist_caption').replace('{frames}', String(VLM.frames.length))}
          </caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className={`${CELL} text-left font-semibold`}>{t('demo.dv.predicate')}</th>
              <th scope="col" className={`${CELL} text-right font-semibold`}>{t('demo.dv.rows_dt')}</th>
              <th scope="col" className="py-0.5 text-right font-semibold">{t('demo.dv.rows_dv')}</th>
            </tr>
          </thead>
          <tbody>
            {predicates.map((p) => (
              <tr key={p} data-testid={`dv-hist-${p}`}>
                <th scope="row" className={`${CELL} whitespace-nowrap text-left font-normal`}>{p}</th>
                <td data-testid={`dv-hist-${p}-dt`} className={`${CELL} text-right tabular-nums`}>
                  {countText(dt.get(p) ?? 0)}
                </td>
                <td data-testid={`dv-hist-${p}-dv`} className="py-0.5 text-right tabular-nums">
                  {countText(dv.get(p) ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="max-w-[20em] text-slate-700">{t('demo.dv.hist_note')}</p>
      </div>
    </div>
  );
}
