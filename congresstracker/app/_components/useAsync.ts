"use client";

import { useEffect, useState } from "react";

/**
 * Run an async data-fetcher in the browser and track its result + loading
 * state. Used by the page components in the static-export ("live hybrid")
 * build, where every page is a static shell that fetches its own data from
 * Supabase (anon, RLS read-only) on the client. The same components also work
 * unchanged on a server host — they just render client-side there too.
 *
 * `deps` controls when the fetch re-runs (e.g. when URL filters change). A
 * stale in-flight request is ignored if deps change before it resolves.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  initial: T,
): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fn().then(
      (result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      },
      () => {
        if (active) setLoading(false);
      },
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}
