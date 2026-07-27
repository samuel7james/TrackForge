// The daily challenge track's fixed, reserved slug -- kept in its own
// tiny module with zero other imports so client components (track-
// editor.tsx, ModeToggle) can safely import just this constant without
// pulling in server/daily-challenge.ts's Prisma/server-only dependencies
// into the client bundle.
export const DAILY_CHALLENGE_SLUG = "daily-challenge";
