"use client";

import { createContext, useContext } from "react";
import type { PresencePeer } from "./use-presence-room";

interface PresenceContextValue {
  peers: PresencePeer[];
  broadcastCursor: (x: number, z: number) => void;
}

const noop = () => {};
const PresenceContext = createContext<PresenceContextValue>({ peers: [], broadcastCursor: noop });

// track-editor.tsx is the one place usePresenceRoom() is called (it owns
// `slug`); TileGridLayer/PresenceCursors live several components deeper
// inside the <Canvas> tree, and PresenceAvatars lives in the header --
// Context avoids prop-drilling this through TrackForgeCanvas/EditorEngine,
// neither of which otherwise cares about presence at all.
export const PresenceProvider = PresenceContext.Provider;

export function usePresenceContext() {
  return useContext(PresenceContext);
}
