"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AdminLapTimeActions({ id }: { id: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Delete this lap time? This can't be undone.")) return;
    setIsBusy(true);
    try {
      const res = await fetch(`/api/admin/laptimes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to delete lap time");
        return;
      }
      toast.success("Lap time deleted");
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
