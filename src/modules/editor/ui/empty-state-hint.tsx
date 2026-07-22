"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MousePointerClick } from "lucide-react";
import { useTrackStore } from "@/store/track-store";
import { useEditorStore } from "@/store/editor-store";

// Shown only while the Road tool is active (the tool that actually adds
// points) and no points exist yet -- the first thing a brand-new user
// should see, gone the moment they place a point.
export function EmptyStateHint() {
  const pointCount = useTrackStore((s) => s.document.splines[0]?.points.length ?? 0);
  const activeToolId = useEditorStore((s) => s.activeToolId);
  const show = pointCount === 0 && activeToolId === "road";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground/80 shadow-lg backdrop-blur"
          >
            <MousePointerClick className="size-5" />
          </motion.div>
          <p className="text-sm font-medium text-foreground/80">
            Click anywhere on the ground to place your first point
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
