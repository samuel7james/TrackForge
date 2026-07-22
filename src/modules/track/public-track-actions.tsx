"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { editTokenStorageKey } from "@/modules/track-format/use-save-track";

interface PublicTrackActionsProps {
  slug: string;
  isPublished: boolean;
}

const noSubscription = () => () => {};

// Whether "you" are the owner is purely a client-side check (localStorage
// holds the edit token; there's no server-side session in the anonymous
// Milestone 1 model) -- see PROJECT_PLAN.md §8. useSyncExternalStore (rather
// than an effect + setState) is the correct tool for reading a browser-only
// API that also needs a safe SSR snapshot.
export function PublicTrackActions({ slug, isPublished }: PublicTrackActionsProps) {
  const isOwner = useSyncExternalStore(
    noSubscription,
    () => Boolean(localStorage.getItem(editTokenStorageKey(slug))),
    () => false
  );

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/t/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
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
              render={<Link href={`/editor/${slug}`} />}
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
        render={<Link href={`/editor/${slug}?autoplay=1`} />}
        className="gap-1.5"
      >
        <Play className="size-4" />
        Play
      </Button>
      <Button variant="outline" onClick={handleCopyLink} className="gap-1.5">
        <Copy className="size-4" />
        Copy link
      </Button>
    </div>
  );
}
