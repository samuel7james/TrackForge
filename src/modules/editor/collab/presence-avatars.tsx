"use client";

import { useSyncExternalStore } from "react";
import type { PresencePeer } from "./use-presence-room";
import { usePresenceContext } from "./presence-context";
import { getDisplayName } from "@/modules/game-engine/display-name-storage";

const noSubscription = () => () => {};

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

// A small avatar stack in the editor header -- shows a "1" for just
// yourself too (not hidden when solo), so the feature is discoverable even
// before anyone else has joined.
export function PresenceAvatars() {
  const { peers } = usePresenceContext();
  const ownName = useSyncExternalStore(
    noSubscription,
    () => getDisplayName() ?? "Anonymous",
    () => "Anonymous"
  );

  const everyone: Pick<PresencePeer, "viewerId" | "displayName" | "color">[] = [
    { viewerId: "__self", displayName: ownName, color: "var(--primary)" },
    ...peers,
  ];

  return (
    <div className="flex items-center -space-x-2">
      {everyone.map((peer) => (
        <div
          key={peer.viewerId}
          title={peer.displayName}
          className="flex size-6 items-center justify-center rounded-full border-2 border-background text-[0.6rem] font-semibold text-white"
          style={{ backgroundColor: peer.color }}
        >
          {initials(peer.displayName)}
        </div>
      ))}
    </div>
  );
}
