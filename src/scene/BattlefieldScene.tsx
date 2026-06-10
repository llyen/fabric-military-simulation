import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Terrain } from './Terrain';
import { PoligonProps } from './PoligonProps';
import { SectorOverlay } from './SectorOverlay';
import { Vehicles } from './Vehicles';
import { Soldiers } from './Soldiers';
import { Drones } from './Drones';
import { RadarTracks } from './RadarTracks';
import { ThreatLines } from './ThreatLines';
import { DetectionLines } from './DetectionLines';
import { Sky } from './Sky';
import type { BattlefieldSnapshot, Selection } from '@/types';

export function BattlefieldScene({
  snapshot,
  selection,
  onSelect,
  onDeselect,
}: {
  snapshot: BattlefieldSnapshot;
  selection: Selection | null;
  onSelect: (sel: Selection) => void;
  onDeselect: () => void;
}) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [1200, 800, 1500], fov: 45, near: 1, far: 30000 }}
      onPointerMissed={onDeselect}
    >
      <Sky snapshot={snapshot} />
      <Stars radius={20000} depth={5000} count={3000} factor={50} fade />
      <Terrain />
      <PoligonProps />
      <SectorOverlay sectors={snapshot.sectors} />
      <Vehicles vehicles={snapshot.vehicles} selection={selection} onSelect={onSelect} />
      <Soldiers soldiers={snapshot.soldiers} selection={selection} onSelect={onSelect} />
      <Drones drones={snapshot.drones} selection={selection} onSelect={onSelect} />
      <RadarTracks tracks={snapshot.radarTracks} selection={selection} onSelect={onSelect} />
      <ThreatLines snapshot={snapshot} />
      <DetectionLines snapshot={snapshot} />
      <OrbitControls
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.07}
        minDistance={300}
        maxDistance={14000}
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  );
}
