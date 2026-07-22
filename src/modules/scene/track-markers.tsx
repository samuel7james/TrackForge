"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { useCheckpoints, useStartLine } from "@/modules/track-format/hooks";
import type { GeneratedCheckpoint, GeneratedStartLine } from "@/modules/track-format/generate-track-elements";

function useCheckerTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const half = size / 2;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#111318";
    ctx.fillRect(0, 0, half, half);
    ctx.fillRect(half, half, half, half);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

function yawFromQuat(q: GeneratedStartLine["rotation"]): number {
  const quaternion = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  return new THREE.Euler().setFromQuaternion(quaternion, "YXZ").y;
}

function StartLineMarker({ startLine }: { startLine: GeneratedStartLine }) {
  const texture = useCheckerTexture();
  const yaw = useMemo(() => yawFromQuat(startLine.rotation), [startLine.rotation]);

  return (
    <group
      position={[startLine.position.x, startLine.position.y + 0.04, startLine.position.z]}
      rotation={[0, yaw, 0]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[startLine.width, 3]} />
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
    </group>
  );
}

function CheckpointMarker({ checkpoint }: { checkpoint: GeneratedCheckpoint }) {
  const height = checkpoint.width * 0.3;
  return (
    <mesh
      position={[
        checkpoint.position.x,
        checkpoint.position.y + height / 2,
        checkpoint.position.z,
      ]}
      quaternion={[
        checkpoint.rotation.x,
        checkpoint.rotation.y,
        checkpoint.rotation.z,
        checkpoint.rotation.w,
      ]}
    >
      <planeGeometry args={[checkpoint.width, height]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Start/finish and checkpoints are derived (see track-format/hooks.ts), not
// user-placed objects — this just projects them into the scene, same as Road
// projects splines. Renders in both edit and Play mode since it's mounted by
// SceneRoot.
export function TrackMarkers() {
  const startLine = useStartLine();
  const checkpoints = useCheckpoints();

  return (
    <>
      {startLine && <StartLineMarker startLine={startLine} />}
      {checkpoints.map((checkpoint) => (
        <CheckpointMarker key={checkpoint.id} checkpoint={checkpoint} />
      ))}
    </>
  );
}
