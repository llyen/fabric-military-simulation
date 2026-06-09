import { CENTER_LAT, CENTER_LON } from '@/data/sectors';

/**
 * Convert geographic coordinates to scene-local meters around the
 * Drawsko Pomorskie center. Z grows northwards, X grows eastwards.
 *
 * Approximation good for ~10 km radius (we are at ~53.5° N).
 */
const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LON = 111.32 * Math.cos((CENTER_LAT * Math.PI) / 180);

/** Returns position in METRES (Three.js world units = 1 m). */
export function geoToWorld(lat: number, lon: number): [number, number, number] {
  const dx = (lon - CENTER_LON) * KM_PER_DEG_LON * 1000;
  const dz = -(lat - CENTER_LAT) * KM_PER_DEG_LAT * 1000;
  return [dx, 0, dz];
}

export function worldToGeo(x: number, z: number): { lat: number; lon: number } {
  const lat = CENTER_LAT - z / 1000 / KM_PER_DEG_LAT;
  const lon = CENTER_LON + x / 1000 / KM_PER_DEG_LON;
  return { lat, lon };
}

/**
 * Convert compass heading (0=N, 90=E) to a Y-axis yaw in radians for a model
 * whose object-space "forward" is +Z. World convention: north = -Z, east = +X.
 *
 *   heading 0   → yaw  π   (faces -Z)
 *   heading 90  → yaw  π/2 (faces +X)
 *   heading 180 → yaw  0   (faces +Z)
 *   heading 270 → yaw -π/2 (faces -X)
 */
export function headingToYaw(headingDeg: number): number {
  return Math.PI - (headingDeg * Math.PI) / 180;
}
