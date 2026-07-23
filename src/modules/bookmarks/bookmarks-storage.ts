const BOOKMARKS_KEY = "trackforge:bookmarks";
const CHANGE_EVENT = "trackforge:bookmarks-changed";

export interface BookmarkEntry {
  slug: string;
  name: string;
  bookmarkedAt: string;
}

// Client-side only, no server model (§8/Phase 19) -- there's no account to
// sync a bookmark list to, so localStorage on this one browser is the whole
// feature. name is a snapshot from bookmark time, not re-fetched -- if the
// track is later renamed/unpublished/deleted, the bookmark entry still shows
// its old name and just links out to a live /t/[slug] (which 404s or reflects
// the current state on its own); acceptable for a client-only feature with no
// backing store to reconcile against.
//
// Caches the parsed array keyed by the raw string it came from --
// useSyncExternalStore requires getSnapshot to return a referentially stable
// result when the underlying data hasn't changed, but JSON.parse allocates a
// new array every call. Without this cache, useBookmarks() re-renders forever
// (confirmed: "Maximum update depth exceeded" without it).
let cachedRaw: string | null = null;
let cachedBookmarks: BookmarkEntry[] = [];

export function getBookmarks(): BookmarkEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BOOKMARKS_KEY);
  if (raw === cachedRaw) return cachedBookmarks;
  cachedRaw = raw;
  try {
    cachedBookmarks = raw ? (JSON.parse(raw) as BookmarkEntry[]) : [];
  } catch {
    cachedBookmarks = [];
  }
  return cachedBookmarks;
}

export function isBookmarked(slug: string): boolean {
  return getBookmarks().some((entry) => entry.slug === slug);
}

function writeBookmarks(entries: BookmarkEntry[]): void {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(entries));
  // `storage` events only fire in OTHER tabs, never the tab that made the
  // change -- this custom event is what lets this same tab's UI (the toggle
  // button, the /bookmarks list) update immediately.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function toggleBookmark(slug: string, name: string): void {
  const current = getBookmarks();
  const next = current.some((entry) => entry.slug === slug)
    ? current.filter((entry) => entry.slug !== slug)
    : [{ slug, name, bookmarkedAt: new Date().toISOString() }, ...current];
  writeBookmarks(next);
}

export function subscribeToBookmarks(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
