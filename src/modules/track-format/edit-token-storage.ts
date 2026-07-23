// Pure string formatting, no store coupling -- use-save-track.ts and
// public-track-actions.tsx both need it and it has nothing to do with
// which document format is being saved.
export function editTokenStorageKey(slug: string): string {
  return `trackforge:editToken:${slug}`;
}
