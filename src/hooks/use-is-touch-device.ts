"use client";

import { useSyncExternalStore } from "react";

// Touch capability never changes over a page's lifetime, so there's nothing
// to subscribe to -- this only exists to give useSyncExternalStore the
// browser-vs-server snapshot split it needs to read `window` without a
// hydration mismatch (the standard React 19 idiom for a browser-only
// capability check). Shared by touch-controls-overlay.tsx, toolbar.tsx, and
// rotate-device-hint.tsx -- previously duplicated inline in the first of
// those.
function subscribeNever() {
  return () => {};
}
function getTouchSnapshot() {
  return "ontouchstart" in window;
}
function getTouchServerSnapshot() {
  return false;
}

export function useIsTouchDevice() {
  return useSyncExternalStore(subscribeNever, getTouchSnapshot, getTouchServerSnapshot);
}
