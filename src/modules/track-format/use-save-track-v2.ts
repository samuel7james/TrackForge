"use client";

import { useCallback } from "react";
import { useTrackStoreV2 } from "@/store/track-store-v2";
import { editTokenStorageKey } from "./use-save-track";

// Parallel to use-save-track.ts (v1) rather than a generic/parameterized
// version -- the POST-if-no-slug/PATCH-if-slug/editToken/history.replaceState
// logic is identical in shape, but duplicating ~40 lines here is simpler and
// safer than threading a generic store type through both, per this
// project's own preference for a little repetition over a premature
// abstraction. editTokenStorageKey itself IS reused (it's pure string
// formatting, no store coupling at all).
let inFlightSave: Promise<void> | null = null;

async function performSave(): Promise<void> {
  const { document } = useTrackStoreV2.getState();
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
    useTrackStoreV2.getState().setSlug(data.slug);
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
    body: JSON.stringify({ document: useTrackStoreV2.getState().document }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to save track");
  }
}

export function useSaveTrackV2() {
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
