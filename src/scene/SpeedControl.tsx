import { useSimControl } from '@/hooks/useSimControl';

const PRESETS = [0, 0.5, 1, 2, 4, 8];

export function SpeedControl() {
  const speed = useSimControl((s) => s.speed);
  const setSpeed = useSimControl((s) => s.setSpeed);
  const togglePause = useSimControl((s) => s.togglePause);

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
          onChange={(e) => setSpeed(PRESETS[Number(e.target.value)])}
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
            onClick={() => setSpeed(p)}
          >
            {p === 0 ? '⏸' : `${p}×`}
          </button>
        ))}
      </div>
    </div>
  );
}
