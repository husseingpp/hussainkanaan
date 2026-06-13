import { describe, expect, it } from "vitest";

import { ScanDetector } from "./useBarcodeScanner";

// Simulate a sequence of keystrokes with controllable timing.
function feed(detector: ScanDetector, keys: string[], gapMs: number): (string | null)[] {
  let t = 0;
  return keys.map((k) => {
    t += gapMs;
    return detector.handle(k, t);
  });
}

describe("ScanDetector", () => {
  it("decodes a fast burst terminated by Enter as a scan", () => {
    const d = new ScanDetector();
    const out = feed(d, ["6", "2", "9", "1", "0", "4", "Enter"], 10);
    expect(out.slice(0, -1).every((r) => r === null)).toBe(true);
    expect(out[out.length - 1]).toBe("629104");
  });

  it("ignores slow human typing followed by Enter", () => {
    const d = new ScanDetector();
    const out = feed(d, ["a", "b", "c", "Enter"], 300); // 300ms gaps = human
    expect(out[out.length - 1]).toBeNull();
  });

  it("rejects bursts shorter than minLength", () => {
    const d = new ScanDetector({ minLength: 4 });
    const out = feed(d, ["1", "2", "Enter"], 10);
    expect(out[out.length - 1]).toBeNull();
  });

  it("supports Tab as a suffix key", () => {
    const d = new ScanDetector({ suffixKeys: ["Tab"] });
    const out = feed(d, ["9", "9", "9", "9", "Tab"], 10);
    expect(out[out.length - 1]).toBe("9999");
  });

  it("resets the buffer when a slow gap interrupts a burst", () => {
    const d = new ScanDetector();
    // fast "12", then a long pause, then fast "345" + Enter → only "345" survives
    expect(d.handle("1", 0)).toBeNull();
    expect(d.handle("2", 10)).toBeNull();
    expect(d.handle("3", 1000)).toBeNull(); // slow gap resets, buffer = "3"
    expect(d.handle("4", 1010)).toBeNull();
    expect(d.handle("5", 1020)).toBeNull();
    expect(d.handle("Enter", 1030)).toBe("345");
  });

  it("does not let Shift break a scan", () => {
    const d = new ScanDetector();
    const out = feed(d, ["Shift", "7", "7", "7", "Enter"], 10);
    expect(out[out.length - 1]).toBe("777");
  });
});
