import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/my-tracks", label: "My tracks" },
] as const;

// Shared across Discover/creator/bookmarks pages -- none of Milestone 3's
// pages have accounts to put a persistent app shell around, so this is just
// a plain link row repeated per-page rather than a real layout/header.
export function PublicNav({ current }: { current?: (typeof LINKS)[number]["href"] }) {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={
            current === href
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
