import { useSyncExternalStore } from "react";
import { statusEffects } from "./statusEffects";
import type { PlayerFxSnapshot } from "./statusEffects";

const subscribe = (cb: () => void) => statusEffects.subscribe(cb);
const getSnapshot = () => statusEffects.getSnapshot();

export function usePlayerEffects(): PlayerFxSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
