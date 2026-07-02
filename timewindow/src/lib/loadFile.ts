import type { ParseResponse } from '@/worker/parse.worker';
import { useStore } from '@/store/useStore';
import { saveLocal } from './fileStore';
import { isCloudConfigured, saveCloud } from './cloudStore';

/**
 * Read a File, parse it off the main thread, push the result into the store, and
 * auto-save it (locally always, and to the cloud when configured) so it can be
 * reopened later. Falls back to synchronous parsing if the Worker can't be built.
 */
export async function loadFile(file: File): Promise<void> {
  const { setParsing, setParseError, setDataset } = useStore.getState();
  setParsing(true);
  setParseError(null);
  try {
    const text = await file.text();
    const response = await parseInWorker(text, file.name).catch(() => parseInline(text, file.name));
    if (response.ok) {
      setDataset(response.dataset);
      void autoSave(response.dataset, file.name);
    } else {
      setDataset(null);
      setParseError(response.error);
    }
  } catch (err) {
    setDataset(null);
    setParseError(err instanceof Error ? err.message : 'Failed to read the file.');
  } finally {
    setParsing(false);
  }
}

/** Persist a freshly-imported dataset. Best-effort — failures never block the import. */
async function autoSave(dataset: Parameters<typeof saveLocal>[0], filename: string): Promise<void> {
  const name = filename.replace(/\.[^.]+$/, '') || dataset.symbol;
  try {
    await saveLocal(dataset, name);
  } catch (err) {
    console.warn('Local save failed:', err);
  }
  if (isCloudConfigured()) {
    try {
      await saveCloud(dataset, name);
    } catch (err) {
      console.warn('Cloud save failed:', err);
    }
  }
}

function parseInWorker(text: string, filename: string): Promise<ParseResponse> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/parse.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<ParseResponse>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(e);
      worker.terminate();
    };
    worker.postMessage({ text, filename });
  });
}

async function parseInline(text: string, filename: string): Promise<ParseResponse> {
  const { parseMt5 } = await import('@/engine');
  try {
    return { ok: true, dataset: parseMt5(text, filename) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to parse the file.' };
  }
}
