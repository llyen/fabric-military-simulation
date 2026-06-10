import { useEffect } from 'react';
import { useSimControl } from '@/hooks/useSimControl';
import { isMockMode } from '@/services/rayfinClient';
import { pushSimSpeed, fetchSimSpeed } from '@/services/simControl';

const PRESETS = [0, 0.5, 1, 2, 4, 8];

export function SpeedControl() {
  const speed = useSimControl((s) => s.speed);
  const setSpeed = useSimControl((s) => s.setSpeed);

  // In live mode, reflect the tempo currently applied by the simulator.
  useEffect(() => {
    if (isMockMode()) return;
    let cancelled = false;
    fetchSimSpeed().then((s) => {
      if (!cancelled && s !== null) setSpeed(s);
    });
    return () => {
      cancelled = true;
    };
  }, [setSpeed]);

  // Apply locally (drives the mock sim + slider) and push to the live simulator.
  const applySpeed = (s: number) => {
    setSpeed(s);
    void pushSimSpeed(s);
  };
  const togglePause = () => applySpeed(speed === 0 ? 1 : 0);

  // Map speed → slider index for snapping
  const idx = PRESETS.indexOf(speed);
  const sliderValue = idx >= 0 ? idx : 2;

  return (
    <div className="hud hud-br speed-ctrl">
      <div className="hud-section">SIM CONTROL</div>
      <div className="speed-row">
        <button
          className="speed-btn"
          onClick={togglePause}
          title={speed === 0 ? 'Resume' : 'Pause'}
        >
          {speed === 0 ? '▶' : '❚❚'}
        </button>
        <input
          className="speed-slider"
          type="range"
          min={0}
          max={PRESETS.length - 1}
          step={1}
          value={sliderValue}
          onChange={(e) => applySpeed(PRESETS[Number(e.target.value)])}
        />
        <div className="speed-value">
          {speed === 0 ? 'PAUSE' : `${speed}×`}
        </div>
      </div>
      <div className="speed-ticks">
        {PRESETS.map((p) => (
          <button
            key={p}
            className={`speed-tick ${p === speed ? 'active' : ''}`}
            onClick={() => applySpeed(p)}
          >
            {p === 0 ? '⏸' : `${p}×`}
          </button>
        ))}
      </div>
    </div>
  );
}
