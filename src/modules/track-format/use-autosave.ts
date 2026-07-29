"use client";

import { useEffect, useRef } from "react";
import { useTrackStore } from "@/store/track-store";
import { useSaveTrack } from "./use-save-track";

const AUTOSAVE_DEBOUNCE_MS = 4000;

/** `enabled` is false for the daily challenge, which is system-owned -- the
 * server refuses to PATCH it at all (see api/tracks/[slug]/route.ts), so
 * subscribing would only ever produce requests that come back 403. */
export function useAutosave(isAdmin = false, enabled = true) {
  const saveTrack = useSaveTrack(isAdmin);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = useTrackStore.subscribe((state, prevState) => {
      if (state.document === prevState.document) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        saveTrack().catch(() => {
          // Silent — the explicit Save button surfaces failures.
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [saveTrack, enabled]);
}
