import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiFailure, getJson, messageOf } from '../api';

function reply(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', reply(200, { ok: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getJson', () => {
  it('returns the parsed body on success', async () => {
    await expect(getJson('/api/anything')).resolves.toEqual({ ok: true });
  });

  it('throws the backend error rather than a status code', async () => {
    vi.stubGlobal(
      'fetch',
      reply(422, {
        error: {
          code: 'slice_images_missing',
          message_en: 'Unpack the slice bundle into data/slices/.',
          message_zh: '請將課程發放的 slice bundle 解壓縮至 data/slices/。',
          detail: { dataset: 'vg150-sgb' },
        },
      }),
    );

    const failure = await getJson('/api/x').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).code).toBe('slice_images_missing');
    expect((failure as ApiFailure).detail).toEqual({ dataset: 'vg150-sgb' });
  });

  it('survives an error response that is not the error model at all', async () => {
    // A proxy, a dev server or a crashed worker can answer with HTML. The lab must state a
    // reason rather than throwing on `.error.code` while rendering the failure.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      })),
    );

    const failure = (await getJson('/api/x').catch((e: unknown) => e)) as ApiFailure;
    expect(failure).toBeInstanceOf(ApiFailure);
    expect(failure.code).toBe('unreadable_response');
    expect(failure.status).toBe(502);
  });

  it('reports a dead backend as such rather than as a 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const failure = (await getJson('/api/x').catch((e: unknown) => e)) as ApiFailure;
    expect(failure.code).toBe('backend_unreachable');
    expect(failure.status).toBe(0);
  });
});

describe('messageOf', () => {
  const failure = new ApiFailure(503, 'vlm_unavailable', 'No provider is configured.', '未設定供應者。');

  it('gives the locale its own sentence, both ways', () => {
    expect(messageOf(failure, 'en')).toBe('No provider is configured.');
    expect(messageOf(failure, 'zh-TW')).toBe('未設定供應者。');
  });

  it('never returns an empty string, whatever it is handed', () => {
    expect(messageOf(new Error('boom'), 'en')).not.toBe('');
    expect(messageOf(null, 'zh-TW')).not.toBe('');
  });
});
