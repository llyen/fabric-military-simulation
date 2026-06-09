import { useBattlefield } from '@/hooks/useBattlefield';
import { BattlefieldScene } from '@/scene/BattlefieldScene';
import { HUD } from '@/scene/HUD';

export default function App() {
  const snapshot = useBattlefield();
  return (
    <div className="app">
      <BattlefieldScene snapshot={snapshot} />
      <HUD snapshot={snapshot} />
    </div>
  );
}
