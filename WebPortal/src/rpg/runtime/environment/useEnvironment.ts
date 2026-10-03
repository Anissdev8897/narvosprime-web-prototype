// environment/useEnvironment.ts — pont React (useSyncExternalStore) vers environmentStore
import { useSyncExternalStore } from "react";
import { environmentStore } from "./environmentStore";
import type { EnvConfig } from "./environmentTypes";

/** Retourne la config live de la map ; re-render quand le store change (version). */
export function useEnvironment(mapId: string): EnvConfig {
  // getVersion = snapshot stable (number) → déclenche le re-render sans boucle.
  useSyncExternalStore(environmentStore.subscribe, environmentStore.getVersion, environmentStore.getVersion);
  return environmentStore.get(mapId);
}
