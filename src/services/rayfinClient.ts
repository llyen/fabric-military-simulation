import { RayfinClient } from '@microsoft/rayfin-client';
import type { SENTINELSchema } from '../../rayfin/data/schema';

let client: RayfinClient<SENTINELSchema> | null = null;
let isMock = false;

export function isMockMode(): boolean {
  return isMock || import.meta.env.VITE_RAYFIN_MOCK === '1';
}

export function initRayfinClient(): RayfinClient<SENTINELSchema> | null {
  if (isMockMode()) {
    isMock = true;
    return null;
  }
  if (client) return client;

  const apiUrl = import.meta.env.VITE_RAYFIN_API_URL;
  const publishableKey = import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY;
  if (!apiUrl || !publishableKey) {
    // No Rayfin env yet → fall back to in-browser mock simulator
    console.warn('[rayfin] VITE_RAYFIN_API_URL / PUBLISHABLE_KEY missing — running in MOCK mode.');
    isMock = true;
    return null;
  }

  client = new RayfinClient<SENTINELSchema>({
    baseUrl: apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`,
    publishableKey,
    functionsBaseUrl: import.meta.env.VITE_RAYFIN_FUNCTIONS_URL,
    useProxy: false,
    authStorage: true,
  });
  return client;
}

export function getRayfinClient(): RayfinClient<SENTINELSchema> {
  if (!client) throw new Error('Rayfin client not initialized.');
  return client;
}

/** Returns the Auth instance of the browser client, or null in mock/uninitialized mode. */
export function getRayfinAuth() {
  return client?.auth ?? null;
}
