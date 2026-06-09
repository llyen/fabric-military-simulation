/**
 * Headless mirror of `src/services/mockSim.ts` — same equations, but exported
 * as plain functions so the Node simulator can keep state across ticks.
 */
import type {
  BattlefieldSnapshot,
  Drone,
  RadarTrack,
  Sector,
  Soldier,
  Vehicle,
  WeatherCell,
} from '../src/types.ts';

const SECTORS = [
  { name: 'Alpha',   lat: 53.545, lon: 15.750, radiusKm: 2.0, role: 'friendly_rear' },
  { name: 'Bravo',   lat: 53.530, lon: 15.810, radiusKm: 2.5, role: 'contested' },
  { name: 'Charlie', lat: 53.515, lon: 15.770, radiusKm: 2.0, role: 'forward' },
  { name: 'Delta',   lat: 53.540, lon: 15.800, radiusKm: 1.5, role: 'observation' },
] as const;

const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LON = 111.32 * Math.cos((53.53 * Math.PI) / 180);
const kmToLat = (km: number) => km / KM_PER_DEG_LAT;
const kmToLon = (km: number) => km / KM_PER_DEG_LON;

let s = 1;
const rand = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
};
const range = (lo: number, hi: number) => lo + rand() * (hi - lo);
const irand = (lo: number, hi: number) => Math.floor(range(lo, hi + 1));

export function buildInitialWorld(): BattlefieldSnapshot {
  s = 42;
  const now = new Date();
  const sectors: Sector[] = SECTORS.map((sc) => ({
    id: `sec-${sc.name}`,
    name: sc.name,
    centerLat: sc.lat,
    centerLon: sc.lon,
    radiusKm: sc.radiusKm,
    role: sc.role,
  }));
  const vehicles: Vehicle[] = [];
  for (let u = 0; u < 3; u++) {
    for (let i = 0; i < 6; i++) {
      const sec = SECTORS[u % SECTORS.length];
      const r = rand() * sec.radiusKm * 0.8;
      const a = rand() * Math.PI * 2;
      vehicles.push({
        id: `veh-${u}-${i}`,
        vehicleId: `BWP-${u + 1}K-${String(i + 1).padStart(2, '0')}`,
        vehicleType: i % 2 === 0 ? 'BWP_Borsuk' : 'Rosomak',
        unitName: `${u + 1}. kompania zmech.`,
        sector: sec.name,
        latitude: sec.lat + kmToLat(r * Math.sin(a)),
        longitude: sec.lon + kmToLon(r * Math.cos(a)),
        speedKmh: 0,
        headingDeg: irand(0, 359),
        engineStatus: 'running',
        fuelPercent: irand(45, 95),
        ammoPercent: irand(40, 90),
        crewCount: 3,
        combatReady: true,
        updatedAt: now,
      });
    }
  }
  const soldiers: Soldier[] = [];
  for (let u = 0; u < 3; u++) {
    for (let i = 0; i < 18; i++) {
      const sec = SECTORS[u % SECTORS.length];
      const r = rand() * sec.radiusKm;
      const a = rand() * Math.PI * 2;
      soldiers.push({
        id: `sol-${u}-${i}`,
        soldierId: `SOL-${u + 1}K-${String(i + 1).padStart(3, '0')}`,
        unitName: `${u + 1}. kompania zmech.`,
        sector: sec.name,
        latitude: sec.lat + kmToLat(r * Math.sin(a)),
        longitude: sec.lon + kmToLon(r * Math.cos(a)),
        heartRate: irand(70, 95),
        bodyTemp: 36.6,
        bloodOxygen: 98,
        stressLevel: 'normal',
        movementStatus: 'walking',
        updatedAt: now,
      });
    }
  }
  const drones: Drone[] = SECTORS.map((sc, i) => ({
    id: `dr-${i}`,
    droneId: i % 2 === 0 ? `FE-0${i + 1}` : `WM-0${i + 1}`,
    droneType: i % 2 === 0 ? 'FlyEye' : 'Warmate',
    sector: sc.name,
    latitude: sc.lat,
    longitude: sc.lon,
    altitudeM: 280,
    batteryPercent: irand(70, 100),
    observationType: 'patrol_scan',
    targetClassification: 'none',
    targetCount: 0,
    confidence: 0,
    updatedAt: now,
  }));
  const weather: WeatherCell[] = SECTORS.map((sc) => ({
    id: `wx-${sc.name}`,
    sector: sc.name,
    tempC: 8,
    windSpeedMs: 4,
    windDirDeg: 230,
    cloudCover: 0.5,
    fogDensity: 0.1,
    precipMmH: 0,
    condition: 'overcast',
    updatedAt: now,
  }));
  return {
    sectors, vehicles, soldiers, drones,
    radarTracks: [], weather, events: [],
    missionClockSec: 0, timeOfDayH: 10,
  };
}

export function advance(w: BattlefieldSnapshot) {
  w.missionClockSec += 1;
  const t = w.missionClockSec;
  const phaseDetect = t > 60;
  const phaseEngage = t > 180;

  for (const v of w.vehicles) {
    const target = phaseEngage && v.sector !== 'Alpha' ? range(8, 22) : range(0, 3);
    v.speedKmh += (target - v.speedKmh) * 0.15;
    const distKm = v.speedKmh / 3600;
    const rad = (v.headingDeg * Math.PI) / 180;
    v.latitude += kmToLat(distKm * Math.cos(rad));
    v.longitude += kmToLon(distKm * Math.sin(rad));
    if (rand() < 0.02) v.fuelPercent = Math.max(0, v.fuelPercent - 1);
    v.headingDeg = (v.headingDeg + (rand() - 0.5) * 6 + 360) % 360;
    v.updatedAt = new Date();
  }
  for (const sl of w.soldiers) {
    sl.heartRate = clamp(sl.heartRate + (rand() - 0.5) * 6 + (phaseEngage ? 1.5 : 0), 60, 215);
    sl.stressLevel = sl.heartRate > 180 ? 'critical' : sl.heartRate > 130 ? 'elevated' : 'normal';
    sl.updatedAt = new Date();
  }
  for (const d of w.drones) {
    const sc = SECTORS.find((x) => x.name === d.sector)!;
    const dx = (d.longitude - sc.lon) * KM_PER_DEG_LON;
    const dz = (d.latitude - sc.lat) * KM_PER_DEG_LAT;
    const r = Math.hypot(dx, dz) || 0.01;
    const tan = { x: -dz / r, z: dx / r };
    d.longitude += kmToLon(tan.x * 0.04);
    d.latitude += kmToLat(tan.z * 0.04);
    d.updatedAt = new Date();
  }
  if (phaseDetect && w.radarTracks.length < 12 && rand() < 0.5) {
    const sc = SECTORS[1]; // Bravo
    const r = sc.radiusKm * (0.8 + rand() * 0.6);
    const a = rand() * Math.PI * 2;
    w.radarTracks.push({
      id: `trk-${Math.random().toString(36).slice(2, 8)}`,
      trackId: `TRK-H-${irand(1000, 9999)}`,
      classification: rand() < 0.85 ? 'hostile' : 'unknown',
      objectType: 'armored_vehicle',
      sector: 'Bravo',
      latitude: sc.lat + kmToLat(r * Math.sin(a)),
      longitude: sc.lon + kmToLon(r * Math.cos(a)),
      speedKmh: range(15, 60),
      headingDeg: irand(220, 320),
      distanceToBlueKm: +range(2, 6).toFixed(1),
      confidence: +(0.55 + rand() * 0.4).toFixed(2),
      radarId: `RAD-0${irand(1, 4)}`,
      detectedAt: new Date(),
      updatedAt: new Date(),
    });
  }
  for (const wx of w.weather) {
    wx.windSpeedMs = clamp(wx.windSpeedMs + (rand() - 0.5) * 0.6, 0, 18);
    wx.fogDensity = clamp(wx.fogDensity + (rand() - 0.5) * 0.02, 0, 0.6);
    wx.updatedAt = new Date();
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
