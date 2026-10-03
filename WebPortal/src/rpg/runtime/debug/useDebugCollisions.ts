import { useSyncExternalStore } from "react";
import { debugCollisionsStore } from "./debugCollisions";

/** True si le mode debug collisions est activé. Réactif. */
export function useDebugCollisions(): boolean {
  return useSyncExternalStore(
    debugCollisionsStore.subscribe,
    debugCollisionsStore.get,
    debugCollisionsStore.get,
  );
}
