"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Rocket, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTrackStore } from "@/store/track-store";
import { editTokenStorageKey } from "@/modules/track-format/edit-token-storage";

interface PublishIssue {
  code: string;
  message: string;
}

// Publish makes a track visible on Discover and gives it a real, shareable
// `/t/{slug}` link -- before this, only the owning browser (via its
// localStorage edit token) can even open it. Reads `slug`/`name` from the
// store rather than a prop so they reflect a slug just assigned by the very
// first Save, not whatever was true when this component first mounted.
export function PublishShareButton({
  initiallyPublished,
  saveTrack,
}: {
  initiallyPublished: boolean;
  saveTrack: () => Promise<void>;
}) {
  const slug = useTrackStore((s) => s.document.meta.slug);
  const name = useTrackStore((s) => s.document.meta.name);
  const setMeta = useTrackStore((s) => s.setMeta);
  const [isPublished, setIsPublished] = useState(initiallyPublished);
  const [isPublishing, setIsPublishing] = useState(false);
  const [open, setOpen] = useState(false);

  if (!slug) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1.5" title="Save the track first">
        <Rocket className="size-4" />
        Publish
      </Button>
    );
  }

  const shareUrl = `${window.location.origin}/t/${slug}`;

  const handlePublish = async () => {
    const editToken = localStorage.getItem(editTokenStorageKey(slug));
    if (!editToken) {
      toast.error("This browser doesn't have edit permissions for this track");
      return;
    }
    setIsPublishing(true);
    try {
      // Persist the name (and any other pending edits) before flipping the
      // track public, so the name shown on Discover/the share link matches
      // what was just typed here rather than the last autosave.
      await saveTrack();

      const res = await fetch(`/api/tracks/${slug}/publish`, {
        method: "POST",
        headers: { "X-Edit-Token": editToken },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const issues: PublishIssue[] | undefined = body?.issues;
        const message = issues?.length
          ? issues.map((issue) => issue.message).join(" · ")
          : (body?.error ?? "Failed to publish track");
        toast.error(message);
        return;
      }
      setIsPublished(true);
      toast.success("Track published");
    } catch {
      toast.error("Failed to publish track");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant={isPublished ? "outline" : "default"} className="gap-1.5" />
        }
      >
        {isPublished ? <Share2 className="size-4" /> : <Rocket className="size-4" />}
        {isPublished ? "Share" : "Publish"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPublished ? "Share this track" : "Publish this track"}</DialogTitle>
          <DialogDescription>
            {isPublished
              ? "Anyone with this link can view and play your track."
              : "Publishing makes this track visible on Discover and gives it a link you can share with friends."}
          </DialogDescription>
        </DialogHeader>

        {isPublished ? (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
            />
            <Button onClick={handleCopyLink} className="gap-1.5">
              <Copy className="size-4" />
              Copy link
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="publish-track-name" className="text-sm text-muted-foreground">
                Track name
              </label>
              <input
                id="publish-track-name"
                value={name}
                onChange={(e) => setMeta({ name: e.target.value })}
                placeholder="Untitled Track"
                className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
              />
            </div>
            <DialogFooter>
              <Button onClick={handlePublish} disabled={isPublishing || !name.trim()} className="gap-1.5">
                <Rocket className="size-4" />
                {isPublishing ? "Publishing…" : "Publish"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
