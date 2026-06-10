/**
 * Seed Rayfin's Fabric SQL database directly, bypassing the Data API.
 *
 *   npm run simulate:seed:sql
 *
 * Why direct SQL? A Fabric-hosted Rayfin backend only supports Fabric brokered
 * (browser SSO) auth, so the entities' `@role('authenticated')` rules cannot be
 * satisfied from a headless Node process. The `@role` rules guard the Data API
 * only — not the underlying SQL database — so we write rows straight into the
 * provisioned Fabric SQL DB using an Entra access token.
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
import { execSync } from 'node:child_process';
import sql from 'mssql';

const DATASET_DIR = resolve(process.cwd(), '..', 'fabric-military-demo', 'datasets');

function token(tenant: string, resource: string): string {
  return execSync(
    `az account get-access-token --tenant ${tenant} --resource ${resource} --query accessToken -o tsv`,
    { encoding: 'utf8' }
  ).trim();
}

interface SqlTarget {
  server: string;
  database: string;
  token: string;
}

async function resolveTarget(): Promise<SqlTarget> {
  if (process.env.SQL_SERVER && process.env.SQL_DB && process.env.SQL_TOKEN) {
    return {
      server: process.env.SQL_SERVER,
      database: process.env.SQL_DB,
      token: process.env.SQL_TOKEN,
    };
  }

  const registryPath = resolve(process.cwd(), 'rayfin', '.deployments.json');
  if (!existsSync(registryPath)) {
    throw new Error(
      'rayfin/.deployments.json not found — run `rayfin up` first, or set SQL_SERVER/SQL_DB/SQL_TOKEN.'
    );
  }
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
    deployments: Record<string, { fabricWorkspaceId: string; fabricTenantId: string }>;
    active: string;
  };
  const dep = registry.deployments[registry.active];
  if (!dep) throw new Error('No active deployment in rayfin/.deployments.json.');

  const fabricToken = token(dep.fabricTenantId, 'https://api.fabric.microsoft.com');
  const res = await fetch(
    `https://api.fabric.microsoft.com/v1/workspaces/${dep.fabricWorkspaceId}/sqlDatabases`,
    { headers: { Authorization: `Bearer ${fabricToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Fabric API sqlDatabases list failed: ${res.status} ${await res.text()}`);
  }
  const list = (await res.json()) as {
    value: { displayName: string; properties: { serverFqdn: string; databaseName: string } }[];
  };
  const db = list.value[0];
  if (!db) throw new Error('No SQL database found in the workspace.');

  return {
    server: db.properties.serverFqdn.split(',')[0],
    database: db.properties.databaseName,
    token: token(dep.fabricTenantId, 'https://database.windows.net/'),
  };
}

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
  const target = await resolveTarget();
  const pool = await sql.connect({
    server: target.server,
    database: target.database,
    port: 1433,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token: target.token },
    },
  });

  const vehicles = firstByKey(readJsonl<RawVehicle>('vehicle_status.jsonl'), (v) => v.VehicleId);
  const soldiers = firstByKey(readJsonl<RawSoldier>('soldier_health.jsonl'), (s) => s.SoldierId);
  const drones = firstByKey(readJsonl<RawDrone>('drone_observations.jsonl'), (d) => d.DroneId);
  console.log(`[seed-sql] vehicles=${vehicles.length} soldiers=${soldiers.length} drones=${drones.length}`);

  // Idempotent: clear the seeded tables first.
  await pool.request().batch('DELETE FROM dbo.Vehicles; DELETE FROM dbo.Soldiers; DELETE FROM dbo.Drones;');

  for (const v of vehicles) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('vehicleId', sql.NVarChar(32), v.VehicleId)
      .input('vehicleType', sql.NVarChar(32), v.VehicleType)
      .input('unitName', sql.NVarChar(64), v.UnitName)
      .input('sector', sql.NVarChar(16), v.Sector)
      .input('latitude', sql.Decimal(18, 2), v.Latitude)
      .input('longitude', sql.Decimal(18, 2), v.Longitude)
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
      .input('latitude', sql.Decimal(18, 2), s.Latitude)
      .input('longitude', sql.Decimal(18, 2), s.Longitude)
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
      .input('latitude', sql.Decimal(18, 2), d.Latitude)
      .input('longitude', sql.Decimal(18, 2), d.Longitude)
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
