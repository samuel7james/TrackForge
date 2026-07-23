"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { TrackEditor } from "@/modules/editor/track-editor";
import type { TrackDocument } from "@/modules/track-format/schema";

interface EditorViewProps {
  slug: string | null;
}

// New tracks (no slug yet) always use the tile-based editor. For an
// existing slug, the document is fetched once here rather than inside
// TrackEditor itself, so a track saved in an unsupported format can show a
// clear message instead of a runtime crash.
export function EditorView({ slug }: EditorViewProps) {
  if (!slug) {
    return <TrackEditor slug={null} />;
  }
  return <ExistingTrackEditorView slug={slug} />;
}

function ExistingTrackEditorView({ slug }: { slug: string }) {
  const [trackDocument, setTrackDocument] = useState<TrackDocument | null>(null);
  const [isPublished, setIsPublished] = useState(false);
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
        setIsPublished(Boolean(data.isPublished));
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

  return (
    <TrackEditor
      slug={slug}
      document={trackDocument}
      autoplay={autoplay}
      initiallyPublished={isPublished}
    />
  );
}
