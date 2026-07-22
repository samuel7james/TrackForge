import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";
import type { RoadSpline } from "./schema";

// Rough placeholder until Milestone 4 has real recorded lap times: total
// centerline arc length over an assumed arcade-pace average speed. Recomputed
// on demand rather than stamped into the document at publish time, since the
// owner can keep editing a published track and a stored estimate would go
// stale the moment they do.
const ASSUMED_AVERAGE_SPEED_MPS = 18;

export function estimateLapTimeMs(splines: RoadSpline[]): number | null {
  const spline = splines[0];
  if (!spline || spline.points.length < 2) return null;

  const samples = sampleRoadCenterline(spline.points, spline.closed);
  if (samples.length < 2) return null;

  let length = 0;
  for (let i = 1; i < samples.length; i++) {
    length += samples[i].position.distanceTo(samples[i - 1].position);
  }
  return (length / ASSUMED_AVERAGE_SPEED_MPS) * 1000;
}
