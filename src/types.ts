/**
 * Plain TypeScript shapes used both by the simulator and the React scene.
 * Mirror the Rayfin entities in `rayfin/data/*.ts` but without decorators
 * so they can be imported from any context (Node, browser, Vitest).
 */

export interface Sector {
  id: string;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  role: string;
}

export interface Vehicle {
  id: string;
  vehicleId: string;
  vehicleType: string;
  unitName: string;
  sector: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  engineStatus: 'running' | 'idle' | 'off' | 'damaged';
  fuelPercent: number;
  ammoPercent: number;
  crewCount: number;
  combatReady: boolean;
  updatedAt: Date;
}

export interface Soldier {
  id: string;
  soldierId: string;
  unitName: string;
  sector: string;
  latitude: number;
  longitude: number;
  heartRate: number;
  bodyTemp: number;
  bloodOxygen: number;
  stressLevel: 'normal' | 'elevated' | 'critical';
  movementStatus: 'prone' | 'walking' | 'running' | 'down';
  updatedAt: Date;
}

export interface Drone {
  id: string;
  droneId: string;
  droneType: 'FlyEye' | 'Warmate';
  sector: string;
  latitude: number;
  longitude: number;
  altitudeM: number;
  batteryPercent: number;
  observationType: 'patrol_scan' | 'target_lock' | 'rtb' | 'down';
  targetClassification: string;
  targetCount: number;
  confidence: number;
  updatedAt: Date;
}

export interface RadarTrack {
  id: string;
  trackId: string;
  classification: 'friendly' | 'hostile' | 'unknown';
  objectType: string;
  sector: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  distanceToBlueKm: number;
  confidence: number;
  radarId: string;
  detectedAt: Date;
  updatedAt: Date;
}

export interface WeatherCell {
  id: string;
  sector: string;
  tempC: number;
  windSpeedMs: number;
  windDirDeg: number;
  cloudCover: number;
  fogDensity: number;
  precipMmH: number;
  condition: 'clear' | 'overcast' | 'fog' | 'rain' | 'storm';
  updatedAt: Date;
}

export interface SimEvent {
  id: string;
  kind: 'threat' | 'medevac' | 'logistics' | 'ew' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sector: string;
  title: string;
  message: string;
  createdAt: Date;
}

export interface BattlefieldSnapshot {
  sectors: Sector[];
  vehicles: Vehicle[];
  soldiers: Soldier[];
  drones: Drone[];
  radarTracks: RadarTrack[];
  weather: WeatherCell[];
  events: SimEvent[];
  /** Mission clock, seconds since simulation start. */
  missionClockSec: number;
  /** Time-of-day in hours (0..24) for day/night cycle. */
  timeOfDayH: number;
}
