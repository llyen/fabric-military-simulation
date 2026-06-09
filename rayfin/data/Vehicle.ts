import {
  entity,
  role,
  text,
  decimal,
  int,
  boolean,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/** Blue Force ground vehicle (BWP Borsuk, Rosomak, Krab, etc.) */
@entity()
@role('authenticated', ['read', 'create', 'update', 'delete'])
export class Vehicle {
  @uuid() id!: string;
  @text({ max: 32 }) vehicleId!: string;
  @text({ max: 32 }) vehicleType!: string;
  @text({ max: 64 }) unitName!: string;
  @text({ max: 16 }) sector!: string;
  @decimal() latitude!: number;
  @decimal() longitude!: number;
  @decimal() speedKmh!: number;
  @int() headingDeg!: number;
  /** 'running' | 'idle' | 'off' | 'damaged' */
  @text({ max: 16 }) engineStatus!: string;
  @int() fuelPercent!: number;
  @int() ammoPercent!: number;
  @int() crewCount!: number;
  @boolean() combatReady!: boolean;
  @date() updatedAt!: Date;
}
