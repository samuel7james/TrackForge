import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export { AUTHOR_ID_COOKIE, VIEWER_ID_COOKIE } from "./anonymous-id-cookies";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// A stable per-browser id, not a secret -- unlike editToken it grants no
// permission by itself (ownership is still gated by editToken per-track), it
// only ever answers "is this the same browser as before." Read-or-create:
// Route Handlers can set the cookie directly; middleware.ts guarantees it
// already exists by the time a Server Component (which can only read
// cookies, never set them) needs it.
export async function getOrCreateAnonymousId(name: string): Promise<string> {
  const store = await cookies();
  const existing = store.get(name)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(name, id, { maxAge: ONE_YEAR_SECONDS, sameSite: "lax", path: "/" });
  return id;
}
