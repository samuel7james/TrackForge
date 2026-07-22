"use client";

import { useCallback } from "react";
import { useTrackStore } from "@/store/track-store";

export function editTokenStorageKey(slug: string): string {
  return `trackforge:editToken:${slug}`;
}

// Module-level, not component state -- serializes concurrent callers
// (autosave firing at the same moment as an explicit Save/Publish click)
// into one save at a time, so they can never race into two concurrent
// POSTs and create two separate track rows for the same in-progress
// document. Unlike a plain boolean guard, a concurrent caller *waits* for
// the in-flight save rather than silently no-op-ing -- callers like the
// Publish flow need their save to actually happen (and reflect whatever
// they just changed, e.g. name/description), not be skipped because
// autosave happened to be mid-flight (verified: it silently was, causing
// Publish to see a still-empty slug and fail with a confusing error).
let inFlightSave: Promise<void> | null = null;

async function performSave(): Promise<void> {
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
    // Updates the address bar without a Next.js navigation -- see below.
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
    body: JSON.stringify({ document: useTrackStore.getState().document }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to save track");
  }
}

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
    if (inFlightSave) {
      // Let the other save settle first (serializes the network calls so
      // we never create a duplicate track), then still do our own save --
      // the caller needs *their* current state persisted, not to be
      // silently skipped because someone else's save happened to overlap.
      await inFlightSave.catch(() => {});
    }
    const promise = performSave();
    inFlightSave = promise;
    try {
      await promise;
    } finally {
      if (inFlightSave === promise) inFlightSave = null;
    }
  }, []);
}
