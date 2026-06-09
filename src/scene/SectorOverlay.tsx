import { useMemo } from 'react';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { geoToWorld } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';
import type { Sector } from '@/types';

const ROLE_COLOR: Record<string, string> = {
  friendly_rear: '#4ade80',
  forward: '#facc15',
  contested: '#ef4444',
  observation: '#60a5fa',
};

/** Build a flat ring whose vertices follow the terrain — avoids the
 * pizza-slice z-fighting / clipping you get when a single planar ring
 * spans 1.5–2.5 km of varied height. */
function buildTerrainRing(
  cx: number,
  cz: number,
  rOuter: number,
  rInner: number,
  segments = 192,
  yLift = 1.0,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const cs = Math.cos(a), sn = Math.sin(a);
    const xo = cx + cs * rOuter;
    const zo = cz + sn * rOuter;
    const xi = cx + cs * rInner;
    const zi = cz + sn * rInner;
    positions.push(xo, terrainHeight(xo, zo) + yLift, zo);
    positions.push(xi, terrainHeight(xi, zi) + yLift, zi);
    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function SectorOverlay({ sectors }: { sectors: Sector[] }) {
  const ringGeos = useMemo(() => {
    return sectors.map((s) => {
      const [x, , z] = geoToWorld(s.centerLat, s.centerLon);
      const r = s.radiusKm * 1000;
      return buildTerrainRing(x, z, r, r * 0.96, 192, 1.2);
    });
  }, [sectors]);

  return (
    <group>
      {sectors.map((s, idx) => {
        const [x, , z] = geoToWorld(s.centerLat, s.centerLon);
        const r = s.radiusKm * 1000;
        const color = ROLE_COLOR[s.role] ?? '#94a3b8';
        const baseY = terrainHeight(x, z);
        return (
          <group key={s.id}>
            {/* terrain-conforming ring */}
            <mesh geometry={ringGeos[idx]}>
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                depthWrite={false}
              />
            </mesh>
            {/* very subtle volume dome at sector center */}
            <mesh position={[x, baseY, z]}>
              <sphereGeometry args={[r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.025}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            <Billboard position={[x, baseY + 220, z]}>
              <Text fontSize={120} color={color} outlineWidth={4} outlineColor="#000">
                {`${s.name.toUpperCase()}  •  ${s.role.replace('_', ' ')}`}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
