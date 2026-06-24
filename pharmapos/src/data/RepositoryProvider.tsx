/**
 * Async-initialises the repository once and exposes it (plus the active session)
 * to the React tree. The UI reaches data only through these hooks — never SQLite
 * or Supabase directly (CLAUDE.md).
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createRepository, type RepositoryContext } from './createRepository';
import type { Repository } from './repository';
import type { Session } from './seed';

const Ctx = createContext<RepositoryContext | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<RepositoryContext | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    createRepository()
      .then((c) => alive && setCtx(c))
      .catch((e) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="text-red-600">
          <p className="font-semibold">Failed to start PharmaPOS</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading PharmaPOS…
      </div>
    );
  }

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

function useRepositoryContext(): RepositoryContext {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error('useRepository/useSession must be used within a RepositoryProvider');
  }
  return c;
}

export function useRepository(): Repository {
  return useRepositoryContext().repo;
}

export function useSession(): Session {
  return useRepositoryContext().session;
}
