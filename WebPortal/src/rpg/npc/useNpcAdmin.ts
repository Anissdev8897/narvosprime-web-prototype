import { useSyncExternalStore } from "react";
import { npcAdminStore, type NpcAdminConfig } from "./npcAdminStore";

export function useNpcAdmin(): NpcAdminConfig {
  useSyncExternalStore(npcAdminStore.subscribe, npcAdminStore.getVersion, npcAdminStore.getVersion);
  return npcAdminStore.get();
}
