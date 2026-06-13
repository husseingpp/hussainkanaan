import { useEffect, useRef } from "react";

// HID barcode scanners behave as keyboard wedges: they "type" the code very fast
// and send an Enter (CR) suffix. We distinguish a scan from human typing by the
// inter-keystroke gap — scanner keys arrive far faster than a person can type.

export interface ScanDetectorOptions {
  /** Minimum characters for a buffer to qualify as a scan. */
  minLength?: number;
  /** Maximum gap (ms) between keystrokes that still counts as "scanner-fast". */
  maxInterKeyMs?: number;
  /** Keys that terminate a scan. */
  suffixKeys?: string[];
}

const DEFAULTS: Required<ScanDetectorOptions> = {
  minLength: 3,
  maxInterKeyMs: 50,
  suffixKeys: ["Enter", "Tab"],
};

/**
 * Pure, framework-agnostic scan detector. Feed it `(key, timeStamp)` per
 * keydown; it returns the decoded string when a scan completes, else null.
 * Kept free of DOM/React so it can be unit-tested directly.
 */
export class ScanDetector {
  private buffer = "";
  private lastTime = 0;
  private readonly opts: Required<ScanDetectorOptions>;

  constructor(options: ScanDetectorOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  reset(): void {
    this.buffer = "";
    this.lastTime = 0;
  }

  handle(key: string, timeStamp: number): string | null {
    const gap = this.lastTime ? timeStamp - this.lastTime : 0;
    // A slow gap means a human is typing → start the buffer fresh.
    if (this.lastTime && gap > this.opts.maxInterKeyMs) {
      this.buffer = "";
    }

    if (this.opts.suffixKeys.includes(key)) {
      const code = this.buffer;
      this.reset();
      return code.length >= this.opts.minLength ? code : null;
    }

    if (key.length === 1) {
      // Printable character. Use `event.key` so EAN/UPC, Shift and AZERTY all work.
      this.buffer += key;
    }
    // Non-printable, non-suffix keys (Shift, Alt, …) are ignored but still bump timing.
    this.lastTime = timeStamp;
    return null;
  }
}

export interface UseBarcodeScannerOptions extends ScanDetectorOptions {
  enabled?: boolean;
}

/**
 * Global (window-level) scan capture for when focus is NOT in a text field.
 * The dedicated <ScannerInput> handles the common always-focused path; this hook
 * is the safety net so a scan still resolves if the user clicked elsewhere.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  options: UseBarcodeScannerOptions = {},
): void {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const detectorRef = useRef<ScanDetector | null>(null);
  if (detectorRef.current === null) {
    detectorRef.current = new ScanDetector(options);
  }

  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const detector = detectorRef.current!;

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true;
      // Let inputs (including the dedicated scanner field) manage their own keys.
      if (inField) return;

      const code = detector.handle(event.key, event.timeStamp);
      if (code) {
        event.preventDefault();
        onScanRef.current(code);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
