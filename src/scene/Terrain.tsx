import { useMemo } from 'react';
import * as THREE from 'three';
import { terrainHeight } from '@/utils/terrain';

const SIZE_M = 16000;     // 16 km × 16 km world
const SEGMENTS = 220;     // grid resolution

export function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE_M, SIZE_M, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#3a5a32');
    const forest = new THREE.Color('#1f3a1c');
    const mud   = new THREE.Color('#5a4a32');
    const snow  = new THREE.Color('#a4b3a0');
    const rock  = new THREE.Color('#615e54');
    const tmp   = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);

      // Slope-based colour blend
      const hx = terrainHeight(x + 30, z) - h;
      const hz = terrainHeight(x, z + 30) - h;
      const slope = Math.min(1, Math.hypot(hx, hz) / 30);
      tmp.copy(grass).lerp(mud, slope * 0.6);
      if (h > 28) tmp.lerp(rock, Math.min(1, (h - 28) / 25));
      if (h > 50) tmp.lerp(snow, Math.min(1, (h - 50) / 20));
      // Forest patches in low rolling hills
      if (h > 5 && h < 25 && slope < 0.35 && Math.sin(x * 0.0035) * Math.cos(z * 0.004) > 0.25) {
        tmp.lerp(forest, 0.85);
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} flatShading />
    </mesh>
  );
}
