import { useRef } from 'react';

/**
 * Entity interpolation for poll-driven movement.
 *
 * The backend is sampled once per second, so a unit's geographic position
 * arrives as a sparse stream of points. Easing toward the latest point makes a
 * unit dash to it and then sit still until the next poll ("hop–pause"). Instead
 * we buffer the recent samples and render the unit slightly in the past
 * (`delayMs`), linearly interpolating between the two samples that bracket that
 * render time. Because there is always a newer sample ahead of the render
 * cursor, motion is continuous and at constant velocity — the same technique
 * game engines use to smooth networked entities.
 */
export interface InterpResult {
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
}

interface Sample {
  t: number;
  x: number;
  z: number;
}

export function useTrackInterpolation(delayMs = 1200) {
  const history = useRef<Sample[]>([]);
  const lastKey = useRef('');
  const out = useRef<InterpResult>({ x: 0, z: 0, yaw: 0, moving: false });

  return function update(x: number, z: number, nowMs: number): InterpResult {
    const key = `${x},${z}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      history.current.push({ t: nowMs, x, z });
      if (history.current.length > 8) history.current.shift();
    }

    const h = history.current;
    const o = out.current;
    if (h.length === 1) {
      o.x = h[0].x;
      o.z = h[0].z;
      o.moving = false;
      return o;
    }

    const renderT = nowMs - delayMs;
    // Largest index whose timestamp is at or before the render cursor.
    let j = h.length - 1;
    while (j > 0 && h[j].t > renderT) j--;
    const a = h[j];
    const b = h[Math.min(h.length - 1, j + 1)];

    const span = b.t - a.t;
    const alpha = span > 0 ? Math.min(1, Math.max(0, (renderT - a.t) / span)) : 1;
    o.x = a.x + (b.x - a.x) * alpha;
    o.z = a.z + (b.z - a.z) * alpha;

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const motion = Math.hypot(dx, dz);
    if (motion > 0.001) o.yaw = Math.atan2(dx, dz);
    o.moving = motion > 0.5;
    return o;
  };
}
