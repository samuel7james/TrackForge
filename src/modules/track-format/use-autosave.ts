"use client";

import { useEffect, useRef } from "react";
import { useTrackStore } from "@/store/track-store";
import { useSaveTrack } from "./use-save-track";

const AUTOSAVE_DEBOUNCE_MS = 4000;

export function useAutosave(isAdmin = false) {
  const saveTrack = useSaveTrack(isAdmin);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, [saveTrack]);
}
