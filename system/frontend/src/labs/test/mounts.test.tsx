import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cytoscape draws to a canvas and jsdom implements none, so a lab that renders a graph view
 * takes the route's whole tree down through React Router's error boundary. `graph/test/` already
 * mocks it for the same reason and tests the wiring directly; this file is about whether a route
 * mounts its lab and what it says when the backend refuses, and a real Cytoscape here would test
 * the canvas shim instead.
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
const { ROUTES } = await import('../../routes');
const { LAB_IDS } = await import('../registry');

const FRAME = {
  image_id: 'ph-001',
  dataset: 'placeholder',
  width: 640,
  height: 480,
  objects: [
    { object_id: 1, names: ['table'], bbox: { x: 60, y: 300, w: 420, h: 110 }, mask: null },
    { object_id: 2, names: ['cup'], bbox: { x: 200, y: 240, w: 60, h: 70 }, mask: null },
  ],
  relationships: [{ relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on', score: 1 }],
};

const ROUTED: Record<string, unknown> = {
  '/api/datasets': {
    datasets: [
      {
        id: 'placeholder',
        name_en: 'Synthetic placeholder frames',
        name_zh: '合成佔位影像',
        image_count: 6,
        has_masks: false,
        images_present: true,
      },
    ],
  },
  '/api/datasets/placeholder/images': {
    dataset: 'placeholder',
    image_count: 1,
    images: [
      {
        image_id: 'ph-001',
        width: 640,
        height: 480,
        object_count: 2,
        relationship_count: 1,
        present: true,
      },
    ],
  },
  '/api/models': {
    models: [
      {
        id: 'motifs',
        name: 'Neural Motifs',
        family: 'two_stage',
        year: 2018,
        venue: 'CVPR',
        paper_key: 'neural-motifs-2018',
        live: false,
        live_blocked_reason_en: 'maskrcnn-benchmark does not build here.',
        live_blocked_reason_zh: 'maskrcnn-benchmark 無法在此建置。',
        estimated_seconds_per_image: null,
        predictions_available: [{ dataset: 'placeholder', fidelity: 'reconstructed' }],
      },
    ],
  },
};

function body(url: string): unknown {
  if (url.startsWith('/api/datasets/placeholder/images/ph-001')) {
    return { ...FRAME, image_data_url: 'data:image/png;base64,iVBORw0KGgo=' };
  }
  if (url.startsWith('/api/predictions/')) {
    return {
      ...FRAME,
      provenance: { kind: 'model', fidelity: 'reconstructed', model: 'motifs', note: 'Not output.' },
    };
  }
  return ROUTED[url.split('?')[0]!];
}

function stubBackend() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const found = body(url);
      if (found === undefined) {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            error: { code: 'not_found', message_en: 'No such resource.', message_zh: '找不到。' },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => found };
    }),
  );
}

function stubDeadBackend() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }),
  );
}

function open(path: string) {
  const router = createMemoryRouter(ROUTES, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  setLocale('en');
  stubBackend();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/lab/:labId', () => {
  it('knows all eight labs', () => {
    expect(LAB_IDS).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']);
  });

  it.each(LAB_IDS)('mounts %s rather than a blank page', async (labId) => {
    open(`/lab/${labId}`);
    // Either the lab is on screen, or it is saying why it is not. A blank page is neither, and
    // a blank page is what every one of these routes rendered before they existed.
    expect(await screen.findByTestId('lab-root')).toHaveAttribute('data-lab', labId);
  });

  it('says so for a lab id that does not exist', () => {
    open('/lab/L9');
    expect(screen.getByTestId('lab-unknown')).toBeInTheDocument();
    expect(screen.getByText('L9')).toBeInTheDocument();
  });

  it.each(['L2', 'L3', 'L6', 'L7'])(
    'renders %s with the backend down, because it needs no backend',
    async (labId) => {
      stubDeadBackend();
      open(`/lab/${labId}`);
      expect(await screen.findByTestId('lab-root')).toHaveAttribute('data-lab', labId);
      expect(screen.queryByTestId('lab-failure')).not.toBeInTheDocument();
    },
  );

  it.each(['L1', 'L4', 'L8'])(
    'states the reason when %s cannot reach the backend, with no stack trace',
    async (labId) => {
      stubDeadBackend();
      open(`/lab/${labId}`);
      const failure = await screen.findByTestId('lab-failure');
      expect(failure).toHaveTextContent('npm start');
      expect(failure.textContent).not.toMatch(/at \w+ \(/);
    },
  );

  it('gives the failure sentence in the locale on screen', async () => {
    setLocale('zh-TW');
    stubDeadBackend();
    open('/lab/L1');
    expect(await screen.findByTestId('lab-failure')).toHaveTextContent('本機後端沒有回應');
    setLocale('en');
  });

  it('L1 opens on the first frame of the slice without one being named', async () => {
    open('/lab/L1');
    expect(await screen.findByTestId('frame-picker')).toHaveValue('ph-001');
  });

  it('L1 keeps the chosen frame in the URL so the configuration is a link', async () => {
    const router = open('/lab/L1?img=ph-001&ds=placeholder');
    await screen.findByTestId('frame-picker');
    expect(router.state.location.search).toContain('img=ph-001');
  });

  it('L5 does not run anything until it is asked to', async () => {
    open('/lab/L5');
    await screen.findByTestId('lab-root');
    const posts = vi.mocked(fetch).mock.calls.filter(([, init]) => init !== undefined);
    expect(posts).toHaveLength(0);
  });
});
