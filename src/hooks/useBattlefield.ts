import { useEffect, useState } from 'react';
import type { BattlefieldSnapshot } from '@/types';
import { isMockMode, getRayfinClient } from '@/services/rayfinClient';
import * as mock from '@/services/mockSim';

const POLL_MS = 1000;

/**
 * Returns the latest battlefield snapshot.
 *
 *  - In MOCK mode: subscribes to the in-browser simulator (250 ms ticks).
 *  - In Rayfin mode: polls all entities once per second and assembles them.
 */
export function useBattlefield(enabled = true): BattlefieldSnapshot {
  const [snap, setSnap] = useState<BattlefieldSnapshot>(() =>
    isMockMode() ? mock.getSnapshot() : emptySnapshot()
  );

  useEffect(() => {
    if (isMockMode()) {
      return mock.subscribe(setSnap);
    }
    if (!enabled) return;
    let cancelled = false;
    let missionStart = Date.now();

    async function poll() {
      try {
        const c = getRayfinClient();
        const results =
          await Promise.all([
            c.data.Sector.select(['id', 'name', 'centerLat', 'centerLon', 'radiusKm', 'role']).execute(),
            c.data.Vehicle.select([
              'id', 'vehicleId', 'vehicleType', 'unitName', 'sector',
              'latitude', 'longitude', 'speedKmh', 'headingDeg',
              'engineStatus', 'fuelPercent', 'ammoPercent',
              'crewCount', 'combatReady', 'updatedAt',
            ]).execute(),
            c.data.Soldier.select([
              'id', 'soldierId', 'unitName', 'sector',
              'latitude', 'longitude', 'heartRate', 'bodyTemp',
              'bloodOxygen', 'stressLevel', 'movementStatus', 'updatedAt',
            ]).execute(),
            c.data.Drone.select([
              'id', 'droneId', 'droneType', 'sector', 'latitude', 'longitude',
              'altitudeM', 'batteryPercent', 'observationType',
              'targetClassification', 'targetCount', 'confidence', 'updatedAt',
            ]).execute(),
            c.data.RadarTrack.select([
              'id', 'trackId', 'classification', 'objectType', 'sector',
              'latitude', 'longitude', 'speedKmh', 'headingDeg',
              'distanceToBlueKm', 'confidence', 'radarId',
              'detectedAt', 'updatedAt',
            ]).execute(),
            c.data.WeatherCell.select([
              'id', 'sector', 'tempC', 'windSpeedMs', 'windDirDeg',
              'cloudCover', 'fogDensity', 'precipMmH', 'condition', 'updatedAt',
            ]).execute(),
            c.data.SimEvent.select([
              'id', 'kind', 'severity', 'sector', 'title', 'message', 'createdAt',
            ]).orderBy({ createdAt: 'desc' }).execute(),
            c.data.SimState.select(['missionClockSec', 'updatedAt']).execute(),
          ]);
        if (cancelled) return;
        const [
          sectors, vehicles, soldiers, drones, radarTracks, weather, events, simState,
        ] = results;
        // Prefer the simulator's clock (advances with tempo, freezes on pause);
        // fall back to wall-clock if the SimState row isn't available yet.
        const serverClock = (simState as never as { missionClockSec: number }[])[0]?.missionClockSec;
        const missionClockSec = typeof serverClock === 'number'
          ? serverClock
          : Math.floor((Date.now() - missionStart) / 1000);
        setSnap({
          sectors: sectors as never,
          vehicles: vehicles as never,
          soldiers: soldiers as never,
          drones: drones as never,
          radarTracks: radarTracks as never,
          weather: weather as never,
          events: (events as never as BattlefieldSnapshot['events']).slice(0, 40),
          missionClockSec,
          timeOfDayH: ((10 + (missionClockSec / 60) * 1.5) % 24),
        });
      } catch (err) {
        console.error('[rayfin] poll failed', err);
      }
    }

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return snap;
}

function emptySnapshot(): BattlefieldSnapshot {
  return {
    sectors: [], vehicles: [], soldiers: [], drones: [],
    radarTracks: [], weather: [], events: [],
    missionClockSec: 0, timeOfDayH: 10,
  };
}
