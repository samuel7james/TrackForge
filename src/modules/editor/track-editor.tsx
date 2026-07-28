"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BackButton } from "@/components/ui/back-button";
import { TrackForgeCanvas } from "@/modules/scene/track-forge-canvas";
import { EngineMount } from "@/modules/game-engine/engine-mount";
import { DisplayNameGate } from "@/modules/game-engine/display-name-gate";
import { getDisplayName, clearDisplayName } from "@/modules/game-engine/display-name-storage";
import { ModeToggle } from "@/modules/editor/ui/mode-toggle";
import { Toolbar } from "@/modules/editor/ui/toolbar";
import { SaveButton } from "@/modules/editor/ui/save-button";
import { TrackNameEditor } from "@/modules/editor/ui/track-name-editor";
import { PublishShareButton } from "@/modules/editor/ui/publish-share-button";
import { ResetTrackButton } from "@/modules/editor/ui/reset-track-button";
import { useEditorStore } from "@/store/editor-store";
import { useTrackStore } from "@/store/track-store";
import { useCommandStack } from "@/modules/editor/core/command-stack";
import { useAutosave } from "@/modules/track-format/use-autosave";
import { useSaveTrack } from "@/modules/track-format/use-save-track";
import { TOOLS } from "@/modules/editor/core/tool-registry";
import { DAILY_CHALLENGE_SLUG } from "@/lib/daily-challenge-slug";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";
import type { TrackDocument } from "@/modules/track-format/schema";

const noSubscription = () => () => {};

interface TrackEditorProps {
  slug: string | null;
  /** Already fetched+validated by EditorView; omitted for a brand-new track
   * (no slug yet), in which case the store's own default empty document is
   * used as-is. */
  document?: TrackDocument;
  /** A track's public page links here with ?autoplay=1 so a visitor lands
   * directly in the driver's seat instead of the editor. */
  autoplay?: boolean;
  /** Whether the fetched track was already published -- ignored for a
   * brand-new track (always starts unpublished). */
  initiallyPublished?: boolean;
  /** Server-checked (see app/editor/[slug]/page.tsx) -- true if this browser
   * holds a valid admin session, letting Save/Publish succeed on this track
   * even without its editToken. Irrelevant for a brand-new track. */
  isAdmin?: boolean;
}

// TrackForge's editor UI. Deliberately scoped down in a few ways that are
// deferred, not silently dropped: no InspectorPanel/TerrainBrushPanel-
// equivalent (nothing to inspect -- no spline points or heightmap), no
// UndoRedoControls/CommandPalette (TileGridLayer mutates the store directly
// rather than through useCommandStack, so there's nothing for them to act
// on yet).
export function TrackEditor({ slug, document, autoplay, initiallyPublished, isAdmin = false }: TrackEditorProps) {
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const setActiveToolId = useEditorStore((s) => s.setActiveToolId);
  const trackName = useTrackStore((s) => s.document.meta.name);
  const cells = useTrackStore((s) => s.document.track.cells);
  // No real owner can ever save changes to the daily challenge (its
  // editToken is never exposed to any client), so it never gets an Edit
  // affordance at all -- not the ModeToggle button, not the Escape-key
  // shortcut back to edit mode either, both of which would otherwise lead
  // to a dead end (a local-only edit session that can never be saved).
  const isDailyChallenge = slug === DAILY_CHALLENGE_SLUG;
  // The play-mode footer hint is pure keyboard instructions (WASD, Esc) --
  // meaningless on a touch device, and would otherwise sit right behind the
  // brake button (touch-controls-overlay.tsx is also bottom-center).
  const isTouchDevice = useIsTouchDevice();

  useAutosave(isAdmin);
  const saveTrack = useSaveTrack(isAdmin);

  // The leaderboard needs a human-readable name per lap-time submission.
  // useSyncExternalStore reads localStorage safely across SSR (same pattern
  // as PublicTrackActions' isOwner check); `submittedName` layers on top so
  // the DisplayNameGate below can unblock Play immediately in the same
  // session without waiting on a storage-change event that will never fire.
  const storedDisplayName = useSyncExternalStore(
    noSubscription,
    () => getDisplayName(),
    () => null
  );
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const displayName = submittedName ?? storedDisplayName;

  // Bumped (rather than read) purely to force a re-render after
  // clearDisplayName() -- noSubscription above means storedDisplayName only
  // ever re-reads localStorage when something else causes this component to
  // render, and clearing a name that was never re-submitted this session
  // (submittedName already null) wouldn't otherwise trigger one.
  const [, forceRerender] = useState(0);
  const handleDisplayNameInvalid = () => {
    clearDisplayName();
    setSubmittedName(null);
    forceRerender((n) => n + 1);
  };

  // Fresh editor session: load the given document (or keep the store's
  // default empty one for a brand-new track), reset undo history, and
  // default to the road tool.
  useEffect(() => {
    if (document) useTrackStore.getState().loadDocument(document);
    useCommandStack.getState().reset();
    setActiveToolId("tile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "play" && !isDailyChallenge) setMode("edit");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, setMode, isDailyChallenge]);

  // This is also the one place a "real play" (as opposed to the owner
  // testing their own track from inside the editor) is unambiguous, so it's
  // the spot that increments the public playCount -- fire-and-forget, a
  // failed count bump shouldn't block or error out the drive.
  useEffect(() => {
    if (autoplay) {
      setMode("play");
      if (slug) {
        fetch(`/api/tracks/${slug}/play`, { method: "POST" }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0">
      {mode === "edit" ? (
        <TrackForgeCanvas />
      ) : displayName ? (
        <EngineMount
          key={slug ?? "new"}
          mapCells={cells}
          trackId={slug}
          submitLapTimes={autoplay}
          displayName={displayName}
          onDisplayNameInvalid={handleDisplayNameInvalid}
        />
      ) : (
        <DisplayNameGate onSubmit={setSubmittedName} />
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3 text-sm">
            <BackButton />
            <span className="font-medium tracking-tight text-foreground/90">TrackForge</span>
            <span className="text-muted-foreground">/</span>
            {mode === "edit" ? (
              <TrackNameEditor />
            ) : (
              <span className="text-muted-foreground">{trackName}</span>
            )}
            {mode === "edit" && (
              <>
                {isAdmin && (
                  // This browser may not hold this track's own editToken at
                  // all (that's the whole point -- admin bypasses it) --
                  // shown so it's obvious Save/Publish are working via the
                  // admin session, not silently acting on someone else's
                  // track without any indication.
                  <span
                    className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                    title="Editing with admin privileges"
                  >
                    Admin
                  </span>
                )}
                <SaveButton saveTrack={saveTrack} />
                <PublishShareButton
                  initiallyPublished={initiallyPublished ?? false}
                  saveTrack={saveTrack}
                  isAdmin={isAdmin}
                />
                <ResetTrackButton />
              </>
            )}
          </div>
          <ModeToggle allowEdit={!isDailyChallenge} />
        </header>

        <AnimatePresence mode="wait">
          {mode === "edit" && (
            <motion.div
              key="edit-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2"
              >
                <Toolbar tools={TOOLS} />
              </motion.div>
              <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                Road tool: click to place/auto-tile · Erase tool: click to remove · V/G/E switch
                tools
              </p>
            </motion.div>
          )}
          {mode === "play" && !isTouchDevice && (
            <motion.p
              key="play-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground"
            >
              {isDailyChallenge ? "WASD / arrows to drive" : "WASD / arrows to drive · Esc to return to editing"}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
