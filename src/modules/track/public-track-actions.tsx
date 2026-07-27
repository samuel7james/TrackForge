"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bookmark, Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { editTokenStorageKey } from "@/modules/track-format/edit-token-storage";
import { useIsBookmarked } from "@/modules/bookmarks/use-bookmarks";
import { toggleBookmark } from "@/modules/bookmarks/bookmarks-storage";

interface PublicTrackActionsProps {
  slug: string;
  name: string;
  isPublished: boolean;
}

const noSubscription = () => () => {};

// Whether "you" are the owner is purely a client-side check (localStorage
// holds the edit token; there's no server-side session in the anonymous
// Milestone 1 model) -- see PROJECT_PLAN.md §8. useSyncExternalStore (rather
// than an effect + setState) is the correct tool for reading a browser-only
// API that also needs a safe SSR snapshot.
export function PublicTrackActions({ slug, name, isPublished }: PublicTrackActionsProps) {
  const isOwner = useSyncExternalStore(
    noSubscription,
    () => Boolean(localStorage.getItem(editTokenStorageKey(slug))),
    () => false
  );
  const bookmarked = useIsBookmarked(slug);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/t/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const handleBookmark = () => {
    toggleBookmark(slug, name);
    toast.success(bookmarked ? "Removed from bookmarks" : "Bookmarked");
  };

  if (!isPublished) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
        {isOwner ? (
          <>
            <span>This track isn&apos;t published yet — only you can see this page.</span>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              // prefetch={false}: reconsidered from a previous pass -- yes
              // the track *document* comes from a client-side fetch(), but
              // `slug` itself is a prop threaded down from the Server
              // Component page (app/editor/[slug]/page.tsx's `params`), so
              // a stale cached RSC payload for this route would hand
              // EditorView the WRONG slug outright, not just stale data --
              // it would then correctly fetch and fully render a different
              // track under this URL. Same risk class as /t/[slug], so
              // prefetch stays off here too; the loading spinner in
              // engine-mount.tsx covers the perceived-speed cost.
              render={<Link href={`/editor/${slug}`} prefetch={false} />}
            >
              Open editor
            </Button>
          </>
        ) : (
          <span>This track hasn&apos;t been published yet.</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        nativeButton={false}
        // prefetch={false}: see "Open editor" above -- the slug itself
        // flows through this route's Server Component prop, not just the
        // document, so it's exposed to the same stale-RSC-payload risk.
        render={<Link href={`/editor/${slug}?autoplay=1`} prefetch={false} />}
        className="gap-1.5"
      >
        <Play className="size-4" />
        Play
      </Button>
      <Button variant="outline" onClick={handleCopyLink} className="gap-1.5">
        <Copy className="size-4" />
        Copy link
      </Button>
      <Button
        variant={bookmarked ? "default" : "outline"}
        onClick={handleBookmark}
        className="gap-1.5"
      >
        <Bookmark className={bookmarked ? "size-4 fill-current" : "size-4"} />
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
    </div>
  );
}
