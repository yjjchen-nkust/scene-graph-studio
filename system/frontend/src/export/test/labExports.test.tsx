import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PRD §6.6: "Any constructed graph to Visual-Genome-driver-compatible JSON." In L1 and L8 the
 * constructed graph is the student's, and it lives inside the lab, not in the mount that fetched
 * the frame. These run the labs as the routes mount them, so a mount handing the export the
 * frame's annotation instead is caught where it happens.
 *
 * Cytoscape draws to a canvas and jsdom has none; L1's graph view is stubbed for that reason
 * alone, as `labs/test/mounts.test.tsx` does.
 */
vi.mock('cytoscape', () => ({
  default: Object.assign(
    vi.fn(() => ({
      destroy: vi.fn(),
      on: vi.fn(),
      layout: vi.fn(() => ({ run: vi.fn() })),
      elements: vi.fn(() => ({ remove: vi.fn() })),
      add: vi.fn(),
      json: vi.fn(),
      fit: vi.fn(),
    })),
    { use: vi.fn() },
  ),
}));
vi.mock('cytoscape-dagre', () => ({ default: vi.fn() }));

const { setLocale } = await import('../../i18n/useLocale');
const { MOUNTS } = await import('../../labs/mounts');

const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

/** One frame: two objects and one annotated relationship, `cup on table`. */
function frame(dataset: string, image_id: string, names: [string, string], predicate: string) {
  return {
    image_id,
    dataset,
    width: 640,
    height: 480,
    objects: names.map((name, i) => ({
      object_id: i + 1,
      names: [name],
      bbox: { x: 100 * i, y: 0, w: 80, h: 80 },
    })),
    relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate }],
    provenance: { kind: 'ground_truth', fidelity: 'measured' },
  };
}

function stubBackend(dataset: string, annotated: ReturnType<typeof frame>, draft?: unknown) {
  const answer = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === `/api/datasets/${dataset}/images`) {
        return answer({
          dataset,
          image_count: 1,
          images: [{ image_id: annotated.image_id, width: 640, height: 480, object_count: 2,
            relationship_count: 1, present: true }],
        });
      }
      if (url.startsWith(`/api/datasets/${dataset}/images/`)) {
        return answer({ ...annotated, image_data_url: PHOTO });
      }
      if (url === '/api/vlm/indvissgg') {
        return answer({ step1: { graph: draft, prompt_shown: '' }, step2: [], step3: null,
          provider_used: 'transcript' });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

function open(labId: 'L1' | 'L8', search: string) {
  const Lab = MOUNTS[labId];
  const router = createMemoryRouter([{ path: `/lab/${labId}`, element: <Lab /> }], {
    initialEntries: [`/lab/${labId}${search}`],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** Every download the page starts, decoded, without a browser to save it. */
function captureDownloads() {
  const seen: { name: string; text: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const text = decodeURIComponent(this.href.slice(this.href.indexOf(',') + 1));
    seen.push({ name: this.download, text });
  });
  return seen;
}

beforeEach(() => setLocale('en'));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('L1 exports', () => {
  it("writes the student's triplets, under the student's name, not the annotation", async () => {
    // The annotation says `cup on table`; the student built `table near cup` and nothing else.
    stubBackend('placeholder', frame('placeholder', 'ph-001', ['cup', 'table'], 'on'));
    open('L1', '?t=2-near-1');
    const seen = captureDownloads();
    fireEvent.click(await screen.findByTestId('export-json'));

    const document = JSON.parse(seen[0]!.text);
    expect(document.relationships).toEqual([
      expect.objectContaining({ subject_id: 2, object_id: 1, predicate: 'near' }),
    ]);
    expect(document.sgs_provenance).toEqual({ kind: 'user', fidelity: 'measured' });
    // PredCls gives the boxes, so the objects are the frame's, and the file says whose frame.
    expect(document.objects.map((o: { names: string[] }) => o.names[0])).toEqual(['cup', 'table']);
    expect(seen[0]!.name).toBe('placeholder_ph-001.json');
  });

  it('puts the frame beneath the boxes in the SVG', async () => {
    stubBackend('placeholder', frame('placeholder', 'ph-001', ['cup', 'table'], 'on'));
    open('L1', '');
    const seen = captureDownloads();
    fireEvent.click(await screen.findByTestId('export-svg'));
    expect(seen[0]!.text).toMatch(/<image[^>]+href="data:image\/png;base64,iVBORw0KGgo="/);
  });
});

describe('L8 exports', () => {
  const reference = frame('mini-isg', 'isg-a', ['hand', 'wrench'], 'holding');
  const draft = {
    ...reference,
    relationships: [{ relationship_id: 1, subject_id: 1, object_id: 2, predicate: 'touching' }],
    provenance: { kind: 'vlm', fidelity: 'reconstructed', vlm: 'transcript', note: 'Replayed.' },
  };

  it('writes the working copy as corrected, not the reference set', async () => {
    stubBackend('mini-isg', reference, draft);
    open('L8', '?img=isg-a');
    fireEvent.change(await screen.findByLabelText('Predicate between hand and wrench'), {
      target: { value: 'holding' },
    });
    fireEvent.click(screen.getByTestId('delete'));

    const seen = captureDownloads();
    fireEvent.click(screen.getByTestId('export-json'));
    const document = JSON.parse(seen[0]!.text);
    // The reference has one `holding`; the annotator rewrote the draft's predicate and then
    // deleted the triplet, so their graph has none, and it is theirs.
    expect(document.relationships).toEqual([]);
    expect(document.sgs_provenance).toMatchObject({ kind: 'user', fidelity: 'measured' });
  });

  it('writes an untouched draft under the provenance it arrived with', async () => {
    // Nothing has been corrected, so nothing is claimed for the annotator: D-07.
    stubBackend('mini-isg', reference, draft);
    open('L8', '?img=isg-a');
    const seen = captureDownloads();
    fireEvent.click(await screen.findByTestId('export-json'));
    const document = JSON.parse(seen[0]!.text);
    expect(document.relationships).toEqual([
      expect.objectContaining({ subject_id: 1, object_id: 2, predicate: 'touching' }),
    ]);
    expect(document.sgs_provenance).toEqual(draft.provenance);
  });
});
