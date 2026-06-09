import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Soldier } from '@/types';
import { geoToWorld } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';

const STRESS_UNIFORM: Record<Soldier['stressLevel'], string> = {
  normal: '#3a5a32',
  elevated: '#7a6a2a',
  critical: '#7a3a2a',
};

const FIGURE_SCALE = 35;

function SoldierFigure({ s }: { s: Soldier }) {
  const groupRef = useRef<THREE.Group>(null!);
  const tiltRef = useRef<THREE.Group>(null!);
  const aux = useRef({
    phase: Math.random() * Math.PI * 2,
    t: new THREE.Vector3(),
    last: new THREE.Vector3(),
    yaw: 0,
    yawInit: false,
  });

  useFrame((state, delta) => {
    if (!groupRef.current || !tiltRef.current) return;
    const [x, , z] = geoToWorld(s.latitude, s.longitude);
    const ground = terrainHeight(x, z);
    const down = s.movementStatus === 'down';
    const prone = s.movementStatus === 'prone';
    // Feet are anchored at object-space y=0, so the group sits on the ground.
    aux.current.t.set(x, ground, z);
    if (!aux.current.yawInit) {
      groupRef.current.position.copy(aux.current.t);
      aux.current.last.copy(aux.current.t);
      aux.current.yawInit = true;
    }
    const k = 1 - Math.exp(-delta * 6);
    groupRef.current.position.lerp(aux.current.t, k);

    // Yaw from motion direction (only when moving meaningfully).
    const dx = aux.current.t.x - aux.current.last.x;
    const dz = aux.current.t.z - aux.current.last.z;
    const motion = Math.hypot(dx, dz);
    if (motion > 0.3 && !down && !prone) {
      aux.current.yaw = Math.atan2(dx, dz);
    }
    aux.current.last.copy(aux.current.t);
    let dy = aux.current.yaw - groupRef.current.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    groupRef.current.rotation.y += dy * (1 - Math.exp(-delta * 5));

    // Tilt only the inner group (so position/yaw are unaffected).
    const targetTiltX = down ? Math.PI / 2 : prone ? Math.PI / 2.2 : 0;
    tiltRef.current.rotation.x += (targetTiltX - tiltRef.current.rotation.x) * (1 - Math.exp(-delta * 4));

    if (s.movementStatus === 'walking' || s.movementStatus === 'running') {
      const sp = s.movementStatus === 'running' ? 8 : 4;
      const swing = Math.sin(state.clock.elapsedTime * sp + aux.current.phase) * 0.35;
      const legL = tiltRef.current.getObjectByName('legL');
      const legR = tiltRef.current.getObjectByName('legR');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
    } else {
      // Reset gait when not walking
      const legL = tiltRef.current.getObjectByName('legL');
      const legR = tiltRef.current.getObjectByName('legR');
      if (legL) legL.rotation.x *= 1 - k;
      if (legR) legR.rotation.x *= 1 - k;
    }
  });

  const uniform = STRESS_UNIFORM[s.stressLevel];
  const down = s.movementStatus === 'down';
  const skin = '#c39972';
  const pip =
    down ? '#dc2626'
      : s.stressLevel === 'critical' ? '#f87171'
      : s.stressLevel === 'elevated' ? '#fde047'
      : '#86efac';

  return (
    <group ref={groupRef} scale={FIGURE_SCALE}>
      {/* tilt pivot — feet at y=0 of this inner group */}
      <group ref={tiltRef}>
        {/* helmet */}
        <mesh castShadow position={[0, 1.20, 0]}>
          <sphereGeometry args={[0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          <meshStandardMaterial color={down ? '#5a2a2a' : '#2d3a25'} roughness={0.75} />
        </mesh>
        {/* face */}
        <mesh position={[0, 1.08, 0.06]}>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color={skin} roughness={0.9} />
        </mesh>
        {/* torso */}
        <mesh castShadow position={[0, 0.70, 0]}>
          <boxGeometry args={[0.55, 0.6, 0.32]} />
          <meshStandardMaterial color={uniform} roughness={0.85} />
        </mesh>
        {/* plate carrier */}
        <mesh position={[0, 0.70, 0.18]}>
          <boxGeometry args={[0.46, 0.5, 0.06]} />
          <meshStandardMaterial color="#2a3022" roughness={0.95} />
        </mesh>
        {/* arms */}
        <mesh castShadow position={[-0.36, 0.70, 0]}>
          <boxGeometry args={[0.16, 0.55, 0.2]} />
          <meshStandardMaterial color={uniform} />
        </mesh>
        <mesh castShadow position={[0.36, 0.70, 0]}>
          <boxGeometry args={[0.16, 0.55, 0.2]} />
          <meshStandardMaterial color={uniform} />
        </mesh>
        {/* legs — feet bottom now at y=0 */}
        <mesh name="legL" castShadow position={[-0.15, 0.30, 0]}>
          <boxGeometry args={[0.2, 0.6, 0.24]} />
          <meshStandardMaterial color="#2d3a25" />
        </mesh>
        <mesh name="legR" castShadow position={[0.15, 0.30, 0]}>
          <boxGeometry args={[0.2, 0.6, 0.24]} />
          <meshStandardMaterial color="#2d3a25" />
        </mesh>
        {/* rifle */}
        <mesh position={[0.22, 0.80, 0.34]} rotation={[Math.PI / 8, 0, 0]}>
          <boxGeometry args={[0.07, 0.08, 0.95]} />
          <meshStandardMaterial color="#181818" roughness={0.35} metalness={0.6} />
        </mesh>
      </group>
      {/* status pip — outside tilt so it always points up */}
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshBasicMaterial color={pip} />
      </mesh>
    </group>
  );
}

export function Soldiers({ soldiers }: { soldiers: Soldier[] }) {
  return (
    <group>
      {soldiers.map((s) => (
        <SoldierFigure key={s.id} s={s} />
      ))}
    </group>
  );
}
