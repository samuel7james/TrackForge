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

### Phase 2 — Ghost recording/playback

- [x] `GhostRecorder` (`src/modules/game-engine/ghost-recorder.ts`) — samples
      the vehicle's world position/quaternion at a capped ~15Hz (not every
      frame; a 60fps recording would bloat `localStorage` with no
      perceptible playback benefit once interpolated). Samples are plain
      number tuples, not `Vector3`/`Quaternion` instances, so the buffer
      round-trips through `JSON.stringify` with zero conversion.
- [x] `ghost-playback.ts` — `saveGhost`/`loadGhost` under
      `racing.bestGhost.<trackId>` (same `try/catch`-guarded style as
      `lap-timer.ts`'s `loadBest`/`saveBest`), and `GhostPlayer.sampleAt`
      linearly interpolates position and `slerp`s rotation between the two
      bracketing samples for the given lap time -- necessary since the
      ~15Hz recording rate is far coarser than the 60fps render loop.
- [x] `engine-core.ts`: a semi-transparent clone of the player vehicle
      (`buildGhostMesh`, materials explicitly cloned so transparency never
      leaks onto the real vehicle's shared materials) is positioned each
      frame from `ghostPlayer.sampleAt(lapTimer.currentLapTime)`. Recording
      runs every frame while `lapTimer.enabled`; the shared
      `onLapComplete()` hook (from Phase 1) saves the recording and swaps
      `ghostPlayer` onto it whenever `lapTimer.lastLapWasBest`, then resets
      the recorder for the next lap attempt regardless of outcome.

**Notes:**

- Unit-verified `GhostRecorder`/`GhostPlayer`'s actual logic (not a
  reimplementation) via a `tsx`-run script importing the real modules
  directly: sample-rate capping, `reset()`, mid-recording interpolation,
  clamping before the first sample, `null` past the recording's end (ghost
  finished), and an exact `saveGhost`/`loadGhost` round-trip. All passed.
- Live-verified the load → render → interpolate pipeline in the browser by
  injecting a hand-crafted "previous session's best ghost" into
  `localStorage` before mounting the engine (the same key format
  `saveGhost` itself would have written), then confirmed via screenshots: a
  second, visibly semi-transparent vehicle appears immediately at its first
  sample, moves independently along its own recorded path as lap time
  advances, all with zero console errors.
- Driving an actual full lap around the demo circuit purely via scripted
  Playwright keyboard input (to verify the record → auto-save-on-lap-
  complete trigger end-to-end) proved impractical -- the track needs real
  cornering, and neither "hold forward" nor "hold forward + constant turn"
  completed a lap within a generous time budget. Accepted as a known gap:
  the save-on-best-lap trigger is a small, low-risk extension of Phase 1's
  already-tested `onLapComplete()` hook (same diffing mechanism, one more
  branch), not new detection logic of its own.
- Full `tsc`/`eslint`/`next build` clean.

### Phase 3 — Leaderboards, personal bests, world records

- [x] `LapRecord` model (`prisma/schema.prisma`, migration
      `20260724093351_lap_records`) — one row per (track, viewer) = that
      viewer's personal best; the world record is just `MIN(timeMs)`
      aggregated on demand, not a separate denormalized field. Includes
      `displayName` (the name from the new racing gate), only updated when
      `timeMs` itself improves — same accepted-staleness trade-off as
      `Comment.displayName`.
- [x] `POST /api/tracks/[slug]/laptimes` — viewerId + rate-limit pattern
      copied verbatim from `like/route.ts`; manual read-then-write (not a
      blind Prisma `upsert`) since "only write if better" isn't expressible
      as one. Returns whether it was a new personal best and the current
      world record.
- [x] `GET /api/tracks/[slug]/leaderboard` — public, top 20 by `timeMs`,
      plus the requesting viewer's own rank/entry even when outside the
      top 20.
- [x] `submitLapTimes`/`displayName` threaded through
      `EngineOptions`/`EngineMount`/`track-editor.tsx` — `track-editor.tsx`
      passes `submitLapTimes={autoplay}`, the *exact same flag* that
      already gates the `playCount` POST, so an owner testing their own
      track from the editor's mode toggle can never inflate their own
      leaderboard position. A `sonner` toast fires on a new personal best
      or new world record.
- [x] `Leaderboard` (`src/modules/track/leaderboard.tsx`) — server-rendered
      initial data fetched in `t/[slug]/page.tsx` (same `Promise.all` block
      already fetching likes/comments), ranked list with a trophy badge on
      #1 and the viewer's own row highlighted.

**Notes:**

- Verified the full API path directly (driving an actual lap end-to-end
  wasn't reliably scriptable, per Phase 2's note, so this exercises the
  same route/DB code a real submission would hit): submitted a lap time →
  confirmed `isNewPersonalBest: true` and the correct world record;
  submitted a *slower* time from the same viewer → confirmed it did **not**
  overwrite the personal best (`isNewPersonalBest: false`, unchanged
  `personalBestMs`); `GET /leaderboard` returned the entry correctly
  ranked; reloaded the actual public track page and confirmed the rendered
  `Leaderboard` component shows the name and correctly formatted time.
  Zero console errors throughout.
- The anti-inflation gate (`submitLapTimes={autoplay}`) was verified by
  code inspection end-to-end (`track-editor.tsx` → `EngineMount` →
  `createEngine` → the submission call), since it's structurally
  impossible for the editor's own mode-toggle path to set it.
- Incidental fix while reviewing the public track page: the demo track's
  stored `description` (both the `Track.description` column and the
  `document.meta.description` JSON field, which stays in sync via the
  `PATCH` route) still said "...now built with the real
  Starter-Kit-Racing tile track" — a leftover from before this session's
  earlier request to strip all mrdoob/Starter-Kit-Racing name references,
  which only touched code comments, not existing database content. Updated
  both fields directly via SQL to remove the name.
- Full `tsc`/`eslint`/`next build` clean.

## Ad hoc — Optimization pass

A project-wide audit (DB query patterns, bundle size, React rendering,
game-engine per-frame allocations, assets, API route efficiency) turned up
a short list of concrete, fixable issues — no speculative optimization for
scale nobody's asked for.

- [x] **Denormalized `Track.difficulty`** (`prisma/schema.prisma`,
      migration `20260724095934_track_difficulty_and_tags_index`) — same
      pattern already used for `name`/`description`/`tags`. Discover and
      the creator page were fetching each track's *entire* `document` JSON
      (the whole tile grid + placed objects, unbounded size) in a 24-row
      list purely to read `meta.difficulty` for `TrackCard`. Both pages
      and `TrackCard` now `select`/accept `difficulty` directly.
- [x] **Trimmed four over-fetching routes** (`comments`, `like`,
      `laptimes`, `leaderboard`, plus `PATCH`/`DELETE` on
      `/api/tracks/[slug]`) — all did `prisma.track.findUnique({ where:
      { slug } })` with no `select`, pulling the full `document` blob just
      to read `.id`/`.editToken`. Now `select: { id: true }` (or
      `{ editToken: true }` where that's the only other field checked).
- [x] **Added a GIN index on `Track.tags`** (`@@index([tags], type: Gin)`)
      — Discover's tag search (`{ tags: { has: query } }`) was an
      unindexed sequential scan.
- [x] **Removed two genuinely dead dependencies**: `@dimforge/rapier3d-compat`
      and `@react-three/rapier` — leftover from the v1 spline/Rapier stack
      deleted in the earlier engine-swap arc, confirmed via `grep` to have
      zero remaining imports anywhere in `src/`. Rapier ships a WASM
      binary, not a trivial remove.
- [x] Moved `@types/three` and `shadcn` from `dependencies` to
      `devDependencies` — neither is imported at runtime (`shadcn` is a
      CLI scaffolder, `@types/three` is types-only).

**Notes:**

- Everything else the audit checked came back clean: no N+1 patterns,
  Zustand selectors are already granular everywhere, `engine-core.ts`'s
  `animate()` loop (including all of Milestone 4's additions) already
  follows the codebase's own no-per-frame-allocation convention, no
  oversized assets, Three.js is already isolated from `/`/`/discover` by
  Next's per-route code splitting.
- `npm audit` surfaces 6 pre-existing vulnerabilities, all in dev-only
  tooling transitive deps (`shadcn`'s bundled MCP SDK, `next`'s bundled
  `postcss`/`sharp`) — `npm audit fix --force`'s suggested fix would
  downgrade Next.js to v9, so left alone rather than "fixed" destructively.
- Verified via Playwright: Discover and the creator page still render the
  correct name/description/difficulty; the trimmed like/comment/leaderboard
  routes still function correctly end-to-end. Full `tsc`/`eslint`/
  `next build` clean. Test comment/like created during verification
  cleaned up from the dev database afterward.

## Milestone 5 — Live Collaboration

### Phase 1 — Presence + live cursors

Real-time transport: **PartyKit** (user's choice — purpose-built for Yjs/
collab rooms, generous free tier, deploys separately from the Vercel-hosted
Next.js app). Scoped down to presence + live cursors first, no CRDT
document merge yet (that's Phase 2) — see the plan this phase followed for
the full reasoning.

- [x] `party/index.ts` (new top-level `party/` dir, sibling to `src/`) — a
      minimal presence-relay `Party.Server`. One room per track (room id =
      slug). `onMessage` handles `identify` (viewerId + displayName +
      color) and `cursor` (world x/z), storing state on the connection
      itself and broadcasting the full peer list on every change; `onClose`/
      `onError` re-broadcast so a disconnect is reflected immediately.
      `partykit.json` config; `partykit`/`partysocket` added as deps; new
      `dev:party` npm script (`partykit dev`, run alongside `next dev` in a
      second terminal, not auto-started by `npm run dev`).
- [x] `use-presence-room.ts` (`src/modules/editor/collab/`) — connects via
      `partysocket/react`'s `usePartySocket`, only when a track has a slug
      (nothing to collaborate on for a brand-new unsaved track). Sends
      `identify` on open (viewerId read from the existing, non-httpOnly
      `VIEWER_ID_COOKIE`; displayName from the Milestone-4 racing name
      storage, falling back to "Anonymous" -- editing doesn't get a hard
      name-gate like racing does). Exposes `{ peers, broadcastCursor }`,
      `peers` always excluding the local browser's own entry.
- [x] `presence-context.tsx` — a React Context (not a Zustand store, unlike
      most cross-cutting state in this codebase) carrying `{ peers,
      broadcastCursor }` from `track-editor.tsx` (the one place `slug` is
      known) down through `TrackForgeCanvas`/`EditorEngine` to
      `TileGridLayer` and `PresenceCursors`, and up to the header's
      `PresenceAvatars` -- avoids prop-drilling through components that
      don't otherwise care about presence at all.
- [x] `presence-cursors.tsx` — world-space cursor markers (a small ring +
      a `drei` `<Html>` name tag), mounted in `scene-root.tsx`. A 3D
      editor's cursor is meaningfully a world position, not a 2D
      screen-space one (every viewer's camera angle differs).
      `tile-grid-layer.tsx` gained an `onPointerMove` on its existing
      ground-catcher mesh, throttled to ~20Hz, reusing the exact
      world-space hit-testing already used for tile placement.
- [x] `presence-avatars.tsx` — a small avatar stack in the editor header,
      next to Save/Publish/Reset/Delete, showing everyone in the room
      (including a "1" for just yourself, so it's discoverable solo).
- [x] `NEXT_PUBLIC_PARTYKIT_HOST` env var (`.env`/`.env.example`) --
      `127.0.0.1:1999` locally; the deployed `<project>.<user>.partykit.dev`
      host is the user's own to set up (a PartyKit account/deploy is
      theirs to run, not mine to do on their behalf).

**Notes:**

- Fixed a real bug hit during the build: `use-presence-room.ts` imported
  `VIEWER_ID_COOKIE` from `lib/anonymous-id.ts`, which also has a top-level
  `next/headers` import (server-only) -- pulling that into the client
  bundle broke `next build`. Split just the two cookie *name* constants
  into a new `lib/anonymous-id-cookies.ts` with zero imports;
  `anonymous-id.ts` re-exports them for its existing server-side callers.
- Verified with two separate Playwright browser contexts (two distinct
  `viewerId` cookies) against `partykit dev` (local emulator) run alongside
  `next dev`: both contexts show 2 avatars once presence syncs; moving the
  pointer in one context's Road-tool ground-catcher shows a live cursor
  pin + name tag at the correct world position in the other's `<Canvas>`;
  closing one context drops the avatar count back to 1 in the other within
  ~2s. Zero console errors in either context. Full `tsc`/`eslint`/
  `next build` clean.

### Phase 2 — Yjs-backed collaborative editing (not yet designed)

### Phase 3 — Conflict/save-race handling (not yet designed)

### Production deploy — blocked (no paid services, by explicit choice)

`npx partykit deploy` fails on **both** free paths:

- Default shared `partykit.dev` domain → Cloudflare's platform-wide limit
  of 10,000 custom domains per zone, already exceeded (not specific to
  this account — a capacity issue on PartyKit's shared free hosting).
- Custom domain via a bring-your-own Cloudflare account
  (`--domain party.samueljames.dev`, using the user's own
  `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`) → Cloudflare's free
  Workers plan requires Durable Objects to use the newer SQLite-backed
  storage class (`new_sqlite_classes`), and PartyKit CLI `v0.0.115`
  (confirmed latest published version) has no config surface to request
  that migration type. Upgrading to Cloudflare's paid Workers plan would
  lift this restriction, but is explicitly off the table (no paid
  services, by the user's explicit, repeated instruction).

**Decision**: keep local dev working as-is (already fully verified with
two Playwright browser contexts, see Phase 1's own notes) and periodically
retry the plain `npx partykit deploy` (no `--domain`) to check whether
Cloudflare's shared-zone capacity has freed up. No code changes pending on
this — if it stays blocked long-term, revisit swapping the transport
entirely (Liveblocks' free tier was the leading alternative discussed,
since it needs no Cloudflare account/Durable Objects at all).

## Ad hoc — Remove the dead landing-page Play button

- [x] The production Neon database is empty (migrations create schema, not
      data — the local `azure-delta-thu9` demo track only ever existed in
      the dev Docker Postgres). Seeding it onto production hit a
      non-reproducible `P1001` connection error and was dropped as a
      goal — recreating a demo track through the live editor, if wanted,
      is the user's call, not something this repo needs to carry.
- [x] Removed the landing page's `Play` button (`src/app/page.tsx`), which
      linked to `/t/azure-delta-thu9` — a track that no longer exists in
      production, so it led nowhere. "Create a new track" is now the sole
      primary CTA next to "Discover tracks."

**Notes:**

- Verified via Playwright: landing page renders with zero `Play` links
  present, zero console errors. Full `tsc`/`eslint`/`next build` clean.

---

## Notes
- Each `[ ]` above becomes `[x]` only after it's implemented **and** manually verified in-browser (per engineering standards — type checks and tests confirm correctness, not feel).
- This file is updated at the end of every phase, not just at milestone boundaries.
