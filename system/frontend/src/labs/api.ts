import { useQuery } from '@tanstack/react-query';
import type { SceneGraph } from 'sgg-metrics';
import type { Locale } from '../i18n/useLocale';
import type { ModelRow } from './L4/types';

/**
 * A backend refusal, carried whole.
 *
 * Contracts §1.1 gives every non-2xx response a code and a sentence in both languages, and NFR-1
 * requires a visible reason rather than a stack trace. Reducing that to a status code at the
 * fetch boundary would throw the sentence away at exactly the moment it is needed — the 422 for
 * a missing slice image names the bundle to unpack and the command to verify it, and a lab that
 * renders "422" instead is a support question.
 */
export class ApiFailure extends Error {
  // Fields declared and assigned, not constructor parameter properties: the frontend compiles
  // under `erasableSyntaxOnly`, which admits only type syntax a stripper can delete.
  readonly status: number;
  readonly code: string;
  readonly messageEn: string;
  readonly messageZh: string;
  readonly detail: unknown;

  constructor(
    status: number,
    code: string,
    messageEn: string,
    messageZh: string,
    detail?: unknown,
  ) {
    super(`${code}: ${messageEn}`);
    this.name = 'ApiFailure';
    this.status = status;
    this.code = code;
    this.messageEn = messageEn;
    this.messageZh = messageZh;
    this.detail = detail;
  }
}

interface WireError {
  error?: { code?: string; message_en?: string; message_zh?: string; detail?: unknown };
}

/**
 * Where the backend lives. Empty for the local run, where Vite proxies `/api` to it. A static
 * deployment (GitHub Pages) has no such proxy, so its build sets `VITE_API_BASE` to the backend's
 * own origin, without a trailing slash.
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${url}`, init);
  } catch {
    // `fetch` rejects only for a transport failure, which here means the local backend is not
    // running. That is a different instruction to the reader than any status code.
    throw new ApiFailure(
      0,
      'backend_unreachable',
      'The local backend is not answering. Start it with `npm start`.',
      '本機後端沒有回應，請以 `npm start` 啟動。',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new ApiFailure(
        response.status,
        'unreadable_response',
        'The backend answered with something that is not JSON.',
        '後端回應的內容不是 JSON。',
      );
    }
    body = undefined;
  }

  if (response.ok) return body as T;

  const wire = (body ?? {}) as WireError;
  if (!wire.error?.code) {
    // Not the error model: a proxy page, a dev-server overlay, a crashed worker. Say that,
    // rather than throwing on `.error.code` while rendering the failure.
    throw new ApiFailure(
      response.status,
      'unreadable_response',
      `The backend answered ${response.status} in a shape this application does not know.`,
      `後端回應 ${response.status}，且格式非本應用程式所認得。`,
    );
  }

  throw new ApiFailure(
    response.status,
    wire.error.code,
    wire.error.message_en ?? wire.error.code,
    wire.error.message_zh ?? wire.error.code,
    wire.error.detail,
  );
}

/** `getJson` with a JSON body. One place that spells the header, so no caller can forget it. */
export function postJson<T>(url: string, body: unknown): Promise<T> {
  return getJson<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Whether a failure says the thing asked for is not there: a 404 `not_found` in the error model.
 *
 * For a committed prediction that is an answer, "none for this frame". Every other failure, a dead
 * backend, a 500, a proxy's 404 page, is a reason no answer could be had, and reading it as
 * "none" states something about the corpus that nobody learned.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiFailure && error.status === 404 && error.code === 'not_found';
}

/** The sentence to show, in the locale on screen. Never empty, whatever it is handed. */
export function messageOf(error: unknown, locale: Locale): string {
  if (error instanceof ApiFailure) return locale === 'en' ? error.messageEn : error.messageZh;
  if (error instanceof Error && error.message) return error.message;
  return locale === 'en' ? 'Something failed, with no reason given.' : '發生未指明原因的錯誤。';
}

export interface SliceImageRow {
  image_id: string;
  width: number;
  height: number;
  object_count: number;
  relationship_count: number;
  present: boolean;
}

export interface SliceImages {
  dataset: string;
  image_count: number;
  images: SliceImageRow[];
}

export interface DatasetRow {
  id: string;
  name_en: string;
  name_zh: string;
  image_count: number;
  has_masks: boolean;
  images_present: boolean;
}

// The corpora are immutable for a session, contracts §2.3. Nothing below refetches.
const STATIC = { staleTime: Infinity, retry: false } as const;

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: () => getJson<{ datasets: DatasetRow[] }>('/api/datasets'),
    ...STATIC,
  });
}

export function useSliceImages(ds: string) {
  return useQuery({
    queryKey: ['slice-images', ds],
    queryFn: () => getJson<SliceImages>(`/api/datasets/${ds}/images`),
    ...STATIC,
  });
}

export function useImageGraph(ds: string, imageId: string | null, withImage = false) {
  return useQuery({
    queryKey: ['image-graph', ds, imageId, withImage],
    queryFn: () =>
      getJson<SceneGraph & { image_data_url?: string }>(
        `/api/datasets/${ds}/images/${imageId}${withImage ? '?include_image=true' : ''}`,
      ),
    enabled: imageId !== null,
    ...STATIC,
  });
}

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => getJson<{ models: ModelRow[] }>('/api/models'),
    ...STATIC,
  });
}

