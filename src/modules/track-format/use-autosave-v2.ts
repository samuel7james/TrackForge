"use client";

import { useEffect, useRef } from "react";
import { useTrackStoreV2 } from "@/store/track-store-v2";
import { useSaveTrackV2 } from "./use-save-track-v2";

const AUTOSAVE_DEBOUNCE_MS = 4000;

// Parallel to use-autosave.ts (v1) -- see use-save-track-v2.ts's comment on
// why this is a small duplicate rather than a generic/parameterized hook.
export function useAutosaveV2() {
  const saveTrack = useSaveTrackV2();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = useTrackStoreV2.subscribe((state, prevState) => {
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
