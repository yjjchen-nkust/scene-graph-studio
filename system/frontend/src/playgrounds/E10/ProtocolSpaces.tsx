import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame } from '../controls';
import { hypothesisSpace, idRun, wholePixelBoxes, type Protocol } from '../logic';
import type { PlaygroundProps } from '../mounts';
import { MARK_ANNOTATED, PhotoMarks, type Mark } from '../PhotoMarks';
import { SLICE_CLASS_COUNT, SLICE_PREDICATE_COUNT, frameById } from '../slice';
import { E10_BADGE_PLACES, E10_FRAME, VG150_CLASSES, VG150_PREDICATES } from './setup';

/** The photograph's height at most, in viewport heights. */
const PICTURE_VH = 34;

const PROTOCOLS: Protocol[] = ['predcls', 'sgcls', 'sgdet'];
const NAMES: Record<Protocol, string> = { predcls: 'PredCls', sgcls: 'SGCls', sgdet: 'SGDet' };
const VOCABULARIES = ['slice', 'vg150'] as const;
type Vocabulary = (typeof VOCABULARIES)[number];

/**
 * E10 — 三種 protocol.
 *
 * What each protocol hands the model, drawn on the frame `E10_FRAME` names, and how many
 * single-triplet hypotheses it leaves to search: |V|(|V|-1)|P| under PredCls, |V|(|V|-1)|C|²|P|
 * under SGCls, and B(B-1)|C|²|P| under SGDet, B being every whole-pixel box in the photograph.
 * Each set contains the one before it, which is what M3's step before this one states; the recall
 * ordering is observed, not implied, and is L2's to score.
 *
 * Computes three counts, exactly: the last exceeds 2^53, so it is a `bigint` and is printed digit
 * for digit. No metric.
 *
 * Two parts (D96): what the chosen protocol hands over, then the vocabulary and the three counts,
 * the chosen one marked. As one step it ran 96 px past a 1024×768 panel. The second part marks
 * the protocol chosen on the first, so it shows that knob too. Mounted without a part, as its
 * unit tests mount it, it is both.
 */
export function ProtocolSpaces({ part }: PlaygroundProps = {}) {
  const { t, locale } = useLocale();
  const [params, setParams] = useLabParams({
    'E10.pr': 'predcls' as string,
    'E10.voc': 'slice' as string,
  });

  // A value the URL invented is none of the three; fall back rather than count nothing.
  const protocol: Protocol = (PROTOCOLS as string[]).includes(params['E10.pr']) ? (params['E10.pr'] as Protocol) : 'predcls';
  const vocabulary: Vocabulary = (VOCABULARIES as readonly string[]).includes(params['E10.voc'])
    ? (params['E10.voc'] as Vocabulary)
    : 'slice';
  const classes = vocabulary === 'vg150' ? VG150_CLASSES : SLICE_CLASS_COUNT;
  const predicates = vocabulary === 'vg150' ? VG150_PREDICATES : SLICE_PREDICATE_COUNT;

  const frame = frameById(E10_FRAME)!;
  const objects = frame.objects.length;
  const boxes = wholePixelBoxes(frame.width, frame.height);
  const formula: Record<Protocol, string> = {
    predcls: `${objects} × ${objects - 1} × ${predicates}`,
    sgcls: `${objects} × ${objects - 1} × ${classes}² × ${predicates}`,
    sgdet: `B(B − 1) × ${classes}² × ${predicates}`,
  };

  const givenView = part !== 2;
  const countView = part !== 1;

  const marks: Mark[] = protocol === 'sgdet'
    ? []
    : frame.objects.map((o) => ({ box: o.bbox, line: 'solid', stroke: MARK_ANNOTATED, testid: `e10-box-${o.object_id}` }));
  const separator = locale === 'zh-TW' ? '、' : ', ';
  // The boxes are numbered on the photograph, so PredCls's labels say which box each belongs to.
  const badges = protocol === 'sgdet'
    ? []
    : frame.objects.map((o) => ({
      box: o.bbox,
      text: `#${o.object_id}`,
      testid: `e10-badge-${o.object_id}`,
      place: E10_BADGE_PLACES[o.object_id],
    }));
  // SGCls names the boxes by their ids: a run where they have no gap, else each one (D101).
  const ids = frame.objects.map((o) => o.object_id).sort((a, b) => a - b);
  const run = idRun(ids);
  const boxIds = run && run.last > run.first
    ? t('playground.e10.id_run').replace('{first}', String(run.first)).replace('{last}', String(run.last))
    : ids.map((id) => `#${id}`).join(separator);
  const given = protocol === 'predcls'
    ? frame.objects.map((o) => `#${o.object_id} ${o.names[0]}`).join(separator)
    : protocol === 'sgcls'
      ? t('playground.e10.boxes_only').replace('{ids}', boxIds)
      : t('playground.e10.nothing');

  const controls = (
    <>
      <Choice
        id="E10.pr"
        label={t('playground.e10.protocol')}
        value={protocol}
        options={PROTOCOLS.map((p) => ({ value: p, label: NAMES[p] }))}
        onChange={(next) => setParams({ 'E10.pr': next })}
      />
      {countView && (
        <Choice
          id="E10.voc"
          label={t('playground.e10.vocabulary')}
          value={vocabulary}
          options={[
            { value: 'slice', label: t('playground.e10.voc_slice') },
            { value: 'vg150', label: t('playground.e10.voc_vg150') },
          ]}
          onChange={(next) => setParams({ 'E10.voc': next })}
        />
      )}
    </>
  );

  return (
    <PlaygroundFrame title="E10" controls={controls} clip={false}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {givenView && (
          <PhotoMarks
            frame={frame}
            marks={marks}
            badges={badges}
            maxVh={PICTURE_VH}
            alt={t('playground.e10.picture').replace('{frame}', E10_FRAME)}
            testid="e10-picture"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {givenView && (
            <p data-testid="e10-given" className="text-[1em] text-slate-900">
              {t('playground.e10.given')}
              <span className="font-mono">{given}</span>
            </p>
          )}
          {countView && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p data-testid="e10-vocabulary" className="font-mono text-[1em] text-slate-700">
                {/* |V| is handed over under PredCls and SGCls and not under SGDet (D100). */}
                {`${protocol === 'sgdet' ? '' : `|V| = ${objects}, `}|𝒞| = ${classes}, |𝒫| = ${predicates}`}
              </p>
              <p className="text-[0.875em] text-slate-700">{t('playground.e10.to_l2')}</p>
            </div>
          )}
          {/* The inclusion is a fact about hypotheses of one shape, and only when what a protocol hands
              over is itself a hypothesis of the next (D98); the two read as one sentence. */}
          <p className="text-[1em] text-slate-900">
            <span data-testid="e10-inclusion" className="font-mono">
              ℋ<sub>PredCls</sub> ⊆ ℋ<sub>SGCls</sub> ⊆ ℋ<sub>SGDet</sub>
            </span>
            {locale === 'zh-TW' ? '，' : ' '}
            <span data-testid="e10-inclusion-if" className="text-[0.875em] text-slate-700">
              {t('playground.e10.inclusion_if')}
            </span>
          </p>
        </div>
      </div>
      {countView && (
        <>
          <table data-testid="e10-counts" className="mt-4 w-full font-mono text-[0.875em]">
            <caption className="text-left font-sans text-[1em] text-slate-700">{t('playground.e10.count')}</caption>
            <tbody>
              {/* Every row carries the sign and the 4 px rule, and only the chosen row shows them.
                  Drawn in that row alone they widened the first column, the sign by its width and
                  the rule by half of it under collapsed borders, and moved the two columns after
                  it by up to 40 px when the protocol changed (D101). */}
              {PROTOCOLS.map((p) => (
                <tr
                  key={p}
                  data-testid={`e10-row-${p}`}
                  aria-current={p === protocol ? 'true' : undefined}
                  className={p === protocol ? 'border-l-4 border-slate-900 bg-white font-semibold text-slate-900' : 'border-l-4 border-transparent text-slate-700'}
                >
                  <th scope="row" className="py-0.5 pl-2 pr-4 text-left font-sans">
                    <span
                      data-testid={p === protocol ? 'e10-chosen' : undefined}
                      aria-hidden="true"
                      className={p === protocol ? undefined : 'invisible'}
                    >
                      ►{' '}
                    </span>
                    {NAMES[p]}
                  </th>
                  <td className="py-0.5 pr-4">{formula[p]}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {hypothesisSpace(p, objects, classes, predicates, boxes).toLocaleString('en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* C(w + 1, 2) · C(h + 1, 2): a box's two x-edges are two of the w + 1 pixel boundaries. */}
          <p data-testid="e10-boxes-note" className="mt-1 font-mono text-[0.875em] text-slate-700">
            {t('playground.e10.boxes_note')
              .replace('{w}', String(frame.width + 1))
              .replace('{h}', String(frame.height + 1))
              .replace('{b}', boxes.toLocaleString('en-US'))}
          </p>
        </>
      )}
    </PlaygroundFrame>
  );
}
