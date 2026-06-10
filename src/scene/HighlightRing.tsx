import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Pulsing cyan ring drawn around the currently selected object.
 * `radius` is expressed in the parent group's local units, so it scales with
 * whatever `scale` the entity group already applies.
 */
export function HighlightRing({ radius, y = 0.05 }: { radius: number; y?: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    const p = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.09;
    ref.current.scale.set(p, p, p);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <ringGeometry args={[radius * 0.82, radius, 48]} />
      <meshBasicMaterial
        color="#22d3ee"
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
        depthTest={false}
      />
    </mesh>
  );
}
