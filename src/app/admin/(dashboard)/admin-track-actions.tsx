"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Same actions a track's own owner has (delete, publish/unpublish) but
// exercised site-wide by the admin session instead of a per-track
// editToken -- the API routes check the admin cookie, not ownership.
export function AdminTrackActions({ slug, isPublished }: { slug: string; isPublished: boolean }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  const handleTogglePublish = async () => {
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/tracks/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to update track");
        return;
      }
      toast.success(isPublished ? "Track unpublished" : "Track published");
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${slug}"? This can't be undone.`)) return;
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/tracks/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to delete track");
        return;
      }
      toast.success("Track deleted");
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button size="xs" variant="outline" onClick={handleTogglePublish} disabled={isBusy}>
        {isPublished ? "Unpublish" : "Publish"}
      </Button>
      <Button size="xs" variant="destructive" onClick={handleDelete} disabled={isBusy}>
        Delete
      </Button>
    </div>
  );
}
