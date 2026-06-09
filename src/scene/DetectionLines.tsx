import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BattlefieldSnapshot, Drone, RadarTrack } from '@/types';
import { geoToWorld } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';

/**
 * Draws cyan dashed lines from the closest friendly drone (the "sensor")
 * down to every radar track. Visualises which sensor is observing each
 * detected object — replaces the freestanding vertical beams that used
 * to float above each track.
 */
export function DetectionLines({ snapshot }: { snapshot: BattlefieldSnapshot }) {
  const ref = useRef<THREE.LineSegments>(null!);
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const matRef = useRef<THREE.LineDashedMaterial>(null!);

  useFrame((state) => {
    const drones = snapshot.drones;
    const tracks = snapshot.radarTracks;
    const positions: number[] = [];
    for (const tr of tracks) {
      const src = nearestDrone(tr, drones);
      if (!src) continue;
      const [tx, , tz] = geoToWorld(tr.latitude, tr.longitude);
      const ty = terrainHeight(tx, tz) + 30;
      const [dx, , dz] = geoToWorld(src.latitude, src.longitude);
      const droneY = terrainHeight(dx, dz) + src.altitudeM;
      positions.push(dx, droneY, dz, tx, ty, tz);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeBoundingSphere();
    if (ref.current) ref.current.computeLineDistances();
    if (matRef.current) {
      // gentle pulsing opacity
      matRef.current.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineDashedMaterial
        ref={matRef}
        color="#22d3ee"
        dashSize={30}
        gapSize={18}
        transparent
        opacity={0.35}
      />
    </lineSegments>
  );
}

function nearestDrone(t: RadarTrack, drones: Drone[]): Drone | undefined {
  let best: Drone | undefined;
  let bestD = Infinity;
  for (const d of drones) {
    const dd =
      (d.latitude - t.latitude) ** 2 + (d.longitude - t.longitude) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}
