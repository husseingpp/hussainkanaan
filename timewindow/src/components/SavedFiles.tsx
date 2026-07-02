import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import type { SavedMeta } from '@/lib/datasetCodec';
import { deleteLocal, listLocal, loadLocal, saveLocal } from '@/lib/fileStore';
import {
  deleteCloud,
  getCloudConfig,
  isCloudConfigured,
  listCloud,
  loadCloud,
  saveCloud,
  setCloudConfig,
} from '@/lib/cloudStore';
import { fmtDateUTC } from '@/lib/format';

interface Row {
  meta: SavedMeta;
  local: boolean;
  cloud: boolean;
}

/** Merge local + cloud saved-file lists by id, newest first. */
function merge(local: SavedMeta[], cloud: SavedMeta[]): Row[] {
  const byId = new Map<string, Row>();
  for (const meta of local) byId.set(meta.id, { meta, local: true, cloud: false });
  for (const meta of cloud) {
    const existing = byId.get(meta.id);
    if (existing) existing.cloud = true;
    else byId.set(meta.id, { meta, local: false, cloud: true });
  }
  return [...byId.values()].sort((a, b) => b.meta.savedAt - a.meta.savedAt);
}

export function SavedFiles() {
  const setDataset = useStore((s) => s.setDataset);
  const setParsing = useStore((s) => s.setParsing);
  const [rows, setRows] = useState<Row[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  const refresh = useCallback(async () => {
    const [local, cloud] = await Promise.all([
      listLocal().catch(() => []),
      listCloud().catch(() => []),
    ]);
    setRows(merge(local, cloud));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reopen = useCallback(
    async (row: Row) => {
      setParsing(true);
      try {
        const ds = row.local ? await loadLocal(row.meta.id) : await loadCloud(row.meta.id);
        if (ds) {
          setDataset(ds);
          // If it only lived in one place, mirror it to the other so both stay in sync.
          if (!row.local) await saveLocal(ds, row.meta.name).catch(() => {});
          if (!row.cloud && isCloudConfigured()) await saveCloud(ds, row.meta.name).catch(() => {});
        }
      } finally {
        setParsing(false);
      }
    },
    [setDataset, setParsing],
  );

  const remove = useCallback(
    async (row: Row) => {
      await Promise.all([
        deleteLocal(row.meta.id).catch(() => {}),
        isCloudConfigured() ? deleteCloud(row.meta.id).catch(() => {}) : Promise.resolve(),
      ]);
      await refresh();
    },
    [refresh],
  );

  if (rows.length === 0 && !showConfig) {
    return (
      <div className="mt-6 w-full max-w-xl text-center">
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className="text-xs text-text-dim underline-offset-2 hover:text-floor-gold hover:underline"
        >
          Set up cloud sync (optional)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 w-full max-w-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-text-dim">Saved files</span>
        <button
          type="button"
          onClick={() => setShowConfig((v) => !v)}
          className="text-xs text-text-dim underline-offset-2 hover:text-floor-gold hover:underline"
        >
          Cloud sync
        </button>
      </div>

      {showConfig && <CloudConfigPanel onSaved={refresh} />}

      <ul className="divide-y divide-floor-border overflow-hidden rounded-lg border border-floor-border">
        {rows.map((row) => (
          <li key={row.meta.id} className="flex items-center gap-3 bg-floor-panel px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-text-primary">{row.meta.name}</div>
              <div className="num text-xs text-text-dim">
                {row.meta.symbol} · {row.meta.bars.toLocaleString()} bars · {row.meta.source} ·{' '}
                {fmtDateUTC(new Date(row.meta.savedAt))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {row.local && (
                <span className="rounded-full border border-floor-border px-1.5 py-0.5 text-text-dim">local</span>
              )}
              {row.cloud && (
                <span className="rounded-full border border-floor-gold/40 px-1.5 py-0.5 text-floor-gold">cloud</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void reopen(row)}
              className="rounded-md border border-floor-border px-2 py-1 text-xs text-text-primary hover:border-floor-gold"
            >
              Reopen
            </button>
            <button
              type="button"
              onClick={() => void remove(row)}
              className="rounded-md border border-floor-border px-2 py-1 text-xs text-text-dim hover:border-trade-loss hover:text-trade-loss"
              aria-label={`Delete ${row.meta.name}`}
            >
              ✕
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="bg-floor-panel px-3 py-4 text-center text-xs text-text-dim">
            No saved files yet — import one and it&apos;s saved automatically.
          </li>
        )}
      </ul>
    </div>
  );
}

function CloudConfigPanel({ onSaved }: { onSaved: () => void }) {
  const existing = getCloudConfig();
  const [url, setUrl] = useState(existing?.url ?? '');
  const [anonKey, setAnonKey] = useState(existing?.anonKey ?? '');

  return (
    <div className="mb-3 rounded-lg border border-floor-border bg-floor-bg p-3 text-left">
      <p className="mb-2 text-xs text-text-dim">
        Paste your Supabase project URL + anon key to sync saved files across devices. Stored only in
        this browser. Create a public bucket named <span className="num text-text-primary">timewindow-datasets</span> first.
      </p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://xxxx.supabase.co"
        className="num mb-2 w-full rounded-md border border-floor-border bg-floor-panel px-2 py-1.5 text-sm text-text-primary placeholder:text-text-dim"
      />
      <input
        value={anonKey}
        onChange={(e) => setAnonKey(e.target.value)}
        placeholder="anon public key"
        className="num mb-2 w-full rounded-md border border-floor-border bg-floor-panel px-2 py-1.5 text-sm text-text-primary placeholder:text-text-dim"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setCloudConfig(url.trim() && anonKey.trim() ? { url: url.trim(), anonKey: anonKey.trim() } : null);
            onSaved();
          }}
          className="rounded-md border border-floor-border px-3 py-1 text-sm text-text-primary hover:border-floor-gold"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setCloudConfig(null);
            setUrl('');
            setAnonKey('');
            onSaved();
          }}
          className="rounded-md border border-floor-border px-3 py-1 text-sm text-text-dim hover:border-trade-loss hover:text-trade-loss"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
