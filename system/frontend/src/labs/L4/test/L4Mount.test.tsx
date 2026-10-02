import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/useLocale';
import { MOUNTS } from '../../mounts';

/**
 * L4 as the route mounts it, against a stubbed backend: what reaches the comparator when a
 * prediction is absent, when its read fails, and when a live run answers.
 */

const FRAME = {
  image_id: 'ph-001',
  dataset: 'placeholder',
  width: 640,
  height: 480,
  objects: [
    { object_id: 1, names: ['table'], bbox: { x: 60, y: 300, w: 420, h: 110 } },
    { object_id: 2, names: ['cup'], bbox: { x: 200, y: 240, w: 60, h: 70 } },
  ],
  relationships: [{ relationship_id: 1, subject_id: 2, object_id: 1, predicate: 'on', score: 1 }],
  provenance: { kind: 'ground_truth', fidelity: 'measured' },
};

const RELTR = {
  id: 'reltr',
  name: 'RelTR',
  family: 'one_stage',
  year: 2023,
  venue: 'TPAMI',
  paper_key: 'reltr-2023',
  live: true,
  live_blocked_reason_en: null,
  live_blocked_reason_zh: null,
  estimated_seconds_per_image: null,
  predictions_available: [{ dataset: 'placeholder', fidelity: 'reconstructed' }],
};

const RECONSTRUCTED = {
  ...FRAME,
  provenance: { kind: 'model', fidelity: 'reconstructed', model: 'reltr', note: 'Not output.' },
};

const MEASURED = {
  ...FRAME,
  provenance: { kind: 'model', fidelity: 'measured', model: 'reltr', generated_at: '2026-10-01T00:00:00Z' },
};

type Answer = { status: number; body: unknown };

const ok = (body: unknown): Answer => ({ status: 200, body });
const refused = (status: number, code: string, en: string, zh: string, detail?: unknown): Answer => ({
  status,
  body: { error: { code, message_en: en, message_zh: zh, detail } },
});

/** The backend, with the prediction read and the live run answering as each test says. */
function stub({ prediction, infer }: { prediction: Answer; infer?: Answer }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const answer: Answer = url.startsWith('/api/predictions/')
        ? prediction
        : url.startsWith('/api/infer/')
          ? (infer ?? refused(500, 'internal_error', 'Unexpected.', '未預期。'))
          : url === '/api/datasets/placeholder/images'
            ? ok({
                dataset: 'placeholder',
                image_count: 1,
                images: [{ image_id: 'ph-001', width: 640, height: 480, object_count: 2, relationship_count: 1, present: true }],
              })
            : url.startsWith('/api/datasets/placeholder/images/')
              ? ok(FRAME)
              : url === '/api/models'
                ? ok({ models: [RELTR] })
                : refused(404, 'not_found', 'No such resource.', '找不到此資源。');
      return { ok: answer.status < 300, status: answer.status, json: async () => answer.body };
    }),
  );
}

function open() {
  const L4 = MOUNTS.L4;
  const router = createMemoryRouter([{ path: '/lab/L4', element: <L4 /> }], {
    initialEntries: ['/lab/L4'],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => setLocale('en'));
afterEach(() => vi.unstubAllGlobals());

describe('L4 as mounted', () => {
  it('says a prediction is absent only when the backend answers 404', async () => {
    stub({ prediction: refused(404, 'not_found', 'No such resource.', '找不到此資源。') });
    open();
    expect(await screen.findByTestId('no-columns')).toBeInTheDocument();
    expect(screen.queryByTestId('prediction-failed-reltr')).toBeNull();
  });

  it('shows a prediction whose read failed as a failure, with its reason, not as none', async () => {
    stub({ prediction: refused(500, 'internal_error', 'An unexpected error occurred.', '發生未預期的錯誤。') });
    open();
    expect(await screen.findByTestId('prediction-failed-reltr')).toHaveTextContent(
      'An unexpected error occurred.',
    );
    expect(screen.queryByTestId('no-columns')).toBeNull();
  });

  it('tags the figures on a committed reconstructed prediction reconstructed', async () => {
    stub({ prediction: ok(RECONSTRUCTED) });
    open();
    const metrics = within(await screen.findByTestId('column-reltr')).getByTestId('metrics');
    const tiers = [...metrics.querySelectorAll('[data-fidelity]')].map((el) => el.getAttribute('data-fidelity'));
    expect(tiers).toEqual(['reconstructed', 'reconstructed']);
  });

  it('puts the 503 of a live run under its button, with the reason it gives', async () => {
    stub({
      prediction: ok(RECONSTRUCTED),
      infer: refused(
        503,
        'inference_unavailable',
        'Live inference is not available for this model on this machine.',
        '此機器無法對本模型執行即時推論。',
        { model: 'reltr', reason_en: 'RelTR is not wired.', reason_zh: 'RelTR 尚未接上。' },
      ),
    });
    open();
    fireEvent.click(await screen.findByTestId('infer-reltr'));
    const shown = await screen.findByTestId('refused-reltr');
    expect(shown).toHaveTextContent('Live inference is not available');
    expect(shown).toHaveTextContent('RelTR is not wired.');
  });

  it('puts a live graph in its model’s column, measured, in place of the committed one', async () => {
    stub({ prediction: ok(RECONSTRUCTED), infer: ok(MEASURED) });
    open();
    fireEvent.click(await screen.findByTestId('infer-reltr'));
    const chip = within(screen.getByTestId('column-reltr')).getByTestId('provenance-chip');
    await vi.waitFor(() => expect(chip).toHaveAttribute('data-fidelity', 'measured'));
    const metrics = within(screen.getByTestId('column-reltr')).getByTestId('metrics');
    const tiers = [...metrics.querySelectorAll('[data-fidelity]')].map((el) => el.getAttribute('data-fidelity'));
    expect(tiers).toEqual(['measured', 'measured']);
  });
});
