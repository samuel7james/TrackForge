import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

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
