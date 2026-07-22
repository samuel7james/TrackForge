import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safeParseTrackDocument } from "@/modules/track-format/validate";
import { estimateLapTimeMs } from "@/modules/track-format/estimate-lap-time";
import { PublicTrackActions } from "@/modules/track/public-track-actions";

interface PublicTrackPageProps {
  params: Promise<{ slug: string }>;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

function formatEstimatedTime(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default async function PublicTrackPage({ params }: PublicTrackPageProps) {
  const { slug } = await params;
  const track = await prisma.track.findUnique({ where: { slug } });
  if (!track) notFound();

  const parsed = safeParseTrackDocument(track.document);
  const estimatedLapTimeMs = parsed.success
    ? estimateLapTimeMs(parsed.data.splines)
    : null;
  const difficulty = parsed.success ? parsed.data.meta.difficulty : "beginner";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        <span>TrackForge</span>
        {!track.isPublished && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400">
            Draft
          </span>
        )}
      </div>

      <h1 className="text-4xl font-semibold tracking-tight">{track.name}</h1>
      {track.description && (
        <p className="max-w-lg text-muted-foreground">{track.description}</p>
      )}

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Difficulty</dt>
          <dd className="font-medium">
            {DIFFICULTY_LABELS[difficulty] ?? difficulty}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated lap</dt>
          <dd className="font-medium">{formatEstimatedTime(estimatedLapTimeMs)}</dd>
        </div>
      </dl>

      <PublicTrackActions slug={slug} isPublished={track.isPublished} />
    </div>
  );
}
