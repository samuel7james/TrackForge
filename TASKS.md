# TrackForge — Tasks

## Ad hoc — Landing Page, Publish/Share, and Track Reset

- [x] Landing page: "Play the demo track" → "Play"; stale description
      ("splines", "sculpt terrain") replaced with copy matching the current
      tile-based editor; status badge updated to "Now building — Milestone 4"
- [x] `PublishShareButton` (`src/modules/editor/ui/publish-share-button.tsx`)
      — a header button in the tile editor that opens a themed dialog:
      unpublished shows a "Publish" action (calls the existing
      `POST /api/tracks/[slug]/publish` route with the browser's edit
      token), published shows the track's `/t/{slug}` link with a
      "Copy link" button so a track can be shared with friends right after
      creating it, not just from the public page after the fact. Reads the
      track's slug from the store (not a prop) so it reflects a slug the
      very first Save just assigned.
- [x] `ResetTrackButton` (`src/modules/editor/ui/reset-track-button.tsx`)
      — clears the whole grid back to a single finish cell and removes
      every placed object, behind a native `confirm()` since it's the one
      genuinely destructive, no-undo action in the editor (`TileGridLayer`
      doesn't push onto the command stack yet).
- [x] Both wired into the editor's header, next to the existing Save
      button (this file was `editor-view-v2.tsx` at the time, since renamed
      to `track-editor.tsx` — see the "-V2" cleanup entry below).

**Notes:**

- Verified the full loop end to end, not just each piece in isolation:
  built a track (auto-tiled cells + a placed cone) in `/editor/new`, saved,
  published, copied the share link, then opened the public `/t/{slug}`
  page fresh and confirmed liking and posting a comment both work
  correctly against a v2 (tile-based) track — the anonymous social layer
  (`TrackEngagement`/`PublicTrackActions`) needed zero changes since it was
  already format-agnostic. Also verified Reset actually clears a placed
  cell back to just the finish tile. Zero console errors throughout. Test
  tracks (including two stray autosave-created rows from mid-test edits
  before the explicit Save) cleaned up from the dev database afterward.
- Full `tsc`/`eslint`/`next build` clean.

## Ad hoc — Drop the "-V2" naming, name a track while publishing

- [x] Renamed every file/export left over from the engine-swap's "v1 vs v2"
      disambiguation, now that v1 (spline/heightmap) is fully deleted and
      there's nothing left to disambiguate against:
      - `store/track-store-v2.ts` → `store/track-store.ts`
        (`useTrackStoreV2` → `useTrackStore`, `TrackMetaPatchV2` →
        `TrackMetaPatch`)
      - `schema.ts`: `TrackDocumentV2` → `TrackDocument`,
        `trackDocumentV2Schema` → `trackDocumentSchema`,
        `createEmptyTrackDocumentV2` → `createEmptyTrackDocument`
      - `use-save-track-v2.ts` / `use-autosave-v2.ts` →
        `use-save-track.ts` / `use-autosave.ts` (`useSaveTrackV2` →
        `useSaveTrack`, `useAutosaveV2` → `useAutosave`)
      - `tool-registry-v2.ts` → `tool-registry.ts` (`TOOLS_V2` → `TOOLS`)
      - `editor-engine-v2.tsx` → `editor-engine.tsx` (`EditorEngineV2` →
        `EditorEngine`)
      - `scene-root-v2.tsx` / `track-forge-canvas-v2.tsx` → `scene-root.tsx`
        / `track-forge-canvas.tsx` (`SceneRootV2` → `SceneRoot`,
        `TrackForgeCanvasV2` → `TrackForgeCanvas`)
      - `editor-view-v2.tsx` → `track-editor.tsx` (`EditorViewV2` →
        `TrackEditor`) — renamed rather than just dropping the suffix
        since `editor-view.tsx` (the slug-fetching dispatcher) already
        owned that name
      - Every stale "(v1)"/"parallel to X (v1)" comment referencing
        already-deleted files was rewritten or removed along the way.
- [x] `PublishShareButton` now takes a `saveTrack` prop and shows an
      editable "Track name" input (bound to the store's `meta.name`) in the
      pre-publish dialog state, so a track can be named/renamed right
      before going public instead of only via `SaveButton`'s implicit
      autosave title. Publish now calls `saveTrack()` first to persist the
      name (and any other pending edits) before flipping the track public,
      so Discover/the share link show the name just typed, not the last
      autosave's.

**Notes:**

- Verified via `grep` that zero references to the old `-V2` identifiers or
  filenames remain anywhere in `src/`.
- Full `tsc`/`eslint`/`next build` clean after the rename.
- Browser-verified the rename didn't break anything: built and saved a new
  track, confirmed the Publish dialog's name field is prefilled from the
  store, renamed it to "My Custom Race Name", published, confirmed the
  public `/t/{slug}` page shows the new name, then reopened the editor and
  confirmed Play/drive still works. Zero console errors. Stray test track
  (plus one leftover autosave row from earlier testing) cleaned up from the
  dev database afterward, leaving only the real demo track.

## Milestone 4 — Competition (high-level)
- [ ] Ghost recording/playback
- [ ] Leaderboards, personal bests, world records
- [ ] Session stats (avg/top speed, history)

## Milestone 5 — Live Collaboration (high-level)
- [ ] Networked `CommandStack` backend (Yjs or custom CRDT)
- [ ] Live cursors, live selection highlights
- [ ] Presence/session UI, conflict handling

---

## Notes
- Each `[ ]` above becomes `[x]` only after it's implemented **and** manually verified in-browser (per engineering standards — type checks and tests confirm correctness, not feel).
- This file is updated at the end of every phase, not just at milestone boundaries.
