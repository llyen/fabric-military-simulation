import {
  entity,
  role,
  text,
  date,
  uuid,
} from '@microsoft/rayfin-core';

/** Append-only event log for HUD ticker (alerts, MEDEVAC, threat, logistics). */
@entity()
@role('authenticated', ['read', 'create'])
export class SimEvent {
  @uuid() id!: string;
  /** 'threat' | 'medevac' | 'logistics' | 'ew' | 'info' */
  @text({ max: 16 }) kind!: string;
  /** 'low' | 'medium' | 'high' | 'critical' */
  @text({ max: 16 }) severity!: string;
  @text({ max: 16 }) sector!: string;
  @text({ max: 256 }) title!: string;
  @text({ max: 1024 }) message!: string;
  @date() createdAt!: Date;
}
