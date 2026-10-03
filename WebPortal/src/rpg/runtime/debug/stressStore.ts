// runtime/debug/stressStore.ts — état du harnais de stress (dev/admin).
import { useSyncExternalStore } from "react";

export interface StressState {
  count: number;                 // nb de bots actifs (0 = aucun)
  behavior: "wander" | "shoot";  // errer seul / errer + lancer des sorts
}

let state: StressState = { count: 0, behavior: "shoot" };
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export const stressStore = {
  get: () => state,
  set: (patch: Partial<StressState>) => { state = { ...state, ...patch }; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useStress(): StressState {
  return useSyncExternalStore(stressStore.subscribe, stressStore.get, stressStore.get);
}
