"use client";

import { useCallback } from "react";
import { useTrackStore } from "@/store/track-store";
import { editTokenStorageKey } from "./edit-token-storage";

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

export function useSaveTrack() {
  return useCallback(async () => {
    if (inFlightSave) {
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
