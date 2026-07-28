"use client";

import { useCallback } from "react";
import { useTrackStore } from "@/store/track-store";
import { editTokenStorageKey } from "./edit-token-storage";

let inFlightSave: Promise<void> | null = null;

async function performSave(isAdmin: boolean): Promise<void> {
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

  // A missing local token only blocks the save for a non-admin -- the admin
  // session cookie (checked server-side, see route.ts) authorizes the
  // request instead, so an admin editing someone else's track (no editToken
  // in their own browser) can still save.
  const editToken = localStorage.getItem(editTokenStorageKey(slug));
  if (!editToken && !isAdmin) {
    throw new Error("This browser doesn't have edit permissions for this track");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (editToken) headers["X-Edit-Token"] = editToken;
  const res = await fetch(`/api/tracks/${slug}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ document: useTrackStore.getState().document }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to save track");
  }
}

export function useSaveTrack(isAdmin = false) {
  return useCallback(async () => {
    if (inFlightSave) {
      await inFlightSave.catch(() => {});
    }
    const promise = performSave(isAdmin);
    inFlightSave = promise;
    try {
      await promise;
    } finally {
      if (inFlightSave === promise) inFlightSave = null;
    }
  }, [isAdmin]);
}
