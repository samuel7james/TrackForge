# TrackForge — Project Plan & Architecture

> Figma for race tracks. The editor is the product; racing exists to validate and enjoy what you build.

This document is the architectural source of truth for TrackForge. It is a living document — update it whenever an architectural decision changes. It should always reflect what the codebase *actually does*, not what it aspires to do (aspirations live in the "Future Expansion" section).

---

## 1. Core Philosophy

```
Create → Publish → Share → Race → Improve → Repeat
```

Every technical decision below is justified against this loop. If a decision doesn't make Create, Publish, Share, or Race better, it's scope creep and it waits for a later milestone.

Two rules shape everything else:

1. **One scene, two modes.** The 3D scene that you edit is the exact scene you drive on. There is no export step, no rebuild, no "compiling the track." Pressing Play swaps *controllers*, not *content*.
2. **Data first, rendering second.** The track is a plain serializable document. The 3D scene is a reactive projection of that document. Tools never touch Three.js objects directly — they dispatch commands that mutate the document, and the renderer reacts. This is what makes undo/redo, autosave, versioning, and (later) multiplayer collaboration possible without three parallel implementations.

---

## 2. Tech Stack & Rationale

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Route handlers double as our API without a separate backend service; React Server Components keep the marketing/discover pages fast while the editor is a fully client-rendered island. The brief specified 15; 16 was the current stable release at scaffold time and is a drop-in superset, so we took it per the "best long-term maintainability" rule rather than pinning to an already-superseded major. |
| UI runtime | React 19 | Required by React Three Fiber's latest major; concurrent features help keep the editor UI responsive while the canvas renders. |
| 3D | Three.js + React Three Fiber + Drei | R3F lets the scene graph be *declarative React*, which pairs naturally with our "scene = projection of state" rule. Drei supplies gizmos, controls, and helpers we'd otherwise hand-roll. |
| Physics | Rapier (via `@react-three/rapier`) | WASM, fast, deterministic enough for ghost replay comparison, only active in Play mode. |
| State | Zustand | Minimal boilerplate, selector-based subscriptions (critical for perf — a control-point drag should not re-render the whole UI), works equally well inside and outside React (tools are plain TS classes, not components). |
| Styling | Tailwind CSS + shadcn/ui | Fast to build a premium, consistent UI; shadcn gives us accessible primitives we own the source of (no black-box component library). Current shadcn generates components on **Base UI** rather than Radix — same team, same headless-primitive philosophy, but the polymorphic-render API is a `render` prop (`<Button render={<Link/>}>`) instead of Radix's `asChild`/`<Slot>`. Worth remembering when writing new components. |
| Motion | Framer Motion | Panel transitions, command palette, toasts. |
| DB | PostgreSQL via Prisma | Relational data (users, tracks, versions, likes) with real relations; Prisma gives typed queries and painless migrations. |
| Hosting | Vercel + Neon | Neon's branching model is a nice conceptual match for "fork a track," serverless Postgres scales to zero for an early-stage product. |

**Deliberately excluded for now:** authentication providers, WebSocket/CRDT infra, object storage/CDN, queues, search infra (Elasticsearch/Algolia). These arrive in the milestone that actually needs them (see §9). Introducing them earlier would be infrastructure for infrastructure's sake.

---

## 3. Folder Structure

```
trackforge/
├── PROJECT_PLAN.md
├── TASKS.md
├── prisma/
│   └── schema.prisma
├── public/
├── src/
│   ├── app/                        # Next.js routes (thin — delegate to modules/server)
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Home / Discover feed
│   │   ├── editor/[trackId]/page.tsx
│   │   ├── t/[slug]/page.tsx         # Public track page (trackforge.app/t/alpine-touge)
│   │   └── api/
│   │       └── tracks/
│   │           ├── route.ts               # POST create
│   │           └── [slug]/route.ts        # GET/PATCH, /publish
│   │
│   ├── modules/                     # Feature-oriented core logic (framework-agnostic where possible)
│   │   ├── track-format/            # THE schema. Versioned, validated, migrated. No UI deps.
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   └── validate.ts
│   │   │
│   │   ├── editor/
│   │   │   ├── core/                # EditorEngine, ToolRegistry, CommandStack (undo/redo)
│   │   │   ├── tools/                # One file per tool (plugin architecture, §5)
│   │   │   │   ├── select-tool.ts
│   │   │   │   ├── road-tool.ts
│   │   │   │   ├── terrain-tool.ts
│   │   │   │   ├── paint-tool.ts
│   │   │   │   ├── object-tool.ts
│   │   │   │   ├── weather-tool.ts
│   │   │   │   └── camera-tool.ts
│   │   │   ├── commands/             # Command objects (AddControlPoint, MoveObject, ...)
│   │   │   └── ui/                   # Toolbar, Inspector, Timeline, CommandPalette
│   │   │
│   │   ├── spline/                  # Pure math: control points → curve → road geometry
│   │   │   ├── catmull-rom.ts
│   │   │   ├── road-mesh.ts
│   │   │   └── road-mesh.worker.ts   # (future) offload for very large tracks
│   │   │
│   │   ├── terrain/                 # Heightfield sculpting + texture splatting
│   │   ├── objects/                  # Placeable prop registry + instancing manager
│   │   ├── scene/                    # Shared R3F scene composed from the document (editor & race both mount this)
│   │   │
│   │   ├── race/
│   │   │   ├── vehicle/              # Vehicle controller (input → forces)
│   │   │   ├── physics/              # Rapier world setup, collider generation from road mesh
│   │   │   ├── timing/               # Lap/sector timing, checkpoint sequencing
│   │   │   └── ghost/                 # Replay recording/playback (Milestone 4)
│   │   │
│   │   └── collaboration/            # Stubbed interface only until Milestone 5 (§9)
│   │
│   ├── components/                   # Cross-cutting shadcn/ui-based components
│   ├── store/                        # Zustand stores (trackStore, editorStore, raceStore, uiStore)
│   ├── server/                       # Route handler business logic, Prisma access, slug generation
│   ├── lib/                          # Generic utilities (auth stub, cn(), id generation)
│   └── types/
└── ...config files
```

**Why `modules/` instead of the typical `features/`:** most of these modules (`track-format`, `spline`, `terrain`) have zero React dependency and are unit-testable in isolation. Keeping them out of `components/` and `app/` makes that boundary explicit and stops UI concerns leaking into geometry math.

---

## 4. Rendering Architecture — "One Scene, Two Modes"

A single `<Canvas>` is mounted once per editor session and never unmounts between editing and driving. This is the mechanism behind the "no loading screen" Play button.

```
<TrackForgeCanvas>                     (mounted once)
  <SceneRoot>                          (reads trackStore, renders splines/terrain/objects)
  <ModeController>                      switches on editorStore.mode:
      mode === "edit"  → <EditorCameraRig/> + <GizmoOverlay/> + tool raycasting
      mode === "play"  → <RaceCameraRig/> + <PhysicsWorld> + <VehicleController/>
</TrackForgeCanvas>
```

- `SceneRoot` has no idea whether it's being edited or raced — it just renders geometry derived from the document. This guarantees Play mode literally cannot show something different from what you edited.
- Switching modes toggles which camera rig and controller subtree is mounted (React swaps a handful of leaf components), and activates/deactivates the Rapier physics step. It does **not** touch `SceneRoot` or reload the document.
- Road, terrain, and object meshes are memoized against the document's relevant slice (via Zustand selectors + `useMemo`), so editing a spline only regenerates that spline's geometry, not the whole track.

### Geometry generation pipeline

```
ControlPoint[] → CatmullRomSpline → sampled centerline (position + tangent + up)
                                        │
                                        ├─→ extrude by width/banking → road BufferGeometry
                                        ├─→ offset curbs → curb BufferGeometry
                                        └─→ project onto terrain heightfield (elevation)
```

This is a pure function chain (`ControlPoint[] → BufferGeometry`), which is what makes three things possible later without rearchitecting:
- Moving it into a Web Worker if profiling shows main-thread jank on large tracks.
- Deterministic collider generation for physics (same function, different consumer).
- Collaborative editing (the function is a pure reducer — perfect for CRDT replay).

---

## 5. Editor Architecture — Plugin Tool System

The brief explicitly calls for no giant switch statements and composition over inheritance. The design:

```typescript
interface EditorTool {
  id: string;
  label: string;
  icon: ComponentType;
  shortcut?: string;
  onActivate(ctx: ToolContext): void;
  onDeactivate(ctx: ToolContext): void;
  onPointerDown?(e: ToolPointerEvent, ctx: ToolContext): void;
  onPointerMove?(e: ToolPointerEvent, ctx: ToolContext): void;
  onPointerUp?(e: ToolPointerEvent, ctx: ToolContext): void;
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): void;
  renderOverlay?(ctx: ToolContext): ReactNode;   // gizmos, previews, guides
}
```

- Tools are registered into a `ToolRegistry` (an array + Map, not a switch). Adding "Paint Tool" means adding `paint-tool.ts` and one line in the registry — zero edits to existing tools.
- `EditorEngine` owns exactly one active tool at a time and forwards raw pointer/keyboard events from the canvas to it. It has no knowledge of what any individual tool does.
- **Tools never mutate state directly.** A tool's pointer handler constructs a `Command` (e.g. `MoveControlPointCommand`) and pushes it through the `CommandStack`. The stack applies it to `trackStore` and records its inverse. This single mechanism gives us:
  - Undo/Redo (pop stack, apply inverse)
  - A natural seam for collaboration later (commands are the unit that would sync across clients)
  - Autosave (subscribe to "command applied" instead of diffing state)
- Selection is a cross-cutting concern owned by `editorStore`, not by any one tool, so Select, Object, and Terrain tools all share one selection model (needed for multi-select/grouping).

---

## 6. State Management

Four Zustand stores, deliberately separated by lifecycle and update frequency:

| Store | Contains | Update frequency |
|---|---|---|
| `trackStore` | The `TrackDocument` — splines, terrain, objects, environment, validation. The only store that gets serialized/saved. | Medium (per edit, via commands) |
| `editorStore` | Active tool, selection, camera mode, gizmo mode, editor mode (`edit`\|`play`) | Medium |
| `raceStore` | Live lap/sector timers, input state, ghost data | High (every frame while racing) — kept separate so a 60fps timer update never re-renders editor panels |
| `uiStore` | Panel visibility, command palette, modals, toasts | Low |

`trackStore` is the only one that round-trips to the save format 1:1, which keeps serialization trivial: `serialize(trackStore.getState()) → TrackDocument JSON`.

---

## 7. Data Model — Track Document (Save Format)

Versioned, portable JSON. TypeScript source of truth in `modules/track-format/schema.ts`, Zod-validated.

```typescript
interface TrackDocument {
  formatVersion: 1;
  meta: {
    id: string;
    slug: string;
    name: string;
    description: string;
    authorId: string;
    difficulty: "beginner" | "intermediate" | "advanced" | "expert";
    estimatedLapTimeMs: number | null;
    createdAt: string;
    updatedAt: string;
  };
  environment: {
    weather: "sunny" | "sunset" | "night" | "rain" | "snow" | "fog" | "cloudy";
    timeOfDay: number;       // 0–24, drives sun angle
    fogDensity: number;
  };
  splines: RoadSpline[];
  terrain: TerrainData;
  objects: PlacedObject[];
  checkpoints: Checkpoint[];
  startLine: { position: Vec3; rotation: Quat };
  validation: {
    isValid: boolean;
    issues: ValidationIssue[];
    validatedAt: string | null;
  };
}

interface RoadSpline {
  id: string;
  closed: boolean;
  points: {
    id: string;
    position: Vec3;
    tangentIn: Vec3;
    tangentOut: Vec3;
    width: number;
    banking: number;
    elevation: number;
  }[];
}

interface TerrainData {
  size: { width: number; depth: number };
  resolution: number;
  heightmap: number[];              // flattened, row-major
  textureLayers: { type: "grass"|"sand"|"rock"|"dirt"|"snow"; weightmap: number[] }[];
}

interface PlacedObject {
  id: string;
  type: string;                     // registry key, e.g. "tree_pine_01"
  position: Vec3; rotation: Quat; scale: Vec3;
  groupId: string | null;
}
```

**Why `formatVersion` from day one:** the brief explicitly requires the save format stay "versionable and extensible." Every load path runs the document through `migrations/` (a simple ordered array of `v(n) → v(n+1)` transforms) before it touches the store. Adding a field later is additive; changing semantics of an existing field requires a migration function, never a silent break of old tracks.

**Why Zod validation at the boundary:** the document crosses a trust boundary (client → API → DB → client). Validating on read/write means a malformed or hand-edited JSON can't corrupt the store or crash the renderer.

### Database schema (Prisma, Milestone 1 subset)

```prisma
model Track {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String   @default("")
  authorId    String
  editToken   String   // bearer secret for anonymous edit rights (see §8)
  document    Json      // current TrackDocument
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  versions    TrackVersion[]
}

model TrackVersion {
  id        String   @id @default(cuid())
  trackId   String
  track     Track    @relation(fields: [trackId], references: [id])
  document  Json
  createdAt DateTime @default(now())

  @@index([trackId])
}
```

`TrackVersion` is included in the schema now (empty table until Milestone 3/version-history work) because retrofitting version history onto a table with no history trail later would require a backfill; capturing one row per save from day one is free.

---

## 8. Auth — Deliberately Permanent, Not Deferred

**Decision (as of Milestone 3 planning): TrackForge has no login, no accounts, no email auth, ever.** It's free for everyone; sharing happens purely via URL. This was originally scoped as "deferred to Milestone 3" (see git history for the earlier version of this section), but the project owner chose to keep the anonymous/link-sharing model permanently rather than add a `User` model — so the scheme below is the permanent design, not a stopgap:

- On first save, the server generates a random `editToken` and returns it once. The client stores it in `localStorage` keyed by track id.
- `PATCH /api/tracks/[slug]` requires the token (header) to match.
- `authorId` is a stable anonymous client id (generated client-side, stored in a cookie) — it identifies "the browser that made this," never a real identity. It's reused, unchanged, as the join key for creator pages (§11) and as the basis for a separate anonymous `viewerId` cookie that gates one-like-per-browser voting.
- Anything that would normally require login — profiles, following, saved tracks — is instead built either as a page addressed by `authorId` (a "creator page," no login needed to view or to *be* one) or as purely client-side state (bookmarks live in `localStorage`, not the database, since there's no account to sync them to).

This keeps the trust model identical to Milestone 1's: whoever holds the token/cookie can act as that identity, and clearing cookies means starting over as a new anonymous author. That trade-off is accepted deliberately in exchange for zero signup friction.

---

## 9. Performance Strategy

| Concern | Strategy |
|---|---|
| Road regeneration during drag | Recompute only the edited spline's geometry (keyed `useMemo` per spline id), not the full track. |
| Repeated props (trees, barriers, cones) | `InstancedMesh` grouped by object `type`; the object module maintains one instanced buffer per registry key. |
| Large terrain | Heightfield rendered as a single geometry now; chunking/LOD deferred until a track exceeds a measured frame-time budget (avoid premature complexity). |
| Off-screen geometry | Three.js default frustum culling; revisit manual culling only if profiling shows it's insufficient. |
| Heavy pure computation (spline sampling) | Isolated in `modules/spline` with no React/Zustand imports specifically so it can move into a Web Worker later without touching call sites. |
| Editor responsiveness under React | Zustand selectors scoped tightly (e.g. a control-point drag subscribes only to that point, not the whole `splines` array) so dragging doesn't re-render unrelated panels. |

Target: 60fps in editor with a track of ~50 spline points, ~500 placed objects, on mid-range hardware. Re-benchmark at the end of Milestone 2 when terrain + objects are both live.

---

## 10. Instant Play Mode — Implementation Note

Because of §4's single-scene design, "Play" is:
1. Validate the track (checkpoints reachable, closed loop) — reuses the same validator that gates Publishing.
2. Generate (or reuse cached) Rapier colliders from the current road/terrain geometry.
3. Set `editorStore.mode = "play"`, mount `<VehicleController>` at the start line, swap camera rig.
4. `ESC` reverses step 3 exactly — no teardown of the scene itself.

No serialization round-trip happens when entering Play. This is the direct payoff of "data first, rendering second."

---

## 11. Future Expansion Plan (Milestones 2–5)

The architecture above is chosen specifically so these don't require rewrites:

- **Milestone 2 (Terrain/Objects/Weather/Camera/Validation):** all additive tools in the existing plugin registry; terrain and objects already have first-class slots in `TrackDocument`.
- **Milestone 3 (Creator platform, anonymous):** additive Prisma models (`Like`, `Comment`) plus new routes/pages — deliberately no `User`/`Follow` model (§8: no accounts, ever). Discovery, likes, and comments all key off the existing anonymous `authorId`/new anonymous `viewerId` cookie; bookmarks are client-side only (`localStorage`, no server model needed since there's no account to sync to). Deploys to Vercel on a custom domain.
- **Milestone 4 (Ghost racing/leaderboards):** `race/ghost` records `{position, rotation, speed, steering, throttle, brake}` samples at a fixed tick rate during Play mode — this is just another consumer of the existing vehicle controller's per-frame state, plus new `Replay`/`LapTime` Prisma models.
- **Milestone 5 (Live collaboration):** the Command pattern (§5) is the seam. A `RemoteCommandTransport` will broadcast commands through a WebSocket/CRDT layer (likely Yjs) instead of only pushing to the local `CommandStack`. Because tools already never mutate state directly, no tool code changes — only `CommandStack` gains a network-aware backend. `collaboration/` exists today as an empty module specifically to hold this without restructuring `editor/core` later.

---

## 12. Design Language

Dark-first, Figma/Linear/Trackmania-inspired: minimal chrome, generous canvas space, a floating left toolbar (tools), right inspector panel (contextual properties of selection), bottom timeline (future: version history), and a `Cmd+K` command palette for everything else. Keyboard shortcuts mirror industry-standard conventions (V select, G road/grab, Z undo) so the tool feels familiar on first touch.

---

## 13. Non-Goals for Milestone 1

Explicitly out of scope until later milestones, to keep the vertical slice honest:
- Terrain sculpting, object placement, weather/lighting variety (Milestone 2)
- Profiles, discovery feed, likes/comments (Milestone 3)
- Ghost racing, leaderboards (Milestone 4)
- Any multiplayer/collaboration (Milestone 5)

Milestone 1's track is: a single road spline, flat ground plane, one car, one lap timer, save/load, publish to a URL.
