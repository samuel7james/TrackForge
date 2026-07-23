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
- [x] Both wired into `editor-view-v2.tsx`'s header, next to the existing
      Save button.

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
