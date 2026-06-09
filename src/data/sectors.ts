/** Geographic anchor – Drawsko Pomorskie training area. */
export const CENTER_LAT = 53.530;
export const CENTER_LON = 15.780;

/** Half-extent of the simulated world in km (square). */
export const WORLD_HALF_KM = 8;

/** Sector definitions match generate_datasets.py from fabric-military-demo. */
export const SECTORS = [
  { name: 'Alpha',   lat: 53.545, lon: 15.750, radiusKm: 2.0, role: 'friendly_rear' },
  { name: 'Bravo',   lat: 53.530, lon: 15.810, radiusKm: 2.5, role: 'contested' },
  { name: 'Charlie', lat: 53.515, lon: 15.770, radiusKm: 2.0, role: 'forward' },
  { name: 'Delta',   lat: 53.540, lon: 15.800, radiusKm: 1.5, role: 'observation' },
] as const;

export type SectorName = typeof SECTORS[number]['name'];

export const VEHICLE_TYPES = ['BWP_Borsuk', 'Rosomak', 'Krab'] as const;
export const DRONE_TYPES = ['FlyEye', 'Warmate'] as const;
export const UNIT_NAMES = [
  '1. kompania zmech.',
  '2. kompania zmech.',
  '3. kompania zmech.',
  'bateria Krab',
] as const;
