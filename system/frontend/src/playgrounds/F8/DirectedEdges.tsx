import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { isInE } from '../logic';
import { FRAMES, frameById } from '../slice';

/**
 * F8 — 有向邊與不對稱性.
 *
 * One control, and the wording is the whole design. M0's third implication states
 * 已標註者不等於為真者, so this reports 「此邊收錄於 E」 against 「此邊未收錄於 E」 and never
 * 真 against 偽. A playground printing "false" would contradict the module three paragraphs
 * above it, and would teach the confusion that the missed-against-spurious split later has to
 * undo.
 *
 * The case worth showing is `person near table`: the relation reads as symmetric, and its
 * reversal is still absent from E. That is the annotation-versus-truth distinction arriving as
 * a fact rather than as a caution.
 */
export function DirectedEdges() {
  const { t } = useLocale();
  const [params, setParams] = useLabParams({
    'F8.img': FRAMES[0].image_id,
    'F8.rel': 1,
    'F8.swap': 0,
  });

  const frame = frameById(params['F8.img']) ?? FRAMES[0];
  const relationship =
    frame.relationships.find((r) => r.relationship_id === params['F8.rel']) ??
    frame.relationships[0];
  const swapped = params['F8.swap'] === 1;

  const subjectId = swapped ? relationship.object_id : relationship.subject_id;
  const objectId = swapped ? relationship.subject_id : relationship.object_id;
  const nameOf = (id: number) =>
    frame.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);

  const recorded = isInE(frame, {
    subject_id: subjectId,
    predicate: relationship.predicate,
    object_id: objectId,
  });

  const controls = (
    <>
      <Choice
        id="F8.frame"
        label={t('playground.frame')}
        value={frame.image_id}
        options={FRAMES.map((f) => ({ value: f.image_id, label: f.image_id }))}
        onChange={(next) => setParams({ 'F8.img': next, 'F8.rel': 1, 'F8.swap': 0 })}
      />
      <Choice
        id="F8.rel"
        label={t('playground.triplet')}
        value={String(relationship.relationship_id)}
        options={frame.relationships.map((r) => ({
          value: String(r.relationship_id),
          label: `${nameOf(r.subject_id)} ${r.predicate} ${nameOf(r.object_id)}`,
        }))}
        onChange={(next) => setParams({ 'F8.rel': Number(next), 'F8.swap': 0 })}
      />
      <Toggle
        id="F8.swap"
        label={t('playground.swap')}
        checked={swapped}
        onChange={(on) => setParams({ 'F8.swap': on ? 1 : 0 })}
      />
    </>
  );

  return (
    <PlaygroundFrame title="F8" controls={controls}>
      <div className="flex flex-col gap-4">
        <p data-testid="f8-sentence" className="font-mono text-3xl text-slate-900">
          {nameOf(subjectId)} <span className="text-slate-500">{relationship.predicate}</span>{' '}
          {nameOf(objectId)}
        </p>
        <p
          data-testid="f8-status"
          data-recorded={String(recorded)}
          className={recorded ? 'text-2xl text-emerald-700' : 'text-2xl text-slate-700'}
        >
          {/* The words carry the distinction, not the colour: NFR-5, and more importantly the
              reader must be able to quote this line without the palette. */}
          {recorded ? t('playground.in_e') : t('playground.not_in_e')}
        </p>
        {!recorded && (
          <p data-testid="f8-note" className="text-base text-slate-600">
            {t('playground.not_in_e_note')}
          </p>
        )}
        <Readout
          label={t('playground.annotated')}
          value={String(frame.relationships.length)}
          note={`|E| — ${frame.image_id}`}
        />
      </div>
    </PlaygroundFrame>
  );
}
