"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { markInAppNavigation } from "@/lib/navigation-history";

// Mounted once in the root layout (persists across every route change,
// unlike a per-page component) -- marks the session the first time the
// pathname actually changes, i.e. a real in-app navigation happened, not
// just the initial page a browser tab landed on directly.
export function NavigationTracker() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    markInAppNavigation();
  }, [pathname]);

  return null;
}
