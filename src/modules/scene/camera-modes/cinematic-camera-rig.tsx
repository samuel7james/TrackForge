"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useTrackStore } from "@/store/track-store";
import { sampleRoadCenterline } from "@/modules/spline/catmull-rom";

const LAP_DURATION_S = 22; // how long one full flythrough takes
const HEIGHT_OFFSET = 4.5;
const LOOK_AHEAD_FRACTION = 0.03; // how far ahead along the lap to aim, as a fraction of total samples

// A no-input scripted flythrough along the track's own centerline -- an
// automatic preview of the finished circuit, the kind of shot a track's
// public page or a trailer would want. Reuses sampleRoadCenterline (the
// same function Road/TrackPhysics/lap-time estimation all already use), so
// the flythrough always matches whatever the track currently looks like.
// Loops seamlessly on a closed spline; on an open one it ping-pongs back
// and forth rather than snapping.
export function CinematicCameraRig() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const spline = useTrackStore((s) => s.document.splines[0]);
  const elapsed = useRef(0);

  const samples = useMemo(() => {
    if (!spline || spline.points.length < 2) return [];
    return sampleRoadCenterline(spline.points, spline.closed);
  }, [spline]);

  const closed = spline?.closed ?? false;

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    if (!camera || samples.length < 2) return;

    elapsed.current += delta;
    const lapFraction = (elapsed.current % LAP_DURATION_S) / LAP_DURATION_S;

    let u = lapFraction;
    if (!closed) {
      // Ping-pong 0..1..0 instead of snapping back to the start.
      const t = (elapsed.current % (LAP_DURATION_S * 2)) / LAP_DURATION_S;
      u = t <= 1 ? t : 2 - t;
    }

    const index = Math.min(samples.length - 1, Math.floor(u * (samples.length - 1)));
    const lookIndex = closed
      ? (index + Math.ceil(samples.length * LOOK_AHEAD_FRACTION)) % samples.length
      : Math.min(samples.length - 1, index + Math.ceil(samples.length * LOOK_AHEAD_FRACTION));

    const sample = samples[index];
    const lookSample = samples[lookIndex];

    camera.position.set(sample.position.x, sample.position.y + HEIGHT_OFFSET, sample.position.z);
    camera.lookAt(lookSample.position.x, lookSample.position.y + HEIGHT_OFFSET * 0.6, lookSample.position.z);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={55} position={[0, HEIGHT_OFFSET, 0]} />;
}
