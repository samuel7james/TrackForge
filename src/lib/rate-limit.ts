// Best-effort, in-memory sliding-window limiter -- no Redis/KV in this stack
// (§8/Milestone 3: free for everyone, no paid external services). On Vercel's
// serverless functions this state is per-instance, not global: under real
// concurrent load across multiple warm instances an abuser could exceed the
// nominal limit by a multiple of however many instances happen to be warm.
// That's an accepted trade-off for a solo project's comment/like spam
// deterrent, not a security boundary -- it raises the bar against casual
// abuse for free, nothing more. Revisit with Upstash/Vercel KV if abuse
// actually happens in practice.
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}
