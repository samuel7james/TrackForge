"use client";

import Link from "next/link";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNav } from "@/modules/track/public-nav";
import { useBookmarks } from "@/modules/bookmarks/use-bookmarks";
import { toggleBookmark } from "@/modules/bookmarks/bookmarks-storage";

// Client-only page (§8/Phase 19) -- the bookmark list lives entirely in this
// browser's localStorage, there's no server model to render server-side.
export default function BookmarksPage() {
  const bookmarks = useBookmarks();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            TrackForge
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Bookmarks</h1>
        </div>
        <PublicNav current="/bookmarks" />
      </div>

      {bookmarks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
          <Bookmark className="size-8" />
          <p>No bookmarks yet — browse Discover to find tracks worth saving.</p>
          <Button nativeButton={false} render={<Link href="/discover" />}>
            Discover tracks
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookmarks.map((entry) => (
            <li
              key={entry.slug}
              className="flex items-center justify-between rounded-lg border border-border/50 p-4"
            >
              <Link href={`/t/${entry.slug}`} className="font-medium hover:underline">
                {entry.name}
              </Link>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => toggleBookmark(entry.slug, entry.name)}
                title="Remove bookmark"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
