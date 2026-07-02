/// <reference lib="webworker" />
/**
 * Off-main-thread parsing. A 3-year M1 export is ~1M rows; parsing it here keeps
 * the UI responsive (blueprint §9.1). The parser is pure, so the worker is a thin
 * wrapper: text in → Dataset (or a UI-ready error message) out.
 */
import { parseMt5 } from '@/engine';

export interface ParseRequest {
  text: string;
  filename?: string;
}
export type ParseResponse =
  | { ok: true; dataset: ReturnType<typeof parseMt5> }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  try {
    const dataset = parseMt5(e.data.text, e.data.filename);
    (self as unknown as Worker).postMessage({ ok: true, dataset } satisfies ParseResponse);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to parse the file.';
    (self as unknown as Worker).postMessage({ ok: false, error } satisfies ParseResponse);
  }
};
