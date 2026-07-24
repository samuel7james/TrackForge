import { ImageResponse } from "next/og";

// Generated the same way as opengraph-image.tsx (next/og's ImageResponse) --
// a simple GT-car side silhouette (cabin + body + two wheels) in the app's
// dark-graphite/orange theme, rather than a static binary asset to keep in
// sync by hand.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: 7,
        }}
      >
        <div style={{ position: "relative", width: 28, height: 16, display: "flex" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 7,
              width: 14,
              height: 6,
              background: "#f97316",
              borderRadius: "6px 6px 2px 2px",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 0,
              width: 28,
              height: 7,
              background: "#f97316",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 3,
              width: 6,
              height: 6,
              background: "#0b1120",
              border: "2px solid #f97316",
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 19,
              width: 6,
              height: 6,
              background: "#0b1120",
              border: "2px solid #f97316",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
