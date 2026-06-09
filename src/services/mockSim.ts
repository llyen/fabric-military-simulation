import {
  CENTER_LAT,
  CENTER_LON,
  SECTORS,
  VEHICLE_TYPES,
  DRONE_TYPES,
  UNIT_NAMES,
} from '@/data/sectors';
import { getSimSpeed } from '@/hooks/useSimControl';
import type {
  BattlefieldSnapshot,
  Drone,
  RadarTrack,
  Sector,
  SimEvent,
  Soldier,
  Vehicle,
  WeatherCell,
} from '@/types';

/* ---------- deterministic RNG so reloads tell the same story ---------- */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(42);
const rand = () => rng();
const randRange = (lo: number, hi: number) => lo + rand() * (hi - lo);
const randInt = (lo: number, hi: number) => Math.floor(randRange(lo, hi + 1));
const pick = <T,>(arr: readonly T[]) => arr[randInt(0, arr.length - 1)];

const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LON = 111.32 * Math.cos((CENTER_LAT * Math.PI) / 180);
const kmToLat = (km: number) => km / KM_PER_DEG_LAT;
const kmToLon = (km: number) => km / KM_PER_DEG_LON;

function jitterInSector(name: string, jitterKm = 0.6) {
  const s = SECTORS.find((x) => x.name === name)!;
  const r = rand() * Math.min(s.radiusKm, jitterKm + s.radiusKm * 0.6);
  const a = rand() * Math.PI * 2;
  return {
    latitude: s.lat + kmToLat(r * Math.sin(a)),
    longitude: s.lon + kmToLon(r * Math.cos(a)),
  };
}

/* Per-entity persistent motion state (not stored on snapshot — kept here so
 * deterministic-seed snapshots remain plain data). */
interface SoldierAI {
  headingDeg: number;
  speedMs: number;          // current speed (m/s), smoothed
  targetSpeedMs: number;    // current goal
  statusHoldUntil: number;  // sim seconds — hold movementStatus until this t
  pivotEvery: number;       // re-roll heading every N seconds
  lastPivotT: number;
}
const soldierAI = new Map<string, SoldierAI>();

interface VehicleAI {
  targetSpeedKmh: number;
  speedHoldUntil: number;
  lastTurnT: number;
  turnRateDegPerS: number;  // signed rate of yaw change
}
const vehicleAI = new Map<string, VehicleAI>();

/* ------------------------------ initial seed ------------------------------ */
function buildInitial(): BattlefieldSnapshot {
  rng = mulberry32(42);
  const now = new Date();
  const sectors: Sector[] = SECTORS.map((s) => ({
    id: `sec-${s.name}`,
    name: s.name,
    centerLat: s.lat,
    centerLon: s.lon,
    radiusKm: s.radiusKm,
    role: s.role,
  }));

  const vehicles: Vehicle[] = [];
  let vid = 1;
  for (let unitIdx = 0; unitIdx < 3; unitIdx++) {
    const unit = UNIT_NAMES[unitIdx];
    const sector = SECTORS[unitIdx % SECTORS.length].name;
    for (let i = 0; i < 6; i++) {
      const vtype = VEHICLE_TYPES[i % 2];
      const pos = jitterInSector(sector);
      vehicles.push({
        id: `veh-${vid}`,
        vehicleId: `${vtype === 'BWP_Borsuk' ? 'BWP' : 'ROS'}-${unitIdx + 1}K-${String(i + 1).padStart(2, '0')}`,
        vehicleType: vtype,
        unitName: unit,
        sector,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speedKmh: 0,
        headingDeg: randInt(0, 359),
        engineStatus: 'running',
        fuelPercent: randInt(45, 95),
        ammoPercent: randInt(40, 90),
        crewCount: randInt(3, 4),
        combatReady: true,
        updatedAt: now,
      });
      vid++;
    }
  }
  // Krab artillery battery in Alpha rear
  for (let i = 0; i < 3; i++) {
    const pos = jitterInSector('Alpha', 0.4);
    vehicles.push({
      id: `veh-krab-${i + 1}`,
      vehicleId: `KRAB-${String(i + 1).padStart(2, '0')}`,
      vehicleType: 'Krab',
      unitName: 'bateria Krab',
      sector: 'Alpha',
      latitude: pos.latitude,
      longitude: pos.longitude,
      speedKmh: 0,
      headingDeg: 90,
      engineStatus: 'idle',
      fuelPercent: randInt(70, 95),
      ammoPercent: randInt(80, 100),
      crewCount: 5,
      combatReady: true,
      updatedAt: now,
    });
  }

  const soldiers: Soldier[] = [];
  for (let unitIdx = 0; unitIdx < 3; unitIdx++) {
    const unit = UNIT_NAMES[unitIdx];
    const sector = SECTORS[unitIdx % SECTORS.length].name;
    for (let i = 0; i < 18; i++) {
      const pos = jitterInSector(sector, 0.9);
      soldiers.push({
        id: `sol-${unitIdx}-${i}`,
        soldierId: `SOL-${unitIdx + 1}K-${String(i + 1).padStart(3, '0')}`,
        unitName: unit,
        sector,
        latitude: pos.latitude,
        longitude: pos.longitude,
        heartRate: randInt(70, 95),
        bodyTemp: +(36.4 + rand() * 0.6).toFixed(1),
        bloodOxygen: randInt(95, 99),
        stressLevel: 'normal',
        movementStatus: pick(['walking', 'prone', 'walking']),
        updatedAt: now,
      });
    }
  }

  const drones: Drone[] = [];
  for (let i = 0; i < 4; i++) {
    const sector = SECTORS[i].name;
    const pos = jitterInSector(sector, 1.2);
    drones.push({
      id: `dr-${i}`,
      droneId: `${i % 2 === 0 ? 'FE' : 'WM'}-${String(i + 1).padStart(2, '0')}`,
      droneType: i % 2 === 0 ? 'FlyEye' : 'Warmate',
      sector,
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitudeM: 220 + rand() * 180,
      batteryPercent: randInt(70, 100),
      observationType: 'patrol_scan',
      targetClassification: 'none',
      targetCount: 0,
      confidence: 0,
      updatedAt: now,
    });
  }

  const radarTracks: RadarTrack[] = [];
  const weather: WeatherCell[] = SECTORS.map((s, i) => ({
    id: `wx-${s.name}`,
    sector: s.name,
    tempC: 6 + rand() * 4,
    windSpeedMs: 2 + rand() * 5,
    windDirDeg: randInt(180, 320),
    cloudCover: 0.4 + rand() * 0.4,
    fogDensity: i === 1 ? 0.15 : 0.05,
    precipMmH: 0,
    condition: 'overcast',
    updatedAt: now,
  }));

  return {
    sectors,
    vehicles,
    soldiers,
    drones,
    radarTracks,
    weather,
    events: [
      {
        id: 'evt-init',
        kind: 'info',
        severity: 'low',
        sector: 'Alpha',
        title: 'Mission start',
        message: 'OPERATION IRONSHIELD — wszystkie systemy nominal.',
        createdAt: now,
      },
    ],
    missionClockSec: 0,
    timeOfDayH: 10,
  };
}

/* ------------------------------ live tick ------------------------------ */

let snapshot: BattlefieldSnapshot = buildInitial();
let listeners = new Set<(s: BattlefieldSnapshot) => void>();
let started = false;

const BASE_SIM_DT_S = 1; // simulation seconds per logical tick
const TICK_MS = 250;

function tick() {
  const speed = getSimSpeed();
  if (speed <= 0) return; // paused: skip without emitting
  const SIM_DT_S = BASE_SIM_DT_S * speed;
  const now = new Date();
  snapshot.missionClockSec += SIM_DT_S;
  // 6× day/night speed → full cycle in 4 minutes wall clock
  snapshot.timeOfDayH = (10 + (snapshot.missionClockSec / 60) * 1.5) % 24;
  const t = snapshot.missionClockSec;

  /* phase model loosely matching the IRONSHIELD scenario */
  const phaseDetect = t > 60;
  const phaseEngage = t > 180;
  const phaseBDA = t > 360;
  const phaseLogistics = t > 540;

  // Vehicles: travel along a heading, persistent target speed, smooth turns.
  for (const v of snapshot.vehicles) {
    if (v.engineStatus !== 'running' && v.engineStatus !== 'idle') continue;
    let ai = vehicleAI.get(v.id);
    if (!ai) {
      ai = {
        targetSpeedKmh: 0,
        speedHoldUntil: 0,
        lastTurnT: t,
        turnRateDegPerS: 0,
      };
      vehicleAI.set(v.id, ai);
    }

    // Re-pick target speed only every 8–18 sim seconds (persistent intent).
    if (t >= ai.speedHoldUntil) {
      const advance = phaseEngage && v.sector !== 'Alpha';
      ai.targetSpeedKmh = advance ? randRange(12, 28) : randRange(0, 4);
      // Krab (artillery) tends to stay slow / static
      if (v.vehicleType === 'Krab') ai.targetSpeedKmh = advance ? randRange(0, 8) : 0;
      ai.speedHoldUntil = t + randRange(8, 18);
    }
    // Acceleration limited (~3 km/h per sim second)
    const dv = ai.targetSpeedKmh - v.speedKmh;
    const accel = Math.sign(dv) * Math.min(Math.abs(dv), 3 * SIM_DT_S);
    v.speedKmh = Math.max(0, v.speedKmh + accel);

    // Heading turn rate persists for 4–10 sim seconds, then re-rolls.
    if (t - ai.lastTurnT > randRange(4, 10)) {
      ai.turnRateDegPerS = (rand() - 0.5) * 8; // ±4 °/s
      ai.lastTurnT = t;
    }
    if (v.speedKmh > 0.4) {
      v.headingDeg = (v.headingDeg + ai.turnRateDegPerS * SIM_DT_S + 360) % 360;
      const distKm = (v.speedKmh * SIM_DT_S) / 3600;
      const rad = (v.headingDeg * Math.PI) / 180;
      v.latitude += kmToLat(distKm * Math.cos(rad));
      v.longitude += kmToLon(distKm * Math.sin(rad));
    }
    if (rand() < 0.02) v.fuelPercent = Math.max(0, v.fuelPercent - 1);
    if (phaseEngage && rand() < 0.01) v.ammoPercent = Math.max(0, v.ammoPercent - randInt(1, 4));
    if (v.fuelPercent < 25 && rand() < 0.05) {
      pushEvent('logistics', 'medium', v.sector, 'Niski poziom paliwa', `${v.vehicleId} (${v.fuelPercent}%) — sektor ${v.sector}`);
    }
    v.updatedAt = now;
  }

  // Soldiers: persistent heading, walk smoothly, change posture rarely.
  for (const s of snapshot.soldiers) {
    let ai = soldierAI.get(s.id);
    if (!ai) {
      ai = {
        headingDeg: rand() * 360,
        speedMs: 1.2,
        targetSpeedMs: 1.2,
        statusHoldUntil: t + randRange(4, 10),
        pivotEvery: randRange(6, 14),
        lastPivotT: t,
      };
      soldierAI.set(s.id, ai);
    }

    // Re-pivot heading every few seconds with a small bias change (smooth turn).
    if (t - ai.lastPivotT > ai.pivotEvery) {
      ai.headingDeg = (ai.headingDeg + (rand() - 0.5) * 90 + 360) % 360;
      ai.lastPivotT = t;
      ai.pivotEvery = randRange(6, 14);
    }

    // Posture changes every 4–10 seconds, not every tick.
    // Prone (taktyczne położenie) tylko w kontestowanych sektorach pod ostrzałem,
    // nigdy w bezpiecznym tyle (Alpha). To rozróżnia sytuację taktyczną od `down`
    // (rannego), który zachodzi niezależnie poprzez próg HR.
    if (s.movementStatus !== 'down' && t >= ai.statusHoldUntil) {
      const inCombat = phaseEngage && s.sector !== 'Alpha';
      const r = rand();
      let next: Soldier['movementStatus'];
      if (inCombat) {
        next = r < 0.45 ? 'walking'
             : r < 0.70 ? 'prone'
             : r < 0.95 ? 'running'
             : 'walking';
      } else {
        // Bezpieczny tył — tylko ruch pieszy, brak prone bez powodu
        next = r < 0.85 ? 'walking' : 'running';
      }
      s.movementStatus = next;
      ai.statusHoldUntil = t + randRange(4, 10);
      ai.targetSpeedMs =
        next === 'running' ? 3.2
        : next === 'walking' ? 1.2
        : 0; // prone idle
    }

    // Smooth speed toward target
    ai.speedMs += (ai.targetSpeedMs - ai.speedMs) * Math.min(1, SIM_DT_S * 1.2);

    if (ai.speedMs > 0.05 && s.movementStatus !== 'down') {
      const distKm = (ai.speedMs * SIM_DT_S) / 1000;
      const rad = (ai.headingDeg * Math.PI) / 180;
      s.latitude += kmToLat(distKm * Math.cos(rad));
      s.longitude += kmToLon(distKm * Math.sin(rad));
    }

    const stressBoost = phaseEngage && s.sector !== 'Alpha' ? 25 : 0;
    s.heartRate = clamp(s.heartRate + (rand() - 0.5) * 6 + stressBoost * 0.05, 60, 215);
    s.bodyTemp = clamp(s.bodyTemp + (rand() - 0.5) * 0.05, 35.5, 39.5);
    s.bloodOxygen = clamp(s.bloodOxygen + (rand() - 0.5) * 0.4, 86, 100) | 0;
    if (s.heartRate > 180) s.stressLevel = 'critical';
    else if (s.heartRate > 130) s.stressLevel = 'elevated';
    else s.stressLevel = 'normal';
    if (s.movementStatus !== 'down' && s.heartRate > 195 && rand() < 0.04) {
      s.movementStatus = 'down';
      ai.targetSpeedMs = 0;
      ai.speedMs = 0;
      pushEvent('medevac', 'critical', s.sector, 'MEDEVAC required', `${s.soldierId} HR=${s.heartRate|0} SpO2=${s.bloodOxygen}`);
    }
    s.updatedAt = now;
  }

  // Drones: orbit in their sector
  for (const d of snapshot.drones) {
    const sec = SECTORS.find((x) => x.name === d.sector)!;
    const dx = (d.longitude - sec.lon) * KM_PER_DEG_LON;
    const dz = (d.latitude - sec.lat) * KM_PER_DEG_LAT;
    const r = Math.hypot(dx, dz) || 0.01;
    const tan = { x: -dz / r, z: dx / r };
    const stepKm = 0.04;
    d.longitude += kmToLon(tan.x * stepKm);
    d.latitude += kmToLat(tan.z * stepKm);
    d.altitudeM += (rand() - 0.5) * 4;
    d.altitudeM = clamp(d.altitudeM, 180, 480);
    d.batteryPercent = Math.max(0, d.batteryPercent - (rand() < 0.3 ? 1 : 0));
    if (phaseDetect && d.sector === 'Bravo' && rand() < 0.05) {
      d.observationType = 'target_lock';
      d.targetClassification = 'hostile_armor';
      d.targetCount = randInt(1, 3);
      d.confidence = +(0.7 + rand() * 0.25).toFixed(2);
    }
    d.updatedAt = now;
  }

  // Radar tracks: spawn hostiles in Bravo during detection phase
  if (phaseDetect && snapshot.radarTracks.length < 14 && rand() < 0.5) {
    const sector = pick(['Bravo', 'Charlie', 'Bravo']);
    const sec = SECTORS.find((x) => x.name === sector)!;
    const r = sec.radiusKm * (0.8 + rand() * 0.6);
    const a = rand() * Math.PI * 2;
    snapshot.radarTracks.push({
      id: `trk-${Math.random().toString(36).slice(2, 8)}`,
      trackId: `TRK-H-${randInt(1000, 9999)}`,
      classification: rand() < 0.85 ? 'hostile' : 'unknown',
      objectType: pick(['armored_vehicle', 'drone', 'infantry']),
      sector,
      latitude: sec.lat + kmToLat(r * Math.sin(a)),
      longitude: sec.lon + kmToLon(r * Math.cos(a)),
      speedKmh: randRange(15, 60),
      headingDeg: randInt(220, 320),
      distanceToBlueKm: +randRange(2, 6).toFixed(1),
      confidence: +(0.55 + rand() * 0.4).toFixed(2),
      radarId: `RAD-${randInt(1, 4).toString().padStart(2, '0')}`,
      detectedAt: now,
      updatedAt: now,
    });
    pushEvent('threat', 'high', sector, 'Hostile contact', `Nowy track w sektorze ${sector}.`);
  }
  // Move existing tracks toward Blue
  for (const tr of snapshot.radarTracks) {
    const distKm = (tr.speedKmh * SIM_DT_S) / 3600;
    const rad = (tr.headingDeg * Math.PI) / 180;
    tr.latitude += kmToLat(distKm * Math.cos(rad));
    tr.longitude += kmToLon(distKm * Math.sin(rad));
    tr.distanceToBlueKm = Math.max(0, tr.distanceToBlueKm - distKm);
    tr.updatedAt = now;
  }
  // Engagement attrition
  if (phaseBDA) {
    snapshot.radarTracks = snapshot.radarTracks.filter(() => rand() > 0.01);
  }

  // Weather drift
  for (const w of snapshot.weather) {
    w.windDirDeg = (w.windDirDeg + (rand() - 0.5) * 8 + 360) % 360;
    w.windSpeedMs = clamp(w.windSpeedMs + (rand() - 0.5) * 0.6, 0, 18);
    w.fogDensity = clamp(w.fogDensity + (rand() - 0.5) * 0.02, 0, 0.6);
    w.cloudCover = clamp(w.cloudCover + (rand() - 0.5) * 0.04, 0, 1);
    if (phaseLogistics && rand() < 0.005) {
      w.condition = 'rain';
      w.precipMmH = 1.5;
    }
    w.updatedAt = now;
  }

  // Logistics phase event
  if (phaseLogistics && rand() < 0.02) {
    pushEvent('logistics', 'low', 'Alpha', 'Konwój zaopatrzenia', 'COY-LOG-1 wjeżdża do sektora Alpha.');
  }

  emit();
}

function pushEvent(kind: SimEvent['kind'], severity: SimEvent['severity'], sector: string, title: string, message: string) {
  snapshot.events.unshift({
    id: `evt-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    severity,
    sector,
    title,
    message,
    createdAt: new Date(),
  });
  if (snapshot.events.length > 40) snapshot.events.length = 40;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function emit() {
  // Shallow-clone arrays so React detects changes
  const next: BattlefieldSnapshot = {
    ...snapshot,
    sectors: snapshot.sectors,
    vehicles: snapshot.vehicles.slice(),
    soldiers: snapshot.soldiers.slice(),
    drones: snapshot.drones.slice(),
    radarTracks: snapshot.radarTracks.slice(),
    weather: snapshot.weather.slice(),
    events: snapshot.events.slice(),
  };
  for (const cb of listeners) cb(next);
}

export function getSnapshot(): BattlefieldSnapshot {
  return snapshot;
}

export function subscribe(cb: (s: BattlefieldSnapshot) => void): () => void {
  listeners.add(cb);
  if (!started) {
    started = true;
    setInterval(tick, TICK_MS);
  }
  cb(snapshot);
  return () => {
    listeners.delete(cb);
  };
}

export function resetSimulation() {
  snapshot = buildInitial();
  emit();
}
