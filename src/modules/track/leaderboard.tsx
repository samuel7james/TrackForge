"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLapTime } from "@/modules/game-engine/lap-timer";
import { editTokenStorageKey } from "@/modules/track-format/edit-token-storage";

export interface LeaderboardEntry {
  id: string;
  rank: number;
  displayName: string;
  timeMs: number;
  isViewer: boolean;
}

export interface LeaderboardOwnEntry {
  id: string;
  rank: number;
  displayName: string;
  timeMs: number;
}

interface LeaderboardProps {
  slug: string;
  entries: LeaderboardEntry[];
  own: LeaderboardOwnEntry | null;
}

const noSubscription = () => () => {};

// Server-rendered initial data (see t/[slug]/page.tsx's own fetch, same
// Promise.all block that already fetches likes/comments) -- no client
// refetch on mount, since a fresh submission during play already shows its
// own toast (engine-core.ts) and this list is naturally current again on
// the next page load. `own` covers "you're #47" even when outside the
// rendered top N, same reasoning the API route itself documents.
//
// Deletion is the one owner-moderation power scoped to a track's content
// rather than the track row itself (see /api/tracks/[slug]/laptimes/[id])
// -- same "does this browser hold the edit token" check as
// PublicTrackActions, so a delete control only ever renders for whoever
// owns this track, never for other racers.
export function Leaderboard({ slug, entries, own }: LeaderboardProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isOwner = useSyncExternalStore(
    noSubscription,
    () => Boolean(localStorage.getItem(editTokenStorageKey(slug))),
    () => false
  );

  const handleDelete = async (id: string) => {
    const editToken = localStorage.getItem(editTokenStorageKey(slug));
    if (!editToken) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tracks/${slug}/laptimes/${id}`, {
        method: "DELETE",
        headers: { "X-Edit-Token": editToken },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to delete lap time");
        return;
      }
      toast.success("Lap time removed");
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          No lap times yet — be the first to set one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Leaderboard</h2>
      <ol className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
              entry.isViewer
                ? "border-primary/40 bg-primary/10"
                : "border-border/50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-5 text-right tabular-nums text-muted-foreground">
                {entry.rank}
              </span>
              {entry.rank === 1 && <Trophy className="size-3.5 text-amber-400" />}
              <span className="font-medium">{entry.displayName}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-muted-foreground">
                {formatLapTime(entry.timeMs / 1000)}
              </span>
              {isOwner && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Remove lap time"
                  disabled={deletingId === entry.id}
                  onClick={() => handleDelete(entry.id)}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </span>
          </li>
        ))}
      </ol>

      {own && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-5 text-right tabular-nums text-muted-foreground">
              {own.rank}
            </span>
            <span className="font-medium">{own.displayName}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums text-muted-foreground">
              {formatLapTime(own.timeMs / 1000)}
            </span>
            {isOwner && (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="Remove lap time"
                disabled={deletingId === own.id}
                onClick={() => handleDelete(own.id)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
