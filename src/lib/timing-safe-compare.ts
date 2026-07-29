import { timingSafeEqual } from "node:crypto";

// Constant-time string comparison, for any secret an attacker submits and
// the server checks (admin credentials/session signatures, a track's
// editToken). A plain `===`/`!==` returns as soon as it finds a differing
// byte, so how long the comparison takes leaks how many leading bytes were
// right -- enough, given enough samples, to reconstruct a secret one byte
// at a time rather than having to guess it whole.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on mismatched lengths rather than returning
  // false, so the length check has to happen first -- it leaks length,
  // not content, an accepted trade-off for this standard pattern.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
