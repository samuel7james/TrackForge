"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDisplayName, setDisplayName } from "@/modules/game-engine/display-name-storage";

interface Comment {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
}

interface TrackEngagementProps {
  slug: string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialComments: Comment[];
}

const noSubscription = () => () => {};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// No accounts (§8), but no anonymous identities either -- commenting uses
// the same globally-claimed DisplayName racing does (see
// display-name-gate.tsx), not a name typed fresh per comment. A viewer who
// hasn't claimed one yet (may never have raced) claims it right here inline
// instead of a full-screen gate, since this isn't blocking a 3D canvas.
export function TrackEngagement({
  slug,
  initialLiked,
  initialLikeCount,
  initialComments,
}: TrackEngagementProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiking, setIsLiking] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  // Bumped purely to force a re-render after setDisplayName() -- noSubscription
  // below means the useSyncExternalStore snapshot only re-reads localStorage
  // when something else causes this component to render.
  const [, forceRerender] = useState(0);

  const displayName = useSyncExternalStore(noSubscription, () => getDisplayName(), () => null);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    // Optimistic -- a failed toggle is rare and low-stakes, reverted below.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => count + (nextLiked ? 1 : -1));
    try {
      const res = await fetch(`/api/tracks/${slug}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      setLiked(!nextLiked);
      setLikeCount((count) => count + (nextLiked ? -1 : 1));
    } finally {
      setIsLiking(false);
    }
  };

  const handleClaimName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed || isClaiming) return;
    setIsClaiming(true);
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
      forceRerender((n) => n + 1);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCommenting) return;
    setIsCommenting(true);
    try {
      const res = await fetch(`/api/tracks/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to post comment");
      setComments((prev) => [data, ...prev]);
      setCommentBody("");
    } catch {
      // Silently no-op on failure -- the form keeps its contents so the
      // visitor can just retry, no toast plumbing needed for Milestone 3.
    } finally {
      setIsCommenting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant={liked ? "default" : "outline"}
        className="w-fit gap-1.5"
        onClick={handleLike}
        disabled={isLiking}
      >
        <Heart className={liked ? "size-4 fill-current" : "size-4"} />
        {likeCount} like{likeCount === 1 ? "" : "s"}
      </Button>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Comments ({comments.length})
        </h2>

        {displayName ? (
          <form onSubmit={handleComment} className="flex flex-col gap-2">
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder={`Comment as ${displayName}...`}
              maxLength={500}
              rows={2}
              required
            />
            <Button type="submit" size="sm" className="w-fit" disabled={isCommenting}>
              {isCommenting ? "Posting…" : "Post comment"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleClaimName} className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Pick a name to comment under. Names are first-come, first-served, and this is the
              same name you&apos;ll race under.
            </p>
            <div className="flex gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your name"
                maxLength={40}
                required
              />
              <Button type="submit" size="sm" disabled={isClaiming}>
                {isClaiming ? "Checking…" : "Claim name"}
              </Button>
            </div>
          </form>
        )}

        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border/50 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{comment.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(comment.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
