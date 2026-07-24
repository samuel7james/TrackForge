// A minimal presence-relay server -- one PartyKit room per track (the room
// id is the track's slug, matched client-side in use-presence-room.ts).
// No document/CRDT state here yet (that's Phase 2); this room only ever
// tracks "who's currently connected and where their cursor is," entirely
// in-memory via each Connection's own `state` (PartyKit's per-connection
// attachment, persisted across the hibernation this server doesn't opt
// into anyway -- see ServerOptions.hibernate, left at its default false).
import type * as Party from "partykit/server";

export interface PresenceState {
  viewerId: string;
  displayName: string;
  color: string;
  cursor: { x: number; z: number } | null;
}

type IncomingMessage =
  | { type: "identify"; viewerId: string; displayName: string; color: string }
  | { type: "cursor"; x: number; z: number };

export default class PresenceServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onMessage(message: string, sender: Party.Connection<PresenceState>) {
    let data: IncomingMessage;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === "identify") {
      sender.setState({
        viewerId: data.viewerId,
        displayName: data.displayName,
        color: data.color,
        cursor: null,
      });
    } else if (data.type === "cursor") {
      const state = sender.state;
      if (!state) return; // hasn't sent `identify` yet -- ignore
      sender.setState({ ...state, cursor: { x: data.x, z: data.z } });
    } else {
      return;
    }

    this.broadcastPresence();
  }

  onClose() {
    this.broadcastPresence();
  }

  onError() {
    this.broadcastPresence();
  }

  private broadcastPresence() {
    const peers: PresenceState[] = [];
    for (const connection of this.room.getConnections<PresenceState>()) {
      if (connection.state) peers.push(connection.state);
    }
    this.room.broadcast(JSON.stringify({ type: "presence", peers }));
  }
}

PresenceServer satisfies Party.Worker;
