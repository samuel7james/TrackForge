import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

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
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
  });

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/discover`, changeFrequency: "hourly", priority: 0.8 },
    ...tracks.map((track) => ({
      url: `${siteUrl}/t/${track.slug}`,
      lastModified: track.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
