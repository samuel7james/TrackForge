"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { EditorViewV2 } from "@/modules/editor/editor-view-v2";
import type { TrackDocumentV2 } from "@/modules/track-format/schema";

interface EditorViewProps {
  slug: string | null;
}

// New tracks (no slug yet) are always the tile-based editor -- there's only
// one format now (the old spline/heightmap editor and its whole R3F/Rapier
// rendering stack were deleted in the engine-swap cleanup, see TASKS.md's
// "Ad hoc -- Engine Swap" entries). For an existing slug, the document is
// fetched once here rather than inside EditorViewV2 itself, so a track
// left over from before the cutover (formatVersion 1, no longer
// renderable at all) can show a clear message instead of a runtime crash.
export function EditorView({ slug }: EditorViewProps) {
  if (!slug) {
    return <EditorViewV2 slug={null} />;
  }
  return <ExistingTrackEditorView slug={slug} />;
}

function ExistingTrackEditorView({ slug }: { slug: string }) {
  const [trackDocument, setTrackDocument] = useState<TrackDocumentV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const autoplay = searchParams.get("autoplay") === "1";

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/tracks/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Track not found");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const parsed = safeParseTrackDocument(data.document);
        if (!parsed.success) throw new Error("This track's data is corrupted");
        if (parsed.data.formatVersion !== 2) {
          throw new Error(
            "This track was saved in a format TrackForge no longer supports."
          );
        }
        setTrackDocument(parsed.data);
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load track";
          setError(message);
          toast.error(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!trackDocument) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Loading track…
      </div>
    );
  }

  return <EditorViewV2 slug={slug} document={trackDocument} autoplay={autoplay} />;
}
