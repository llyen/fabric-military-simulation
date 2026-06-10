import type {
  BattlefieldSnapshot,
  Drone,
  RadarTrack,
  Selection,
  Soldier,
  Vehicle,
} from '@/types';

type Row = { label: string; value: string };

function fmtCoord(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function vehicleRows(v: Vehicle): Row[] {
  return [
    { label: 'Unit', value: v.unitName },
    { label: 'Type', value: v.vehicleType },
    { label: 'Sector', value: v.sector },
    { label: 'Position', value: fmtCoord(v.latitude, v.longitude) },
    { label: 'Speed', value: `${Math.round(v.speedKmh)} km/h` },
    { label: 'Heading', value: `${Math.round(v.headingDeg)}°` },
    { label: 'Engine', value: v.engineStatus },
    { label: 'Fuel', value: `${Math.round(v.fuelPercent)} %` },
    { label: 'Ammo', value: `${Math.round(v.ammoPercent)} %` },
    { label: 'Crew', value: String(v.crewCount) },
    { label: 'Combat ready', value: v.combatReady ? 'Yes' : 'No' },
  ];
}

function soldierRows(s: Soldier): Row[] {
  return [
    { label: 'Unit', value: s.unitName },
    { label: 'Sector', value: s.sector },
    { label: 'Position', value: fmtCoord(s.latitude, s.longitude) },
    { label: 'Status', value: s.movementStatus },
    { label: 'Stress', value: s.stressLevel },
    { label: 'Heart rate', value: `${Math.round(s.heartRate)} bpm` },
    { label: 'Body temp', value: `${s.bodyTemp.toFixed(1)} °C` },
    { label: 'Blood O₂', value: `${Math.round(s.bloodOxygen)} %` },
  ];
}

function droneRows(d: Drone): Row[] {
  return [
    { label: 'Type', value: d.droneType },
    { label: 'Sector', value: d.sector },
    { label: 'Position', value: fmtCoord(d.latitude, d.longitude) },
    { label: 'Altitude', value: `${Math.round(d.altitudeM)} m` },
    { label: 'Battery', value: `${Math.round(d.batteryPercent)} %` },
    { label: 'Observation', value: d.observationType },
    { label: 'Target class', value: d.targetClassification },
    { label: 'Targets', value: String(d.targetCount) },
    { label: 'Confidence', value: `${Math.round(d.confidence * 100)} %` },
  ];
}

function radarRows(t: RadarTrack): Row[] {
  return [
    { label: 'Track', value: t.trackId },
    { label: 'Classification', value: t.classification },
    { label: 'Object', value: t.objectType },
    { label: 'Sector', value: t.sector },
    { label: 'Position', value: fmtCoord(t.latitude, t.longitude) },
    { label: 'Speed', value: `${Math.round(t.speedKmh)} km/h` },
    { label: 'Heading', value: `${Math.round(t.headingDeg)}°` },
    { label: 'Dist. to blue', value: `${t.distanceToBlueKm.toFixed(1)} km` },
    { label: 'Confidence', value: `${Math.round(t.confidence * 100)} %` },
    { label: 'Radar', value: t.radarId },
  ];
}

const KIND_LABEL: Record<Selection['kind'], string> = {
  vehicle: 'Vehicle',
  soldier: 'Soldier',
  drone: 'Drone',
  radar: 'Radar Track',
};

function resolve(
  snapshot: BattlefieldSnapshot,
  selection: Selection
): { title: string; rows: Row[] } | null {
  switch (selection.kind) {
    case 'vehicle': {
      const v = snapshot.vehicles.find((x) => x.id === selection.id);
      return v ? { title: v.vehicleId, rows: vehicleRows(v) } : null;
    }
    case 'soldier': {
      const s = snapshot.soldiers.find((x) => x.id === selection.id);
      return s ? { title: s.soldierId, rows: soldierRows(s) } : null;
    }
    case 'drone': {
      const d = snapshot.drones.find((x) => x.id === selection.id);
      return d ? { title: d.droneId, rows: droneRows(d) } : null;
    }
    case 'radar': {
      const t = snapshot.radarTracks.find((x) => x.id === selection.id);
      return t ? { title: t.trackId, rows: radarRows(t) } : null;
    }
  }
}

export function SelectionPanel({
  snapshot,
  selection,
  onClose,
}: {
  snapshot: BattlefieldSnapshot;
  selection: Selection | null;
  onClose: () => void;
}) {
  if (!selection) return null;
  const data = resolve(snapshot, selection);
  if (!data) return null;

  return (
    <div className="hud sel-panel">
      <div className="hud-title">
        {data.title}
        <span className="hud-mode">{KIND_LABEL[selection.kind]}</span>
        <button className="sel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="sel-rows">
        {data.rows.map((r) => (
          <div className="sel-row" key={r.label}>
            <span className="sel-label">{r.label}</span>
            <span className="sel-value">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
