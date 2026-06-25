/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Adequate for a single-instance deployment (the default Docker Compose setup).
 * If you scale to multiple app instances, swap this for a shared store such as
 * Redis (e.g. @upstash/ratelimit) so limits are enforced across instances.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
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
