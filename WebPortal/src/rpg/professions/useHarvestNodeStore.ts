import { useSyncExternalStore } from "react";
import { harvestNodeStore, type PlacedHarvestNode } from "./harvestNodeStore";

/** Abonnement React aux nœuds de récolte placés sur une map. */
export function usePlacedHarvestNodes(mapId: string): PlacedHarvestNode[] {
  useSyncExternalStore(harvestNodeStore.subscribe, harvestNodeStore.getVersion, harvestNodeStore.getVersion);
  return harvestNodeStore.list(mapId);
}
