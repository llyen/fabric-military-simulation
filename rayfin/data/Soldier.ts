import {
  entity,
  role,
  text,
  decimal,
  int,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/** Individual dismounted soldier with biometric telemetry. */
@entity()
@role('authenticated', ['read', 'create', 'update', 'delete'])
export class Soldier {
  @uuid() id!: string;
  @text({ max: 32 }) soldierId!: string;
  @text({ max: 64 }) unitName!: string;
  @text({ max: 16 }) sector!: string;
  @decimal({ precision: 18, scale: 6 }) latitude!: number;
  @decimal({ precision: 18, scale: 6 }) longitude!: number;
  @int() heartRate!: number;
  @decimal() bodyTemp!: number;
  @int() bloodOxygen!: number;
  /** 'normal' | 'elevated' | 'critical' */
  @text({ max: 16 }) stressLevel!: string;
  /** 'prone' | 'walking' | 'running' | 'down' */
  @text({ max: 16 }) movementStatus!: string;
  @date() updatedAt!: Date;
}
