"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// No accounts (§8) -- liking is a viewerId cookie toggle, commenting is a
// freeform display name typed fresh each time, not tied to any persistent
// identity beyond "whichever browser is submitting right now."
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
  const [displayName, setDisplayName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

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

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCommenting) return;
    setIsCommenting(true);
    try {
      const res = await fetch(`/api/tracks/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, body: commentBody }),
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

        <form onSubmit={handleComment} className="flex flex-col gap-2">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            required
          />
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Say something about this track..."
            maxLength={500}
            rows={2}
            required
          />
          <Button type="submit" size="sm" className="w-fit" disabled={isCommenting}>
            {isCommenting ? "Posting…" : "Post comment"}
          </Button>
        </form>

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
