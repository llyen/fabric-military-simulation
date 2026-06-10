import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SECTORS } from '@/data/sectors';
import { geoToWorld } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';

const WORLD_HALF = 7000; // m (slightly inside the 16 km terrain)
const PROPS_SCALE = 25; // match vehicle/figure scale so structures read at distance

/* deterministic RNG */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─────────────────────────── FORESTS ─────────────────────────── */
/** Two instanced meshes (trunk + canopy) with thousands of trees scattered
 * deterministically only on flatter low-altitude terrain. */
function Forests() {
  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const canopyRef = useRef<THREE.InstancedMesh>(null!);
  const TREE_COUNT = 1800;

  const matrices = useMemo(() => {
    const rng = mulberry32(7);
    const dummy = new THREE.Object3D();
    const trunkMs: THREE.Matrix4[] = [];
    const canopyMs: THREE.Matrix4[] = [];
    let attempts = 0;
    while (trunkMs.length < TREE_COUNT && attempts < TREE_COUNT * 8) {
      attempts++;
      const x = (rng() * 2 - 1) * WORLD_HALF;
      const z = (rng() * 2 - 1) * WORLD_HALF;
      const h = terrainHeight(x, z);
      const slope = Math.hypot(
        terrainHeight(x + 30, z) - h,
        terrainHeight(x, z + 30) - h
      ) / 30;
      // Forest mask similar to the colour mask in Terrain.tsx
      const forestProb = h > 5 && h < 30 && slope < 0.35
        ? Math.max(0, Math.sin(x * 0.0035) * Math.cos(z * 0.004) - 0.05) + 0.1
        : 0;
      if (rng() > forestProb) continue;
      const scale = (0.8 + rng() * 1.4) * 6;
      const yaw = rng() * Math.PI * 2;
      // trunk
      dummy.position.set(x, h + 6 * scale, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunkMs.push(dummy.matrix.clone());
      // canopy on top
      dummy.position.set(x, h + 14 * scale, z);
      dummy.scale.set(scale * 1.4, scale * 1.6, scale * 1.4);
      dummy.updateMatrix();
      canopyMs.push(dummy.matrix.clone());
    }
    return { trunkMs, canopyMs };
  }, []);

  useMemo(() => {
    if (trunkRef.current) {
      matrices.trunkMs.forEach((m, i) => trunkRef.current.setMatrixAt(i, m));
      trunkRef.current.instanceMatrix.needsUpdate = true;
      trunkRef.current.count = matrices.trunkMs.length;
    }
    if (canopyRef.current) {
      matrices.canopyMs.forEach((m, i) => canopyRef.current.setMatrixAt(i, m));
      canopyRef.current.instanceMatrix.needsUpdate = true;
      canopyRef.current.count = matrices.canopyMs.length;
    }
  }, [matrices]);

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, TREE_COUNT]}
        castShadow
        frustumCulled={false}
      >
        <cylinderGeometry args={[1.4, 2.0, 12, 6]} />
        <meshStandardMaterial color="#4a3220" roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={canopyRef}
        args={[undefined, undefined, TREE_COUNT]}
        castShadow
        frustumCulled={false}
      >
        <coneGeometry args={[7, 18, 8]} />
        <meshStandardMaterial color="#1f3a1c" roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}

/* ─────────────────────────── DIRT ROADS ─────────────────────────── */
/** Flat ribbon roads draped on the terrain — built as triangle strips so the
 * road hugs slopes instead of floating like a cylindrical pipe. */
function Roads() {
  const geometries = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    const sectorCenters = SECTORS.map((s) => {
      const [x, , z] = geoToWorld(s.lat, s.lon);
      return new THREE.Vector3(x, 0, z);
    });
    const order = [0, 1, 3, 2, 0]; // Alpha → Bravo → Delta → Charlie → Alpha
    const ROAD_HALF_WIDTH = 14; // metres
    const SAMPLES = 240;

    for (let i = 0; i < order.length - 1; i++) {
      const a = sectorCenters[order[i]];
      const b = sectorCenters[order[i + 1]];
      const path = makeWiggly(a, b, 6);
      const curve = new THREE.CatmullRomCurve3(path);

      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      let prevTan = new THREE.Vector3(0, 0, 1);

      for (let j = 0; j <= SAMPLES; j++) {
        const t = j / SAMPLES;
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        if (tan.lengthSq() < 1e-6) tan.copy(prevTan); else prevTan.copy(tan);
        // Perpendicular in XZ plane (road sits flat on terrain)
        const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

        const lx = p.x + perp.x * ROAD_HALF_WIDTH;
        const lz = p.z + perp.z * ROAD_HALF_WIDTH;
        const rx = p.x - perp.x * ROAD_HALF_WIDTH;
        const rz = p.z - perp.z * ROAD_HALF_WIDTH;

        // Tiny lift above terrain to avoid z-fighting
        positions.push(lx, terrainHeight(lx, lz) + 0.4, lz);
        positions.push(rx, terrainHeight(rx, rz) + 0.4, rz);
        uvs.push(0, t * 40);
        uvs.push(1, t * 40);

        if (j > 0) {
          const base = (j - 1) * 2;
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        }
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      g.computeVertexNormals();
      out.push(g);
    }
    return out;
  }, []);

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial
            color="#8a6f4f"
            roughness={1}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}
    </group>
  );
}

function makeWiggly(a: THREE.Vector3, b: THREE.Vector3, segs: number): THREE.Vector3[] {
  const rng = mulberry32(Math.floor(a.x + b.z));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = a.clone().lerp(b, t);
    const perp = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize();
    p.addScaledVector(perp, (rng() - 0.5) * 350);
    p.y = terrainHeight(p.x, p.z) + 0.6;
    pts.push(p);
  }
  return pts;
}

/* ─────────────────────────── OBSERVATION TOWER ─────────────────────────── */
function ObservationTower({ position, height = 18 }: { position: [number, number, number]; height?: number }) {
  const [x, , z] = position;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y, z]} scale={PROPS_SCALE}>
      {/* 4 legs */}
      {[[-3, -3], [3, -3], [3, 3], [-3, 3]].map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, height / 2, lz]}>
          <boxGeometry args={[0.5, height, 0.5]} />
          <meshStandardMaterial color="#3a3328" roughness={1} />
        </mesh>
      ))}
      {/* X-bracing */}
      {[[-3, 3, -3, -3], [3, -3, 3, 3]].map((c, i) => (
        <mesh key={`b${i}`} position={[0, height / 3, c[1]]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[8, 0.2, 0.2]} />
          <meshStandardMaterial color="#3a3328" />
        </mesh>
      ))}
      {/* platform */}
      <mesh castShadow position={[0, height + 0.3, 0]}>
        <boxGeometry args={[8, 0.5, 8]} />
        <meshStandardMaterial color="#5a4a32" roughness={0.95} />
      </mesh>
      {/* roof */}
      <mesh castShadow position={[0, height + 3, 0]}>
        <coneGeometry args={[6, 2.5, 4]} />
        <meshStandardMaterial color="#2d3a25" />
      </mesh>
      {/* railing posts */}
      {[[-3.5, -3.5], [3.5, -3.5], [3.5, 3.5], [-3.5, 3.5]].map(([lx, lz], i) => (
        <mesh key={`r${i}`} position={[lx, height + 1.4, lz]}>
          <boxGeometry args={[0.15, 1.6, 0.15]} />
          <meshStandardMaterial color="#3a3328" />
        </mesh>
      ))}
      {/* warning light on roof */}
      <mesh position={[0, height + 4.5, 0]}>
        <sphereGeometry args={[0.4, 10, 10]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

/* ─────────────────────────── BUNKER ─────────────────────────── */
function Bunker({ position, yaw = 0 }: { position: [number, number, number]; yaw?: number }) {
  const [x, , z] = position;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} scale={PROPS_SCALE}>
      {/* main concrete block half-buried */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <boxGeometry args={[12, 3, 8]} />
        <meshStandardMaterial color="#5a5a52" roughness={1} />
      </mesh>
      {/* sloped top */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[12.6, 0.4, 8.6]} />
        <meshStandardMaterial color="#4a4a42" roughness={1} />
      </mesh>
      {/* firing slits */}
      {[-3, 0, 3].map((xp) => (
        <mesh key={xp} position={[xp, 2.2, 4.05]}>
          <boxGeometry args={[1.6, 0.3, 0.05]} />
          <meshBasicMaterial color="#000" />
        </mesh>
      ))}
      {/* sandbags (instanced via simple boxes) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const xx = -5.5 + i * 1.0;
        return (
          <mesh key={`sb${i}`} castShadow position={[xx, 0.3, 4.6]}>
            <boxGeometry args={[1.0, 0.55, 0.7]} />
            <meshStandardMaterial color="#7a6a4a" roughness={1} />
          </mesh>
        );
      })}
      {/* camo netting (large flat plane on top) */}
      <mesh position={[0, 3.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 11]} />
        <meshStandardMaterial color="#3a4a30" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────── TARGET SILHOUETTES ─────────────────────────── */
function TargetRange({ position, count = 8 }: { position: [number, number, number]; count?: number }) {
  const [cx, , cz] = position;
  const cy = terrainHeight(cx, cz);
  return (
    <group position={[cx, cy, cz]} scale={PROPS_SCALE}>
      {Array.from({ length: count }).map((_, i) => {
        const xp = -count * 3 / 2 + i * 3;
        // E-type target silhouette
        return (
          <group key={i} position={[xp, 0, 0]}>
            <mesh castShadow position={[0, 1.6, 0]}>
              <boxGeometry args={[0.06, 1.4, 1.0]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
            <mesh castShadow position={[0, 2.7, 0]}>
              <boxGeometry args={[0.06, 0.7, 0.6]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
            {/* support pole */}
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[0.1, 0.8, 0.1]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          </group>
        );
      })}
      {/* berm behind targets */}
      <mesh position={[0, 1.5, -8]}>
        <boxGeometry args={[count * 3.5, 3, 4]} />
        <meshStandardMaterial color="#5a4a32" roughness={1} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────── BLAST CRATERS ─────────────────────────── */
function Craters() {
  const positions = useMemo(() => {
    const rng = mulberry32(99);
    const out: [number, number, number][] = [];
    const placed: [number, number][] = [];
    const tryPush = (x: number, z: number, minDist: number) => {
      for (const [px, pz] of placed) {
        if (Math.hypot(x - px, z - pz) < minDist) return false;
      }
      placed.push([x, z]);
      out.push([x, terrainHeight(x, z) + 0.2, z]);
      return true;
    };
    // Cluster craters around Bravo (contested sector), spread evenly over the
    // area (sqrt radius, not linear — linear piles them up in the centre) and
    // reject any that land too close to an existing one so they never merge.
    const sec = SECTORS[1];
    const [bx, , bz] = geoToWorld(sec.lat, sec.lon);
    const clusterR = sec.radiusKm * 1000 * 0.95;
    for (let placedCount = 0, attempts = 0; placedCount < 22 && attempts < 800; attempts++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * clusterR;
      if (tryPush(bx + Math.cos(a) * r, bz + Math.sin(a) * r, 360)) placedCount++;
    }
    // A handful scattered across the wider range, well separated.
    for (let scatter = 0, attempts = 0; scatter < 10 && attempts < 500; attempts++) {
      const x = (rng() * 2 - 1) * 5000;
      const z = (rng() * 2 - 1) * 5000;
      if (tryPush(x, z, 600)) scatter++;
    }
    return out;
  }, []);
  return (
    <group>
      {positions.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} scale={PROPS_SCALE * 0.6}>
          {/* dark scorch ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <ringGeometry args={[1.5, 5 + (i % 4) * 1.5, 24]} />
            <meshBasicMaterial
              color="#1a1308" transparent opacity={0.85} side={THREE.DoubleSide}
              polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
              depthWrite={false}
            />
          </mesh>
          {/* inner crater bowl — slightly above the scorch ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <circleGeometry args={[2.2 + (i % 4) * 0.5, 16]} />
            <meshBasicMaterial
              color="#0a0703"
              polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3}
              depthWrite={false}
            />
          </mesh>
          {/* ejecta debris specks */}
          {Array.from({ length: 5 }).map((_, k) => {
            const a = (k / 5) * Math.PI * 2 + i;
            const rr = 8 + (k % 3) * 2;
            return (
              <mesh
                key={k}
                position={[Math.cos(a) * rr, 0.08, Math.sin(a) * rr]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <circleGeometry args={[0.4 + (k % 2) * 0.3, 6]} />
                <meshBasicMaterial
                  color="#3a2a1a"
                  polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/* ─────────────────────────── HELIPAD (Alpha rear) ─────────────────────────── */
function Helipad({ position }: { position: [number, number, number] }) {
  const [x, , z] = position;
  const y = terrainHeight(x, z);
  return (
    <group position={[x, y + 0.6, z]} scale={PROPS_SCALE}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[14, 32]} />
        <meshStandardMaterial
          color="#2a2a2a" roughness={1}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
      {/* H marking — sits above pad surface */}
      <mesh position={[-2.5, 0.15, -3.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 7]} />
        <meshBasicMaterial
          color="#facc15"
          polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[2.5, 0.15, -3.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 7]} />
        <meshBasicMaterial
          color="#facc15"
          polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.15, -3.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 1.5]} />
        <meshBasicMaterial
          color="#facc15"
          polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}
          depthWrite={false}
        />
      </mesh>
      {/* outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[12.5, 13.5, 64]} />
        <meshBasicMaterial
          color="#facc15"
          polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────────── BARRACKS BUILDINGS (Alpha) ─────────────────────────── */
function Barracks({ position }: { position: [number, number, number] }) {
  const [cx, , cz] = position;
  const cy = terrainHeight(cx, cz);
  return (
    <group position={[cx, cy, cz]} scale={PROPS_SCALE}>
      {[-22, -7, 8].map((xp, i) => (
        <group key={i} position={[xp, 0, 0]}>
          <mesh castShadow position={[0, 2.5, 0]}>
            <boxGeometry args={[12, 5, 8]} />
            <meshStandardMaterial color="#7a6a4a" roughness={0.9} />
          </mesh>
          {/* roof */}
          <mesh castShadow position={[0, 5.7, 0]}>
            <boxGeometry args={[12.4, 0.7, 8.4]} />
            <meshStandardMaterial color="#3a2a1a" roughness={0.95} />
          </mesh>
          {/* windows */}
          {[-4, 0, 4].map((wx) => (
            <mesh key={wx} position={[wx, 2.8, 4.05]}>
              <boxGeometry args={[1.4, 1.2, 0.02]} />
              <meshStandardMaterial color="#a8c8d8" emissive="#88a8b8" emissiveIntensity={0.2} />
            </mesh>
          ))}
          {/* door */}
          <mesh position={[0, 1.4, 4.05]}>
            <boxGeometry args={[1.3, 2.6, 0.02]} />
            <meshStandardMaterial color="#3a2a1a" />
          </mesh>
        </group>
      ))}
      {/* flagpole between barracks */}
      <mesh position={[-14, 6, 6]}>
        <cylinderGeometry args={[0.1, 0.1, 12, 8]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[-13.2, 10.5, 6]}>
        <planeGeometry args={[1.6, 1.0]} />
        <meshBasicMaterial color="#dc143c" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-13.2, 11.4, 6]}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial color="#fff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────── ROOT ─────────────────────────── */
export function PoligonProps() {
  // Place static structures based on sector centres
  const alphaPos = useMemo<[number, number, number]>(() => {
    const [x, , z] = geoToWorld(SECTORS[0].lat, SECTORS[0].lon);
    return [x, 0, z];
  }, []);
  const deltaPos = useMemo<[number, number, number]>(() => {
    const [x, , z] = geoToWorld(SECTORS[3].lat, SECTORS[3].lon);
    return [x, 0, z];
  }, []);

  return (
    <group>
      <Forests />
      <Roads />
      <Craters />

      {/* Alpha (rear) — barracks, helipad, target range */}
      <Barracks position={[alphaPos[0] - 80, 0, alphaPos[2] - 60]} />
      <Helipad position={[alphaPos[0] + 60, 0, alphaPos[2] - 30]} />
      <TargetRange position={[alphaPos[0] + 200, 0, alphaPos[2] + 80]} count={10} />

      {/* Delta (observation) — towers */}
      <ObservationTower position={[deltaPos[0], 0, deltaPos[2]]} height={22} />
      <ObservationTower position={[deltaPos[0] + 250, 0, deltaPos[2] + 100]} height={16} />

      {/* Forward bunkers along the contested edge */}
      <Bunker position={[1100, 0, -200]} yaw={Math.PI / 6} />
      <Bunker position={[-300, 0, 600]} yaw={-Math.PI / 4} />
      <Bunker position={[600, 0, 900]} yaw={0} />
    </group>
  );
}
