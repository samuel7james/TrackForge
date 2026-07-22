# TrackForge — Tasks

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

Work proceeds one phase at a time per the project workflow: implement → test → document → update this file → propose commit → **stop for approval** before the next phase.

---

## Phase 0 — Architecture (this phase)

- [x] `PROJECT_PLAN.md` — full architecture
- [x] `TASKS.md` — this file

---

## Milestone 1 — Vertical Slice

Goal: create a road with splines, edit it live, play it, record a lap, save/reload, publish, get a shareable URL. Must feel demo-ready.

### Phase 1 — Project Scaffolding
- [x] Next.js 16 + React 19 + TypeScript project init (see `PROJECT_PLAN.md` §2 note on the 15→16 deviation)
- [x] Tailwind CSS + shadcn/ui setup, base theme (dark-first, violet accent)
- [x] ESLint config (Next defaults; Prettier not added — not needed yet)
- [x] Install R3F, Drei, Rapier bindings, Zustand, Framer Motion, Zod
- [x] Prisma init + local Postgres via Docker Compose, initial migration (`Track` + `TrackVersion` models)
- [x] Folder skeleton per `PROJECT_PLAN.md` §3 (top-level `app/`, `components/`, `lib/`; deeper `modules/*` folders created as each phase needs them)
- [x] Base app shell: `/` (placeholder home), `/editor/new` route stub

### Phase 2 — Scene Core (One Scene, Two Modes)
- [x] `TrackForgeCanvas` — single persistent `<Canvas>`
- [x] `SceneRoot` — renders from `trackStore` (currently a minimal name-only stub; reactive label proves the wiring ahead of Phase 3's full document)
- [x] `editorStore` with `mode: "edit" | "play"`
- [x] `EditorCameraRig` (orbit camera) + temporary `PlayModeCameraRig` placeholder + `ModeController` swap, wired to a Play/Edit toggle button and Esc-to-edit — validates the zero-remount mode switch ahead of Phase 6's real vehicle controller
- [x] Ground plane placeholder (flat + grid) standing in for terrain until Milestone 2
- [x] Verified in-browser via Playwright: scene renders, mode toggle + Esc both work, no console errors

### Phase 3 — Spline Data Model & Road Tool
- [x] `track-format/schema.ts` — full `TrackDocument` v1 Zod schema + `createEmptyTrackDocument()` factory (only `splines` populated by the M1 UI; terrain/objects/checkpoints/validation shapes exist now so later milestones are additive)
- [x] `modules/spline` — arc-length Catmull-Rom centerline sampling (`catmull-rom.ts`) + road/curb ribbon extrusion (`road-mesh.ts`, `road.tsx`)
- [x] Road Tool interaction (`modules/editor/tools/road-editing-layer.tsx`): click ground to add a point, drag a point to move it (camera orbit correctly disabled mid-drag), select + Delete/Backspace to remove — implemented as direct trackStore mutations for now; Phase 4 wraps these in Commands for undo/redo and formalizes the `EditorTool` interface
- [x] Live geometry regeneration on edit via `useMemo` keyed on the spline — no rebuild/reload
- [x] Basic road material (asphalt) + alternating red/white curb strip
- [x] Verified in-browser via Playwright: add/drag/delete all work, live regen confirmed, orbit-vs-drag isolation confirmed, zero console errors
- [x] Fixed an infinite-render-loop bug found during verification (Zustand selector returning a fresh `[]` literal every call)
- **Known limitation:** the ribbon offset is naive (no miter/min-radius handling), so a corner tighter than the road's half-width can self-intersect. Only shows up on unrealistically sharp turns; revisit if it matters once real tracks are being built (candidate for Milestone 2 spline/validation work).

### Phase 4 — Editor Shell, Commands, Undo/Redo
- [x] `ToolRegistry` (`modules/editor/core/tool-registry.ts`) + `EditorEngine` (`modules/editor/core/editor-engine.tsx`) — adapted honestly for R3F: the registry drives the toolbar and which tool's behavior is active, while low-level pointer dispatch stays declarative through R3F's own event system rather than a hand-rolled raycasting dispatcher (reinventing that would fight the framework, not avoid a switch statement)
- [x] `CommandStack` (`modules/editor/core/command-stack.ts`) — undo/redo wired to control-point add (`AddControlPointCommand`), update/move (`UpdateControlPointCommand`, covers both drag and inspector edits), and remove (`RemoveControlPointCommand`, restores original index on undo)
- [x] Floating toolbar UI (Select, Road tools) — `modules/editor/ui/toolbar.tsx`
- [x] Inspector panel (selected point: position, width — banking/elevation fields stubbed for Milestone 2) — `modules/editor/ui/inspector-panel.tsx`
- [x] Keyboard shortcuts: `V` select, `G` road tool, `Ctrl+Z` / `Ctrl+Shift+Z` — with an input-focus guard so shortcuts don't hijack typing in inspector fields
- [x] Verified in-browser via Playwright: tool switching (click + shortcut), Road-adds/Select-doesn't, inspector width edits, full undo/redo cycles for add/update/remove (including order-preserving delete-undo), input-focus guard (Backspace in a field edits the field, not the point), zero console errors

### Phase 5 — Track Validation
- [x] Auto-generate start/finish line from spline start (`generateStartLine`) — derived from the spline every render via `useStartLine()`, not independently stored during editing
- [x] Auto-generate checkpoints along spline at even arc-length intervals (`generateCheckpoints` / `useCheckpoints()`) — inherently ordered since they're walked along the curve, so "correct order" needs no separate check
- [x] Validator (`modules/track-format/validate-track.ts`): closed loop + minimum 3 points. A single continuous Milestone-1 spline can't have unreachable sections, so that's the whole layout check for now
- [x] Added a **Close Loop** toggle (`ToggleSplineClosedCommand`, undoable) — without it the validator could never pass, since "closed" isn't otherwise reachable from the UI
- [x] Validation surfaced in the UI: a status badge (header) with a hover tooltip listing issues
- **Scope revision from the original bullet:** validation blocks **Publish** (Phase 9), not Play. Blocking Play would contradict the master prompt's own "Instant Play Mode — test at any time" philosophy; you should be able to test-drive a road while it's still unfinished. The validator itself is fully built here; enforcement is wired to whichever action actually needs it.
- [x] Verified in-browser via Playwright: issue badge at 0/2 points, Close Loop appearing at 3+ points, closing/reopening updates the badge and the rendered loop shape, start line + checkpoint gates render correctly, undo/redo of the close-loop toggle both work, zero console errors

### Phase 6 — Instant Play Mode
- [x] Rapier `<Physics>` world mounted only in `ModeController`'s play branch (`modules/scene/mode-controller.tsx`) — unmounts fully on Esc, so every Play press starts fresh at the start line
- [x] Colliders generated from the same spline → geometry pipeline the visual Road uses (`modules/race/physics/track-physics.tsx`), plus a flat ground collider so driving off-track doesn't fall through the world
- [x] Vehicle controller (`modules/race/vehicle/use-vehicle-controller.ts`): arcade-style force model on a single dynamic rigid body — speed-scaled direct angular velocity for steering, lateral-velocity damping for grip — rather than Rapier's raycast wheel controller, which is harder to tune for arcade feel and overkill for the "Mr.doob simplicity" the brief asks for
- [x] `PlayModeCameraRig` replaced with a real smoothed chase camera (exponential-decay position/look-at follow, frame-rate independent)
- [x] Procedural placeholder `CarModel` (no external assets yet)
- [x] Play/Esc toggle verified zero-reload/instant (already proven structurally in Phase 2; Phase 6 just gives the play branch real content)
- **Two real bugs found and fixed during in-browser verification** (both confirmed via temporary position/velocity logging, not just visual inspection):
  1. The controller read `forwardSpeed`/`lateralSpeed` from velocity *before* calling `applyImpulse`, then overwrote velocity via `setLinvel` using those stale pre-impulse values — silently discarding every frame's engine force (car had exactly zero horizontal velocity despite full throttle). Fixed by resolving forward/lateral speed as scalars and committing one `setLinvel` per frame instead of mixing `applyImpulse` and `setLinvel`.
  2. `@react-three/rapier`'s mesh-based collider auto-fit (`colliders="cuboid"`/`"trimesh"` on a `<RigidBody>` wrapping a `visible={false}` mesh) silently produced no collider at all — the car fell through both the ground and the road forever with no error. Fixed by switching to explicit `<CuboidCollider>` / `<TrimeshCollider>` components, which is also clearer to read than relying on implicit mesh auto-fit.
- [x] Verified in-browser via Playwright with temporary debug logging: car rests correctly on the road surface, accelerates/steers/grips in response to input, drives off-track onto the ground plane without falling through, Esc returns instantly to editing, zero console errors

### Phase 7 — Lap Timing
- [x] Gate-crossing detection (`modules/race/timing/gate-crossing.ts`): transforms car position into the gate's local space and checks for a forward-axis sign change within the gate's lateral bounds — a plain distance-to-center check would miss cars passing near the edge of a wide gate
- [x] Checkpoint-order tracking + lap start/finish detection (`modules/race/timing/lap-timer.tsx`) — checkpoints must be crossed in order before start/finish completes a lap; crossing start/finish early is silently ignored rather than penalized, keeping M1 forgiving
- [x] `raceStore`: current lap (event-driven start/sector/complete, not a 60fps store tick), last lap, best lap, best-per-sector, session lap history — persists across multiple Play sessions within the same page load, reset only on full reload
- [x] HUD overlay (`modules/race/timing/race-hud.tsx`): live lap timer ticks via `requestAnimationFrame` mutating a ref directly (not React state), so it updates smoothly without re-rendering the rest of the HUD; last/best lap; a fading sector-delta indicator (green/amber) on each checkpoint cross
- [x] Verified in-browser via Playwright, directly (not just visually): confirmed `hasCrossedGate` correctly fires for both the start line and a checkpoint gate, confirmed the order-guard correctly ignores an early start/finish crossing while a checkpoint is still pending, confirmed a full start→complete lap cycle with correct elapsed time and correct HUD last/best display, zero console errors. Scripted autonomous circular driving proved too non-deterministic to reliably reach a checkpoint placed partway around a large loop, so that specific crossing was confirmed with a direct teleport-across-the-gate test instead — the exact same `hasCrossedGate` code path the start-line crossings (proven across several successful runs) already exercised, just with checkpoint gate data instead of start-line data.

### Phase 8 — Persistence
- [x] `POST /api/tracks` — create + return `{ id, slug, editToken }`; generates a human-readable slug (`generateSlug()`, adjective-noun-suffix) with retry-on-collision, ahead of Phase 9's schedule since the creation response itself needs a slug for the `/editor/[slug]` URL
- [x] `PATCH /api/tracks/[slug]` — save document (editToken-guarded via `X-Edit-Token` header, 401 missing / 403 wrong), also writes a `TrackVersion` row per save (empty of product features until Milestone 3's version history UI, but capturing the trail from day one avoids a backfill)
- [x] `GET /api/tracks/[slug]` — load document, publicly readable (404 if not found)
- [x] `modules/track-format/validate.ts` — Zod boundary validation (distinct from `validate-track.ts`'s "is this a raceable track" check); every route validates the document shape before touching Prisma
- [x] Client: `useSaveTrack` (explicit) + `useAutosave` (4s debounce on any `trackStore.document` change) share the same save path; editToken kept only in localStorage, never round-tripped through Zustand state
- [x] Reload flow: `/editor/[slug]` fetches and loads the saved document on mount, resets undo history (a fresh load shouldn't be unwindable by a prior session's undo stack) — verified byte-for-byte identical scene reconstruction after a full page reload
- **Real bug found and fixed:** the POST handler stored the document as the client sent it — with `meta.slug` still `""`, since the client doesn't know the slug until the response comes back. The client's local `setSlug()` call updated in-memory state correctly, but because navigating to `/editor/[slug]` remounts `EditorView` (a different route/component tree, not just a prop change) and its mount effect refetches-and-loads the document from the server, it silently overwrote the correct local slug with the stale empty one from the database — so the *next* save saw `slug === null` again and created a second, duplicate track instead of updating the first. Fixed by having the POST handler stamp the generated slug into `document.meta.slug` before persisting, so the stored document is self-consistent from the moment it exists. Confirmed via a real second-edit-then-save test that initially reproduced the duplicate-track bug, then confirmed the fix (single track, correct point count, one `TrackVersion` row) after the change.
- [x] Verified in-browser via Playwright + direct Postgres queries: save creates a `Track` row and redirects, wrong/missing edit token correctly 403/401, nonexistent slug 404s, a second real edit+save correctly updates the same track (not a duplicate) and writes a `TrackVersion` row, full reload reconstructs an identical scene

### Interim — Visual & Feel Polish Pass
Triggered by direct feedback that the vertical slice wasn't yet at a demoable bar ("the whole experience... including everything"). Rather than guess, referenced Mr.doob's Starter-Kit-Racing (the brief's own inspiration) for what was missing: real modeled assets, and a lot of "juice" — body lean/tilt tied to input, wheel roll/steer animation, drift feedback. Paused Phase 9 to close the gap on what's achievable without external assets.

- [x] Vehicle feel (`modules/race/vehicle/`): body lean/tilt animation tied to steering and throttle (`vehicle-visual-state.ts`, a plain mutable object the controller writes into every physics frame and `CarModel` reads in its own `useFrame` — same pattern as `vehicleHandle`, no React state at 60fps), front-wheel steering yaw, and rolling wheel spin via `mesh.rotateY()` (composes correctly with a static base rotation; setting `rotation.y` directly does not)
- [x] `CarModel` rebuilt with `RoundedBox` body/cabin, tinted glass cabin material, emissive headlights/taillights — reads as an actual car instead of bare boxes
- [x] Scene lighting overhaul: custom gradient `SkyDome` (dusk palette) + hemisphere light + warmer directional "sun", replacing the flat black background and bare ambient+directional setup
- [x] Asphalt grain texture on the road surface (same canvas-texture technique as the curb striping and checker start line)
- **Three real bugs found during this pass, each confirmed via a live before/after test, not just visual inspection:**
  1. drei's `<Environment preset="sunset">` requires fetching an HDRI from a third-party CDN at runtime — confirmed via `curl` that this sandbox has no DNS path to it at all. An external asset dependency for basic scene lighting is fragile in general, not just here, so switched to a fully local, procedural approach instead of chasing network access.
  2. drei's `<Sky>` (a local shader, no network involved) rendered solid black for reasons not resolved; a custom gradient dome sphere was built to replace it. That dome itself then also rendered solid black at a "true skybox" scale (800 units) with normal depth testing — root-caused to depth-buffer precision loss at that near(0.1)/far(2000) ratio and scale (confirmed by binary-searching the exact scale where it broke: fine at 20-50, gone at 100+). Fixed by using a much more modest scale (180, still past the grid's own fade distance) with ordinary depth testing rather than disabling depth testing (which was tried first and made it worse, not better).
  3. **The significant one:** autosave's first-time save calls `router.replace()` to move the URL from `/editor/new` to `/editor/[slug]`. Because those are different dynamic route segments, Next.js fully unmounts and remounts the whole editor to navigate between them — including an in-progress Play session. Reproduced reliably: build a track, press Play, keep driving past the ~4s autosave debounce, and the game yanks back to a "Loading track…" screen mid-drive, resetting the car and camera. This is likely a meaningful part of what read as "broken." Fixed by updating the address bar via `window.history.replaceState` instead of the Next.js router — it keeps the URL correct for reload/sharing without triggering any navigation or remount.
- [x] Re-verified after the fix: full save → drive-through-autosave-window → no interruption; save/reload/editToken flows from Phase 8 re-confirmed unaffected by the URL-update change

### Phase 9 — Publishing & Sharing
- [x] Slug generation (human-readable, unique) — done in Phase 8, needed as soon as a track is first saved, not just on publish
- [ ] `POST /api/tracks/[slug]/publish` — sets `isPublished`, locks slug
- [ ] Public track page `/t/[slug]` — name, description, difficulty, estimated lap time, "Play" CTA
- [ ] Share affordance (copy link)

### Phase 10 — Polish Pass
- [ ] Empty-state onboarding (first-time "click to place your first point" hint)
- [ ] Command palette (`Cmd+K`) with at least: New Track, Save, Publish, Play/Edit toggle
- [ ] Toasts for save/publish/validation feedback
- [ ] Pass over animations/transitions (Framer Motion) for panel and mode-switch polish
- [ ] Full manual run-through of the entire Create→Publish→Share→Race loop end-to-end

---

## Milestone 2 — Editor Expansion (high-level, refine when reached)
- [ ] Terrain sculpting (raise/lower/flatten/smooth/noise) + texture painting
- [ ] Object placement system + prop registry + instancing
- [ ] Weather/lighting presets, real-time updates
- [ ] Additional camera modes (Free Fly, Cinematic, Top View)
- [ ] Advanced spline editing (tangent handles, split/merge, snapping, elevation/banking UI)
- [ ] Track validation hardening (unreachable-area detection, etc.)

## Milestone 3 — Creator Platform (high-level)
- [ ] Real auth + `User` model, migrate anonymous `authorId`s
- [ ] Profiles, track pages richer metadata
- [ ] Discover feed (trending/new/most played/highest rated)
- [ ] Likes, comments, bookmarks, follows, search

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
