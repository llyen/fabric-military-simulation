import type { BattlefieldSnapshot, SimEvent } from '@/types';
import { isMockMode } from '@/services/rayfinClient';
import { SpeedControl } from './SpeedControl';

const KIND_COLOR: Record<SimEvent['kind'], string> = {
  threat: '#ef4444',
  medevac: '#f97316',
  logistics: '#facc15',
  ew: '#a855f7',
  info: '#22d3ee',
};

const SEV_COLOR: Record<SimEvent['severity'], string> = {
  low: '#9ca3af',
  medium: '#fde047',
  high: '#fb923c',
  critical: '#f87171',
};

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtTOD(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} L`;
}

export function HUD({ snapshot }: { snapshot: BattlefieldSnapshot }) {
  const hostiles = snapshot.radarTracks.filter((t) => t.classification === 'hostile').length;
  const unknowns = snapshot.radarTracks.filter((t) => t.classification === 'unknown').length;
  const medevac = snapshot.soldiers.filter((s) => s.movementStatus === 'down' || s.heartRate > 180).length;
  const lowFuel = snapshot.vehicles.filter((v) => v.fuelPercent < 30).length;
  const lowAmmo = snapshot.vehicles.filter((v) => v.ammoPercent < 30).length;
  const droneLock = snapshot.drones.filter((d) => d.observationType === 'target_lock').length;

  return (
    <>
      {/* Top-left: mission status */}
      <div className="hud hud-tl">
        <div className="hud-title">
          <span className="dot dot-live" /> OPERATION IRONSHIELD
          <span className="hud-mode">{isMockMode() ? 'MOCK SIM' : 'FABRIC LIVE'}</span>
        </div>
        <div className="hud-clock">
          <div>{fmtClock(snapshot.missionClockSec)}</div>
          <div className="muted">{fmtTOD(snapshot.timeOfDayH)}</div>
        </div>
        <div className="hud-counters">
          <Stat label="Hostiles" value={hostiles} color="#ef4444" />
          <Stat label="Unknown" value={unknowns} color="#facc15" />
          <Stat label="Drone locks" value={droneLock} color="#f97316" />
          <Stat label="MEDEVAC" value={medevac} color="#fb7185" />
          <Stat label="Low fuel" value={lowFuel} color="#fde047" />
          <Stat label="Low ammo" value={lowAmmo} color="#fdba74" />
        </div>
      </div>

      {/* Top-right: per-sector tile */}
      <div className="hud hud-tr">
        <div className="hud-section">SECTORS</div>
        {snapshot.sectors.map((s) => {
          const sectorHostiles = snapshot.radarTracks.filter(
            (t) => t.sector === s.name && t.classification !== 'friendly'
          ).length;
          const sectorBlue = snapshot.vehicles.filter((v) => v.sector === s.name).length;
          const wx = snapshot.weather.find((w) => w.sector === s.name);
          return (
            <div className="sector-row" key={s.id}>
              <div className="sector-name">{s.name}</div>
              <div className="sector-stats">
                <span title="Blue force vehicles">🟢 {sectorBlue}</span>
                <span title="Hostile/unknown contacts" style={{ color: sectorHostiles ? '#ef4444' : '#9ca3af' }}>
                  ⚠ {sectorHostiles}
                </span>
                <span title="Weather" className="muted">
                  {wx ? `${wx.condition}` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom: event ticker */}
      <div className="hud hud-b">
        <div className="hud-section">EVENT FEED</div>
        <div className="ticker">
          {snapshot.events.slice(0, 8).map((e) => (
            <div className="ticker-item" key={e.id}>
              <span className="kind-pill" style={{ background: KIND_COLOR[e.kind] }}>
                {e.kind.toUpperCase()}
              </span>
              <span className="sev" style={{ color: SEV_COLOR[e.severity] }}>
                {e.severity}
              </span>
              <strong>{e.title}</strong>
              <span className="muted"> — {e.message}</span>
              <span className="ticker-sector"> [{e.sector}]</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="hud hud-bl">
        <div className="legend">
          <span><i className="sw" style={{ background: '#22d3ee' }} /> Blue Force</span>
          <span><i className="sw" style={{ background: '#ef4444' }} /> Hostile</span>
          <span><i className="sw" style={{ background: '#facc15' }} /> Unknown</span>
          <span><i className="sw" style={{ background: '#86efac' }} /> Soldier OK</span>
          <span><i className="sw" style={{ background: '#dc2626' }} /> Soldier down</span>
        </div>
      </div>

      {/* Speed slider */}
      <SpeedControl />
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
