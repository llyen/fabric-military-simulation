import {
  entity,
  role,
  text,
  decimal,
  int,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/** ISR / loitering munition drone (FlyEye, Warmate). */
@entity()
@role('authenticated', ['read', 'create', 'update', 'delete'])
export class Drone {
  @uuid() id!: string;
  @text({ max: 32 }) droneId!: string;
  /** 'FlyEye' | 'Warmate' */
  @text({ max: 32 }) droneType!: string;
  @text({ max: 16 }) sector!: string;
  @decimal() latitude!: number;
  @decimal() longitude!: number;
  @decimal() altitudeM!: number;
  @int() batteryPercent!: number;
  /** 'patrol_scan' | 'target_lock' | 'rtb' | 'down' */
  @text({ max: 32 }) observationType!: string;
  @text({ max: 32 }) targetClassification!: string;
  @int() targetCount!: number;
  @decimal() confidence!: number;
  @date() updatedAt!: Date;
}
