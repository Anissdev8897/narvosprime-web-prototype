import { useSyncExternalStore } from "react";
import { portalStore, type PlacedPortal } from "./portalStore";

export function usePortals(mapId: string): PlacedPortal[] {
  useSyncExternalStore(portalStore.subscribe, portalStore.getVersion, portalStore.getVersion);
  return portalStore.list(mapId);
}
