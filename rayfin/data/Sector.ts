import { entity, role, text, decimal, uuid } from '@microsoft/rayfin-core';

/** Named operations area on Northgate training range. */
@entity()
@role('authenticated', ['read', 'create', 'update', 'delete'])
export class Sector {
  @uuid() id!: string;
  @text({ max: 32 }) name!: string;
  @decimal({ precision: 18, scale: 6 }) centerLat!: number;
  @decimal({ precision: 18, scale: 6 }) centerLon!: number;
  @decimal() radiusKm!: number;
  /** 'friendly_rear' | 'forward' | 'contested' | 'observation' */
  @text({ max: 32 }) role!: string;
}
