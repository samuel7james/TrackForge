import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// /editor is a workspace, not content -- indexing it would just surface
// blank/in-progress tracks with no context. /api is data, not pages. /creator
// and /my-tracks/bookmarks are intentionally left crawlable: they're normal
// content pages, just addressed by an anonymous id instead of a username.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/editor/", "/api/"] },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
