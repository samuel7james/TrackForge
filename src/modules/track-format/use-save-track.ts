"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTrackStore } from "@/store/track-store";

export function editTokenStorageKey(slug: string): string {
  return `trackforge:editToken:${slug}`;
}

// Module-level, not component state -- prevents autosave and an explicit
// Save click from racing each other into two concurrent POSTs (which would
// create two separate track rows for the same in-progress document).
let saveInFlight = false;

// Saves the current document — creates the track on first save (no slug
// yet) or updates it thereafter (PATCH, guarded by the edit token kept in
// localStorage; never round-tripped through the Zustand store). On first
// save, redirects to /editor/[slug] so reloading the page keeps working —
// this is a client-side navigation, so trackStore's in-memory document
// (a module-level singleton, not tied to the page component) survives the
// transition intact.
export function useSaveTrack() {
  const router = useRouter();

  return useCallback(async () => {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      const { document } = useTrackStore.getState();
      const slug = document.meta.slug || null;

      if (!slug) {
        const res = await fetch("/api/tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Failed to save track");
        }
        const data = await res.json();
        localStorage.setItem(editTokenStorageKey(data.slug), data.editToken);
        useTrackStore.getState().setSlug(data.slug);
        router.replace(`/editor/${data.slug}`);
        return;
      }

      const editToken = localStorage.getItem(editTokenStorageKey(slug));
      if (!editToken) {
        throw new Error("This browser doesn't have edit permissions for this track");
      }
      const res = await fetch(`/api/tracks/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Edit-Token": editToken },
        body: JSON.stringify({ document }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save track");
      }
    } finally {
      saveInFlight = false;
    }
  }, [router]);
}
