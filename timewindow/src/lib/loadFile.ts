import type { ParseResponse } from '@/worker/parse.worker';
import { useStore } from '@/store/useStore';

/**
 * Read a File, parse it off the main thread, and push the result into the store.
 * Falls back to synchronous parsing if the Worker can't be constructed.
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
