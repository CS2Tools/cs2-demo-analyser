import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteKey, RouteParams, RouteResult } from '@cs2/contract';
import { transport } from './transport';

export interface RouteState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useRoute<K extends RouteKey>(
  route: K,
  params: RouteParams<K>,
  deps: readonly unknown[] = [],
): RouteState<RouteResult<K>> {
  const [data, setData] = useState<RouteResult<K> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    transport
      .call(route, paramsRef.current)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };

  }, [route, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

export function useAction<K extends RouteKey>(route: K) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (params: RouteParams<K>): Promise<RouteResult<K> | null> => {
      setPending(true);
      setError(null);
      try {
        return await transport.call(route, params);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setPending(false);
      }
    },
    [route],
  );

  return { run, pending, error };
}
