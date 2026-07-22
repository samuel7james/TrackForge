"use client";

import { useEffect, useRef } from "react";

export interface DriveInput {
  throttle: number; // -1 (reverse/brake) .. 1 (forward)
  steer: number; // -1 (right) .. 1 (left)
}

const FORWARD_KEYS = ["w", "arrowup"];
const BACK_KEYS = ["s", "arrowdown"];
const LEFT_KEYS = ["a", "arrowleft"];
const RIGHT_KEYS = ["d", "arrowright"];

export function useKeyboardInput() {
  const input = useRef<DriveInput>({ throttle: 0, steer: 0 });

  useEffect(() => {
    const keys = new Set<string>();

    function recompute() {
      const throttle =
        (FORWARD_KEYS.some((k) => keys.has(k)) ? 1 : 0) -
        (BACK_KEYS.some((k) => keys.has(k)) ? 1 : 0);
      const steer =
        (LEFT_KEYS.some((k) => keys.has(k)) ? 1 : 0) -
        (RIGHT_KEYS.some((k) => keys.has(k)) ? 1 : 0);
      input.current = { throttle, steer };
    }

    function onKeyDown(e: KeyboardEvent) {
      keys.add(e.key.toLowerCase());
      recompute();
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
      recompute();
    }
    function onBlur() {
      keys.clear();
      recompute();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return input;
}
