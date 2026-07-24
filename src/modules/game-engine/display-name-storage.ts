// Pure string storage, no store coupling -- a persistent per-browser racing
// name (unlike a comment's display name, which is typed fresh every time
// and never saved), so it only needs to be entered once and gets attached
// to every future lap-time submission for the leaderboard.
const DISPLAY_NAME_KEY = "trackforge:displayName";

export function getDisplayName(): string | null {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}

export function setDisplayName(name: string) {
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
  } catch {
    // storage unavailable -- name just won't persist across sessions
  }
}
