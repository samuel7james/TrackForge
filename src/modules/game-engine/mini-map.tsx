"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CELL_RAW, GRID_SCALE, TRACK_CELLS, type Cell } from "./track";

const VIEWPORT_SIZE = 132;
const PADDING = 10;
const _forward = new THREE.Vector3();

export interface MiniMapProps {
  /** null/empty falls back to the same built-in demo grid the engine
   * itself renders in that case, so the minimap always matches what's
   * actually on screen. */
  cells: Cell[] | null;
  /** Read every frame, same mutated-in-place objects the render loop
   * itself updates -- see EngineHandle's own comment. */
  vehiclePosition: THREE.Vector3;
  vehicleQuaternion: THREE.Quaternion;
}

// A schematic top-down view of the whole track with a live position/
// heading marker, so a driver can see upcoming corners rather than only
// what the chase camera currently frames. Static shape computed once
// (the layout never changes mid-session); the marker updates via its own
// rAF loop mutating an SVG transform directly, same pattern hud-
// overlay.tsx uses for its live timer -- re-rendering React every frame
// for this would be wasteful.
export function MiniMap({ cells, vehiclePosition, vehicleQuaternion }: MiniMapProps) {
  const markerRef = useRef<SVGGElement>(null);
  const list = cells && cells.length > 0 ? cells : TRACK_CELLS;

  const layout = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [gx, gz] of list) {
      minX = Math.min(minX, gx);
      maxX = Math.max(maxX, gx);
      minZ = Math.min(minZ, gz);
      maxZ = Math.max(maxZ, gz);
    }
    const span = Math.max(maxX - minX + 1, maxZ - minZ + 1, 1);
    const scale = (VIEWPORT_SIZE - PADDING * 2) / span;
    const points = list.map(([gx, gz]) => [
      (gx - minX) * scale + PADDING,
      (gz - minZ) * scale + PADDING,
    ]);
    return { minX, minZ, scale, points };
  }, [list]);

  const cellWorldSize = CELL_RAW * GRID_SCALE;

  useEffect(() => {
    let frameId: number;

    function tick() {
      if (markerRef.current) {
        const gx = vehiclePosition.x / cellWorldSize - layout.minX;
        const gz = vehiclePosition.z / cellWorldSize - layout.minZ;
        const px = gx * layout.scale + PADDING;
        const py = gz * layout.scale + PADDING;

        _forward.set(0, 0, 1).applyQuaternion(vehicleQuaternion);
        // Marker's default (unrotated) orientation points toward -y (up) in
        // SVG space, but +gz maps to +y (down) on the minimap -- so the z
        // term must be negated here, or the marker ends up rotated 180°
        // from the car's actual heading.
        const angleDeg = Math.atan2(_forward.x, -_forward.z) * (180 / Math.PI);

        markerRef.current.setAttribute("transform", `translate(${px} ${py}) rotate(${angleDeg})`);
      }
      frameId = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(frameId);
  }, [vehiclePosition, vehicleQuaternion, layout, cellWorldSize]);

  return (
    <div className="pointer-events-none absolute right-3 top-20 z-10 rounded-2xl border border-border/50 bg-card/80 p-2 shadow-lg backdrop-blur-xl">
      <svg width={VIEWPORT_SIZE} height={VIEWPORT_SIZE} viewBox={`0 0 ${VIEWPORT_SIZE} ${VIEWPORT_SIZE}`}>
        {layout.points.map(([px, py], i) => (
          <rect
            key={i}
            x={px - layout.scale / 2}
            y={py - layout.scale / 2}
            width={layout.scale + 0.5}
            height={layout.scale + 0.5}
            rx={1}
            fill="#f97316"
            opacity={0.55}
          />
        ))}
        <g ref={markerRef}>
          <polygon points="0,-5.5 4,4.5 -4,4.5" fill="#fff" stroke="#0f172a" strokeWidth={0.75} />
        </g>
      </svg>
    </div>
  );
}
