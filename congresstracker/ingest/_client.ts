/**
 * Rate-limited, retrying, paging client for the Congress.gov API (v3).
 *
 * Why this exists (see ../CLAUDE.md):
 *   - Congress.gov enforces ~5,000 requests/day per key. We page incrementally
 *     and sync by `updateDate` rather than refetching everything, so this client
 *     is the single chokepoint where throttling + a daily cap are enforced.
 *   - Transient failures (429, 5xx, network blips) are retried with exponential
 *     backoff + jitter, honouring `Retry-After` when present.
 *   - All time/network/randomness is injectable so paging and backoff can be
 *     unit-tested deterministically with no real network (the Phase 2 QA gate).
 *
 * Endpoints return a payload like:
 *   { "members": [ ... ], "pagination": { "count": 538, "next": "..." }, "request": {...} }
 * The array key varies per endpoint, so `paginate` auto-detects it (or you pass
 * `itemsKey`) and walks pages via offset/limit until `pagination.count` is met.
 */

export const DEFAULT_BASE_URL = "https://api.congress.gov/v3";
export const MAX_PAGE_SIZE = 250; // Congress.gov hard limit on `limit`.

export interface CongressClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Injectable fetch (defaults to global fetch). */
  fetchFn?: typeof fetch;
  /** Minimum gap between request starts, ms. Smooths bursts. */
  minIntervalMs?: number;
  /** Soft daily cap; throws RateLimitExceededError when exceeded. */
  maxRequestsPerDay?: number;
  /** Retry attempts for transient failures (in addition to the first try). */
  maxRetries?: number;
  /** Base backoff in ms; grows as base * 2^attempt (+ jitter). */
  backoffBaseMs?: number;
  /** Cap on a single backoff wait, ms. */
  backoffMaxMs?: number;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  /** Injectable sleep (defaults to setTimeout). Must advance `now`. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable jitter in [0,1) (defaults to Math.random). */
  random?: () => number;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`Congress.gov ${status} for ${url}: ${body.slice(0, 200)}`);
    this.name = "HttpError";
  }
}

/** Thrown when the configured daily request budget is exhausted. */
export class RateLimitExceededError extends Error {
  constructor(readonly limit: number) {
    super(`Congress.gov daily request cap of ${limit} reached`);
    this.name = "RateLimitExceededError";
  }
}

export interface PaginateOptions {
  /** Query params (api_key, format and paging are added automatically). */
  params?: Record<string, string | number | undefined>;
  /** Page size; clamped to [1, MAX_PAGE_SIZE]. */
  pageSize?: number;
  /** Where this run starts (for resuming). */
  startOffset?: number;
  /** Override the response array key instead of auto-detecting it. */
  itemsKey?: string;
  /** Hard stop on total items yielded (safety valve). */
  maxItems?: number;
}

interface Pagination {
  count?: number;
  next?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class CongressClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly maxRequestsPerDay: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly backoffMaxMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  private lastRequestAt = -Infinity;
  private windowStart = -Infinity;
  private requestsInWindow = 0;

  constructor(opts: CongressClientOptions) {
    if (!opts.apiKey) throw new Error("CongressClient requires an apiKey");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchFn = opts.fetchFn ?? globalThis.fetch;
    this.minIntervalMs = opts.minIntervalMs ?? 0;
    this.maxRequestsPerDay = opts.maxRequestsPerDay ?? 5000;
    this.maxRetries = opts.maxRetries ?? 5;
    this.backoffBaseMs = opts.backoffBaseMs ?? 500;
    this.backoffMaxMs = opts.backoffMaxMs ?? 30_000;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
    this.random = opts.random ?? Math.random;
  }

  /** Number of requests counted in the current rolling 24h window. */
  get requestsUsedToday(): number {
    if (this.now() - this.windowStart >= DAY_MS) return 0;
    return this.requestsInWindow;
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): string {
    const clean = path.replace(/^\/+/, "");
    const url = new URL(`${this.baseUrl}/${clean}`);
    // Sensible defaults; explicit params win.
    url.searchParams.set("format", "json");
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    url.searchParams.set("api_key", this.apiKey);
    return url.toString();
  }

  /** Hide the key when surfacing URLs in errors/logs. */
  private redact(url: string): string {
    return url.replace(/(api_key=)[^&]+/, "$1***");
  }

  private async throttle(): Promise<void> {
    const t = this.now();
    // Roll the daily window.
    if (t - this.windowStart >= DAY_MS) {
      this.windowStart = t;
      this.requestsInWindow = 0;
    }
    if (this.requestsInWindow >= this.maxRequestsPerDay) {
      throw new RateLimitExceededError(this.maxRequestsPerDay);
    }
    // Smooth bursts: ensure a minimum gap between request starts.
    const wait = this.minIntervalMs - (t - this.lastRequestAt);
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();
    this.requestsInWindow += 1;
  }

  private backoffDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined && retryAfterMs >= 0) {
      return Math.min(retryAfterMs, this.backoffMaxMs);
    }
    const exp = this.backoffBaseMs * 2 ** attempt;
    const jitter = exp * this.random();
    return Math.min(exp + jitter, this.backoffMaxMs);
  }

  private static parseRetryAfter(res: Response): number | undefined {
    const raw = res.headers.get("retry-after");
    if (!raw) return undefined;
    const secs = Number(raw);
    if (Number.isFinite(secs)) return secs * 1000;
    const date = Date.parse(raw);
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
  }

  /** GET a single endpoint and parse JSON, with throttling + retries. */
  async get<T = unknown>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    let attempt = 0;

    for (;;) {
      await this.throttle();

      let res: Response;
      try {
        res = await this.fetchFn(url, {
          headers: { Accept: "application/json" },
        });
      } catch (err) {
        // Network-level failure: retry if budget remains.
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoffDelay(attempt));
          attempt += 1;
          continue;
        }
        throw err;
      }

      if (res.ok) {
        return (await res.json()) as T;
      }

      const retryable = RETRYABLE_STATUS.has(res.status);
      if (retryable && attempt < this.maxRetries) {
        const retryAfterMs = CongressClient.parseRetryAfter(res);
        await this.sleep(this.backoffDelay(attempt, retryAfterMs));
        attempt += 1;
        continue;
      }

      const body = await res.text().catch(() => "");
      throw new HttpError(res.status, this.redact(url), body);
    }
  }

  /**
   * Walk every page of a collection endpoint, yielding items one at a time.
   * Stops when `pagination.count` is reached, a short page is returned, or
   * `maxItems` is hit. Pages are fetched lazily (one request per page).
   */
  async *paginate<T = unknown>(
    path: string,
    options: PaginateOptions = {},
  ): AsyncGenerator<T, void, unknown> {
    const pageSize = clamp(options.pageSize ?? MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    let offset = Math.max(0, options.startOffset ?? 0);
    let yielded = 0;
    let total: number | undefined;

    for (;;) {
      const payload = await this.get<Record<string, unknown>>(path, {
        ...options.params,
        offset,
        limit: pageSize,
      });

      const pagination = (payload.pagination ?? {}) as Pagination;
      if (typeof pagination.count === "number") total = pagination.count;

      const items = this.extractItems<T>(payload, options.itemsKey);
      for (const item of items) {
        yield item;
        yielded += 1;
        if (options.maxItems !== undefined && yielded >= options.maxItems) {
          return;
        }
      }

      // Termination: short page, no items, or we've covered the reported total.
      if (items.length < pageSize) return;
      if (total !== undefined && offset + items.length >= total) return;

      offset += items.length;
    }
  }

  /** Collect a full endpoint into an array (convenience over paginate). */
  async fetchAll<T = unknown>(
    path: string,
    options: PaginateOptions = {},
  ): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this.paginate<T>(path, options)) out.push(item);
    return out;
  }

  private extractItems<T>(
    payload: Record<string, unknown>,
    itemsKey?: string,
  ): T[] {
    if (itemsKey) {
      const v = payload[itemsKey];
      return Array.isArray(v) ? (v as T[]) : [];
    }
    // Auto-detect: the first array-valued property that isn't metadata.
    for (const [key, value] of Object.entries(payload)) {
      if (key === "pagination" || key === "request") continue;
      if (Array.isArray(value)) return value as T[];
    }
    return [];
  }
}
