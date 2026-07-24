"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Comment moderation doesn't exist for track owners at all today (Comment
// has no delete route) -- this is admin-only, not "owner powers exercised
// globally" like the track actions are.
export function AdminCommentActions({ id }: { id: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Delete this comment? This can't be undone.")) return;
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to delete comment");
        return;
      }
      toast.success("Comment deleted");
      router.refresh();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Button size="xs" variant="destructive" onClick={handleDelete} disabled={isBusy}>
      Delete
    </Button>
  );
}
