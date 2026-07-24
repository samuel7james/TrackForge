"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDisplayName } from "./display-name-storage";

// Shown in place of the engine whenever a browser races for the first time
// (no stored name yet, see display-name-storage.ts) -- the leaderboard needs
// a human-readable name per lap-time submission, not just an anonymous
// viewerId. A one-time gate: once submitted, the name persists across every
// future race from this browser, same trade-off already accepted for
// editToken/authorId (no accounts, just a durable per-browser value).
//
// The chosen name is claimed globally (POST /api/display-names/claim)
// before it's saved locally, so no two browsers can race under the same
// name -- a taken name shows an error instead of silently succeeding.
export function DisplayNameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/display-names/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to claim that name");
        return;
      }
      setDisplayName(trimmed);
      onSubmit(trimmed);
    } catch {
      toast.error("Failed to claim that name");
    } finally {
      setIsSubmitting(false);
    }
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
          Names are first-come, first-served.
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          autoFocus
          required
        />
        <Button type="submit" disabled={isSubmitting} className="gap-1.5">
          {isSubmitting ? "Checking…" : "Start racing"}
        </Button>
      </form>
    </div>
  );
}
