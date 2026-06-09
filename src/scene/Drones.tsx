import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Drone } from '@/types';
import { geoToWorld } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';

const DRONE_SCALE = 60;

/* ──────────────── FlyEye — fixed-wing ISR ──────────────── */
function FlyEyeModel({ d: _d }: { d: Drone }) {
  const propRef = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (propRef.current) propRef.current.rotation.z = state.clock.elapsedTime * 60;
  });
  const body = '#dcd8c8';        // light tan camo for FlyEye
  const accent = '#5a5040';
  return (
    <>
      {/* fuselage — slim cigar lying along forward axis (Z) */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.07, 1.1, 12]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* main wing — wide span along X, thin chord along Z */}
      <mesh castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[2.4, 0.04, 0.32]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* wing tips angled up */}
      <mesh position={[1.18, 0.1, 0]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.3, 0.04, 0.2]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[-1.18, 0.1, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.3, 0.04, 0.2]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {/* twin tail boom — extending backwards along -Z */}
      <mesh position={[0.18, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[-0.18, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {/* horizontal stab */}
      <mesh position={[0, 0, -0.85]}>
        <boxGeometry args={[0.5, 0.03, 0.18]} />
        <meshStandardMaterial color={body} />
      </mesh>
      {/* twin vertical fins */}
      <mesh position={[0.18, 0.13, -0.85]}>
        <boxGeometry args={[0.03, 0.25, 0.15]} />
        <meshStandardMaterial color={body} />
      </mesh>
      <mesh position={[-0.18, 0.13, -0.85]}>
        <boxGeometry args={[0.03, 0.25, 0.15]} />
        <meshStandardMaterial color={body} />
      </mesh>
      {/* gimbal camera ball under nose (nose = +Z) */}
      <mesh castShadow position={[0, -0.13, 0.35]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.13, 0.42]}>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      {/* tail pusher prop spinning around Z */}
      <mesh ref={propRef} position={[0, 0, -1.0]}>
        <boxGeometry args={[0.55, 0.03, 0.04]} />
        <meshStandardMaterial color="#222" transparent opacity={0.55} />
      </mesh>
      {/* nav lights — green starboard (+X), red port (-X) */}
      <mesh position={[1.18, 0.12, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh position={[-1.18, 0.12, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </>
  );
}

/* ──────────────── Warmate — loitering munition (X-quad) ──────────────── */
function WarmateModel({ d: _d }: { d: Drone }) {
  const r1 = useRef<THREE.Mesh>(null!);
  const r2 = useRef<THREE.Mesh>(null!);
  const r3 = useRef<THREE.Mesh>(null!);
  const r4 = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 80;
    if (r1.current) r1.current.rotation.y = t;
    if (r2.current) r2.current.rotation.y = -t;
    if (r3.current) r3.current.rotation.y = t;
    if (r4.current) r4.current.rotation.y = -t;
  });
  const body = '#1a1f24';

  const Arm = ({ x, z }: { x: number; z: number }) => {
    const len = Math.hypot(x, z);
    const ang = Math.atan2(x, z);
    return (
      <group rotation={[0, ang, 0]}>
        <mesh position={[0, 0, len / 2]}>
          <boxGeometry args={[0.06, 0.06, len]} />
          <meshStandardMaterial color={body} />
        </mesh>
      </group>
    );
  };

  return (
    <>
      {/* central body */}
      <mesh castShadow>
        <boxGeometry args={[0.45, 0.18, 0.45]} />
        <meshStandardMaterial color={body} roughness={0.7} />
      </mesh>
      {/* warhead nose underneath */}
      <mesh castShadow position={[0, -0.18, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.35, 12]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.85} />
      </mesh>
      {/* 4 arms in X */}
      <Arm x={0.55} z={0.55} />
      <Arm x={-0.55} z={0.55} />
      <Arm x={0.55} z={-0.55} />
      <Arm x={-0.55} z={-0.55} />
      {/* motors at arm tips */}
      {[
        { x: 0.55, z: 0.55, ref: r1 },
        { x: -0.55, z: 0.55, ref: r2 },
        { x: 0.55, z: -0.55, ref: r3 },
        { x: -0.55, z: -0.55, ref: r4 },
      ].map((m, i) => (
        <group key={i} position={[m.x, 0.05, m.z]}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 10]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.5} />
          </mesh>
          {/* spinning rotor disc — semi-transparent for blur effect */}
          <mesh ref={m.ref} position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.012, 18]} />
            <meshBasicMaterial color="#444" transparent opacity={0.35} />
          </mesh>
          {/* visible blades */}
          <mesh ref={m.ref} position={[0, 0.08, 0]}>
            <boxGeometry args={[0.62, 0.012, 0.04]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      ))}
      {/* camera */}
      <mesh position={[0, -0.05, 0.22]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color="#111" metalness={0.5} />
      </mesh>
    </>
  );
}

function DroneModel({ d }: { d: Drone }) {
  const ref = useRef<THREE.Group>(null!);
  const bankRef = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const beamRef = useRef<THREE.Group>(null!);
  const aux = useRef({
    target: new THREE.Vector3(),
    last: new THREE.Vector3(),
    yaw: 0,
    init: false,
  });

  useFrame((state, delta) => {
    if (!ref.current) return;
    const [x, , z] = geoToWorld(d.latitude, d.longitude);
    const ground = terrainHeight(x, z);
    const y = ground + d.altitudeM;
    aux.current.target.set(x, y, z);
    if (!aux.current.init) {
      ref.current.position.copy(aux.current.target);
      aux.current.last.copy(aux.current.target);
      aux.current.init = true;
    }
    const k = 1 - Math.exp(-delta * 4);
    ref.current.position.lerp(aux.current.target, k);

    // Yaw from horizontal motion direction.
    const dx = aux.current.target.x - aux.current.last.x;
    const dz = aux.current.target.z - aux.current.last.z;
    const motion = Math.hypot(dx, dz);
    if (motion > 0.5) aux.current.yaw = Math.atan2(dx, dz);
    aux.current.last.copy(aux.current.target);

    let dy = aux.current.yaw - ref.current.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    ref.current.rotation.y += dy * (1 - Math.exp(-delta * 2.5));

    // Fixed-wing FlyEye banks into turns; Warmate pitches gently
    if (bankRef.current) {
      if (d.droneType !== 'Warmate') {
        const bankTarget = THREE.MathUtils.clamp(dy * 4, -0.4, 0.4);
        bankRef.current.rotation.z += (bankTarget - bankRef.current.rotation.z) * (1 - Math.exp(-delta * 3));
      } else {
        // Warmate hover bob
        bankRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.3) * 0.05;
      }
    }

    // Target-lock pulse expanding ring
    if (ringRef.current) {
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      if (d.observationType === 'target_lock') {
        const phase = (state.clock.elapsedTime * 0.8) % 1;
        const sc = 1 + phase * 6;
        ringRef.current.scale.set(sc, sc, sc);
        m.opacity = 0.6 * (1 - phase);
      } else {
        m.opacity = 0;
      }
    }
    // Pulsating sensor beam down to target
    if (beamRef.current) {
      const visible = d.observationType === 'target_lock';
      beamRef.current.visible = visible;
      if (visible) beamRef.current.rotation.z = state.clock.elapsedTime * 2;
    }
  });

  const isWarmate = d.droneType === 'Warmate';

  return (
    <group ref={ref} scale={DRONE_SCALE}>
      <group ref={bankRef}>
        {isWarmate ? <WarmateModel d={d} /> : <FlyEyeModel d={d} />}
      </group>

      {/* status light visible from far */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshBasicMaterial color={d.observationType === 'target_lock' ? '#ef4444' : '#22d3ee'} />
      </mesh>

      {/* expanding target-lock ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* sensor beam down */}
      <group ref={beamRef} visible={false}>
        <mesh position={[0, -d.altitudeM / DRONE_SCALE / 2, 0]}>
          <coneGeometry args={[d.altitudeM / DRONE_SCALE / 6, d.altitudeM / DRONE_SCALE, 16, 1, true]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export function Drones({ drones }: { drones: Drone[] }) {
  return (
    <group>
      {drones.map((d) => (
        <DroneModel key={d.id} d={d} />
      ))}
    </group>
  );
}
