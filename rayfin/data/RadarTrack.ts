import {
  entity,
  role,
  text,
  decimal,
  int,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/** Radar contact (Blue / Hostile / Unknown). */
@entity()
@role('authenticated', ['read', 'create', 'update', 'delete'])
export class RadarTrack {
  @uuid() id!: string;
  @text({ max: 32 }) trackId!: string;
  /** 'friendly' | 'hostile' | 'unknown' */
  @text({ max: 16 }) classification!: string;
  /** 'drone' | 'armored_vehicle' | 'aircraft' | 'infantry' | 'unknown' */
  @text({ max: 32 }) objectType!: string;
  @text({ max: 16 }) sector!: string;
  @decimal() latitude!: number;
  @decimal() longitude!: number;
  @decimal() speedKmh!: number;
  @int() headingDeg!: number;
  @decimal() distanceToBlueKm!: number;
  @decimal() confidence!: number;
  @text({ max: 16 }) radarId!: string;
  @date() detectedAt!: Date;
  @date() updatedAt!: Date;
}
