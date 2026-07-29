// Whether a request looks like it came from the site's own pages.
//
// This is the "use CORS on it" instinct, implemented the way it actually
// has to be. CORS itself would do nothing here: it's enforced by browsers
// deciding whether to hand a *response* back to a script, and a request
// forged in Postman or curl never consults it at all. What does help is
// checking, server-side, for the headers a browser attaches and a bare
// API client doesn't.
//
// Worth being clear about its weight: any client can set these headers by
// hand, so this stops casual abuse and costs an attacker one extra line of
// config -- nothing more. It's the outermost and weakest of the layers
// guarding lap submission, not the one doing the real work.
export function isSameOriginRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  // Compared by host rather than against a configured site URL so this
  // keeps working across the custom domain, *.vercel.app, and preview
  // deployments without another env var to keep in sync.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // Fallback for the handful of same-origin cases where a browser omits
  // Origin but still sends a Referer.
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // Neither header at all -- not a page-driven request.
  return false;
}
