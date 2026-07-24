"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDisplayName } from "./display-name-storage";

// Shown in place of the engine whenever a browser races for the first time
// (no stored name yet, see display-name-storage.ts) -- the leaderboard needs
// a human-readable name per lap-time submission, not just an anonymous
// viewerId. A one-time gate: once submitted, the name persists across every
// future race from this browser, same trade-off already accepted for
// editToken/authorId (no accounts, just a durable per-browser value).
export function DisplayNameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xs flex-col gap-3 rounded-2xl border border-border/50 bg-card/80 p-6 shadow-lg backdrop-blur-xl"
      >
        <h2 className="text-lg font-semibold tracking-tight">Before you race</h2>
        <p className="text-sm text-muted-foreground">
          Pick a name to show on the leaderboard. This is saved to this browser, not an account.
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          autoFocus
          required
        />
        <Button type="submit" className="gap-1.5">
          Start racing
        </Button>
      </form>
    </div>
  );
}
