import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { DIFFICULTY_LABELS } from "@/modules/track/difficulty-labels";

// Prisma's client needs Node.js APIs (a real TCP connection), not the Edge
// runtime ImageResponse/next/og otherwise defaults to -- explicit here since
// this is the one OG image that actually looks up data.
export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const track = await prisma.track.findUnique({
    where: { slug },
    select: { name: true, description: true, difficulty: true },
  });

  const difficulty = track ? (DIFFICULTY_LABELS[track.difficulty] ?? "Beginner") : "Beginner";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          gap: 20,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 24, color: "#60a5fa", letterSpacing: 4, textTransform: "uppercase" }}>
          TrackForge
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>
          {track?.name ?? "Track not found"}
        </div>
        {track?.description && (
          <div style={{ fontSize: 28, color: "#94a3b8", maxWidth: 900 }}>{track.description}</div>
        )}
        <div style={{ fontSize: 26, color: "#cbd5e1" }}>{difficulty}</div>
      </div>
    ),
    { ...size }
  );
}
