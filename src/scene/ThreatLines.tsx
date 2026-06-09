import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BattlefieldSnapshot, RadarTrack, Vehicle } from '@/types';
import { geoToWorld } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';

/**
 * Draws red dashed lines from the closest Blue Force vehicle to every
 * hostile/unknown radar track — gives an instant "threat picture".
 */
export function ThreatLines({ snapshot }: { snapshot: BattlefieldSnapshot }) {
  const ref = useRef<THREE.LineSegments>(null!);

  const geo = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame(() => {
    const blue = snapshot.vehicles.filter((v) => v.combatReady);
    const hostiles = snapshot.radarTracks.filter(
      (t) => t.classification !== 'friendly'
    );
    const positions: number[] = [];
    for (const t of hostiles) {
      const closest = nearest(t, blue);
      if (!closest) continue;
      const [tx, , tz] = geoToWorld(t.latitude, t.longitude);
      const ty = terrainHeight(tx, tz) + 80;
      const [vx, , vz] = geoToWorld(closest.latitude, closest.longitude);
      const vy = terrainHeight(vx, vz) + 5;
      positions.push(tx, ty, tz, vx, vy, vz);
    }
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.computeBoundingSphere();
  });

  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineDashedMaterial
        color="#ef4444"
        dashSize={20}
        gapSize={12}
        transparent
        opacity={0.55}
      />
    </lineSegments>
  );
}

function nearest(t: RadarTrack, blue: Vehicle[]): Vehicle | undefined {
  let best: Vehicle | undefined;
  let bestD = Infinity;
  for (const v of blue) {
    const d = (v.latitude - t.latitude) ** 2 + (v.longitude - t.longitude) ** 2;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}
