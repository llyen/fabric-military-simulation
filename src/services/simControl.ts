import { isMockMode, getRayfinClient } from './rayfinClient';

/**
 * Server-side simulation tempo control.
 *
 * In live (Fabric) mode the units are driven by the headless SQL simulator, so
 * changing speed in the browser must reach that process. We append a SimControl
 * row (via the signed-in Fabric session) and the simulator reads the latest row
 * each tick to scale its step rate. In mock mode this is a no-op — the in-browser
 * simulator reads the local store directly.
 */
export async function pushSimSpeed(speed: number): Promise<void> {
  if (isMockMode()) return;
  try {
    const c = getRayfinClient();
    await c.data.SimControl.create({ speed, createdAt: new Date() } as never);
  } catch (e) {
    console.error('[simcontrol] failed to set speed', e);
  }
}

export async function fetchSimSpeed(): Promise<number | null> {
  if (isMockMode()) return null;
  try {
    const c = getRayfinClient();
    const rows = (await c.data.SimControl
      .select(['speed', 'createdAt'])
      .orderBy({ createdAt: 'desc' })
      .execute()) as unknown as { speed: number }[];
    return rows.length ? Number(rows[0].speed) : null;
  } catch {
    return null;
  }
}
