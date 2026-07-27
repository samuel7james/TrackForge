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
};

export default nextConfig;
