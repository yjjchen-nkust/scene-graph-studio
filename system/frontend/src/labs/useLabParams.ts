import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export type LabParamValue = string | number | null;

/**
 * Lab state as URL search parameters, per contracts §2.2.
 *
 * The URL is the state, not a copy of it. A lab that also held the same values in `useState`
 * would have two of them, and the bug that follows is always the same: the view is right, the
 * address bar is stale, and the configuration the professor put on the projector is not the one
 * a student gets by pasting the link. Everything shareable therefore lives here and nowhere else.
 *
 * A value equal to its default is written as an absent key rather than an explicit one. That
 * keeps a shared link to the interesting part of the configuration, and it makes "default" one
 * state rather than two that render alike.
 *
 * Types come from the defaults: a numeric default decodes numerically, and a value that will not
 * parse falls back to the default rather than propagating `NaN` into a metric.
 */
export function useLabParams<T extends Record<string, LabParamValue>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const [search, setSearch] = useSearchParams();

  // Both memos key on the serialized query rather than the URLSearchParams identity, which
  // changes on every navigation even when the query does not.
  const query = search.toString();
  const shape = JSON.stringify(defaults);

  const values = useMemo(() => {
    const fallback = JSON.parse(shape) as T;
    const params = new URLSearchParams(query);
    const out = {} as Record<string, LabParamValue>;
    for (const [key, value] of Object.entries(fallback)) {
      const raw = params.get(key);
      if (raw === null || raw === '') {
        out[key] = value;
      } else if (typeof value === 'number') {
        const n = Number(raw);
        out[key] = Number.isFinite(n) ? n : value;
      } else {
        out[key] = raw;
      }
    }
    return out as T;
  }, [query, shape]);

  const update = useCallback(
    (patch: Partial<T>) => {
      const fallback = JSON.parse(shape) as T;
      const next = new URLSearchParams(query);
      for (const [key, value] of Object.entries(patch)) {
        const isDefault = value === fallback[key];
        if (value === null || value === undefined || value === '' || isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      // `replace` because a lab control is not a navigation: dragging K through ten values should
      // leave one entry in the history, not ten for the back button to walk out of.
      setSearch(next, { replace: true });
    },
    [query, shape, setSearch],
  );

  return [values, update];
}
