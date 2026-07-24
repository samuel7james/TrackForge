"use client";

import { useRef, useState } from "react";
import { usePartySocket } from "partysocket/react";
import { VIEWER_ID_COOKIE } from "@/lib/anonymous-id-cookies";
import { getDisplayName } from "@/modules/game-engine/display-name-storage";

export interface PresencePeer {
  viewerId: string;
  displayName: string;
  color: string;
  cursor: { x: number; z: number } | null;
}

const CURSOR_BROADCAST_INTERVAL_MS = 50; // ~20Hz cap

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Deterministic per-viewer color so the same browser always renders the
// same cursor/avatar color across a session, without a server round-trip
// to assign one.
function colorForViewerId(viewerId: string): string {
  let hash = 0;
  for (let i = 0; i < viewerId.length; i++) hash = (hash * 31 + viewerId.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

// Connects to this track's PartyKit presence room (see party/index.ts) --
// a no-op (no connection) while `slug` is null, since a brand-new unsaved
// track has nothing to collaborate on yet. `peers` never includes this
// browser's own entry (filtered client-side by viewerId, cheaper than
// having the party server tailor a message per recipient).
export function usePresenceRoom(slug: string | null) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const viewerIdRef = useRef<string | null>(null);
  const lastCursorSendRef = useRef(0);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999",
    room: slug ?? "no-room",
    enabled: Boolean(slug),
    onOpen() {
      const viewerId = readCookie(VIEWER_ID_COOKIE) ?? crypto.randomUUID();
      viewerIdRef.current = viewerId;
      socket.send(
        JSON.stringify({
          type: "identify",
          viewerId,
          displayName: getDisplayName() ?? "Anonymous",
          color: colorForViewerId(viewerId),
        })
      );
    },
    onMessage(event) {
      const data = JSON.parse(event.data as string);
      if (data.type !== "presence") return;
      const allPeers = data.peers as PresencePeer[];
      setPeers(allPeers.filter((p) => p.viewerId !== viewerIdRef.current));
    },
  });

  const broadcastCursor = (x: number, z: number) => {
    if (!slug) return;
    const now = performance.now();
    if (now - lastCursorSendRef.current < CURSOR_BROADCAST_INTERVAL_MS) return;
    lastCursorSendRef.current = now;
    socket.send(JSON.stringify({ type: "cursor", x, z }));
  };

  return { peers, broadcastCursor };
}
