/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Adequate for a single-instance deployment (the default Docker Compose setup).
 * If you scale to multiple app instances, swap this for a shared store such as
 * Redis (e.g. @upstash/ratelimit) so limits are enforced across instances.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

// Absolute cap so a flood keyed by attacker-controlled values (e.g. unique
// emails) can never grow a map unbounded and exhaust RAM. Maps are insertion-
// ordered, so evicting the first keys drops the oldest entries.
const MAX_ENTRIES = 20_000;
function evictOldest(map: Map<string, Entry>): void {
  if (map.size < MAX_ENTRIES) return;
  let n = Math.ceil(MAX_ENTRIES * 0.1);
  for (const k of map.keys()) {
    map.delete(k);
    if (--n <= 0) break;
  }
}

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    evictOldest(buckets);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count };
}

// Opportunistic cleanup so the map can't grow unbounded.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now > entry.resetAt) buckets.delete(key);
    }
  }, 10 * 60 * 1000).unref?.();
}

// --- Failure counters (used to decide when the adaptive CAPTCHA appears) ---

const counters = new Map<string, Entry>();

/** Read the current count for a key without changing it (0 if none/expired). */
export function peekCounter(key: string): number {
  const e = counters.get(key);
  if (!e || Date.now() > e.resetAt) return 0;
  return e.count;
}

/** Increment a key's counter within a rolling window and return the new count. */
export function bumpCounter(key: string, windowMs: number): number {
  const now = Date.now();
  const e = counters.get(key);
  if (!e || now > e.resetAt) {
    evictOldest(counters);
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  e.count += 1;
  return e.count;
}

/** Clear a key's counter (e.g. after a successful login). */
export function resetCounter(key: string): void {
  counters.delete(key);
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of counters) {
      if (now > entry.resetAt) counters.delete(key);
    }
  }, 10 * 60 * 1000).unref?.();
}

/**
 * Defense-in-depth guard for authenticated server-action mutations. Throws a
 * user-friendly Persian error when the caller exceeds `max` calls in `windowMs`,
 * which the actions' try/catch turns into a returned { error } via formError().
 */
export function enforceRateLimit(key: string, max: number, windowMs: number): void {
  if (!checkRateLimit(key, max, windowMs).allowed) {
    throw new Error("تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.");
  }
}
