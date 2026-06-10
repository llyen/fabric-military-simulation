/**
 * Seed Rayfin's Fabric SQL database directly, bypassing the Data API.
 *
 *   npm run simulate:seed:sql
 *
 * Why direct SQL? See simulator/fabricSql.ts — a Fabric-hosted backend only
 * supports Fabric brokered (browser SSO) auth, so headless writes target the
 * underlying SQL database, which the `@role` rules do not guard.
 *
 * Seeds a static snapshot:
 *   • Sectors + WeatherCells from the procedural world definition (overlays).
 *   • Vehicles / Soldiers / Drones from the recorded JSONL datasets.
 *
 * For a *moving* battlefield against Fabric, run `npm run simulate:sql` instead.
 *
 * Prerequisites:
 *   • Sign in to the deployment's tenant: `az login --tenant <fabricTenantId>`
 *   • A prior `rayfin up` so rayfin/.deployments.json exists.
 *   • JSONL datasets in ../fabric-military-demo/datasets.
 *
 * Override auto-resolution with SQL_SERVER / SQL_DB / SQL_TOKEN env vars.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { connect } from './fabricSql.js';
import { buildInitialWorld } from './world.js';

const DATASET_DIR = resolve(process.cwd(), '..', 'fabric-military-demo', 'datasets');

function readJsonl<T>(name: string): T[] {
  const p = resolve(DATASET_DIR, name);
  if (!existsSync(p)) {
    console.warn(`[seed-sql] missing ${p} — skipping.`);
    return [];
  }
  return readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

function firstByKey<T, K>(arr: T[], keyFn: (t: T) => K): T[] {
  const seen = new Map<K, T>();
  for (const item of arr) if (!seen.has(keyFn(item))) seen.set(keyFn(item), item);
  return [...seen.values()];
}

interface RawVehicle {
  Timestamp: string; VehicleId: string; VehicleType: string; UnitName: string;
  Sector: string; Latitude: number; Longitude: number; Speed_kmh: number;
  Heading_deg: number; EngineStatus: string; FuelPercent: number;
  AmmoPercent: number; CrewCount: number; CombatReady: boolean;
}
interface RawSoldier {
  Timestamp: string; SoldierId: string; UnitName: string; Sector: string;
  Latitude: number; Longitude: number; HeartRate: number; BodyTemp: number;
  BloodOxygen: number; StressLevel: string; MovementStatus: string;
}
interface RawDrone {
  Timestamp: string; DroneId: string; DroneType: string; Sector: string;
  Latitude: number; Longitude: number; Altitude_m: number; BatteryPercent: number;
  ObservationType: string; TargetClassification: string; TargetCount: number; Confidence: number;
}

async function main() {
  const pool = await connect();

  const world = buildInitialWorld();
  const vehicles = firstByKey(readJsonl<RawVehicle>('vehicle_status.jsonl'), (v) => v.VehicleId);
  const soldiers = firstByKey(readJsonl<RawSoldier>('soldier_health.jsonl'), (s) => s.SoldierId);
  const drones = firstByKey(readJsonl<RawDrone>('drone_observations.jsonl'), (d) => d.DroneId);
  console.log(
    `[seed-sql] sectors=${world.sectors.length} vehicles=${vehicles.length} ` +
      `soldiers=${soldiers.length} drones=${drones.length} weather=${world.weather.length}`
  );

  // Idempotent: clear the seeded tables first.
  await pool.request().batch(
    'DELETE FROM dbo.Vehicles; DELETE FROM dbo.Soldiers; DELETE FROM dbo.Drones; ' +
      'DELETE FROM dbo.Sectors; DELETE FROM dbo.WeatherCells;'
  );

  for (const sec of world.sectors) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('name', sql.NVarChar(32), sec.name)
      .input('centerLat', sql.Decimal(18, 6), sec.centerLat)
      .input('centerLon', sql.Decimal(18, 6), sec.centerLon)
      .input('radiusKm', sql.Decimal(18, 2), sec.radiusKm)
      .input('role', sql.NVarChar(32), sec.role)
      .query(`INSERT INTO dbo.Sectors (id, name, centerLat, centerLon, radiusKm, role)
        VALUES (@id, @name, @centerLat, @centerLon, @radiusKm, @role)`);
  }

  for (const w of world.weather) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('sector', sql.NVarChar(16), w.sector)
      .input('tempC', sql.Decimal(18, 2), w.tempC)
      .input('windSpeedMs', sql.Decimal(18, 2), w.windSpeedMs)
      .input('windDirDeg', sql.Int, Math.round(w.windDirDeg))
      .input('cloudCover', sql.Decimal(18, 2), w.cloudCover)
      .input('fogDensity', sql.Decimal(18, 2), w.fogDensity)
      .input('precipMmH', sql.Decimal(18, 2), w.precipMmH)
      .input('condition', sql.NVarChar(16), w.condition)
      .input('updatedAt', sql.DateTime2, w.updatedAt)
      .query(`INSERT INTO dbo.WeatherCells
        (id, sector, tempC, windSpeedMs, windDirDeg, cloudCover, fogDensity, precipMmH, condition, updatedAt)
        VALUES (@id, @sector, @tempC, @windSpeedMs, @windDirDeg, @cloudCover, @fogDensity, @precipMmH, @condition, @updatedAt)`);
  }

  for (const v of vehicles) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('vehicleId', sql.NVarChar(32), v.VehicleId)
      .input('vehicleType', sql.NVarChar(32), v.VehicleType)
      .input('unitName', sql.NVarChar(64), v.UnitName)
      .input('sector', sql.NVarChar(16), v.Sector)
      .input('latitude', sql.Decimal(18, 6), v.Latitude)
      .input('longitude', sql.Decimal(18, 6), v.Longitude)
      .input('speedKmh', sql.Decimal(18, 2), v.Speed_kmh)
      .input('headingDeg', sql.Int, Math.round(v.Heading_deg))
      .input('engineStatus', sql.NVarChar(16), v.EngineStatus)
      .input('fuelPercent', sql.Int, Math.round(v.FuelPercent))
      .input('ammoPercent', sql.Int, Math.round(v.AmmoPercent))
      .input('crewCount', sql.Int, Math.round(v.CrewCount))
      .input('combatReady', sql.Bit, !!v.CombatReady)
      .input('updatedAt', sql.DateTime2, new Date(v.Timestamp))
      .query(`INSERT INTO dbo.Vehicles
        (id, vehicleId, vehicleType, unitName, sector, latitude, longitude, speedKmh, headingDeg, engineStatus, fuelPercent, ammoPercent, crewCount, combatReady, updatedAt)
        VALUES (@id, @vehicleId, @vehicleType, @unitName, @sector, @latitude, @longitude, @speedKmh, @headingDeg, @engineStatus, @fuelPercent, @ammoPercent, @crewCount, @combatReady, @updatedAt)`);
  }

  for (const s of soldiers) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('soldierId', sql.NVarChar(32), s.SoldierId)
      .input('unitName', sql.NVarChar(64), s.UnitName)
      .input('sector', sql.NVarChar(16), s.Sector)
      .input('latitude', sql.Decimal(18, 6), s.Latitude)
      .input('longitude', sql.Decimal(18, 6), s.Longitude)
      .input('heartRate', sql.Int, Math.round(s.HeartRate))
      .input('bodyTemp', sql.Decimal(18, 2), s.BodyTemp)
      .input('bloodOxygen', sql.Int, Math.round(s.BloodOxygen))
      .input('stressLevel', sql.NVarChar(16), s.StressLevel)
      .input('movementStatus', sql.NVarChar(16), s.MovementStatus)
      .input('updatedAt', sql.DateTime2, new Date(s.Timestamp))
      .query(`INSERT INTO dbo.Soldiers
        (id, soldierId, unitName, sector, latitude, longitude, heartRate, bodyTemp, bloodOxygen, stressLevel, movementStatus, updatedAt)
        VALUES (@id, @soldierId, @unitName, @sector, @latitude, @longitude, @heartRate, @bodyTemp, @bloodOxygen, @stressLevel, @movementStatus, @updatedAt)`);
  }

  for (const d of drones) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('droneId', sql.NVarChar(32), d.DroneId)
      .input('droneType', sql.NVarChar(32), d.DroneType)
      .input('sector', sql.NVarChar(16), d.Sector)
      .input('latitude', sql.Decimal(18, 6), d.Latitude)
      .input('longitude', sql.Decimal(18, 6), d.Longitude)
      .input('altitudeM', sql.Decimal(18, 2), d.Altitude_m)
      .input('batteryPercent', sql.Int, Math.round(d.BatteryPercent))
      .input('observationType', sql.NVarChar(32), d.ObservationType)
      .input('targetClassification', sql.NVarChar(32), d.TargetClassification ?? 'none')
      .input('targetCount', sql.Int, Math.round(d.TargetCount ?? 0))
      .input('confidence', sql.Decimal(18, 2), d.Confidence ?? 0)
      .input('updatedAt', sql.DateTime2, new Date(d.Timestamp))
      .query(`INSERT INTO dbo.Drones
        (id, droneId, droneType, sector, latitude, longitude, altitudeM, batteryPercent, observationType, targetClassification, targetCount, confidence, updatedAt)
        VALUES (@id, @droneId, @droneType, @sector, @latitude, @longitude, @altitudeM, @batteryPercent, @observationType, @targetClassification, @targetCount, @confidence, @updatedAt)`);
  }

  const counts = await pool.request().query(
    'SELECT (SELECT COUNT(*) FROM dbo.Vehicles) v, (SELECT COUNT(*) FROM dbo.Soldiers) s, (SELECT COUNT(*) FROM dbo.Drones) d'
  );
  console.log('[seed-sql] inserted:', JSON.stringify(counts.recordset[0]));
  await pool.close();
  console.log('[seed-sql] done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
