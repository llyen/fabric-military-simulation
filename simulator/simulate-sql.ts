/**
 * Headless LIVE simulator that writes battlefield movement straight into
 * Rayfin's Fabric SQL database, bypassing the Data API.
 *
 *   npm run simulate:sql
 *
 * Why not `npm run simulate`? That script pushes through the Rayfin Data API,
 * which a Fabric-hosted backend guards with `@role('authenticated')` and only
 * Fabric brokered (browser SSO) auth can satisfy — impossible from Node. The
 * `@role` rules do not guard the underlying SQL database, so this script writes
 * rows directly using an Entra access token (see simulator/fabricSql.ts).
 *
 * It seeds the full procedural world once (Sectors, Vehicles, Soldiers, Drones,
 * WeatherCells), then advances the simulation every tick and updates the moving
 * rows. The deployed web app polls every second and renders the movement.
 *
 * Prerequisites:
 *   • `az login --tenant <fabricTenantId>`
 *   • A prior `rayfin up` so rayfin/.deployments.json exists.
 *
 * Note: Entra access tokens expire after ~60–90 min; restart the script if
 * long runs start failing with auth errors.
 */
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { connect } from './fabricSql.js';
import { advance, buildInitialWorld } from './world.js';

const TICK_MS = Number(process.env.SIM_TICK_MS ?? 1500);

async function seed(pool: sql.ConnectionPool, world: ReturnType<typeof buildInitialWorld>) {
  await pool.request().batch(
    'DELETE FROM dbo.Sectors; DELETE FROM dbo.Vehicles; DELETE FROM dbo.Soldiers; ' +
      'DELETE FROM dbo.Drones; DELETE FROM dbo.WeatherCells; DELETE FROM dbo.RadarTracks;'
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

  for (const v of world.vehicles) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('vehicleId', sql.NVarChar(32), v.vehicleId)
      .input('vehicleType', sql.NVarChar(32), v.vehicleType)
      .input('unitName', sql.NVarChar(64), v.unitName)
      .input('sector', sql.NVarChar(16), v.sector)
      .input('latitude', sql.Decimal(18, 6), v.latitude)
      .input('longitude', sql.Decimal(18, 6), v.longitude)
      .input('speedKmh', sql.Decimal(18, 2), v.speedKmh)
      .input('headingDeg', sql.Int, Math.round(v.headingDeg))
      .input('engineStatus', sql.NVarChar(16), v.engineStatus)
      .input('fuelPercent', sql.Int, Math.round(v.fuelPercent))
      .input('ammoPercent', sql.Int, Math.round(v.ammoPercent))
      .input('crewCount', sql.Int, Math.round(v.crewCount))
      .input('combatReady', sql.Bit, v.combatReady)
      .input('updatedAt', sql.DateTime2, v.updatedAt)
      .query(`INSERT INTO dbo.Vehicles
        (id, vehicleId, vehicleType, unitName, sector, latitude, longitude, speedKmh, headingDeg, engineStatus, fuelPercent, ammoPercent, crewCount, combatReady, updatedAt)
        VALUES (@id, @vehicleId, @vehicleType, @unitName, @sector, @latitude, @longitude, @speedKmh, @headingDeg, @engineStatus, @fuelPercent, @ammoPercent, @crewCount, @combatReady, @updatedAt)`);
  }

  for (const s of world.soldiers) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('soldierId', sql.NVarChar(32), s.soldierId)
      .input('unitName', sql.NVarChar(64), s.unitName)
      .input('sector', sql.NVarChar(16), s.sector)
      .input('latitude', sql.Decimal(18, 6), s.latitude)
      .input('longitude', sql.Decimal(18, 6), s.longitude)
      .input('heartRate', sql.Int, Math.round(s.heartRate))
      .input('bodyTemp', sql.Decimal(18, 2), s.bodyTemp)
      .input('bloodOxygen', sql.Int, Math.round(s.bloodOxygen))
      .input('stressLevel', sql.NVarChar(16), s.stressLevel)
      .input('movementStatus', sql.NVarChar(16), s.movementStatus)
      .input('updatedAt', sql.DateTime2, s.updatedAt)
      .query(`INSERT INTO dbo.Soldiers
        (id, soldierId, unitName, sector, latitude, longitude, heartRate, bodyTemp, bloodOxygen, stressLevel, movementStatus, updatedAt)
        VALUES (@id, @soldierId, @unitName, @sector, @latitude, @longitude, @heartRate, @bodyTemp, @bloodOxygen, @stressLevel, @movementStatus, @updatedAt)`);
  }

  for (const d of world.drones) {
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('droneId', sql.NVarChar(32), d.droneId)
      .input('droneType', sql.NVarChar(32), d.droneType)
      .input('sector', sql.NVarChar(16), d.sector)
      .input('latitude', sql.Decimal(18, 6), d.latitude)
      .input('longitude', sql.Decimal(18, 6), d.longitude)
      .input('altitudeM', sql.Decimal(18, 2), d.altitudeM)
      .input('batteryPercent', sql.Int, Math.round(d.batteryPercent))
      .input('observationType', sql.NVarChar(32), d.observationType)
      .input('targetClassification', sql.NVarChar(32), d.targetClassification ?? 'none')
      .input('targetCount', sql.Int, Math.round(d.targetCount ?? 0))
      .input('confidence', sql.Decimal(18, 2), d.confidence ?? 0)
      .input('updatedAt', sql.DateTime2, d.updatedAt)
      .query(`INSERT INTO dbo.Drones
        (id, droneId, droneType, sector, latitude, longitude, altitudeM, batteryPercent, observationType, targetClassification, targetCount, confidence, updatedAt)
        VALUES (@id, @droneId, @droneType, @sector, @latitude, @longitude, @altitudeM, @batteryPercent, @observationType, @targetClassification, @targetCount, @confidence, @updatedAt)`);
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
}

/** Batched UPDATE ... FROM OPENJSON: one round-trip per entity type per tick. */
async function pushMovement(
  pool: sql.ConnectionPool,
  world: ReturnType<typeof buildInitialWorld>
) {
  const now = new Date();

  const vehicleJson = JSON.stringify(
    world.vehicles.map((v) => ({
      vehicleId: v.vehicleId,
      latitude: v.latitude,
      longitude: v.longitude,
      speedKmh: v.speedKmh,
      headingDeg: Math.round(v.headingDeg),
      fuelPercent: Math.round(v.fuelPercent),
    }))
  );
  await pool.request()
    .input('data', sql.NVarChar(sql.MAX), vehicleJson)
    .input('now', sql.DateTime2, now)
    .query(`UPDATE v SET v.latitude=j.latitude, v.longitude=j.longitude,
        v.speedKmh=j.speedKmh, v.headingDeg=j.headingDeg, v.fuelPercent=j.fuelPercent, v.updatedAt=@now
      FROM dbo.Vehicles v
      JOIN OPENJSON(@data) WITH (
        vehicleId nvarchar(32) '$.vehicleId',
        latitude decimal(18,6) '$.latitude',
        longitude decimal(18,6) '$.longitude',
        speedKmh decimal(18,2) '$.speedKmh',
        headingDeg int '$.headingDeg',
        fuelPercent int '$.fuelPercent'
      ) j ON j.vehicleId = v.vehicleId`);

  const soldierJson = JSON.stringify(
    world.soldiers.map((s) => ({
      soldierId: s.soldierId,
      heartRate: Math.round(s.heartRate),
      stressLevel: s.stressLevel,
    }))
  );
  await pool.request()
    .input('data', sql.NVarChar(sql.MAX), soldierJson)
    .input('now', sql.DateTime2, now)
    .query(`UPDATE s SET s.heartRate=j.heartRate, s.stressLevel=j.stressLevel, s.updatedAt=@now
      FROM dbo.Soldiers s
      JOIN OPENJSON(@data) WITH (
        soldierId nvarchar(32) '$.soldierId',
        heartRate int '$.heartRate',
        stressLevel nvarchar(16) '$.stressLevel'
      ) j ON j.soldierId = s.soldierId`);

  const droneJson = JSON.stringify(
    world.drones.map((d) => ({
      droneId: d.droneId,
      latitude: d.latitude,
      longitude: d.longitude,
    }))
  );
  await pool.request()
    .input('data', sql.NVarChar(sql.MAX), droneJson)
    .input('now', sql.DateTime2, now)
    .query(`UPDATE d SET d.latitude=j.latitude, d.longitude=j.longitude, d.updatedAt=@now
      FROM dbo.Drones d
      JOIN OPENJSON(@data) WITH (
        droneId nvarchar(32) '$.droneId',
        latitude decimal(18,6) '$.latitude',
        longitude decimal(18,6) '$.longitude'
      ) j ON j.droneId = d.droneId`);

  const weatherJson = JSON.stringify(
    world.weather.map((w) => ({
      sector: w.sector,
      windSpeedMs: w.windSpeedMs,
      fogDensity: w.fogDensity,
    }))
  );
  await pool.request()
    .input('data', sql.NVarChar(sql.MAX), weatherJson)
    .input('now', sql.DateTime2, now)
    .query(`UPDATE w SET w.windSpeedMs=j.windSpeedMs, w.fogDensity=j.fogDensity, w.updatedAt=@now
      FROM dbo.WeatherCells w
      JOIN OPENJSON(@data) WITH (
        sector nvarchar(16) '$.sector',
        windSpeedMs decimal(18,2) '$.windSpeedMs',
        fogDensity decimal(18,2) '$.fogDensity'
      ) j ON j.sector = w.sector`);
}

async function insertNewTracks(
  pool: sql.ConnectionPool,
  world: ReturnType<typeof buildInitialWorld>,
  inserted: Set<string>
) {
  for (const t of world.radarTracks) {
    if (inserted.has(t.id)) continue;
    await pool.request()
      .input('id', sql.UniqueIdentifier, randomUUID())
      .input('trackId', sql.NVarChar(32), t.trackId)
      .input('classification', sql.NVarChar(16), t.classification)
      .input('objectType', sql.NVarChar(32), t.objectType)
      .input('sector', sql.NVarChar(16), t.sector)
      .input('latitude', sql.Decimal(18, 6), t.latitude)
      .input('longitude', sql.Decimal(18, 6), t.longitude)
      .input('speedKmh', sql.Decimal(18, 2), t.speedKmh)
      .input('headingDeg', sql.Int, Math.round(t.headingDeg))
      .input('distanceToBlueKm', sql.Decimal(18, 2), t.distanceToBlueKm)
      .input('confidence', sql.Decimal(18, 2), t.confidence)
      .input('radarId', sql.NVarChar(16), t.radarId)
      .input('detectedAt', sql.DateTime2, t.detectedAt)
      .input('updatedAt', sql.DateTime2, t.updatedAt)
      .query(`INSERT INTO dbo.RadarTracks
        (id, trackId, classification, objectType, sector, latitude, longitude, speedKmh, headingDeg, distanceToBlueKm, confidence, radarId, detectedAt, updatedAt)
        VALUES (@id, @trackId, @classification, @objectType, @sector, @latitude, @longitude, @speedKmh, @headingDeg, @distanceToBlueKm, @confidence, @radarId, @detectedAt, @updatedAt)`);
    inserted.add(t.id);
  }
}

async function main() {
  const pool = await connect();
  const world = buildInitialWorld();

  console.log(
    `[simulate:sql] seeding sectors=${world.sectors.length} vehicles=${world.vehicles.length} ` +
      `soldiers=${world.soldiers.length} drones=${world.drones.length} weather=${world.weather.length}`
  );
  await seed(pool, world);
  console.log('[simulate:sql] seeded. Streaming movement — press Ctrl+C to stop.');

  const insertedTracks = new Set<string>();
  let busy = false;

  setInterval(async () => {
    if (busy) return; // skip a tick if the previous write is still in flight
    busy = true;
    advance(world);
    try {
      await pushMovement(pool, world);
      await insertNewTracks(pool, world, insertedTracks);
      const mm = String(Math.floor(world.missionClockSec / 60)).padStart(2, '0');
      const ss = String(world.missionClockSec % 60).padStart(2, '0');
      process.stdout.write(
        `\rT+${mm}:${ss}  vehicles=${world.vehicles.length} tracks=${world.radarTracks.length}   `
      );
    } catch (err) {
      console.error('\n[simulate:sql] tick failed', err);
    } finally {
      busy = false;
    }
  }, TICK_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
