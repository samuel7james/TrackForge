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
- [x] `POST /api/tracks/[slug]/publish` — editToken-guarded, sets `isPublished`. This is the one place "prevent invalid tracks from being published" is actually enforced (reuses Phase 5's `validateTrack`) — Phase 5 deliberately left Play ungated, only this
- [x] Added a **Publish dialog** (name/description/difficulty form) — there was previously no UI anywhere to set these fields, so publishing was the natural place to add one. Confirming it calls `setMeta`, then `saveTrack`, then the publish endpoint
- [x] `estimate-lap-time.ts` — rough placeholder lap time (centerline arc length ÷ an assumed arcade-pace average speed), computed fresh on every page render rather than stamped into the document at publish time, since the owner can keep editing a published track and a stored estimate would go stale
- [x] Public track page `/t/[slug]` (Server Component: name, description, difficulty, estimated lap, "Play" CTA) + `PublicTrackActions` (client island: owner-only check via `useSyncExternalStore` reading localStorage, not an effect+setState — draft tracks show a "Draft" badge and an "Open editor" link to the owner, a plain "not published yet" notice to anyone else)
- [x] Share affordance: Copy Link button (Clipboard API + toast)
- [x] "Play" CTA links to `/editor/[slug]?autoplay=1` — `EditorView` reads the param and auto-enters Play mode once the document finishes loading, so a visitor lands directly in the driver's seat instead of the editor
- **Two real bugs found during verification, both confirmed via a failing-then-passing test, not just inspection:**
  1. A race in the save mutex: the mutex was a plain boolean guard that silently no-op'd a concurrent call. If autosave's debounced save happened to be in flight when Publish called `saveTrack()` (very plausible — a few seconds of editing is exactly the debounce window), Publish's save silently did nothing, leaving `document.meta.slug` empty, so the publish flow failed with "Couldn't verify edit permissions." Fixed by waiting for any in-flight save to settle and then *always* performing a fresh save, rather than skipping — a concurrent caller needs their own current state persisted, not to be dropped because someone else's save overlapped.
  2. The publish dialog's description field never appeared on the public page. Cause: `Track.description` is a separate Prisma column (distinct from the JSON document's `meta.description`), and the create/update routes only ever wrote `name` into its matching column, never `description`. Fixed by keeping both routes' `description` column in sync with `meta.description`, mirroring the existing `name` handling.
- **Also fixed:** a Base UI `nativeButton` accessibility warning on every `Button` rendered as a `next/link` `<a>` (home page's CTA and both public-page buttons) — added `nativeButton={false}` so Base UI stops assuming native `<button>` semantics for an anchor. Separately confirmed (not a bug) that Base UI's `Button` deliberately keeps `role="button"` even when rendered as an anchor, for consistent semantics regardless of the underlying tag — a real, if minor, thing to know before writing accessibility-tree-based tests against these buttons.
- [x] Verified in-browser via Playwright across two separate scenarios: (1) full publish flow — confirm button disabled while invalid, enabled once a loop closes, name/description/difficulty all persist correctly, Copy Link and autoplay-Play both work, nonexistent slugs 404; (2) draft visibility — the owner (same browser, matching localStorage token) sees a Draft badge and an editor link, a fresh visitor (separate browser context, no token) sees only a neutral "not published" notice with no editor link and no Play button

### Phase 10 — Polish Pass
- [x] Empty-state onboarding (first-time "click to place your first point" hint)
- [x] Command palette (`Cmd+K`) with at least: New Track, Save, Publish, Play/Edit toggle
- [x] Toasts for save/publish/validation feedback
- [x] Pass over animations/transitions (Framer Motion) for panel and mode-switch polish
- [x] Full manual run-through of the entire Create→Publish→Share→Race loop end-to-end

**Notes:**

- `empty-state-hint.tsx`: shown only while the Road tool is active and the track has zero
  points — a bouncing icon + "click anywhere on the ground" prompt, Framer Motion
  enter/exit. Disappears the instant the first point is placed.
- Command palette built on shadcn's generated `command.tsx` (cmdk + Base UI `Dialog`).
  Found and fixed a bug in the generated `CommandDialog`: it rendered `CommandInput`/
  `CommandList` directly inside `DialogContent` without a `<Command>` root, so cmdk's
  internal store was `undefined` or ("Cannot read properties of undefined (reading
  'subscribe')"). Fixed by wrapping the palette's contents in `<Command>` inside
  `CommandDialog`.
  - Opens with `Ctrl+K`/`Cmd+K` from anywhere in the editor (global `keydown` listener in
    `CommandPalette`).
  - Commands: New track (navigates to `/editor/new`), Save (`⌘S`, reuses `useSaveTrack`),
    Publish (opens the existing `PublishDialog`), Play/Edit toggle (`Esc`).
  - Publish's `open` state was lifted out of local `useState` into a new `uiStore`
    (`isPublishDialogOpen`/`isCommandPaletteOpen`) — the store PROJECT_PLAN §6 already
    reserved for "panel visibility, command palette, modals" — so the palette's Publish
    command and the header's Publish button both drive the same dialog instance.
- Toasts: save/publish/load-failure toasts already existed from Phases 8–9
  (`save-button.tsx`, `publish-dialog.tsx`, `editor-view.tsx`'s load error handler) and
  the command palette's Save action reuses the same pattern. Validation feedback is
  surfaced inline in real time (amber "N issues" pill + tooltip in `TrackStatus`, and the
  Publish dialog's description lists the blocking issues) rather than as a toast — more
  useful than a one-shot toast for something that's continuously true while editing.
- Animation pass: header's edit-mode controls (undo/redo, status, save, publish) fade/
  slide in with `AnimatePresence`; Toolbar and InspectorPanel slide in from their
  respective edges on entering edit mode; the whole edit/play subtree cross-fades via
  `AnimatePresence mode="wait"` on the `mode` key, so switching modes (toolbar button,
  `Esc`, or the command palette) is a soft fade rather than an instant swap.
- Full loop verified with Playwright end-to-end (fresh script, not reused from earlier
  phases): create at `/editor/new` → place 4 points → close the loop (`TrackStatus`'s
  "Close loop" button) → explicit Save (slug assigned, URL updated) → Play mode, drove
  for 6s past the autosave debounce window with **no** mid-drive kick back to a loading
  screen (regression check for the Phase-9-era history.replaceState fix) → full page
  reload at `/editor/[slug]` with points still persisted (no empty-state hint) → Publish
  via the command palette, filled in name/description, publish toast fired → visited the
  public `/t/[slug]` page and confirmed name + description render → clicked Play there
  and landed back in the editor in Play mode via `?autoplay=1`. Zero console/page errors
  across the whole run. Test tracks were deleted from the dev database afterward.

---

## Milestone 2 — Editor Expansion

Phased in dependency order: spline editing gets richer first (still the only thing on
screen), then terrain (the ground those splines sit on), then objects (placed on that
terrain), then weather/lighting and camera modes (how it's all viewed), then validation
hardening once tracks are complex enough to need it. Each phase follows the same
implement → verify in browser → update TASKS.md → propose commit → stop for approval
loop as Milestone 1.

### Phase 11 — Advanced Spline Editing

- [x] Per-point tangent handles (manual + auto/Catmull-Rom toggle) for corner shaping
- [x] Split segment (insert a point mid-segment) and merge/delete-with-rejoin
- [x] Snapping (grid snap, angle snap, snap-to-existing-point)
- [x] Elevation & banking editing UI (inspector fields + gizmo, building on the
      `position.y`/width fields already in `InspectorPanel`)
- [x] Fix the known ribbon self-intersection-at-sharp-corners limitation (Phase 3) now
      that miter/min-radius handling has a real reason to exist

**Notes:**

- Schema: control points gained `tangentMode: "auto" | "manual"` (default `"auto"`,
  backward-compatible with existing documents via Zod's `.default()`).
- `modules/spline/road-curve.ts` (new): `RoadCurve extends THREE.Curve<Vector3>`, a cubic
  Hermite spline that replaces the old direct `THREE.CatmullRomCurve3` usage in
  `catmull-rom.ts`. "Auto" points compute their tangent with the standard
  Catmull-Rom-to-Hermite identity (half the chord to neighbors, one-sided at open
  endpoints) -- mathematically identical to the old curve, so an all-auto spline renders
  pixel-identical to before. "Manual" points substitute their authored
  `tangentIn`/`tangentOut` instead, so reshaping one corner doesn't affect neighboring
  auto corners (unlike a global interpolation-mode swap). Extending `THREE.Curve` gets
  arc-length parameterization (`getPointAt`/`getTangentAt`) for free, so every existing
  consumer (`Road`, `TrackPhysics`'s collider, `estimateLapTimeMs`) needed zero changes.
- Banking: `RoadSample` gained a `bank` field (interpolated per-point `banking` degrees,
  same lerp pattern as `width`); `road-mesh.ts`'s cross-section `right` vector now rolls
  around the tangent by the bank angle, which raises the outer edge and lowers the inner
  one exactly like a real banked corner -- and since the physics collider is built from
  the same geometry, cars now physically feel the banking too.
  - Elevation UI is just the existing Position Y field -- the schema's separate
    `elevation` field was already unused/dead before this phase and stays that way; adding
    a second competing "height" concept would have made the model more confusing, not less.
- Sharp-corner self-intersection fix: `road-mesh.ts` now estimates the local turn radius
  at each sample (finite difference of tangent direction over a several-sample window)
  and clamps the half-width offset to a safe fraction of that radius, narrowing the road
  through tight corners instead of letting the two edges cross. Verified: a realistic
  tight hairpin (control points spaced reasonably apart) now renders cleanly with no
  crossing; an intentionally pathological hairpin (control points closer together than
  the road's own width) still shows a small residual artifact, which is a genuine
  degenerate-input limit (the centerline itself nearly folds back on itself within less
  than one road-width) rather than a regression.
- Viewport additions: `TangentHandles` (draggable green handles + connecting lines, shown
  only while the selected point's Corner style is Manual) and `ElevationHandle` (a yellow
  cone above the selected point, drag it vertically to change Position Y) -- both mounted
  in `EditorEngine` alongside the existing `PointEditingLayer`. The elevation handle uses
  a drag plane containing the vertical axis through the point and rotated to face the
  camera, the standard technique for a reliable single-axis gizmo drag.
- Snapping (`point-editing-layer.tsx`): point-snap is always on (new points and drags
  within 1.5m of an existing point lock exactly onto it -- useful for closing a loop
  precisely); grid-snap while holding Ctrl/Cmd (rounds to the visible Grid's 2m cell
  size); angle-snap while holding Shift, but only when placing a *new* point relative to
  the previous one (constrains the direction to the nearest 15°, keeping the click's
  distance) -- the standard vector-tool convention, so no toolbar UI was needed for any of
  the three.
- Split-segment: clicking directly on the road surface while the Select tool is active
  (not the Road tool, which still just appends) inserts a new point at the nearest spot on
  the sampled centerline, at the correct index via `AddControlPointCommand`'s new optional
  `index` param. Implemented as an invisible proxy mesh reusing the same
  `sampleRoadCenterline`/`buildRoadGeometry` pipeline the visible `Road` uses, elevated
  slightly above the visible surface. Hit a real bug while verifying this in-browser: the
  proxy's material had no explicit `side`, defaulting to `FrontSide`, and silently never
  registered a single raycast hit despite being geometrically correct -- `Road`'s own
  material needs `side={THREE.DoubleSide}` to render from this editor's camera angles, so
  the same default-side proxy was being raycast against its non-existent front face. Fixed
  by matching `Road`'s `DoubleSide`.
- Merge/delete-with-rejoin needed no new code: since the curve is always recomputed from
  whatever's left in the `points` array, deleting a point already reconnects its neighbors
  automatically. Verified directly (delete a point, confirm no crash and the inspector
  closes) rather than building something that already existed.
- Verified in-browser via Playwright: point-snap/grid-snap/angle-snap all confirmed via
  exact-value readback from the inspector (not just visual inspection); banking and
  tangent-mode-toggle read back correctly; split-segment selects a new point on ribbon
  click and undo removes it; delete-rejoin doesn't crash. Also reran the full Milestone 1
  create→edit→play→save→reload→publish→share→race loop end-to-end as a regression check
  (the spline/road-mesh pipeline is shared by rendering, physics, and lap-time estimation)
  -- passed with zero console errors, confirming the Hermite-curve swap didn't change
  behavior for existing all-auto tracks.

### Phase 12 — Terrain Sculpting

- [x] Ground plane becomes a sculptable heightfield (raise/lower/flatten/smooth/noise brushes)
- [x] Terrain collider stays in sync with the visual mesh (Rapier heightfield or regenerated trimesh)
- [x] Texture painting (at least 2-3 blendable ground textures)
- [x] Track validation accounts for terrain (car's actual driving surface, not just the spline)

**Notes:**

- Schema: `terrain.resolution` is now vertices-per-side (65, i.e. 64x64 cells over the
  existing 500x500 `size`), with `heightmap`/each texture layer's `weightmap` a flat
  `resolution*resolution` array. Added cross-field Zod `.refine()`s so a corrupted terrain
  document (wrong array length) fails validation at the load boundary instead of producing
  a mismatched mesh/collider. `createEmptyTrackDocument` now seeds a real flat terrain (all
  heights 0, grass fully weighted, dirt/rock at 0) instead of the old empty placeholder
  arrays, so there's always something valid to render and paint from the first save.
- `modules/terrain/`: `heightmap.ts` (grid index helpers, `applyBrush` for
  raise/lower/flatten/smooth/noise with radial smoothstep falloff, `applyPaint` for
  splat-map-style texture weight painting that renormalizes all layers at each touched
  vertex back to summing to 1, `sampleTerrainHeight` for bilinear lookups used by
  validation), `terrain-mesh.ts` (manual `BufferGeometry` construction like
  `road-mesh.ts`'s ribbon, vertex-colored by blending grass/dirt/rock per-vertex weights),
  `terrain.tsx` (the presentational component, replacing `SceneRoot`'s old static flat
  plane -- shared unchanged between edit/play like `Road`).
- Editor: new "Terrain" tool (`T` shortcut) alongside Select/Road. `TerrainSculptLayer`
  (mounted in `EditorEngine`, active only for this tool) is an invisible raycastable copy
  of the terrain surface handling brush strokes; `TerrainBrushPanel` picks brush mode,
  radius, strength, and (for Paint) which layer. One `TerrainSculptCommand` per whole
  stroke (pointer down→up), not per dab, snapshotting the full heightmap/texture-layer
  state before/after so undo/redo doesn't produce dozens of stack entries per drag.
- Physics: `TrackPhysics`'s flat `CuboidCollider` ground is now a real `HeightfieldCollider`
  built from the same heightmap (`terrain-mesh.ts`'s `terrainHeightsForCollider`), sharing
  the exact `index(ix,iz) = ix + iz*resolution` convention as Rapier's column-major heights
  matrix layout, so no transform is needed between what's rendered and what's collided
  with. Verified sculpted bumps physically affect the car (an aggressive test bump visibly
  launched it airborne; a moderate one on a straight produced a clean, controllable rise).
- Track validation: `validateTerrainAlignment` (`validate-track.ts`) samples the road
  centerline at a stride and bilinear-samples the terrain height underneath each sampled
  point via `sampleTerrainHeight`; if any diverge by more than 1.5m it surfaces a
  `terrain-mismatch` issue through the existing `TrackStatus`/`PublishDialog` UI (no new
  feedback mechanism needed). Verified: valid before sculpting, "1 issue" with the
  terrain-mismatch message after digging a deep pit under the road.
- **Found and fixed a real, pre-existing bug while verifying Play mode, unrelated to
  terrain**: the car essentially couldn't drive. Root-caused via per-physics-step velocity
  logging (not just screenshots, which weren't sensitive enough to catch this) to
  `useVehicleController` running on `useFrame` (once per *rendered* frame) while
  `@react-three/rapier`'s `<Physics>` steps its world on its own fixed internal timestep
  (default 1/60s) and substeps to catch up whenever rendering falls behind -- confirmed
  substepping ~4x per rendered frame in this environment. Ground friction/damping got to
  act on the body's velocity every one of those substeps while the controller's
  `accel*delta` thrust model only got to run once, so friction won every time and the car
  barely crept forward no matter how long throttle was held. Fixed by switching to
  `useBeforePhysicsStep`, which fires exactly once per actual physics step, restoring the
  1:1 correspondence the model assumes. Also fixed a second, related issue in the same
  investigation: `Vehicle`'s `RigidBody` was passed `position`/`quaternion` as ongoing JSX
  props (React Three Fiber re-applies array-valued props like `position` every render,
  which was fighting the physics simulation); moved spawn placement to a one-time
  imperative `setTranslation`/`setRotation` in a mount-only effect instead. Verified with
  per-frame position logging: the car now covers ~104m in 12 real seconds (vs. ~1.5m
  before), physics stepping at a clean, render-rate-independent 60Hz.
- Full regression: reran both the Milestone 1 create→edit→play→save→reload→publish→
  share→race loop and the entire Phase 11 spline-editing verification suite (tangent
  handles, snapping, split-segment, banking) -- all still pass with zero console errors,
  confirming the vehicle-controller fix and terrain/collider changes didn't regress
  anything else.

### Phase 13 — Object Placement System

- [x] Prop registry (a small initial set: cones, barriers, trees/rocks, start-line props)
- [x] Placement tool (click to place, drag to move/rotate/scale, delete)
- [x] Instancing for perf (props are the first thing in the scene with real repeat-count)
- [x] Props persist in `TrackDocument` and round-trip through save/load

**Notes:**

- Selection generalized: renamed `editorStore`'s `selectedPointId`/`setSelectedPointId` to
  `selectedId`/`setSelectedId` across every Phase 11 consumer (InspectorPanel,
  PointEditingLayer, TangentHandles, ElevationHandle). This was already the documented
  intent ("Selection is cross-cutting... once they exist") -- IDs are globally unique
  (`crypto.randomUUID()`), so each panel just looks its own entity array up by this one
  shared id and gets nothing back if the current selection belongs to a different entity
  type, rather than maintaining a parallel `selectedObjectId` field.
- `modules/objects/prop-registry.ts`: five procedural prop types (cone, barrier, tree,
  rock, flag for start-line marking), each a small list of primitive geometry+material
  "parts" with a local offset -- same simple-primitives style as `CarModel`/the road
  ribbon, no external model loading/asset pipeline.
- `modules/objects/placed-objects.tsx`: presentational, shared unchanged between edit and
  play mode like `Road`/`Terrain`. One drei `<Instances>` pool per (prop type, part) pair,
  so e.g. every tree's trunk across the whole track batches into a single draw call
  regardless of count; each object's own position/rotation/scale is an ordinary nested
  `<group>` around its parts' `<Instance>`s -- composes correctly since `Instance` reads
  world matrices, no manual matrix math needed.
- Editing interaction (`ObjectPlacementLayer`, editor-only) deliberately does NOT reuse the
  instanced meshes for click targets -- one plain invisible sphere per placed object
  (mirrors `PointEditingLayer`'s per-point spheres) is simplest and avoids the instancing
  complexity entirely for a count of objects where per-object meshes are in no way a perf
  concern; the instancing that actually matters is in the shared rendering path both modes
  use. Rotate/scale are inspector number fields (yaw degrees + uniform scale), not viewport
  gizmos -- consistent scope with Phase 11's banking field, not a regression from it.
- Tool exclusivity: `PointEditingLayer`'s ground click-catcher now only renders for
  Road/Select (previously just "not Terrain"), so it can't fight
  `ObjectPlacementLayer`'s own ground-click-catcher for the same coincident y=0 plane when
  the Object tool is active. `ObjectPlacementLayer` clears any lingering point selection on
  entering the Object tool (mirrors `TerrainSculptLayer`'s equivalent clear), so
  `InspectorPanel` and `PropPalettePanel` don't render on top of each other in the same
  corner.
- Verified in-browser: all five prop types place and render distinctly; rotation and scale
  set via the inspector read back correctly; drag-to-move and Delete both work; save →
  full page reload preserves a placed object's exact rotation/scale (round-trip through
  the existing JSON persistence, no new plumbing needed since `document.objects` was
  already part of the schema). Also verified objects/road/terrain edits coexist in the same
  session without interference, and reran the full Milestone 1 loop plus the Phase 11 and
  Phase 12 verification suites as a regression check -- all pass with zero console errors.

### Phase 14 — Weather & Lighting Presets

- [x] A handful of presets (e.g. Clear Day, Overcast, Sunset, Night) driving sun angle/
      color, sky, ambient/fog
- [x] Real-time preview while editing (no reload needed)
- [x] Preset choice persists as part of the track document

**Notes:**

- All 7 of the schema's existing `weather` enum values got a preset (Clear Day, Sunset,
  Night, Rain, Snow, Fog, Cloudy) rather than just the 4 examples in the phase
  description, since the schema already committed to that enum back in Milestone 1.
- `modules/environment/weather-presets.ts`: each preset sets sun color/base intensity,
  hemisphere sky/ground colors, ambient intensity, a 6-stop sky gradient (feeding
  `SkyDome`, now parametrized instead of hardcoded), and a default time-of-day/fog-density
  to seed when that preset is chosen. Sun *position* is computed separately, continuously,
  from `environment.timeOfDay` (`sunPositionAndFactor`): elevation follows a sunrise-6/
  noon-12/sunset-18/midnight-0 arc, and the resulting elevation factor further scales
  whatever the preset's base sun intensity is -- so the discrete preset (mood) and the
  continuous time-of-day dial (actual sun position/darkness) compose instead of
  fighting each other. Picking "Night" then dragging the time slider to noon doesn't stay
  pitch black, and picking "Clear Day" at midnight still goes dark.
- Fixed a pre-existing inconsistency along the way: `environment.fogDensity` was always
  named for exponential falloff, but `SceneRoot` used a linear `<fog near far>` with
  hardcoded distances that never read it. Switched to `<fogExp2 density={...}>`, which
  actually uses the field it's named after.
- Also fixed a cosmetic mismatch: the schema's default `weather: "sunny"` produced a
  moody purple-dusk look (the *old* hardcoded gradient), not anything resembling "sunny".
  That gradient is now specifically the Sunset preset; Clear Day is an actual bright blue
  sky.
- No literal rain/snow particle effects -- Rain/Snow/Fog presets are lighting/sky/fog mood
  only (desaturated tones, denser fog for wet/snowy/foggy readability). Real precipitation
  particles would be a substantial separate effort better scoped as its own follow-up
  than folded into "lighting presets."
- `EnvironmentDialog` (new header button, next to Publish): a preset grid plus time-of-day
  and fog-density sliders. Sliders apply live to the store on every `onValueChange` (real-
  time preview) but record exactly one `UpdateEnvironmentCommand` on `onValueCommitted`
  (drag release) -- same "apply live, commit once" shape as control-point dragging and
  terrain brush strokes, so dragging a slider doesn't flood the undo stack.
- Verified in-browser: all 7 presets produce visually distinct, correct scenes; the
  time-of-day slider updates the live scene and its label continuously; a chosen preset
  survives a real save -> full page reload round-trip; undo reverts an environment change.
  Reran the full Milestone 1 loop and the Phase 13 object-placement suite as a regression
  check given how central `SceneRoot` is -- zero console errors throughout.

### Phase 15 — Additional Camera Modes

- [x] Free Fly (editor-only, decoupled from OrbitControls' target)
- [x] Cinematic (scripted flythrough along the track spline)
- [x] Top View (orthographic, useful for layout work)
- [x] Mode switch wired into the existing camera-rig architecture (§ ModeController)

**Notes:**

- `editorStore` gained `cameraMode` (`"orbit" | "freefly" | "topview" | "cinematic"`,
  editor-only -- Play mode always uses `PlayModeCameraRig` regardless). `EditorCameraRig`
  now just picks which of four self-contained rigs to mount, the same "swap the
  subtree" pattern `ModeController` already uses for edit/play, so switching modes is
  just remounting a different rig, never touching `SceneRoot`.
- **Free Fly** (`camera-modes/free-fly-camera-rig.tsx`): WASD to move (+ Space/Ctrl for
  up/down, Shift to boost), hold the *right* mouse button and drag to look around --
  right-click specifically, not left (which stays free for tool interactions -- placing a
  point/object, etc. -- so nothing needed to change there) and not the browser Pointer
  Lock API (simpler, no permission/fallback UI to build). Computes its own look delta from
  `clientX`/`clientY` rather than trusting `movementX`/`movementY`, and clamps the
  per-event delta as a defensive backstop against any single spurious/duplicated pointer
  event.
  - Spent a while chasing what looked like a real bug here (a big single simulated drag
    left the view showing only sky/horizon, no grid) before realizing it wasn't one:
    verified by rotating back the same amount immediately afterward, which restored the
    exact original framing. A free camera rotated far enough legitimately points away from
    whatever you were looking at -- correct behavior for an unlimited-look camera, not
    corrupted state. Worth recording since it cost real debugging time on a false lead.
- **Top View** (`camera-modes/top-view-camera-rig.tsx`): an orthographic camera plus
  drei's `MapControls` (the same OrbitControls machinery with rotation disabled and pan
  remapped to left-drag) -- directly inspired by mrdoob's Starter-Kit-Racing track editor,
  which edits from exactly this kind of flat, precise, non-perspective viewpoint. Disabled
  while a control point/object is being dragged, same reason (and same fix) as the orbit
  rig already disables `OrbitControls` mid-drag: native listeners bound directly to the
  canvas, so stopping propagation on the drag handler alone wouldn't stop it from also
  panning the camera.
  - Found a real bug here: the first version placed the camera 200 units up, relying on
    orthographic zoom (not distance) to frame the scene -- correct for framing, but
    `FogExp2` still cares about actual distance regardless of projection type, and at 200
    units even the default Clear Day fog density washed the whole view out to a ~70%
    fogged haze. Fixed by keeping the camera low (45 units) and letting zoom alone control
    how much ground is visible.
- **Cinematic** (`camera-modes/cinematic-camera-rig.tsx`): a no-input scripted flythrough
  along `sampleRoadCenterline` (the same function `Road`/`TrackPhysics`/lap-time
  estimation already share), looping seamlessly on a closed spline or ping-ponging on an
  open one. A scripted preview of the finished circuit, not an editing camera.
- Verified in-browser: all four modes reachable from the new header `CameraModeMenu` and
  switch cleanly with no console errors; Top View pans/zooms correctly; Free Fly's WASD
  movement and right-drag look both work and are fully reversible; Cinematic advances
  smoothly along the track over time. Reran the full Milestone 1 loop as a regression
  check -- zero console errors.

### Phase 16 — Track Validation Hardening

- [x] Unreachable-area detection (props/terrain blocking the drivable path)
- [x] Extend `validateTrack` beyond "closed loop + enough points" now that terrain/objects
      can make a technically-closed loop undriveable
- [x] Surface new issue types through the existing `TrackStatus`/`PublishDialog` UI (no new
      feedback mechanism needed — Phase 10 already built it)

**Notes:**

- `road-mesh.ts`'s `estimateTurnRadius`/`safeHalfWidth` (the curvature-based narrowing that
  already keeps the visual ribbon/collider from self-intersecting on tight corners, Phase 11)
  are now exported and reused directly by validation, rather than re-deriving a second,
  potentially-inconsistent notion of "too tight."
- `prop-registry.ts` gained `PROP_BLOCKING_RADIUS`: an approximate ground-level footprint
  radius per prop type (trunk radius for a tree, not its canopy — a car's body never reaches
  that high), used only for the new blocking-path check.
- Three new checks in `validate-track.ts`, all composed into `useTrackValidation`
  alongside the existing `validateTrack`/`validateTerrainAlignment`:
  - `validateImpassableCorners`: walks the centerline and flags any sample where
    `safeHalfWidth` has narrowed the road below `MIN_SAFE_WIDTH_FRACTION` (0.35) of its
    requested width — i.e. exactly the corners Phase 11's clamp was quietly papering over
    now surface as a real "fix this" issue instead of a silently-narrower road.
  - `validateObjectsBlockingPath`: for each placed prop, finds the nearest centerline
    sample, projects the prop onto that sample's lateral (right) axis, and flags it if its
    scaled footprint circle spans from past one road edge to past the other. Gated by a
    proximity pre-check so most objects (nowhere near the track) cost one distance
    comparison each, not a full lateral-offset computation.
  - `validateTerrainAlignment` (existing, extended): now samples both road edges in
    addition to the centerline, since a hill sculpted just clear of the centerline can still
    poke up through one side of a wide road.
- Verified in-browser (`/editor/new`): a clean rectangular loop reports "Ready to race";
  collapsing one control point onto its neighbor (via precise Inspector X/Z fields, not
  mouse-drag pixel calibration) triggers `impassable-corner` and clears on undo; placing an
  oversized barrier (scaled up so its footprint radius exceeds the road's half-width)
  triggers `object-blocks-path` and clears on delete. Both new checks correctly ignore
  under-sized objects/mild offsets rather than false-flagging — confirmed by first
  reproducing a *non-trigger* case (a default-scale barrier placed off-center) and
  understanding why the math correctly left it valid before tuning the repro to actually
  span the road. Reran the Phase 12 terrain-mismatch regression script — still passes
  unchanged. Zero console errors throughout.
- **Post-phase fix:** `POST /api/tracks/[slug]/publish` was still only running the original
  `validateTrack` (closed-loop) check server-side — the three new checks only gated the
  client's Publish button, which is UX only, not a security boundary, in a system with no
  auth (§8). Anyone could `fetch` the publish endpoint directly with a valid edit token and
  publish a track with an impassable corner or a road-blocking object. Fixed by running all
  four checks server-side too. Verified with a direct `fetch` bypassing the disabled UI
  button entirely: a broken track now gets a 422 with the correct issue code, a clean track
  still publishes (200) — no regression.

## Milestone 3 — Creator Platform (anonymous, no accounts)

Decision: no login, no email auth, ever — free for everyone, sharing is purely by
link. Deploys to Vercel on a custom domain. See `PROJECT_PLAN.md` §8 (rewritten) for
the reasoning; this replaces the originally-planned `User`/auth/`Follow` scope with an
anonymous-cookie-based equivalent.

### Phase 17 — Track Discovery

- [x] `Track` gains `playCount`, `tags` (richer metadata for browsing)
- [x] Discover page: new / most played sorts (highest-rated sort added in Phase 18,
      once Likes exist to rank by)
- [x] Search by name/description/tags

**Notes:**

- `Track` gained `playCount Int @default(0)` and `tags String[] @default([])`, plus
  `@@index([isPublished, createdAt])`/`@@index([isPublished, playCount])` for the two
  Discover sorts. `TrackDocument.meta.tags` mirrors it in the save format (Zod
  `.default([])` so tracks saved before this field existed still parse with no separate
  migration step) and is denormalized onto the `Track` row at save/publish time exactly
  like `name`/`description` already were.
- `playCount` increments via a new `POST /api/tracks/[slug]/play`, fired once from
  `EditorView`'s existing `?autoplay=1` effect (`editor-view.tsx`) — the one place a
  visitor's actual Play, as opposed to the owner testing their own track from inside the
  editor, is unambiguous. Fire-and-forget; a failed count bump doesn't block the drive.
  No auth to gate it (§8), same trust model as every other anonymous write in this app —
  acceptable for a simple popularity signal, revisit if it's ever abused.
- `/discover` (`app/discover/page.tsx`) is a server component reading `sort`/`q` straight
  from `searchParams` and querying Prisma directly — sort tabs and search are just links/a
  GET form that change the URL (`modules/discover/discover-controls.tsx`), so there's no
  separate client-side data-fetching layer to keep in sync. Search matches name,
  description, or an exact tag (`tags: { has: query }`).
- **Post-phase fix, found while verifying:** a routine DB cleanup (deleting Playwright
  test-artifact tracks, an established practice from Milestone 2) ran a blanket
  `DELETE FROM "Track"` without checking contents first, and wiped the real published demo
  track (`electric-ridge-rvfm`, "Sunny Circuit") along with the test rows. Rebuilt and
  republished it identically via the original `build-demo-complete.mjs` script (new slug
  `azure-delta-thu9`, homepage constant updated). Going forward: always `SELECT` and
  review track rows before any bulk `DELETE`, exactly the same discipline already required
  for `git` destructive operations.
- Verified in-browser: published a track with tags via the Publish dialog's new Tags
  field; confirmed it appears on `/discover` under the default "new" sort with its tag
  chips and difficulty visible; searching by an exact tag finds it, a nonsense query shows
  the empty state, and the "most played" sort loads without error. Confirmed `playCount`
  increments in the database after hitting Play from the public track page (the specific
  in-browser text assertion for "1 play" flaked on timing in the same combined test run,
  but the DB value and a follow-up check both confirmed it renders correctly — not a
  product bug). Zero console errors throughout.

### Phase 18 — Anonymous Engagement

- [ ] Anonymous `viewerId` cookie (distinct from `authorId` — identifies "a browser
      that can vote," not "a browser that can edit")
- [ ] Likes: one per (`viewerId`, track), toggle on/off, no login
- [ ] Discover page gains a highest-rated sort using like counts
- [ ] Comments: freeform display-name field, no login, basic abuse mitigation

### Phase 19 — Creator Pages & Bookmarks

- [ ] Public creator page addressed by `authorId`: lists that browser's published tracks
- [ ] Bookmarks: client-side only (`localStorage`), no server model

### Phase 20 — Production Deploy (Vercel + custom domain)

- [ ] Production Postgres (Vercel Postgres/Neon), env config, migration run
- [ ] OG/share images for track links, sitemap/robots
- [ ] Rate limiting on likes/comments (no auth to gate abuse otherwise)
- [ ] Custom domain wired up, deployed build verified live

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
