import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/challenge", label: "Challenge" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/my-tracks", label: "My tracks" },
] as const;

// Shared across Discover/creator/bookmarks pages -- none of Milestone 3's
// pages have accounts to put a persistent app shell around, so this is just
// a plain link row repeated per-page rather than a real layout/header.
export function PublicNav({ current }: { current?: (typeof LINKS)[number]["href"] }) {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {LINKS.map(({ href, label }) =>
        // /challenge's content changes day to day at the same fixed URL --
        // a plain <a>, not next/link, for the same reason track-card.tsx's
        // links are: a prefetched snapshot from before the day rolled over
        // is exactly the "shows the wrong thing until you refresh" bug
        // already fixed elsewhere, just by date instead of by track.
        href === "/challenge" ? (
          <a
            key={href}
            href={href}
            className={
              current === href
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            {label}
          </a>
        ) : (
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
        )
      )}
    </nav>
  );
}
