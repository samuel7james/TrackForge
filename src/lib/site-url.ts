// Absolute origin for anything that needs one outside a request context
// (sitemap.xml, robots.txt, generated OG images, metadataBase) -- these run
// at build/request time with no incoming Request to read a Host header from.
// Priority: an explicit custom domain (NEXT_PUBLIC_SITE_URL, set once the
// Phase 20 domain is live) > Vercel's automatic per-deployment VERCEL_URL
// (no protocol, preview deploys get their own) > localhost for dev.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
