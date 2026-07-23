// Pure string formatting, no store coupling -- extracted from
// use-save-track.ts (deleted, v1-only) since use-save-track-v2.ts and
// public-track-actions.tsx both need it and it has nothing to do with
// which document format is being saved.
export function editTokenStorageKey(slug: string): string {
  return `trackforge:editToken:${slug}`;
}
