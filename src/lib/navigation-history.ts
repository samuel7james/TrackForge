// Whether this browser tab has done at least one client-side (in-app)
// route change yet -- distinct from real browser history existing at all,
// since a page opened directly (shared link, bookmark, new tab) has
// nowhere meaningful for router.back() to go even though window.history
// may still report an entry or two (a new-tab placeholder, an external
// referrer). sessionStorage persists across full reloads within the same
// tab, so a hard navigation partway through a session doesn't lose it.
const FLAG_KEY = "trackforge:hasInAppHistory";

export function markInAppNavigation() {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    // storage unavailable -- back button just falls back to Home every time
  }
}

export function hasInAppHistory(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
