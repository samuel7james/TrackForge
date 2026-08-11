# Accounts — implementation brief

**This document is written to be handed to a coding agent.** Point Claude Code at
this file and it should be able to start work without further context.

Status: **approved in principle, not implemented.** Phases 0–2 may proceed
without further sign-off. **Phase 3 is a one-way door and requires explicit
human approval before starting** (see §9).

---

## 0. How to use this document

1. Read §1–§3 for context and the decision. Do not re-derive it.
2. Run §2 to get a working environment.
3. Work the phases in §7 **in order**. Each has explicit acceptance criteria.
4. §5 is a list of things that will break if you do them. Read it before
   writing code, not after.
5. §9 holds decisions already made on the author's behalf. Follow them unless
   this file says otherwise.

Do not skip ahead to the login form. The risky parts of this work are the data
migration and the identity seam, not authentication itself.

---

## 1. Context

TrackForge is a Next.js 16 / React 19 / Prisma / Postgres browser racing game.
Users build tracks in a 3D editor, publish them, and race for lap records.
It is **live at trackforge.samueljames.dev** (Vercel + Neon Postgres) with real
user data. Treat production data as sacred.

### Current identity model (what you are replacing)

There are no accounts. Identity is two cookies minted per browser:

| Cookie | Set by | Keys |
| --- | --- | --- |
| `trackforge-viewer-id` | `src/proxy.ts`, on every request | `Like.viewerId`, `LapRecord.viewerId`, `DisplayName.viewerId` |
| `trackforge-author-id` | `POST /api/tracks` only | `Track.authorId` |

`DisplayName` maps one `viewerId` to one globally-unique name. Track edit
permission is a per-track bearer secret, `Track.editToken`, held in
`localStorage`.

23 files reference `viewerId` / `authorId` / `editToken`. Find them with:

```bash
rg 'viewerId|authorId|editToken|VIEWER_ID_COOKIE|AUTHOR_ID_COOKIE' src/
```

### The defect being fixed

`DisplayName.name` is globally `@unique` and bound 1:1 to a `viewerId`. So a
player who races on desktop as `Samuel`, then opens the site on their phone,
gets **409 "That name is already taken"** from
`src/app/api/display-names/claim/route.ts` — taken by themselves. They are
forced into `Samuel2` and become two racers on every leaderboard, permanently.

The model does not merely fail to sync across devices; it forbids a player from
being themselves on a second device, and corrupts leaderboards as a result.

Secondary problems from the same root: one-time visitors permanently squat names
in a global namespace; clearing cookies orphans rows nobody can ever reclaim;
"banning" someone is defeated by clearing a cookie.

### What this will NOT fix — do not claim otherwise

Row count, for engaged players. 40 personal bests is still 40 rows. This work
improves data *quality* (one row per human, not per browser), not volume.

The larger storage lever is `TrackVersion`, which writes a full document JSON
blob on **every save** with no product feature consuming it. **Out of scope.**
Do not touch it as part of this work.

---

## 2. Environment setup

Verified working on Windows 11 with PowerShell. Adapt paths for other platforms.

### Prerequisites

Node.js LTS (24.x), Docker Desktop, Git. On Windows via winget:

```powershell
winget install --id OpenJS.NodeJS.LTS --source winget --silent --accept-package-agreements
```

Node must be on `PATH`; open a fresh shell after installing.

### Bootstrap

```bash
npm ci                      # runs `prisma generate` via postinstall
cp .env.example .env         # then edit — see below
docker compose up -d         # Postgres 16 on localhost:5432
npx prisma migrate deploy    # applies all migrations
npm run dev                  # http://localhost:3000
```

`.env` needs a real `ADMIN_SESSION_SECRET` — it signs admin sessions **and**,
via a derived subkey, lap-session tokens (`src/lib/lap-session.ts`). Generate:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `DATABASE_URL` / `DIRECT_URL` defaults in `.env.example` already match the
docker-compose container. Locally both are the same value; in production
`DATABASE_URL` is pooled and `DIRECT_URL` is not.

### Verification commands

```bash
npx tsc --noEmit      # type check
npm run lint          # eslint
npx prisma migrate dev --name <name>   # create a migration
npm run build         # runs `prisma migrate deploy && next build`
```

Run `tsc --noEmit` and `npm run lint` before considering any phase complete.
There is **no test suite** — verification is type check, lint, and driving the
actual app.

### Repo conventions

- Comments are unusually dense and explain *why*, often citing the specific bug
  a line prevents. Match that style; it is deliberate house style, not clutter.
- Comments use `--` as an aside dash, not em dashes.
- Commit locally. **Do not push** unless explicitly asked.

---

## 3. The decision

> **Anyone can drive. Only accounts write.**

| Action | Account required? |
| --- | --- |
| View `/discover`, `/t/[slug]`, a creator page | No |
| Drive or test any track, including via a shared link | **No** |
| Drive the daily challenge | **No** |
| Submit a lap time to a leaderboard | Yes |
| Like, comment | Yes |
| Create, save, publish, edit a track | Yes |

Two consequences to preserve:

**An anonymous visitor writes nothing to the database.** No `viewerId`, no
`DisplayName` row, no `LapRecord`. This is what eliminates the clutter at
source rather than cleaning up after it.

**Shared links keep working exactly as today.** A stranger clicking a track link
gets into the car immediately. The sitemap, `robots.txt`, and per-track OG image
work must stay effective. **Do not put a login wall at `/` or on `/t/[slug]`.**

The auth gate lands where `DisplayNameGate` already sits — in place of the
engine in `src/modules/editor/track-editor.tsx`. You are adding a field to an
existing wall, not building a new one.

### Rejected alternative — do not resurrect

An earlier design kept anonymous writes and added a `getRacerId()` indirection
resolving browser identity to an account principal. Rejected: its only purpose
was reconciling anonymous writes with account writes, and if anonymous users
never write there is nothing to reconcile. It would also keep the cross-device
merge problem forever instead of ending it.

This is a **replacement**, not a layer. Things get deleted — see §6.

---

## 4. Target schema

Additive first. No column is dropped before Phase 5.

```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique          // IS the display name
  email        String?  @unique
  passwordHash String
  createdAt    DateTime @default(now())

  sessions   Session[]
  tracks     Track[]
  lapRecords LapRecord[]
  likes      Like[]
  comments   Comment[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique   // store the hash, never the token
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

`username` doubles as display name, so `DisplayName` collapses into `User`
entirely — one unique-name concept, not two kept in sync.

Changes to existing models, **all nullable during migration**:

```prisma
model Track {
  ownerId  String?   // → User.id. Nullable until legacy tracks are claimed.
  authorId String    // RETAINED until Phase 5.
  editToken String   // RETAINED PERMANENTLY -- legacy claim path.
}

model LapRecord {
  userId      String?  // → User.id
  viewerId    String   // RETAINED until Phase 5
  displayName String   // RETAINED until Phase 5, then dropped (becomes a join)
  // Target constraint: @@unique([trackId, userId])
}

model Like    { userId String? }
model Comment { userId String? }   // Comment has NO identity column today
```

Sessions are **database-backed, not stateless.** `src/lib/admin-auth.ts` uses a
signed stateless token — correct for one hardcoded operator, wrong for N users.
You need logout, per-session revocation, and the ability to kill a stolen
cookie. Do not copy the admin pattern for user sessions.

Password hashing: argon2id (`@node-rs/argon2`), or `bcryptjs` if a native
dependency causes problems on Vercel. **Never** hand-roll password hashing.

---

## 5. Traps — read before writing code

Each of these was found in the current codebase and will cost you real time.

### 5.1 `authorId` is inside the document JSON, not just a column

`src/modules/track-format/schema.ts` puts `authorId` in `metaSchema`, which is
part of the persisted `TrackDocument`. It is embedded in `Track.document` **and
in every `TrackVersion.document` row ever written.**

Repurposing it is a document-format migration, not a column rename.

**Do:** leave `meta.authorId` frozen as a historical field. Put ownership solely
on the `Track.ownerId` column.
**Do not:** keep the JSON copy in sync. That is precisely how the
`LapRecord.displayName` staleness problem was created.

### 5.2 `viewerId` and `authorId` are separate cookies with no stored link

Stated explicitly in `src/app/api/admin/players/[id]/route.ts`. A user who both
raced and created tracks must have **both** claimed in a single step while both
cookies are present, or their track ownership is silently stranded with no way
to recover it.

This is the subtlest failure mode in the whole migration. Get it right in
Phase 2.

### 5.3 Do not put auth in middleware

`src/proxy.ts` runs on the Edge runtime. Session verification needs a database
lookup and Prisma on Edge is a problem. Check sessions inside Route Handlers and
Server Components (Node runtime). This is a further argument for deleting
`proxy.ts` outright rather than repurposing it.

### 5.4 Lap session tokens are bound to identity

`src/lib/lap-session.ts` signs `slug|viewerId|issuedAt|nonce`. Swapping to
`userId` is mechanical, but creates a new case: a user who **logs in mid-race**
changes identity, so their token fails verification and the lap is rejected.

Resolution: refuse to open the login UI while the engine is running. Less
surprising to the player than silently voiding their lap.

### 5.5 Anonymous drivers still need rate limiting

Limiters currently key on `viewerId`. Anonymous drivers have no account, so any
endpoint still reachable by them must fall back to IP via `rateLimitKey` /
`src/lib/client-ip.ts` — the pattern `POST /api/tracks` already uses.

`POST /api/tracks/[slug]/session` stays open to anonymous drivers and **must**
be IP-keyed.

### 5.6 Caching

`src/app/api/tracks/[slug]/leaderboard/route.ts` already documents that its
response varies per viewer and must never be shared-cached. A session cookie has
the same property. Apply the same treatment to any new authenticated endpoint.

### 5.7 The daily challenge has a synthetic author

`src/server/daily-challenge.ts` writes its generated track with
`authorId: "system"` and a throwaway `editToken`. Create a reserved system
`User` row for it; make `/racer/system` 404.

### 5.8 `Comment` has no identity column

It stores only `displayName`, and the admin player-delete flow deletes comments
by **matching the name string**. Add `Comment.userId` going forward, but **do
not** retroactively attribute old comments by name match — that is exactly the
unsafe thing being replaced. Legacy comments keep `displayName` with a null
`userId`.

### 5.9 Registration is cheaper than clearing cookies

Faking a second identity today means clearing cookies; with open registration
it is a form submit. IP-rate-limit registration.

### 5.10 Comments across the repo assert "no accounts, ever"

That rationale is documented in ~12 places and is load-bearing — it explains why
things are shaped as they are. Leaving it will badly mislead the next reader.
Rewrite as you go: `prisma/schema.prisma` (5+ blocks),
`display-name-gate.tsx`, `my-tracks/page.tsx`, `creator/[authorId]/page.tsx`,
`like/route.ts`, `admin-auth.ts`, `anonymous-id.ts`.

---

## 6. File-level impact

### To be deleted (Phase 5)

| File | Why |
| --- | --- |
| `src/proxy.ts` | Its only job is minting the viewer cookie early enough for Server Components to read. Session cookies need no priming — the whole middleware hop goes. |
| `src/lib/anonymous-id.ts` | No anonymous identity to mint. |
| `src/lib/anonymous-id-cookies.ts` | Same. |
| `src/modules/game-engine/display-name-storage.ts` | Name comes from the session, not `localStorage`. |
| `src/app/api/display-names/claim/route.ts` | Name claiming becomes registration. |

### To be created

| File | Purpose |
| --- | --- |
| `src/lib/auth/password.ts` | argon2id hash/verify |
| `src/lib/auth/session.ts` | create / verify / revoke, DB-backed |
| `src/lib/auth/current-user.ts` | `getCurrentUser()`, `requireUser()` |
| `src/app/api/auth/{register,login,logout}/route.ts` | |
| `src/app/api/auth/claim-legacy/route.ts` | §7 Phase 2 |
| `src/app/(auth)/{login,register}/page.tsx` | |
| `src/modules/game-engine/auth-gate.tsx` | Replaces `DisplayNameGate` |

### Write paths — must 401 without a session (Phase 3)

`api/tracks/[slug]/laptimes`, `.../like`, `.../comments`, `api/tracks` (create),
`api/tracks/[slug]` (PATCH), `.../publish`, `.../session`.

`laptimes/route.ts` gets simpler: the `DisplayName` lookup and its
`NEEDS_DISPLAY_NAME` 401 branch both disappear — the session already carries an
authoritative username.

### Read paths — identity optional, drives "this is me" highlighting (Phase 4)

`app/t/[slug]/page.tsx`, `app/challenge/page.tsx`,
`api/tracks/[slug]/leaderboard/route.ts`, `app/my-tracks/page.tsx`,
`app/creator/[authorId]/page.tsx` → becomes `/racer/[username]`.

### Admin (Phase 4)

`app/admin/(dashboard)/page.tsx` loses its manual `groupBy` + `Map` join over
bare `viewerId`s (it exists only because there is nothing to join to) and
becomes a real relation. `api/admin/players/[id]/route.ts` becomes an FK cascade
instead of hand-written `deleteMany` calls across three tables plus a name match.

### Effectively unchanged

`lib/lap-session.ts` (parameter rename only), `lib/rate-limit.ts`,
`lib/client-ip.ts`, `lib/admin-auth.ts` (stays a separate operator identity).

---

## 7. Phases

Work in order. Commit at each phase boundary. Do not start a phase until the
previous one type-checks and lints clean.

### Phase 0 — additive schema

- [ ] Add `User` and `Session` models per §4
- [ ] Add nullable `Track.ownerId`, `LapRecord.userId`, `Like.userId`,
      `Comment.userId`
- [ ] `npx prisma migrate dev --name accounts_additive`

**Done when:** migration applies cleanly, `tsc --noEmit` and lint pass, and the
app behaves identically to before. No existing code reads the new columns yet.

### Phase 1 — auth primitives

- [ ] `src/lib/auth/password.ts` — argon2id
- [ ] `src/lib/auth/session.ts` — DB-backed create/verify/revoke; store
      `tokenHash`, never the raw token; `httpOnly`, `sameSite: lax`, `secure` in
      production
- [ ] `src/lib/auth/current-user.ts` — `getCurrentUser()` / `requireUser()`
- [ ] `POST /api/auth/register`, `/login`, `/logout`; IP-rate-limited
- [ ] `/login` and `/register` pages
- [ ] Registration rejects usernames already held in `DisplayName`

**Done when:** you can register, log in, log out, and the session survives a
restart. **Nothing else in the app is enforced yet** — existing anonymous flows
must still work end to end.

### Phase 2 — legacy claim

See §8 for the full flow. This is where §5.2 will bite.

- [ ] Backfill one `User` per `DisplayName` row (username taken, no password,
      login disabled)
- [ ] `POST /api/auth/claim-legacy` — reads **both** cookies, verifies against
      `DisplayName.viewerId` and `Track.authorId`, sets `passwordHash`, and
      backfills `LapRecord.userId`, `Like.userId`, `Track.ownerId` in **one
      transaction**
- [ ] UI prompt on next visit for a recognized browser
- [ ] Copy stating plainly that a cleared-cookie browser cannot claim

**Done when:** a browser holding pre-existing cookies can set a password and see
all its records and tracks under the new account, and a browser without them
sees a truthful explanation rather than a silent failure.

### Phase 3 — cutover ⚠️ REQUIRES HUMAN APPROVAL

**Do not begin without explicit sign-off.** This is the one-way door.

- [ ] Write paths require a session (401 otherwise) — see §6
- [ ] `auth-gate.tsx` replaces `DisplayNameGate` in `track-editor.tsx`
- [ ] Anonymous drivers can still drive and still get a lap session token
      (IP-rate-limited, §5.5) — they simply cannot submit
- [ ] Show anonymous drivers what they are missing (§9.4)
- [ ] Refuse login while the engine is running (§5.4)

**Done when:** an anonymous visitor can complete a lap via a shared link and is
invited to sign up to save it; a logged-in user's time appears on the
leaderboard from any device.

### Phase 4 — reads, profiles, admin

- [ ] Read paths resolve identity from session (§6)
- [ ] `/creator/[authorId]` → `/racer/[username]`, with redirects from old URLs
- [ ] Admin dashboard and player-delete use real relations
- [ ] Reserved system user for the daily challenge (§5.7)

**Done when:** leaderboards highlight the logged-in user across devices and the
admin dashboard no longer hand-joins on `viewerId`.

### Phase 5 — remove the old model

- [ ] Drop `LapRecord.viewerId`, `LapRecord.displayName`, `Like.viewerId`,
      `Track.authorId`, and the `DisplayName` model
- [ ] Delete the files listed in §6
- [ ] Make `Track.ownerId` and `LapRecord.userId` non-nullable
- [ ] Finish the comment rewrite (§5.10)

**Done when:** `rg 'viewerId|AUTHOR_ID_COOKIE' src/` returns nothing.

### Phase 6 — email

- [ ] Email verification and password reset via Resend or Postmark

Not optional long-term — see §9.1.

---

## 8. Claiming existing data

**The existing cookie is the proof of ownership.** A browser that raced before
still holds `trackforge-viewer-id`, and that is exactly the credential the old
system trusted. No email round-trip, no name collisions, no merge dialog.

1. Backfill one `User` per existing `DisplayName` row — username taken, no
   password, login disabled.
2. On next visit, read the cookie, match the `DisplayName` row, and offer:
   *"You're `Samuel`. Set a password to keep your 12 records and 3 tracks on any
   device."*
3. On success, in one transaction: set `passwordHash`; backfill
   `LapRecord.userId` and `Like.userId` for that `viewerId`; backfill
   `Track.ownerId` for that `authorId`.

**Both cookies must be handled in that single step** (§5.2), or track ownership
is stranded unrecoverably.

### The unavoidable cost

Anyone who cleared cookies, or who wants to claim from a device they never raced
on, **cannot claim their history**. Those rows remain as unclaimable legacy
entries.

There is no way around this — it is the bill for having been anonymous. State it
in the UI; do not let users discover it.

Unclaimed rows are **kept, not purged** (§9.5).

---

## 9. Decisions already made

Adopted on the author's behalf so work is not blocked. Override by editing this
file; do not re-litigate in conversation.

1. **Email is optional at signup, required before publishing a track.** Keeps
   signup friction near zero while ensuring anyone with public content is
   recoverable. Makes Phase 6 mandatory, not optional.
2. **`username` is renameable**, rate-limited, old name released on change.
   Must handle the unique constraint and any cached leaderboard renders.
3. **Hand-roll auth. Do not add Auth.js/NextAuth.** ~300 lines, fits this
   codebase's existing hand-rolled-HMAC style. Revisit only if OAuth becomes a
   requirement — at which point Auth.js v5 is the right call and this decision
   should be reopened deliberately.
4. **Show anonymous drivers what they are missing** — e.g. *"Your 42.1s would
   have ranked #4 — sign up to save it."* Strong conversion mechanic, small
   surface. Build it in Phase 3.
5. **Unclaimed legacy rows are kept forever** as ghost leaderboard entries.
   Deleting real lap times to tidy a table is a bad trade.

### Still requires the human

- **Phase 3 sign-off.** The cutover is irreversible for live users.
- **Production migration timing**, and whether to snapshot the Neon database
  first. Recommended: yes.

---

## 10. If you are picking this up cold

Start at §2, get the app running, then read `prisma/schema.prisma` and
`src/lib/anonymous-id.ts` — between them they explain the entire current
identity model in about 200 lines of heavily-commented code.

Then begin Phase 0. It is purely additive and changes no behavior, so it is
safe to complete and commit before any of the harder judgment calls land.
