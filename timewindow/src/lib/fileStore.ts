/**
 * Local saved-file store (IndexedDB). Persists parsed datasets in the browser so
 * they reopen instantly with no re-parse. Two object stores: `meta` (small rows
 * for listing) and `data` (the full serialized dataset), so listing never loads
 * the candle arrays.
 */
import type { Dataset } from '@/engine';
import {
  deserializeDataset,
  metaOf,
  serializeDataset,
  type SavedMeta,
  type SerializedDataset,
} from './datasetCodec';

const DB_NAME = 'timewindow';
const DB_VERSION = 1;
const META = 'meta';
const DATA = 'data';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveLocal(ds: Dataset, name: string): Promise<SavedMeta> {
  const meta = metaOf(ds, name);
  const data = serializeDataset(ds);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([META, DATA], 'readwrite');
    t.objectStore(META).put(meta);
    t.objectStore(DATA).put(data);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
  return meta;
}

export async function listLocal(): Promise<SavedMeta[]> {
  const all = await tx<SavedMeta[]>(META, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadLocal(id: string): Promise<Dataset | null> {
  const data = await tx<SerializedDataset | undefined>(DATA, 'readonly', (s) => s.get(id));
  return data ? deserializeDataset(data) : null;
}

export async function deleteLocal(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([META, DATA], 'readwrite');
    t.objectStore(META).delete(id);
    t.objectStore(DATA).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}
