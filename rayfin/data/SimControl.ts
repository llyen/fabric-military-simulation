import {
  entity,
  role,
  decimal,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * Append-only simulation-tempo control. The signed-in app writes a new row when
 * the operator changes speed/pauses; the headless SQL simulator reads the most
 * recent row and scales its step rate (0 = paused). Append-only (read+create)
 * mirrors SimEvent so the browser's Fabric-SSO session can write without needing
 * update/delete rights.
 */
@entity()
@role('authenticated', ['read', 'create'])
export class SimControl {
  @uuid() id!: string;
  /** Wall-clock multiplier: 0 = paused, 0.5 / 1 / 2 / 4 / 8. */
  @decimal({ precision: 9, scale: 2 }) speed!: number;
  @date() createdAt!: Date;
}
