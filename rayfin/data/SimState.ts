import {
  entity,
  role,
  int,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * Single-row mirror of the headless simulator's clock. The SQL simulator upserts
 * one fixed row each tick with the current mission-clock seconds; the signed-in
 * app reads it so the HUD clock and day/night cycle advance with the simulation
 * tempo (and freeze on pause) instead of running off wall-clock time.
 */
@entity()
@role('authenticated', ['read'])
export class SimState {
  @uuid() id!: string;
  /** Elapsed simulated seconds since mission start. */
  @int() missionClockSec!: number;
  @date() updatedAt!: Date;
}
