import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vehicle } from '@/types';
import { geoToWorld, headingToYaw } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';

const VEHICLE_SCALE = 50;

const COLOR_BY_TYPE: Record<string, string> = {
  BWP_Borsuk: '#3a5a32',
  Rosomak:    '#4a5a3a',
  Krab:       '#3e3a2a',
};

/* Procedural track texture — shared between vehicle instances. */
let TRACK_TEX: THREE.CanvasTexture | null = null;
function getTrackTex(): THREE.CanvasTexture | null {
  if (TRACK_TEX) return TRACK_TEX;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 16;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = '#3a3a3a';
  for (let i = 0; i < 8; i++) ctx.fillRect(i * 8 + 1, 2, 6, 12);
  ctx.fillStyle = '#0a0a0a';
  for (let i = 0; i < 8; i++) ctx.fillRect(i * 8 + 3, 5, 2, 6);
  TRACK_TEX = new THREE.CanvasTexture(cv);
  TRACK_TEX.wrapS = THREE.RepeatWrapping;
  TRACK_TEX.repeat.x = 6;
  return TRACK_TEX;
}

/** Smoke + dust kicked up behind a moving tracked vehicle. */
function DustTrail({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshBasicMaterial;
    const target = active ? 0.18 : 0;
    m.opacity += (target - m.opacity) * 0.05;
    ref.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
  });
  return (
    <mesh ref={ref} position={[0, 0.4, -1.4]}>
      <sphereGeometry args={[0.7, 12, 8]} />
      <meshBasicMaterial color="#a89070" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

interface ModelProps {
  v: Vehicle;
  trackTex: THREE.CanvasTexture | null;
}

function BWPModel({ v, trackTex }: ModelProps) {
  const trackL = useRef<THREE.Mesh>(null!);
  const trackR = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const scroll = state.clock.elapsedTime * (v.speedKmh / 5 + 0.05);
    if (trackL.current) {
      const m = trackL.current.material as THREE.MeshStandardMaterial;
      if (m.map) m.map.offset.x = -scroll;
    }
    if (trackR.current) {
      const m = trackR.current.material as THREE.MeshStandardMaterial;
      if (m.map) m.map.offset.x = -scroll;
    }
  });
  const baseColor = !v.combatReady ? '#5a3a3a' : COLOR_BY_TYPE.BWP_Borsuk;
  return (
    <>
      {/* lower hull */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.0, 0.5, 2.1]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} />
      </mesh>
      {/* upper hull */}
      <mesh castShadow position={[0, 0.95, -0.05]}>
        <boxGeometry args={[0.95, 0.4, 1.95]} />
        <meshStandardMaterial color={baseColor} roughness={0.85} />
      </mesh>
      {/* sloped glacis plate */}
      <mesh castShadow position={[0, 0.78, 1.05]} rotation={[-0.55, 0, 0]}>
        <boxGeometry args={[0.95, 0.5, 0.42]} />
        <meshStandardMaterial color={baseColor} roughness={0.85} />
      </mesh>
      {/* tracks */}
      <mesh ref={trackL} position={[-0.55, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.32, 2.2]} />
        <meshStandardMaterial map={trackTex ?? undefined} color="#222" side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={trackR} position={[0.55, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.32, 2.2]} />
        <meshStandardMaterial map={trackTex ?? undefined} color="#222" side={THREE.DoubleSide} />
      </mesh>
      {/* drive sprockets (front + rear) */}
      {[-1.0, 1.0].map((zp) => (
        <group key={zp}>
          <mesh position={[-0.55, 0.22, zp]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.22, 0.22, 0.18, 14]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0.55, 0.22, zp]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.22, 0.22, 0.18, 14]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}
      {/* skirt panels */}
      <mesh position={[-0.62, 0.5, 0]}>
        <boxGeometry args={[0.06, 0.2, 1.9]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} />
      </mesh>
      <mesh position={[0.62, 0.5, 0]}>
        <boxGeometry args={[0.06, 0.2, 1.9]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} />
      </mesh>
    </>
  );
}

function RosomakModel({ v }: ModelProps) {
  const wheels = useRef<THREE.Group[]>([]);
  useFrame(() => {
    const dphi = (v.speedKmh * 0.0006) || 0;
    for (const g of wheels.current) if (g) g.rotation.x += dphi;
  });
  const baseColor = !v.combatReady ? '#5a3a3a' : COLOR_BY_TYPE.Rosomak;
  const setRef = (i: number) => (el: THREE.Group | null) => {
    if (el) wheels.current[i] = el;
  };
  return (
    <>
      {/* main hull (boat-like) */}
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[1.05, 0.55, 2.4]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} />
      </mesh>
      {/* upper deck */}
      <mesh castShadow position={[0, 1.0, -0.2]}>
        <boxGeometry args={[1.0, 0.4, 1.6]} />
        <meshStandardMaterial color={baseColor} roughness={0.85} />
      </mesh>
      {/* sloped front */}
      <mesh castShadow position={[0, 0.78, 1.25]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[1.05, 0.5, 0.4]} />
        <meshStandardMaterial color={baseColor} roughness={0.85} />
      </mesh>
      {/* 4 wheel pairs */}
      {[-0.85, -0.3, 0.3, 0.85].map((zp, i) => (
        <group key={i} ref={setRef(i)} position={[0, 0.28, zp]}>
          <mesh position={[-0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.2, 18]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          <mesh position={[0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.2, 18]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          {/* hub caps */}
          <mesh position={[-0.66, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.04, 10]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh position={[0.66, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.04, 10]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
        </group>
      ))}
      {/* mudguards */}
      {[-0.85, -0.3, 0.3, 0.85].map((zp, i) => (
        <mesh key={`mg-${i}`} position={[0, 0.55, zp]}>
          <boxGeometry args={[1.3, 0.05, 0.5]} />
          <meshStandardMaterial color="#1f1f1f" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

function KrabModel({ v, trackTex }: ModelProps) {
  const baseColor = !v.combatReady ? '#5a3a3a' : COLOR_BY_TYPE.Krab;
  return (
    <>
      {/* heavy hull */}
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[1.2, 0.6, 2.6]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.05, -0.2]}>
        <boxGeometry args={[1.15, 0.5, 2.0]} />
        <meshStandardMaterial color={baseColor} roughness={0.85} />
      </mesh>
      {/* tracks */}
      <mesh position={[-0.65, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.36, 2.6]} />
        <meshStandardMaterial map={trackTex ?? undefined} color="#222" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.65, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.36, 2.6]} />
        <meshStandardMaterial map={trackTex ?? undefined} color="#222" side={THREE.DoubleSide} />
      </mesh>
      {/* extra side stowage */}
      <mesh position={[-0.7, 0.95, -0.4]}>
        <boxGeometry args={[0.12, 0.35, 1.2]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0.7, 0.95, -0.4]}>
        <boxGeometry args={[0.12, 0.35, 1.2]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </>
  );
}

function Turret({ v }: { v: Vehicle }) {
  const turret = useRef<THREE.Group>(null!);
  const isKrab = v.vehicleType === 'Krab';
  const baseColor = !v.combatReady ? '#5a3a3a' : COLOR_BY_TYPE[v.vehicleType] ?? '#3a5a32';

  useFrame((state) => {
    if (!turret.current) return;
    const t = isKrab
      ? Math.sin(state.clock.elapsedTime * 0.2) * 0.3 + Math.PI / 8
      : Math.sin(state.clock.elapsedTime * 0.5 + v.id.length) * 0.7;
    turret.current.rotation.y += (t - turret.current.rotation.y) * 0.05;
  });

  if (isKrab) {
    // Big boxy howitzer turret, large barrel angled up
    return (
      <group ref={turret} position={[0, 1.55, -0.2]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.7, 1.55]} />
          <meshStandardMaterial color={baseColor} roughness={0.85} />
        </mesh>
        {/* barrel cradle */}
        <mesh position={[0, 0.05, 0.85]}>
          <boxGeometry args={[0.3, 0.25, 0.35]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        {/* barrel — angled up 12° */}
        <group position={[0, 0.05, 0.85]} rotation={[-0.2, 0, 0]}>
          <mesh position={[0, 0, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 2.6, 12]} />
            <meshStandardMaterial color="#1f1f1f" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* muzzle brake */}
          <mesh position={[0, 0, 2.7]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.11, 0.3, 12]} />
            <meshStandardMaterial color="#0a0a0a" />
          </mesh>
        </group>
        {/* commander hatch */}
        <mesh position={[-0.25, 0.4, -0.4]}>
          <cylinderGeometry args={[0.18, 0.18, 0.12, 12]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
      </group>
    );
  }

  // Standard turret for BWP / Rosomak
  return (
    <group ref={turret} position={[0, 1.4, 0.05]}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.4, 0.85]} />
        <meshStandardMaterial color={baseColor} roughness={0.8} />
      </mesh>
      {/* main gun */}
      <mesh position={[0, 0.05, 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 10]} />
        <meshStandardMaterial color="#1f1f1f" metalness={0.3} roughness={0.55} />
      </mesh>
      {/* coax MG */}
      <mesh position={[0.18, 0.18, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* commander cupola */}
      <mesh position={[0, 0.32, -0.15]}>
        <cylinderGeometry args={[0.16, 0.18, 0.18, 12]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
      {/* periscope */}
      <mesh position={[0, 0.5, -0.15]}>
        <boxGeometry args={[0.1, 0.15, 0.08]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      {/* smoke launchers */}
      {[-0.3, 0.3].map((xp) => (
        <group key={xp} position={[xp, 0.2, 0.45]}>
          {[-0.06, 0, 0.06].map((zo) => (
            <mesh key={zo} position={[0, 0, zo]}>
              <cylinderGeometry args={[0.025, 0.025, 0.16, 6]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function VehicleModel({ v }: { v: Vehicle }) {
  const ref = useRef<THREE.Group>(null!);
  const target = useRef(new THREE.Vector3());
  const lastPos = useRef(new THREE.Vector3());
  const trackTex = useMemo(() => getTrackTex(), []);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    const [x, , z] = geoToWorld(v.latitude, v.longitude);
    const y = terrainHeight(x, z);
    target.current.set(x, y, z);
    // dt-aware critically damped smoothing → consistent at any FPS / sim speed
    const k = 1 - Math.exp(-delta * 6);
    ref.current.position.lerp(target.current, k);

    // Derive heading from motion when moving fast enough; fall back to v.headingDeg.
    let yaw: number;
    const dx = target.current.x - lastPos.current.x;
    const dz = target.current.z - lastPos.current.z;
    const motion = Math.hypot(dx, dz);
    if (motion > 0.5 && v.speedKmh > 1) {
      yaw = Math.atan2(dx, dz);
    } else {
      yaw = headingToYaw(v.headingDeg);
    }
    lastPos.current.copy(target.current);

    let dy = yaw - ref.current.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    ref.current.rotation.y += dy * (1 - Math.exp(-delta * 4));
  });

  const damaged = !v.combatReady || v.engineStatus === 'damaged';

  return (
    <group ref={ref} scale={VEHICLE_SCALE}>
      {v.vehicleType === 'Rosomak' && <RosomakModel v={v} trackTex={trackTex} />}
      {v.vehicleType === 'Krab' && <KrabModel v={v} trackTex={trackTex} />}
      {v.vehicleType !== 'Rosomak' && v.vehicleType !== 'Krab' && (
        <BWPModel v={v} trackTex={trackTex} />
      )}
      <Turret v={v} />
      {/* whip antenna */}
      <mesh position={[0.32, 1.7, -0.5]}>
        <cylinderGeometry args={[0.012, 0.008, 1.5, 6]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0.32, 2.45, -0.5]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* dust trail */}
      <DustTrail active={v.speedKmh > 4} />
      {/* status pip */}
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshBasicMaterial color={damaged ? '#ef4444' : '#22d3ee'} />
      </mesh>
    </group>
  );
}

export function Vehicles({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <group>
      {vehicles.map((v) => (
        <VehicleModel key={v.id} v={v} />
      ))}
    </group>
  );
}
