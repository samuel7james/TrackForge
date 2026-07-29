// Best-effort, in-memory sliding-window limiter -- no Redis/KV in this stack
// (§8/Milestone 3: free for everyone, no paid external services). On Vercel's
// serverless functions this state is per-instance, not global: under real
// concurrent load across multiple warm instances an abuser could exceed the
// nominal limit by a multiple of however many instances happen to be warm.
// That's an accepted trade-off for a solo project's comment/like spam
// deterrent, not a security boundary -- it raises the bar against casual
// abuse for free, nothing more. Revisit with Upstash/Vercel KV if abuse
// actually happens in practice.
interface Entry {
  timestamps: number[];
  /** Kept per entry because callers don't share one window -- the sweep
   * below has to judge each key by its own, or a 10-minute budget swept
   * against some other caller's 1-minute window would be dropped while
   * still active, handing its holder a fresh budget early. */
  windowMs: number;
}

const hits = new Map<string, Entry>();

// Entries were only ever added, never removed: every distinct key (and most
// are per-viewerId, so effectively per-visitor) left a permanent array
// behind, growing the map for as long as the process stayed warm. Sweeping
// keeps it proportional to *recent* traffic instead of to all traffic the
// instance has ever seen.
const SWEEP_INTERVAL_MS = 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number) {
  for (const [key, entry] of hits) {
    const newest = entry.timestamps[entry.timestamps.length - 1];
    if (newest === undefined || newest <= now - entry.windowMs) hits.delete(key);
  }
  lastSweep = now;
}

export function checkRateLimit(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();

  if (now - lastSweep > SWEEP_INTERVAL_MS) sweep(now);

  const cutoff = now - windowMs;
  const timestamps = (hits.get(key)?.timestamps ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= max) {
    hits.set(key, { timestamps, windowMs });
    return false;
  }

  timestamps.push(now);
  hits.set(key, { timestamps, windowMs });
  return true;
}
