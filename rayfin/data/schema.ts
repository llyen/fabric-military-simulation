import { Sector } from './Sector.js';
import { Vehicle } from './Vehicle.js';
import { Soldier } from './Soldier.js';
import { Drone } from './Drone.js';
import { RadarTrack } from './RadarTrack.js';
import { WeatherCell } from './WeatherCell.js';
import { SimEvent } from './SimEvent.js';
import { SimControl } from './SimControl.js';

export type SENTINELSchema = {
  Sector: Sector;
  Vehicle: Vehicle;
  Soldier: Soldier;
  Drone: Drone;
  RadarTrack: RadarTrack;
  WeatherCell: WeatherCell;
  SimEvent: SimEvent;
  SimControl: SimControl;
};

export const schema = [
  Sector,
  Vehicle,
  Soldier,
  Drone,
  RadarTrack,
  WeatherCell,
  SimEvent,
  SimControl,
];
