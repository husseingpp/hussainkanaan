/**
 * Optional Supabase cloud sync for saved datasets (cross-device).
 *
 * Config (project URL + anon key) is entered in-app and kept in localStorage —
 * never committed — so the public repo carries no credentials and each of your
 * devices enables cloud by pasting the same two values once. If unconfigured or
 * unreachable, every call no-ops and the app stays fully functional on local only.
 *
 * One-time Supabase setup (personal, no auth per the user): create a PUBLIC
 * Storage bucket named `timewindow-datasets` with permissive anon
 * select/insert/update/delete policies. See the README.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Dataset } from '@/engine';
import {
  deserializeDataset,
  metaOf,
  serializeDataset,
  type SavedMeta,
  type SerializedDataset,
} from './datasetCodec';

const BUCKET = 'timewindow-datasets';
const INDEX = 'index.json';
const CONFIG_KEY = 'timewindow.cloud';

export interface CloudConfig {
  url: string;
  anonKey: string;
}

export function getCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CloudConfig;
    return c.url && c.anonKey ? c : null;
  } catch {
    return null;
  }
}

export function setCloudConfig(config: CloudConfig | null): void {
  if (config && config.url && config.anonKey) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(CONFIG_KEY);
  }
}

export function isCloudConfigured(): boolean {
  return getCloudConfig() !== null;
}

let client: SupabaseClient | null = null;
let clientKey = '';
function getClient(): SupabaseClient | null {
  const config = getCloudConfig();
  if (!config) return null;
  const key = `${config.url}|${config.anonKey}`;
  if (!client || clientKey !== key) {
    client = createClient(config.url, config.anonKey, { auth: { persistSession: false } });
    clientKey = key;
  }
  return client;
}

const dataPath = (id: string) => `data/${id}.json`;

async function readIndex(sb: SupabaseClient): Promise<SavedMeta[]> {
  const { data, error } = await sb.storage.from(BUCKET).download(INDEX);
  if (error || !data) return [];
  try {
    return JSON.parse(await data.text()) as SavedMeta[];
  } catch {
    return [];
  }
}

async function writeIndex(sb: SupabaseClient, metas: SavedMeta[]): Promise<void> {
  const blob = new Blob([JSON.stringify(metas)], { type: 'application/json' });
  await sb.storage.from(BUCKET).upload(INDEX, blob, { upsert: true, contentType: 'application/json' });
}

/** Upload a dataset and update the cloud index. Returns its metadata. */
export async function saveCloud(ds: Dataset, name: string): Promise<SavedMeta> {
  const sb = getClient();
  if (!sb) throw new Error('Cloud sync is not configured.');
  const meta = metaOf(ds, name);
  const blob = new Blob([JSON.stringify(serializeDataset(ds))], { type: 'application/json' });
  const up = await sb.storage.from(BUCKET).upload(dataPath(ds.id), blob, {
    upsert: true,
    contentType: 'application/json',
  });
  if (up.error) throw up.error;
  const index = (await readIndex(sb)).filter((m) => m.id !== ds.id);
  await writeIndex(sb, [meta, ...index]);
  return meta;
}

export async function listCloud(): Promise<SavedMeta[]> {
  const sb = getClient();
  if (!sb) return [];
  return (await readIndex(sb)).sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadCloud(id: string): Promise<Dataset | null> {
  const sb = getClient();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(BUCKET).download(dataPath(id));
  if (error || !data) return null;
  return deserializeDataset(JSON.parse(await data.text()) as SerializedDataset);
}

export async function deleteCloud(id: string): Promise<void> {
  const sb = getClient();
  if (!sb) return;
  await sb.storage.from(BUCKET).remove([dataPath(id)]);
  await writeIndex(sb, (await readIndex(sb)).filter((m) => m.id !== id));
}
