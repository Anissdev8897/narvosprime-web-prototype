import { useSyncExternalStore } from "react";
import { npcPlacementStore, type PlacedNpc } from "./npcPlacementStore";

export function useNpcPlacements(mapId: string): PlacedNpc[] {
  useSyncExternalStore(npcPlacementStore.subscribe, npcPlacementStore.getVersion, npcPlacementStore.getVersion);
  return npcPlacementStore.list(mapId);
}
