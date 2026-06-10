/**
 * Standalone simulator that pushes live battlefield state into Rayfin.
 *
 * Run after `rayfin up` succeeds:
 *
 *   npm run simulate
 *
 * The script needs the same env vars Vite consumes during dev:
 *   - RAYFIN_API_URL (or VITE_RAYFIN_API_URL)
 *   - RAYFIN_PUBLISHABLE_KEY (or VITE_RAYFIN_PUBLISHABLE_KEY)
 *
 * In offline / mock mode the React app simulates everything in-browser,
 * so this script is only required when wiring real Fabric persistence.
 */
import { RayfinClient } from '@microsoft/rayfin-client';
import type { IronshieldSchema } from '../rayfin/data/schema.js';
import { buildInitialWorld, advance } from './world.js';

const apiUrl = process.env.RAYFIN_API_URL ?? process.env.VITE_RAYFIN_API_URL;
const key = process.env.RAYFIN_PUBLISHABLE_KEY ?? process.env.VITE_RAYFIN_PUBLISHABLE_KEY;

if (!apiUrl || !key) {
  console.error(
    '[simulator] RAYFIN_API_URL / RAYFIN_PUBLISHABLE_KEY missing. ' +
      'Run `rayfin env --framework vite` first or use the in-browser mock (npm run dev:mock).'
  );
  process.exit(1);
}

const accessToken =
  process.env.RAYFIN_ACCESS_TOKEN ?? process.env.VITE_RAYFIN_ACCESS_TOKEN;

const client = new RayfinClient<IronshieldSchema>({
  baseUrl: apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
  publishableKey: key,
  ...(accessToken ? { accessToken } : {}),
  useProxy: false,
  authStorage: false,
});

// Entities are guarded by @role('authenticated', ...), so headless writes need a
// Rayfin session. Two supported modes:
//   • Fabric hosting — only Fabric brokered (SSO) auth is available, which is
//     browser-only. Supply a Rayfin session JWT via RAYFIN_ACCESS_TOKEN (copy the
//     Bearer token from the signed-in app's network requests).
//   • Local `rayfin up` dev — password auth works; we sign in (creating the sim
//     user on first run) and the client auto-attaches the session to data calls.
const SIM_EMAIL = process.env.RAYFIN_SEED_EMAIL ?? 'seed@ironshield.local';
const SIM_PASSWORD = process.env.RAYFIN_SEED_PASSWORD ?? 'Ironshield!2026';

async function ensureAuth(): Promise<void> {
  if (accessToken) {
    console.log('[simulator] using RAYFIN_ACCESS_TOKEN');
    return;
  }
  try {
    await client.auth.signIn({ email: SIM_EMAIL, password: SIM_PASSWORD });
  } catch {
    await client.auth.signUp({ email: SIM_EMAIL, password: SIM_PASSWORD });
    await client.auth.signIn({ email: SIM_EMAIL, password: SIM_PASSWORD });
  }
  console.log(`[simulator] authenticated as ${SIM_EMAIL}`);
}

const TICK_MS = 1000;
const world = buildInitialWorld();

async function pushAll() {
  await Promise.all([
    ...world.vehicles.map((v) =>
      client.data.Vehicle.update({ id: v.id }, withoutId(v)).catch(() =>
        client.data.Vehicle.create(v as never)
      )
    ),
    ...world.soldiers.map((s) =>
      client.data.Soldier.update({ id: s.id }, withoutId(s)).catch(() =>
        client.data.Soldier.create(s as never)
      )
    ),
    ...world.drones.map((d) =>
      client.data.Drone.update({ id: d.id }, withoutId(d)).catch(() =>
        client.data.Drone.create(d as never)
      )
    ),
    ...world.weather.map((w) =>
      client.data.WeatherCell.update({ id: w.id }, withoutId(w)).catch(() =>
        client.data.WeatherCell.create(w as never)
      )
    ),
  ]);
  // Radar tracks: full replace (delete missing, insert new)
  for (const t of world.radarTracks) {
    await client.data.RadarTrack.update({ id: t.id }, withoutId(t)).catch(() =>
      client.data.RadarTrack.create(t as never)
    );
  }
}

function withoutId<T extends { id: string }>(o: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = o;
  return rest;
}

async function loop() {
  console.log(`[simulator] connected to ${apiUrl}`);
  await ensureAuth();
  await pushAll();
  setInterval(async () => {
    advance(world);
    try {
      await pushAll();
      process.stdout.write(
        `\rT+${String(Math.floor(world.missionClockSec / 60)).padStart(2, '0')}:${String(world.missionClockSec % 60).padStart(2, '0')}  ` +
          `vehicles=${world.vehicles.length} tracks=${world.radarTracks.length} `
      );
    } catch (err) {
      console.error('\n[simulator] push failed', err);
    }
  }, TICK_MS);
}

loop();
