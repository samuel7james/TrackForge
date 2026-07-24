"use client";

import { Html } from "@react-three/drei";
import { usePresenceContext } from "./presence-context";

// A 3D editor's "cursor" is meaningfully a world-space position (a marker
// pinned in the scene), not a 2D screen-space cursor -- every viewer's
// camera angle differs, so there's no shared screen space to point in.
// Rendered as a sibling to TileGridLayer inside scene-root.tsx's <Canvas>.
export function PresenceCursors() {
  const { peers } = usePresenceContext();

  return (
    <>
      {peers
        .filter((peer) => peer.cursor !== null)
        .map((peer) => (
          <group key={peer.viewerId} position={[peer.cursor!.x, 0.05, peer.cursor!.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.4, 24]} />
              <meshBasicMaterial color={peer.color} transparent opacity={0.9} depthWrite={false} />
            </mesh>
            <Html center distanceFactor={10} style={{ pointerEvents: "none" }}>
              <div
                className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-md"
                style={{ backgroundColor: peer.color, transform: "translateY(-1.6em)" }}
              >
                {peer.displayName}
              </div>
            </Html>
          </group>
        ))}
    </>
  );
}
