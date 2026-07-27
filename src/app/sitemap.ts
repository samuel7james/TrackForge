import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { DAILY_CHALLENGE_SLUG } from "@/server/daily-challenge";

// Forced dynamic (computed per request, never cached at build time) --
// without a dynamic-data signal (cookies()/headers()), Next.js would
// otherwise treat this as static content and prerender it once at build
// time, which both (a) requires a live DATABASE_URL during `next build`
// and (b) would mean newly published tracks never show up in the sitemap
// until the next deploy. /discover already queries prisma per-request the
// same way, so this isn't a new trade-off for the app.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const tracks = await prisma.track.findMany({
    where: { isPublished: true, slug: { not: DAILY_CHALLENGE_SLUG } },
    select: { slug: true, updatedAt: true },
  });

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/discover`, changeFrequency: "hourly", priority: 0.8 },
    // Its own dedicated URL, not /t/[slug] -- see the /challenge page's
    // own comment on why this isn't just another track.
    { url: `${siteUrl}/challenge`, changeFrequency: "daily", priority: 0.7 },
    ...tracks.map((track) => ({
      url: `${siteUrl}/t/${track.slug}`,
      lastModified: track.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
