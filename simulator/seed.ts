/**
 * Seed Rayfin from existing JSONL files in ../fabric-military-demo/datasets.
 * Useful one-shot to bring real OPERATION SENTINEL initial conditions
 * into the digital twin DB before starting the live simulator.
 *
 *   npm run simulate:seed
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { RayfinClient } from '@microsoft/rayfin-client';
import type { SENTINELSchema } from '../rayfin/data/schema.js';

const DATASET_DIR = resolve(process.cwd(), '..', 'fabric-military-demo', 'datasets');

const apiUrl = process.env.RAYFIN_API_URL ?? process.env.VITE_RAYFIN_API_URL;
const key = process.env.RAYFIN_PUBLISHABLE_KEY ?? process.env.VITE_RAYFIN_PUBLISHABLE_KEY;
if (!apiUrl || !key) {
  console.error('[seed] RAYFIN_API_URL / RAYFIN_PUBLISHABLE_KEY missing.');
  process.exit(1);
}
const client = new RayfinClient<SENTINELSchema>({
  baseUrl: apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
  publishableKey: key,
  useProxy: false,
  authStorage: false,
});

function readJsonl<T>(name: string): T[] {
  const p = resolve(DATASET_DIR, name);
  if (!existsSync(p)) {
    console.warn(`[seed] missing ${p} — skipping.`);
    return [];
  }
  return readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

interface RawVehicle {
  EventId: string; Timestamp: string; VehicleId: string; VehicleType: string;
  UnitName: string; Sector: string; Latitude: number; Longitude: number;
  Speed_kmh: number; Heading_deg: number; EngineStatus: string;
  FuelPercent: number; AmmoPercent: number; CrewCount: number; CombatReady: boolean;
}
interface RawSoldier {
  EventId: string; Timestamp: string; SoldierId: string; UnitName: string; Sector: string;
  Latitude: number; Longitude: number; HeartRate: number; BodyTemp: number;
  BloodOxygen: number; StressLevel: string; MovementStatus: string;
}
interface RawDrone {
  EventId: string; Timestamp: string; DroneId: string; DroneType: string; Sector: string;
  Latitude: number; Longitude: number; Altitude_m: number; BatteryPercent: number;
  ObservationType: string; TargetClassification: string; TargetCount: number; Confidence: number;
}

async function main() {
  const vehicles = readJsonl<RawVehicle>('vehicle_status.jsonl');
  const soldiers = readJsonl<RawSoldier>('soldier_health.jsonl');
  const drones = readJsonl<RawDrone>('drone_observations.jsonl');

  // Take only the FIRST snapshot of each entity (initial conditions).
  const firstByKey = <T, K extends string | number>(arr: T[], keyFn: (t: T) => K) => {
    const seen = new Map<K, T>();
    for (const item of arr) if (!seen.has(keyFn(item))) seen.set(keyFn(item), item);
    return [...seen.values()];
  };

  const initVeh = firstByKey(vehicles, (v) => v.VehicleId);
  const initSol = firstByKey(soldiers, (s) => s.SoldierId);
  const initDrn = firstByKey(drones, (d) => d.DroneId);

  console.log(`[seed] vehicles=${initVeh.length} soldiers=${initSol.length} drones=${initDrn.length}`);

  await Promise.all(
    initVeh.map((v) =>
      client.data.Vehicle.create({
        vehicleId: v.VehicleId,
        vehicleType: v.VehicleType,
        unitName: v.UnitName,
        sector: v.Sector,
        latitude: v.Latitude,
        longitude: v.Longitude,
        speedKmh: v.Speed_kmh,
        headingDeg: v.Heading_deg,
        engineStatus: v.EngineStatus,
        fuelPercent: v.FuelPercent,
        ammoPercent: v.AmmoPercent,
        crewCount: v.CrewCount,
        combatReady: v.CombatReady,
        updatedAt: new Date(v.Timestamp),
      } as never)
    )
  );

  await Promise.all(
    initSol.map((s) =>
      client.data.Soldier.create({
        soldierId: s.SoldierId,
        unitName: s.UnitName,
        sector: s.Sector,
        latitude: s.Latitude,
        longitude: s.Longitude,
        heartRate: s.HeartRate,
        bodyTemp: s.BodyTemp,
        bloodOxygen: s.BloodOxygen,
        stressLevel: s.StressLevel,
        movementStatus: s.MovementStatus,
        updatedAt: new Date(s.Timestamp),
      } as never)
    )
  );

  await Promise.all(
    initDrn.map((d) =>
      client.data.Drone.create({
        droneId: d.DroneId,
        droneType: d.DroneType,
        sector: d.Sector,
        latitude: d.Latitude,
        longitude: d.Longitude,
        altitudeM: d.Altitude_m,
        batteryPercent: d.BatteryPercent,
        observationType: d.ObservationType,
        targetClassification: d.TargetClassification,
        targetCount: d.TargetCount,
        confidence: d.Confidence,
        updatedAt: new Date(d.Timestamp),
      } as never)
    )
  );

  console.log('[seed] done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
