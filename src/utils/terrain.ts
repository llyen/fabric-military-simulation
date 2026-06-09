import { createNoise2D } from 'simplex-noise';

/**
 * Deterministic procedural terrain for the Drawsko range.
 * Mostly flat plains with low ridges and a forested rise on the east —
 * matches the real character of the area without being a literal heightmap.
 */
const noise = createNoise2D(mulberry32(42));

/** Returns terrain height in metres for given world (x,z) in metres. */
export function terrainHeight(x: number, z: number): number {
  const kx = x / 2500;
  const kz = z / 2500;

  // Low rolling hills
  let h = 0;
  h += noise(kx, kz) * 35;
  h += noise(kx * 2.1, kz * 2.1) * 14;
  h += noise(kx * 4.7, kz * 4.7) * 5;

  // Eastern ridge bias (Bravo direction)
  const ridge = Math.max(0, x / 1000 - 1.5);
  h += ridge * 6;

  // Subtle valley along the diagonal
  h -= Math.exp(-(((x + z) / 4000) ** 2)) * 8;

  return h;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
