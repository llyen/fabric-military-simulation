import {
  entity,
  role,
  text,
  decimal,
  int,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/** Per-sector weather snapshot driving visual FX (fog, rain, wind). */
@entity()
@role('authenticated', ['read', 'create', 'update', 'delete'])
export class WeatherCell {
  @uuid() id!: string;
  @text({ max: 16 }) sector!: string;
  @decimal() tempC!: number;
  @decimal() windSpeedMs!: number;
  @int() windDirDeg!: number;
  /** 0..1 – fraction of sky obscured */
  @decimal() cloudCover!: number;
  /** 0..1 – heavier = thicker fog */
  @decimal() fogDensity!: number;
  /** mm/h */
  @decimal() precipMmH!: number;
  /** 'clear' | 'overcast' | 'fog' | 'rain' | 'storm' */
  @text({ max: 16 }) condition!: string;
  @date() updatedAt!: Date;
}
