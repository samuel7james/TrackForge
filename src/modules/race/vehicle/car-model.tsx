"use client";

// Procedural placeholder car (no external assets in Milestone 1). Forward
// is local +Z, matching the convention generateStartLine/generateCheckpoints
// already use, so spawn rotation needs no adjustment.
const WHEEL_POSITIONS: [number, number, number][] = [
  [-0.75, -0.2, 1.15],
  [0.75, -0.2, 1.15],
  [-0.75, -0.2, -1.15],
  [0.75, -0.2, -1.15],
];

export function CarModel() {
  return (
    <group>
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[1.6, 0.5, 3.6]} />
        <meshStandardMaterial color="#e0393e" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh castShadow position={[0, 0.35, -0.3]}>
        <boxGeometry args={[1.2, 0.4, 1.6]} />
        <meshStandardMaterial color="#111318" roughness={0.3} metalness={0.1} />
      </mesh>
      {WHEEL_POSITIONS.map((position, i) => (
        <mesh key={i} position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.28, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
