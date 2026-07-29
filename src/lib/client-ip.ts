// The origin to rate-limit against.
//
// Keying a limiter on a cookie id (viewerId/authorId) only limits clients
// that bother to keep their cookies: anything scripted just omits the
// header, gets a freshly minted id on every request, and lands on a
// different bucket each time -- which is exactly the traffic a limiter is
// there to stop. The network address is the cheapest identifier a caller
// can't rotate at will.
//
// On Vercel both headers below are set by the platform edge and overwrite
// whatever the client sent, so they're trustworthy there. Behind any other
// proxy that appends rather than replaces, the client-supplied portion
// would be attacker-controlled -- so this is a spam deterrent, consistent
// with what rate-limit.ts already documents about itself, not an
// authentication signal.
export function getClientIp(request: Request): string | null {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Left-most entry is the original client; the rest are proxy hops.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

// Prefers the network address, falling back to the caller's cookie id when
// there's no proxy header at all (local dev). Callers pass a prefix so two
// different endpoints never share one budget.
export function rateLimitKey(request: Request, prefix: string, fallbackId: string): string {
  return `${prefix}:${getClientIp(request) ?? `id-${fallbackId}`}`;
}
