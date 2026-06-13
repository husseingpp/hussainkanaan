// Fixed-timestep loop (BLUEPRINT.md §4): simulation advances in exact TICK_MS
// steps; rendering runs every animation frame and interpolates between the
// last two sim ticks with `alpha`. The accumulator is a separate class so the
// timing math is unit-testable without requestAnimationFrame.

import { CONFIG } from '../config';

export interface TickResult {
  /** Number of fixed sim ticks to run for this frame. */
  ticks: number;
  /** Fraction [0, 1) of the way from the previous tick to the current one. */
  alpha: number;
}

export class FixedTimestepAccumulator {
  private accumulatedMs = 0;

  constructor(
    private readonly tickMs: number = CONFIG.TICK_MS,
    private readonly maxTicksPerFrame: number = CONFIG.MAX_TICKS_PER_FRAME,
    private readonly maxFrameDeltaMs: number = CONFIG.MAX_FRAME_DELTA_MS,
  ) {}

  advance(elapsedMs: number): TickResult {
    this.accumulatedMs += Math.min(Math.max(elapsedMs, 0), this.maxFrameDeltaMs);

    let ticks = 0;
    while (this.accumulatedMs >= this.tickMs && ticks < this.maxTicksPerFrame) {
      this.accumulatedMs -= this.tickMs;
      ticks++;
    }
    // If we hit the tick cap, drop the backlog instead of trying to catch up
    // forever (the sim slows down rather than death-spiraling).
    if (this.accumulatedMs >= this.tickMs) {
      this.accumulatedMs = this.accumulatedMs % this.tickMs;
    }

    return { ticks, alpha: this.accumulatedMs / this.tickMs };
  }
}

export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed tick of `dtSeconds`. */
  simTick(dtSeconds: number): void;
  /** Draw, interpolating positions by `alpha`; `frameDtMs` is real elapsed time. */
  render(alpha: number, frameDtMs: number): void;
}

export class GameLoop {
  private readonly accumulator = new FixedTimestepAccumulator();
  private rafId = 0;
  private lastTimeMs = 0;
  private running = false;

  constructor(private readonly callbacks: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = performance.now();
    const frame = (nowMs: number): void => {
      if (!this.running) return;
      const frameDtMs = nowMs - this.lastTimeMs;
      this.lastTimeMs = nowMs;

      const { ticks, alpha } = this.accumulator.advance(frameDtMs);
      const dtSeconds = CONFIG.TICK_MS / 1000;
      for (let i = 0; i < ticks; i++) this.callbacks.simTick(dtSeconds);
      this.callbacks.render(alpha, frameDtMs);

      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
