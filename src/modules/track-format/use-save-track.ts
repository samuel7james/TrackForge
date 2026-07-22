"use client";

import { useCallback } from "react";
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
// save, the URL updates to /editor/[slug] via the native History API
// rather than next/navigation's router -- router.replace() across two
// different dynamic route segments (/editor/new -> /editor/[slug]) fully
// unmounts and remounts the page, which would tear down and reset an
// in-progress Play session if autosave fired mid-drive (verified: it does,
// reproducibly, a few seconds after entering Play). history.replaceState
// updates the address bar for reload/sharing without touching React at all.
export function useSaveTrack() {
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
        window.history.replaceState(null, "", `/editor/${data.slug}`);
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
  }, []);
}
