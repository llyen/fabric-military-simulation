import { create } from 'zustand';

interface SimControlState {
  /** 0 = paused, 0.5/1/2/4/8 = wall-clock multiplier */
  speed: number;
  setSpeed: (s: number) => void;
  togglePause: () => void;
}

export const useSimControl = create<SimControlState>((set, get) => ({
  speed: 1,
  setSpeed: (s) => set({ speed: s }),
  togglePause: () => set({ speed: get().speed === 0 ? 1 : 0 }),
}));

/** Read-only access for non-React code (mockSim tick loop). */
export function getSimSpeed(): number {
  return useSimControl.getState().speed;
}
