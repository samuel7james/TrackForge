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
- [ ] Auto-generate start/finish line from spline start
- [ ] Auto-generate checkpoints along spline at intervals
- [ ] Validator: closed loop, checkpoints reachable/ordered
- [ ] Validation surfaced in UI (blocks Play/Publish when invalid, explains why)

### Phase 6 — Instant Play Mode
- [ ] Rapier physics world, activated only in `mode === "play"`
- [ ] Collider generation from road geometry (reuse spline pipeline output)
- [ ] Vehicle controller (keyboard input → throttle/brake/steer forces), tuned for Mr.doob-Starter-Kit-like feel
- [ ] `RaceCameraRig` (chase cam)
- [ ] Play/ESC toggle — verify zero reload, zero flash, sub-frame transition

### Phase 7 — Lap Timing
- [ ] Checkpoint-order tracking, lap start/finish detection
- [ ] `raceStore`: current lap time, sector splits, last lap, best lap (session-only for M1)
- [ ] HUD overlay during Play mode

### Phase 8 — Persistence
- [ ] `POST /api/tracks` — create + return `{ id, editToken }`
- [ ] `PATCH /api/tracks/[slug]` — save document (editToken-guarded)
- [ ] `GET /api/tracks/[slug]` — load document
- [ ] Client: autosave-on-command-batch + explicit "Save" action; editToken persisted in localStorage
- [ ] Reload flow: open `/editor/[slug]` → document loads → identical scene reconstructed

### Phase 9 — Publishing & Sharing
- [ ] Slug generation (human-readable, unique) on publish
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
