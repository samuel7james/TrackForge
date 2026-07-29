import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Every track/creator/discover page is real per-viewer data (which
    // track, whose likes, whose leaderboard) -- the client Router Cache's
    // default 30s stale window for dynamic routes means navigating
    // between two different tracks' pages in quick succession can still
    // show a just-cached snapshot of whichever one was visited moments
    // before, until a hard reload bypasses the cache and fetches fresh.
    // Zeroing it means every navigation to a dynamic route always refetches.
    staleTimes: {
      dynamic: 0,
    },
  },

  // No security headers were being sent at all. These are the ones that
  // cost nothing here -- no Content-Security-Policy, which this app can't
  // adopt blind: Next's inline bootstrap scripts and the WebGL/worker
  // pipeline would need a nonce-based policy built and tested against the
  // real bundle, and a wrong one fails as a blank page rather than a
  // console warning.
  async headers() {
    return [
      {
        // The 11 GLB models (~864KB together) are served straight out of
        // public/, which Next sends as `max-age=0` -- so every single play
        // session re-validated all of them, 11 round trips before the track
        // could even start building, on exactly the phone connections least
        // able to absorb it.
        //
        // Not `immutable`: these filenames aren't content-hashed, so a
        // future edit to a model has to be able to reach players. A day of
        // freshness plus a week of serve-stale-while-revalidating gets the
        // repeat-visit win without making a model change unpublishable --
        // worst case it lands a day late, or immediately if the file is
        // renamed.
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // The editor and play canvas are the whole product -- framing
          // them elsewhere serves no one but a clickjacker overlaying
          // invisible controls (Publish, Delete) on top of the real page.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Stops a browser from second-guessing a declared Content-Type,
          // e.g. treating a stored track document as HTML and running it.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Track slugs and editor URLs shouldn't ride along in the
          // Referer header to any third-party origin a page links out to.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here uses the camera, microphone, or geolocation, so
          // no embedded content should be able to ask for them either.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
