// Just the cookie *names* -- split out from anonymous-id.ts so client
// components can import these without pulling in that file's top-level
// `next/headers` import (server-only; breaks the client bundle otherwise).
export const AUTHOR_ID_COOKIE = "trackforge-author-id";
export const VIEWER_ID_COOKIE = "trackforge-viewer-id";
