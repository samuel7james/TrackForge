import { createHmac, randomBytes } from "node:crypto";
import { timingSafeStringEqual } from "./timing-safe-compare";

// A signed marker that a race actually started, issued when the engine
// boots and handed back with the lap time.
//
// The point is to tie a claimed lap to elapsed wall-clock time on the
// server's own clock: a four-second lap can't be reported by a session
// that opened one second ago, no matter what the client says. That's the
// part a request forged in Postman can't fake without actually waiting,
// and it costs nothing to a real player, whose session necessarily opened
// before their lap finished.
//
// Not a replacement for the plausibility floor (lap-time-bounds.ts) --
// waiting is cheap, so this bounds *when* a time can be claimed while the
// floor bounds *what* can be claimed. Neither proves the lap was driven;
// only validating a full recorded ghost trace server-side would, which is
// a much larger piece of work.

const MAX_SESSION_AGE_MS = 6 * 60 * 60 * 1000;
/** Covers the round trip between the server stamping the token and the
 * client's lap timer starting. Both timestamps come from the server's own
 * clock, so there's no device-clock skew to absorb here, only latency. */
const ELAPSED_SLACK_MS = 1500;

// Derived from the admin secret rather than read directly, so a lap
// session token and an admin session token are signed with different keys
// and neither can ever be presented as the other.
function signingKey(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  return createHmac("sha256", secret).update("lap-session-v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

export function createLapSessionToken(slug: string, viewerId: string): string {
  const issuedAt = Date.now();
  const nonce = randomBytes(8).toString("hex");
  const signature = sign(`${slug}|${viewerId}|${issuedAt}|${nonce}`);
  return `${issuedAt}.${nonce}.${signature}`;
}

export interface LapSessionCheck {
  ok: boolean;
  /** Milliseconds since the session was opened, per the server's clock. */
  elapsedMs: number;
}

// Bound to both the track and the viewer, so a token opened on an easy
// track (or in someone else's browser) can't be spent on another one.
export function verifyLapSessionToken(
  token: string | null | undefined,
  slug: string,
  viewerId: string
): LapSessionCheck {
  const fail = { ok: false, elapsedMs: 0 };
  if (!token) return fail;

  const parts = token.split(".");
  if (parts.length !== 3) return fail;
  const [issuedAtRaw, nonce, signature] = parts;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return fail;

  let expected: string;
  try {
    expected = sign(`${slug}|${viewerId}|${issuedAt}|${nonce}`);
  } catch {
    // Secret missing in this environment -- fail closed rather than 500.
    return fail;
  }
  if (!timingSafeStringEqual(signature, expected)) return fail;

  const elapsedMs = Date.now() - issuedAt;
  // A negative age means a token stamped in the future, which our own
  // signer never produces.
  if (elapsedMs < 0 || elapsedMs > MAX_SESSION_AGE_MS) return fail;

  return { ok: true, elapsedMs };
}

/** The lap can't have taken longer than the session has been open. */
export function isElapsedConsistent(timeMs: number, elapsedMs: number): boolean {
  return timeMs <= elapsedMs + ELAPSED_SLACK_MS;
}
