import { useCallback, useRef, useState } from 'react';
import { loadFile } from '@/lib/loadFile';
import { useStore } from '@/store/useStore';

/** Full-screen empty state: the import dropzone + a 2-step MT5 export micro-guide. */
export function Dropzone() {
  const parsing = useStore((s) => s.parsing);
  const parseError = useStore((s) => s.parseError);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onFiles = useCallback((files: FileList | null) => {
    if (files && files[0]) void loadFile(files[0]);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          Time<span className="text-floor-gold">Window</span>
        </h1>
        <p className="text-text-dim">MT5 intraday time-of-day backtester</p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`w-full max-w-xl rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragging
            ? 'border-floor-gold bg-floor-gold/5'
            : 'border-floor-border bg-floor-panel hover:border-text-dim'
        }`}
        aria-label="Load an MT5 M1 export file"
      >
        <div className="num mb-3 text-lg text-text-primary">
          {parsing ? 'Parsing…' : 'Drop your MT5 M1 export here'}
        </div>
        <div className="text-sm text-text-dim">or click to choose a file (.csv / .txt / .tsv)</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.tsv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </button>

      {parseError && (
        <p className="mt-4 max-w-xl rounded-lg border border-trade-loss/40 bg-trade-loss/10 px-4 py-3 text-sm text-text-primary">
          {parseError}
        </p>
      )}

      <div className="mt-10 max-w-xl text-sm text-text-dim">
        <p className="mb-2 font-medium text-text-primary">Export from MT5 in two steps</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open your symbol on the M1 (1-minute) timeframe.</li>
          <li>
            Right-click the chart → <span className="text-text-primary">Save As</span>, keep the
            default columns. Drop that file above.
          </li>
        </ol>
      </div>
    </div>
  );
}
