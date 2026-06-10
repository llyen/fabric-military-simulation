import { useState } from 'react';
import { useBattlefield } from '@/hooks/useBattlefield';
import { BattlefieldScene } from '@/scene/BattlefieldScene';
import { HUD } from '@/scene/HUD';
import { SelectionPanel } from '@/scene/SelectionPanel';
import { useFabricAuth } from '@/services/fabricAuth';
import { isMockMode } from '@/services/rayfinClient';
import type { Selection } from '@/types';

export default function App() {
  const { state, error, signIn } = useFabricAuth();
  const ready = isMockMode() || state === 'authenticated';
  const snapshot = useBattlefield(ready);
  const [selection, setSelection] = useState<Selection | null>(null);

  return (
    <div className="app">
      <BattlefieldScene
        snapshot={snapshot}
        selection={selection}
        onSelect={setSelection}
        onDeselect={() => setSelection(null)}
      />
      <HUD snapshot={snapshot} />
      <SelectionPanel
        snapshot={snapshot}
        selection={selection}
        onClose={() => setSelection(null)}
      />

      {!ready && state !== 'mock' && (
        <div className="auth-overlay">
          <div className="auth-card">
            <div className="auth-title">OPERATION IRONSHIELD</div>
            <p className="auth-sub">
              {state === 'pending'
                ? 'Authenticating with Microsoft Fabric…'
                : 'Sign in with Microsoft Fabric to load live battlefield telemetry.'}
            </p>
            {state === 'signin-required' || state === 'error' ? (
              <button className="auth-btn" onClick={signIn}>
                Sign in with Fabric
              </button>
            ) : (
              <div className="auth-spinner" />
            )}
            {error && <div className="auth-error">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
