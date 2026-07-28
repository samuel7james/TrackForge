"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Deleting a player identity is admin-only, never available to track
// owners -- see the route's own comment on why (a claimed name isn't
// scoped to any one track). Cascades their lap records, likes, and
// comments too -- see the route for exactly what that does and doesn't
// reach (it never touches tracks, which use a separate identity).
export function AdminPlayerActions({ id }: { id: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Delete this player? This removes their claimed name, lap times, likes, and comments everywhere on the site. This can't be undone."
      )
    )
      return;
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to delete player");
        return;
      }
      toast.success("Player deleted");
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
