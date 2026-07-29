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

// The same check, read directly rather than through React.
//
// The hook above necessarily reports false on its first render -- that's
// the server snapshot, and rendering anything else would be a hydration
// mismatch -- then flips to the real value immediately after. That's
// correct for rendering, but it makes the hook's value unsafe to capture
// inside a mount effect: whether the effect runs before or after that flip
// is a timing race, so an effect with an empty dependency list can hold
// onto `false` on a real phone forever, and does so unpredictably.
//
// That is exactly how the engine is started (see engine-mount.tsx), and it
// decides auto-throttle and the whole render-quality path -- too important
// to leave to a race. Anything reading touch capability at effect time
// should call this instead; anything deciding what to *render* should keep
// using the hook, which is what hydration-safe means here.
export function detectTouchDevice(): boolean {
  return typeof window !== "undefined" && "ontouchstart" in window;
}
