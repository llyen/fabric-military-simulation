import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { RadarTrack, Selection } from '@/types';
import { geoToWorld } from '@/utils/geo';
import { terrainHeight } from '@/utils/terrain';
import { HighlightRing } from './HighlightRing';

const COLOR: Record<RadarTrack['classification'], string> = {
  friendly: '#22d3ee',
  hostile: '#ef4444',
  unknown: '#facc15',
};

function TrackMarker({
  tr,
  selected,
  onSelect,
}: {
  tr: RadarTrack;
  selected: boolean;
  onSelect: (sel: Selection) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const beamRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!ringRef.current) return;
    const t = state.clock.elapsedTime + tr.id.length;
    const s = 1 + ((t * 1.2) % 1) * 1.6;
    ringRef.current.scale.set(s, s, s);
    const m = ringRef.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.7 * (1 - ((t * 1.2) % 1));
    // slow rotating threat diamond
    if (beamRef.current) {
      beamRef.current.rotation.y = t * 0.6;
      beamRef.current.position.y = 60 + Math.sin(t * 1.5) * 6;
    }
  });

  const [x, , z] = geoToWorld(tr.latitude, tr.longitude);
  const y = terrainHeight(x, z);
  const color = COLOR[tr.classification];

  return (
    <group
      position={[x, y, z]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect({ kind: 'radar', id: tr.id });
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {selected && <HighlightRing radius={85} y={2} />}
      {/* ground ring ping */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[40, 60, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* threat icon — small floating diamond just above ground ring */}
      <mesh ref={beamRef} position={[0, 60, 0]}>
        <octahedronGeometry args={[22, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export function RadarTracks({
  tracks,
  selection,
  onSelect,
}: {
  tracks: RadarTrack[];
  selection: Selection | null;
  onSelect: (sel: Selection) => void;
}) {
  return (
    <group>
      {tracks.map((t) => (
        <TrackMarker
          key={t.id}
          tr={t}
          selected={selection?.kind === 'radar' && selection.id === t.id}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
