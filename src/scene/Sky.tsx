import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BattlefieldSnapshot } from '@/types';

/**
 * Day/night & weather driver. Controls fog, ambient/directional light,
 * and sky background colour from `timeOfDayH` and average fog density.
 */
export function Sky({ snapshot }: { snapshot: BattlefieldSnapshot }) {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null!);
  const moonRef = useRef<THREE.DirectionalLight>(null!);
  const ambientRef = useRef<THREE.AmbientLight>(null!);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#9ab0bf', 0.000025);
  }, [scene]);

  useFrame(() => {
    const h = snapshot.timeOfDayH;
    // Sun angle: noon at h=12
    const sunPhase = ((h - 6) / 12) * Math.PI; // 0..π between sunrise..sunset
    const sunY = Math.sin(sunPhase) * 6000;
    const sunX = Math.cos(sunPhase) * 6000;
    if (sunRef.current) {
      sunRef.current.position.set(sunX, Math.max(sunY, -1500), 1500);
      const dayFactor = Math.max(0, Math.sin(sunPhase));
      sunRef.current.intensity = 1.6 * dayFactor;
      const warmSet = new THREE.Color('#ffd9a8');
      const day = new THREE.Color('#fff7e2');
      sunRef.current.color.copy(day).lerp(warmSet, Math.pow(1 - dayFactor, 2));
    }
    if (moonRef.current) {
      moonRef.current.position.set(-sunX, -sunY + 200, -1500);
      moonRef.current.intensity = Math.max(0, -Math.sin(sunPhase)) * 0.4;
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.25 + Math.max(0, Math.sin(sunPhase)) * 0.4;
    }

    // Sky colour
    const sky = new THREE.Color();
    const noon = new THREE.Color('#9bc6e6');
    const dusk = new THREE.Color('#f0a070');
    const night = new THREE.Color('#0a1424');
    const dayMix = Math.max(0, Math.sin(sunPhase));
    sky.copy(night).lerp(dusk, Math.min(1, dayMix * 2.5));
    sky.lerp(noon, Math.max(0, dayMix - 0.25));
    scene.background = sky;

    // Fog density follows worst sector + light, but kept gentle so the scene stays readable
    const avgFog = snapshot.weather.length
      ? snapshot.weather.reduce((a, w) => a + w.fogDensity, 0) / snapshot.weather.length
      : 0.05;
    const f = scene.fog as THREE.FogExp2;
    if (f) {
      f.density = 0.000015 + avgFog * 0.00012 + (1 - dayMix) * 0.00004;
      f.color.copy(sky).lerp(new THREE.Color('#dbe7ee'), 0.3);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.5} />
      <directionalLight
        ref={sunRef}
        castShadow
        intensity={1.4}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-2000}
        shadow-camera-right={2000}
        shadow-camera-top={2000}
        shadow-camera-bottom={-2000}
      />
      <directionalLight ref={moonRef} intensity={0} color="#a6c4ff" />
    </>
  );
}
