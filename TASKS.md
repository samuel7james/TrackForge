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
- [ ] `TrackForgeCanvas` — single persistent `<Canvas>`
- [ ] `SceneRoot` — renders from an (initially empty) `trackStore`
- [ ] `editorStore` with `mode: "edit" | "play"`
- [ ] `EditorCameraRig` (orbit camera to start)
- [ ] Ground plane placeholder (flat, textured) standing in for terrain until Milestone 2

### Phase 3 — Spline Data Model & Road Tool
- [ ] `track-format/schema.ts` — `TrackDocument` v1 types + Zod schema (full shape from plan, only `splines` populated in M1 UI)
- [ ] `modules/spline` — Catmull-Rom sampling, road extrusion → `BufferGeometry`
- [ ] `RoadTool`: click to add control points, drag to move, delete point
- [ ] Live geometry regeneration on edit (no rebuild/reload)
- [ ] Basic road material + curb strip

### Phase 4 — Editor Shell, Commands, Undo/Redo
- [ ] `ToolRegistry` + `EditorEngine` (pointer/keyboard dispatch, no switch statements)
- [ ] `CommandStack` (undo/redo) wired to control-point add/move/delete
- [ ] Floating toolbar UI (Select, Road tools)
- [ ] Inspector panel (selected point: position, width — banking/elevation fields stubbed for Milestone 2)
- [ ] Keyboard shortcuts: `V` select, `G` road tool, `Ctrl+Z` / `Ctrl+Shift+Z`

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
