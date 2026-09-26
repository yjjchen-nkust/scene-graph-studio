import type { SceneGraph, SGRelationship } from 'sgg-metrics';
import { useLocale } from '../../i18n/useLocale';
import { useLabParams } from '../../labs/useLabParams';
import { Choice, PlaygroundFrame, Readout, Toggle } from '../controls';
import { classCounts, flag, isInE, isInMergedE, mergeMap, objectLabels, predicateLabels } from '../logic';
import { VG_FRAMES, vgFrameById } from '../slice';
import { OBJECT_GROUP, PREDICATE_GROUP } from './groups';

/**
 * F6 — Predicate 同義詞沒有階層.
 *
 * Two merges, each a checkbox, independent because the vocabulary has no hierarchy to make one
 * depend on the other. Each moves a class count and a triplet count and leaves every annotation
 * where it was. The membership panel is F8's discipline applied to a merge: a substituted
 * predicate is 「未收錄於 E」 until the merge makes it 「收錄於 E′」, and the model never moved.
 *
 * No mR. s2's inequality carries the metric consequence; this playground shows its two inputs.
 */
const NO_MERGE = new Map<string, string>();
const P_MERGE = mergeMap([PREDICATE_GROUP]);
const O_MERGE = mergeMap([OBJECT_GROUP]);
const PREDICATES = predicateLabels(VG_FRAMES);
const OBJECTS = objectLabels(VG_FRAMES);
const BASE_P = classCounts(PREDICATES, NO_MERGE);
const BASE_O = classCounts(OBJECTS, NO_MERGE);
const HEAD = PREDICATE_GROUP[0]!;

function groupEdges(frame: SceneGraph): SGRelationship[] {
  return frame.relationships.filter((r) => PREDICATE_GROUP.includes(r.predicate));
}

/**
 * The edge the step exists for: its predicate is in the group but is not the group's head, and
 * the head is not also annotated on the same pair. Chosen from the data rather than named, so
 * re-cutting the slice moves the default instead of breaking it.
 */
function teachingEdge(frame: SceneGraph): SGRelationship | undefined {
  return groupEdges(frame).find(
    (r) =>
      r.predicate !== HEAD &&
      !isInE(frame, { subject_id: r.subject_id, predicate: HEAD, object_id: r.object_id }),
  );
}

const FRAMES_WITH_GROUP = VG_FRAMES.filter((f) => groupEdges(f).length > 0);
const DEFAULT_FRAME = VG_FRAMES.find((f) => teachingEdge(f)) ?? FRAMES_WITH_GROUP[0];
const DEFAULT_EDGE = DEFAULT_FRAME && (teachingEdge(DEFAULT_FRAME) ?? groupEdges(DEFAULT_FRAME)[0]);

function sumNote(group: readonly string[], base: Map<string, number>): string {
  const parts = group.map((g) => ({ g, n: base.get(g) ?? 0 }));
  return `${parts.map(({ g, n }) => `${g} ${n}`).join(' + ')} = ${parts.reduce((s, p) => s + p.n, 0)}`;
}

function nameOf(frame: SceneGraph, id: number): string {
  return frame.objects.find((o) => o.object_id === id)?.names[0] ?? String(id);
}

export function PredicateSynonymy() {
  const { t, locale } = useLocale();
  // Chinese takes a full-width colon with no space after it; English a colon and a space (D94).
  const colon = locale === 'en' ? ': ' : '：';
  const [params, setParams] = useLabParams({
    'F6.mp': 0,
    'F6.mo': 0,
    'F6.img': DEFAULT_FRAME?.image_id ?? '',
    'F6.rel': DEFAULT_EDGE?.relationship_id ?? 0,
    'F6.sub': HEAD,
  });
  const mergeP = flag(params['F6.mp'], false);
  const mergeO = flag(params['F6.mo'], false);

  const pCounts = classCounts(PREDICATES, mergeP ? P_MERGE : NO_MERGE);
  const oCounts = classCounts(OBJECTS, mergeO ? O_MERGE : NO_MERGE);

  // A frame from the URL that does not exist, or carries no group edge, falls back to the
  // teaching frame rather than blanking the panel.
  const asked = vgFrameById(params['F6.img']);
  const frame = asked && groupEdges(asked).length > 0 ? asked : DEFAULT_FRAME;
  const edges = frame ? groupEdges(frame) : [];
  const edge = edges.find((r) => r.relationship_id === params['F6.rel']) ?? edges[0];
  const substitutes = PREDICATE_GROUP.filter((p) => p !== edge?.predicate);
  const substitute = substitutes.includes(params['F6.sub']) ? params['F6.sub'] : substitutes[0]!;

  const controls = (
    <>
      <Toggle
        id="F6.mp"
        label={t('playground.f6.merge_predicates')}
        checked={mergeP}
        onChange={(on) => setParams({ 'F6.mp': on ? 1 : 0 })}
      />
      <Toggle
        id="F6.mo"
        label={t('playground.f6.merge_objects')}
        checked={mergeO}
        onChange={(on) => setParams({ 'F6.mo': on ? 1 : 0 })}
      />
      {frame && edge && (
        <>
          <Choice
            id="F6.img"
            label={t('playground.frame')}
            value={frame.image_id}
            options={FRAMES_WITH_GROUP.map((f) => ({ value: f.image_id, label: f.image_id }))}
            onChange={(next) => {
              const f = vgFrameById(next);
              const e = f && (teachingEdge(f) ?? groupEdges(f)[0]);
              setParams({ 'F6.img': next, 'F6.rel': e?.relationship_id ?? 0, 'F6.sub': HEAD });
            }}
          />
          <Choice
            id="F6.rel"
            label={t('playground.f6.edge')}
            value={String(edge.relationship_id)}
            options={edges.map((r) => ({
              value: String(r.relationship_id),
              // With object ids: frame 2008 carries "pillow on bed" five times, between different
              // pillows and beds, and five identical options cannot be chosen between.
              label: `${nameOf(frame, r.subject_id)} #${r.subject_id} ${r.predicate} ${nameOf(frame, r.object_id)} #${r.object_id}`,
            }))}
            onChange={(next) => setParams({ 'F6.rel': Number(next), 'F6.sub': HEAD })}
          />
          <Choice
            id="F6.sub"
            label={t('playground.f6.substitute')}
            value={substitute}
            options={substitutes.map((p) => ({ value: p, label: p }))}
            onChange={(next) => setParams({ 'F6.sub': next })}
          />
        </>
      )}
    </>
  );

  let membership = <p data-testid="f6-empty" className="text-[1.25em] text-slate-700">{t('playground.f6.no_group_edge')}</p>;
  if (frame && edge) {
    const triplet = { subject_id: edge.subject_id, predicate: substitute, object_id: edge.object_id };
    const recorded = mergeP ? isInMergedE(frame, triplet, P_MERGE) : isInE(frame, triplet);
    const status = mergeP
      ? t(recorded ? 'playground.f6.in_e_prime' : 'playground.f6.not_in_e_prime')
      : t(recorded ? 'playground.in_e' : 'playground.not_in_e');
    membership = (
      <div className="flex flex-col gap-2">
        <p data-testid="f6-annotated" className="text-[1em] text-slate-700">
          {t('playground.f6.annotated')}{colon}
          <span className="font-mono">
            {nameOf(frame, edge.subject_id)} {edge.predicate} {nameOf(frame, edge.object_id)}
          </span>
        </p>
        <p data-testid="f6-sentence" className="font-mono text-[1.5em] text-slate-900">
          {nameOf(frame, edge.subject_id)} {substitute} {nameOf(frame, edge.object_id)}
        </p>
        <p
          data-testid="f6-status"
          data-recorded={String(recorded)}
          className={recorded ? 'text-[1.25em] text-emerald-900' : 'text-[1.25em] text-slate-700'}
        >
          {status}
        </p>
      </div>
    );
  }

  return (
    <PlaygroundFrame title="F6" controls={controls} clip={false}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Readout
            id="F6.predicates"
            label={t('playground.f6.predicate_classes')}
            value={String(pCounts.size)}
            note={t('playground.f6.of_vg150')}
          />
          <Readout
            id="F6.group"
            label={t('playground.f6.group_triplets')}
            value={String(pCounts.get(HEAD) ?? 0)}
            note={mergeP ? sumNote(PREDICATE_GROUP, BASE_P) : `${HEAD} ${BASE_P.get(HEAD) ?? 0}`}
          />
          <Readout
            id="F6.objects"
            label={t('playground.f6.object_classes')}
            value={String(oCounts.size)}
            note={mergeO ? sumNote(OBJECT_GROUP, BASE_O) : t('playground.f6.unmerged')}
          />
        </div>
        {membership}
      </div>
    </PlaygroundFrame>
  );
}
