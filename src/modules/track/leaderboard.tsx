"use client";

import { Trophy } from "lucide-react";
import { formatLapTime } from "@/modules/game-engine/lap-timer";

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  timeMs: number;
  isViewer: boolean;
}

export interface LeaderboardOwnEntry {
  rank: number;
  displayName: string;
  timeMs: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  own: LeaderboardOwnEntry | null;
}

// Server-rendered initial data (see t/[slug]/page.tsx's own fetch, same
// Promise.all block that already fetches likes/comments) -- no client
// refetch on mount, since a fresh submission during play already shows its
// own toast (engine-core.ts) and this list is naturally current again on
// the next page load. `own` covers "you're #47" even when outside the
// rendered top N, same reasoning the API route itself documents.
export function Leaderboard({ entries, own }: LeaderboardProps) {
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
            key={entry.rank}
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
            <span className="tabular-nums text-muted-foreground">
              {formatLapTime(entry.timeMs / 1000)}
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
          <span className="tabular-nums text-muted-foreground">
            {formatLapTime(own.timeMs / 1000)}
          </span>
        </div>
      )}
    </div>
  );
}
