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

## Ad hoc — Delete a track

- [x] `DELETE /api/tracks/[slug]` (`src/app/api/tracks/[slug]/route.ts`) —
      edit-token guarded like `PATCH`; `prisma.track.delete` and the
      schema's existing `onDelete: Cascade` on `TrackVersion`/`Like`/
      `Comment` handle full cleanup in one call, no transaction needed.
- [x] `DeleteTrackButton` (`src/modules/editor/ui/delete-track-button.tsx`)
      — a themed confirm dialog (not a native `confirm()`, unlike Reset:
      deleting also destroys likes/comments, not just editable content, so
      it gets the more explicit treatment) styled with the `destructive`
      Button variant. Wired into two places an owner can act from:
      - The editor header, next to Reset — reads the slug from the store
        (`useTrackStore`), not the `slug` route prop, since that prop stays
        `null` for a brand-new track even after the first Save assigns a
        real slug (same gotcha `PublishShareButton` already documents and
        works around).
      - `PublicTrackActions` on a track's public page, gated behind the
        same client-side `isOwner` check (edit token present in
        localStorage) already used there for the unpublished-state
        "Open editor" affordance.
      Both redirect to `/my-tracks` after a successful delete.

**Notes:**

- Verified via Playwright: deleted an unpublished track from the editor
  header (confirmed `GET /api/tracks/[slug]` 404s afterward, redirected to
  `/my-tracks` → `/creator/[authorId]`), and separately published a second
  track and deleted it from its own public page (same 404 check). Zero
  console errors in either flow.
- Caught and fixed a real bug during verification: the Delete button
  initially read `slug` from the component's prop rather than the store,
  so it silently never rendered for a track created and saved in the same
  session (prop stays `null` until a full page reload). Switched to
  `useTrackStore((s) => s.document.meta.slug)`.
- Full `tsc`/`eslint`/`next build` clean.
- Dev database checked via `SELECT slug, name FROM "Track"` before cleanup;
  only the specifically-named stray test row was deleted. A track named
  "RRMMC" found in the same query wasn't created by any verification
  script this session and was left untouched as likely the user's own work.

## Milestone 4 — Competition

### Phase 1 — Session stats

- [x] `SessionStats` (`src/modules/game-engine/session-stats.ts`) — per-
      session (not persisted) top speed / time-weighted average speed, both
      as % of `MAX_SPEED` (no real-world speed unit exists anywhere in this
      codebase to convert to), plus a lap-history list. Gated behind
      `lapTimer.enabled`, same as every other lap-based feature.
- [x] `engine-core.ts` gained a single shared `onLapComplete()` hook
      (diffs `lapTimer.lap` frame-to-frame once, in one place) that Phase 2
      and Phase 3 will also attach to, rather than each duplicating the diff.
- [x] `SessionStatsPanel` (`src/modules/game-engine/session-stats-panel.tsx`)
      — collapsed-by-default themed panel, bottom-right (opposite
      `HudOverlay`'s top-left), same rAF-tick-over-refs pattern as
      `HudOverlay`. Wired into `engine-mount.tsx`.

**Notes:**

- Verified via Playwright: drove the demo track, opened the stats toggle,
  confirmed Top Speed/Avg Speed update live (42%/23% after a few seconds of
  driving) and the panel is properly themed. Zero console errors. Full
  `tsc`/`eslint`/`next build` clean.

### Ad hoc — Name yourself before racing

- [x] `DisplayNameGate` (`src/modules/game-engine/display-name-gate.tsx`) —
      shown in place of the engine the first time a browser enters Play
      mode (editor or public-page autoplay, either path), since the
      upcoming Leaderboard phase needs a human-readable name per lap-time
      submission, not just an anonymous `viewerId`. A one-time gate: the
      name is saved to `localStorage` (`display-name-storage.ts`,
      `trackforge:displayName`) and never asked for again from that
      browser — same "durable per-browser value, not an account" trade-off
      already accepted for `editToken`/`authorId`.
- [x] Wired into `track-editor.tsx`: `useSyncExternalStore` reads the
      stored name (SSR-safe, same pattern as `PublicTrackActions`'
      `isOwner` check), layered under a plain `submittedName` state so
      submitting the gate unblocks Play immediately in the same session
      rather than waiting on a storage event that would never fire.

**Notes:**

- Verified via Playwright: fresh browser context → clicking Play shows the
  gate → submitting a name mounts the engine immediately → returning to
  edit and clicking Play again does *not* re-show the gate (persisted).
  Zero console errors. Full `tsc`/`eslint`/`next build` clean.

### Phase 2 — Ghost recording/playback (pending)

### Phase 3 — Leaderboards, personal bests, world records (pending)

## Milestone 5 — Live Collaboration (high-level)
- [ ] Networked `CommandStack` backend (Yjs or custom CRDT)
- [ ] Live cursors, live selection highlights
- [ ] Presence/session UI, conflict handling

---

## Notes
- Each `[ ]` above becomes `[x]` only after it's implemented **and** manually verified in-browser (per engineering standards — type checks and tests confirm correctness, not feel).
- This file is updated at the end of every phase, not just at milestone boundaries.
