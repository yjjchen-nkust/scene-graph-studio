import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import type { SceneGraph } from 'sgg-metrics';
import { useLocale } from '../i18n/useLocale';
import { getJson, postJson, useImageGraph, useModels, useSliceImages } from './api';
import { ExportButtons } from '../export/ExportButtons';
import { LabFrame } from './LabFrame';
import { TripletBuilder } from './L1/TripletBuilder';
import { TRIPLET_PARAMS } from './L1/triplets';
import { GT as L2_GT, PRED as L2_PRED } from './L2/fixture';
import { MetricExplorer } from './L2/MetricExplorer';
import { LongTailLab } from './L3/LongTailLab';
import { MethodComparator } from './L4/MethodComparator';
import type { Column } from './L4/types';
import { IndVisSGGReplica } from './L5/IndVisSGGReplica';
import type { ReplicaRequest, ReplicaResult } from './L5/types';
import { ProtocolForensics } from './L6/ProtocolForensics';
import { CaptionToGraph } from './L7/CaptionToGraph';
import { MiniISGAnnotator } from './L8/MiniISGAnnotator';
import { useLabParams, type LabParamValue } from './useLabParams';

/**
 * The frame every image-backed lab opens on.
 *
 * `placeholder` rather than `vg150-sgb`: D-08 ships the real slices as a bundle the class
 * unpacks, and `make_placeholders.py` is the one slice every clone has. A lab whose default
 * dataset is absent on a fresh machine teaches the student that the application is broken.
 */
const DEFAULT_DS = 'placeholder';

/** One prediction file as `/api/predictions/...` serves it: a graph with its provenance. */
type PredictionBody = SceneGraph & {
  provenance?: { fidelity?: string; note?: string | null };
};

/**
 * Dataset and frame, from the URL, with the slice's first frame as the fallback.
 *
 * The fallback is not written into the URL. `useLabParams` writes a value equal to its default
 * as an absent key, and a lab that wrote the resolved id back would make "the first frame" and
 * "this particular frame" two different links to the same thing.
 *
 * `perFrame` holds the lab's parameters that describe one frame, with their defaults, and
 * `pickFrame` writes them back to those defaults in the same update as the new frame. Every slice
 * numbers its objects from 1, so an id left behind resolves on the new frame and is scored there.
 */
function useFrame(perFrame: Record<string, LabParamValue> = {}) {
  const [params, setParams] = useLabParams<{ ds: string; img: string } & typeof perFrame>({
    ds: DEFAULT_DS,
    img: '',
    ...perFrame,
  });
  const images = useSliceImages(params.ds);
  const rows = images.data?.images ?? [];
  const imageId = params.img || rows[0]?.image_id || null;
  const pickFrame = (img: string) => setParams({ ...perFrame, img });
  return { ds: params.ds, imageId, rows, images, pickFrame };
}

function FramePicker({
  value,
  rows,
  onChange,
}: {
  value: string;
  rows: { image_id: string; present: boolean }[];
  onChange: (imageId: string) => void;
}) {
  const { t } = useLocale();
  return (
    <label className="mb-4 flex items-baseline gap-2 text-sm">
      <span className="text-slate-600">{t('lab.frame')}</span>
      <select
        data-testid="frame-picker"
        className="rounded border border-slate-300 px-2 py-1 font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {rows.map((row) => (
          <option key={row.image_id} value={row.image_id}>
            {row.image_id}
            {row.present ? '' : ' ·'}
          </option>
        ))}
      </select>
    </label>
  );
}

function L1Mount() {
  const { ds, imageId, rows, images, pickFrame } = useFrame(TRIPLET_PARAMS);
  const graph = useImageGraph(ds, imageId, true);
  const area = useRef<HTMLDivElement>(null);
  const error = images.error ?? graph.error;
  const pending = !error && (images.isPending || graph.isPending);

  return (
    <LabFrame labId="L1" pending={pending} error={error}>
      {graph.data && (
        <>
          <FramePicker value={imageId ?? ''} rows={rows} onChange={pickFrame} />
          <ExportButtons graph={graph.data} targetRef={area} />
          <div ref={area}>
            <TripletBuilder gt={graph.data} imageUrl={graph.data.image_data_url ?? ''} />
          </div>
        </>
      )}
    </LabFrame>
  );
}

function L2Mount() {
  // The fixture, not a slice. L2 is about what K, the protocol and the constraint do to a pair
  // of graphs, and a pair small enough to hold in the head is what makes the movement readable.
  return (
    <LabFrame labId="L2">
      <MetricExplorer gt={L2_GT} pred={L2_PRED} />
    </LabFrame>
  );
}

function L3Mount() {
  return (
    <LabFrame labId="L3">
      <LongTailLab />
    </LabFrame>
  );
}

function L4Mount() {
  const { ds, imageId, rows, images, pickFrame } = useFrame();
  const graph = useImageGraph(ds, imageId, false);
  const models = useModels();

  const available = useMemo(
    () =>
      (models.data?.models ?? []).filter((m) =>
        m.predictions_available.some((p) => p.dataset === ds),
      ),
    [models.data, ds],
  );

  // One request per model, in parallel, keyed so switching frames does not refetch the others.
  const predictions = useQueries({
    queries: available.map((m) => ({
      queryKey: ['prediction', ds, m.id, imageId],
      queryFn: () => getJson<PredictionBody>(`/api/predictions/${ds}/${m.id}/${imageId}`),
      enabled: imageId !== null,
      staleTime: Infinity,
      retry: false,
    })),
  });

  const columns: Column[] = available.flatMap((m, i) => {
    const body = predictions[i]?.data;
    if (!body) return [];
    return [
      {
        model: m.id,
        graph: body,
        fidelity: (body.provenance?.fidelity ?? 'reconstructed') as Column['fidelity'],
        note: body.provenance?.note ?? null,
      },
    ];
  });

  const error = images.error ?? graph.error ?? models.error;
  const pending = !error && (images.isPending || graph.isPending || models.isPending);

  return (
    <LabFrame labId="L4" pending={pending} error={error}>
      {graph.data && (
        <>
          <FramePicker value={imageId ?? ''} rows={rows} onChange={pickFrame} />
          <MethodComparator
            gt={graph.data}
            columns={columns}
            models={available}
            // Live inference is opt-in and, per D-06, RelTR only. The registry already carries
            // the reason each model cannot run and the lab renders it, so this hands the request
            // to the backend and lets the 503 say the rest.
            onInfer={(model) => {
              void postJson(`/api/infer/${model}`, { dataset: ds, image_id: imageId }).catch(
                () => undefined,
              );
            }}
          />
        </>
      )}
    </LabFrame>
  );
}

function L5Mount() {
  // A mutation, not a query: the page must run nothing on open. The replica's whole subject is
  // what a particular O, P and E produce, and a run fired before the student has set them would
  // put an answer on screen to a question nobody asked.
  const run = useMutation({
    mutationFn: (req: ReplicaRequest) => postJson<ReplicaResult>('/api/vlm/indvissgg', req),
  });

  return (
    <LabFrame labId="L5" error={run.error}>
      {/* `variables` and `data` belong to the same mutation, so the result is always shown
          beside the request that produced it. */}
      <IndVisSGGReplica
        result={run.data ?? null}
        request={run.variables ?? null}
        onRun={(req) => run.mutate(req)}
      />
    </LabFrame>
  );
}

function L6Mount() {
  return (
    <LabFrame labId="L6">
      <ProtocolForensics />
    </LabFrame>
  );
}

function L7Mount() {
  return (
    <LabFrame labId="L7">
      <CaptionToGraph />
    </LabFrame>
  );
}

function L8Mount() {
  const [params, setParams] = useLabParams({ img: '' });
  const images = useSliceImages('mini-isg');
  const rows = images.data?.images ?? [];
  const imageId = params.img || rows[0]?.image_id || null;
  const reference = useImageGraph('mini-isg', imageId, true);
  const area = useRef<HTMLDivElement>(null);
  // The draft is the lab's "before", so it is fetched rather than run: step 1 only, from the
  // authored transcript the frame's own criteria select (D51). Its boxes are placeholders by
  // construction, which is why box adjustment is one of the four correction categories.
  const draft = useQuery({
    queryKey: ['mini-isg-draft', imageId],
    queryFn: () =>
      postJson<{ step1: { graph: SceneGraph } | null }>('/api/vlm/indvissgg', {
        dataset: 'mini-isg',
        image_id: imageId,
        steps: [1],
      }),
    enabled: imageId !== null,
    staleTime: Infinity,
    retry: false,
  });

  const error = images.error ?? reference.error ?? draft.error;
  const pending = !error && (images.isPending || reference.isPending || draft.isPending);
  const drafted = draft.data?.step1?.graph ?? null;

  return (
    <LabFrame labId="L8" pending={pending} error={error}>
      {reference.data && drafted && (
        <>
          <FramePicker value={imageId ?? ''} rows={rows} onChange={(img) => setParams({ img })} />
          <ExportButtons graph={reference.data} targetRef={area} />
          <div ref={area}>
            {/* Keyed by frame: the working copy is local state seeded from the draft, and a
                return to a cached frame resolves in one render, so without the key the
                annotator would keep the last frame's copy. */}
            <MiniISGAnnotator
              key={imageId}
              draft={drafted}
              reference={reference.data}
              imageUrl={reference.data.image_data_url ?? ''}
              predicates={[...new Set(reference.data.relationships.map((r) => r.predicate))].sort()}
            />
          </div>
        </>
      )}
    </LabFrame>
  );
}

export const MOUNTS = {
  L1: L1Mount,
  L2: L2Mount,
  L3: L3Mount,
  L4: L4Mount,
  L5: L5Mount,
  L6: L6Mount,
  L7: L7Mount,
  L8: L8Mount,
} as const;
