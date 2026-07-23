"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { editTokenStorageKey } from "@/modules/track-format/edit-token-storage";

// Permanently removes the track row (and, via schema cascade, every
// TrackVersion/Like/Comment attached to it) -- unlike ResetTrackButton,
// which only clears the grid back to a blank track and keeps the row/slug
// alive. A themed confirm dialog rather than a native confirm() since this
// is more severe than Reset (comments and likes are gone too, not just
// editable content) and deserves the extra clarity.
export function DeleteTrackButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    const editToken = localStorage.getItem(editTokenStorageKey(slug));
    if (!editToken) {
      toast.error("This browser doesn't have edit permissions for this track");
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tracks/${slug}`, {
        method: "DELETE",
        headers: { "X-Edit-Token": editToken },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to delete track");
        return;
      }
      localStorage.removeItem(editTokenStorageKey(slug));
      toast.success("Track deleted");
      router.push("/my-tracks");
    } catch {
      toast.error("Failed to delete track");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive" className="gap-1.5" />}>
        <Trash2 className="size-4" />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &quot;{name}&quot;?</DialogTitle>
          <DialogDescription>
            This permanently deletes the track, including its likes and comments. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleDelete} disabled={isDeleting} variant="destructive" className="gap-1.5">
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting…" : "Delete track"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
