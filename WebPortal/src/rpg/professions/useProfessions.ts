import { useSyncExternalStore } from "react";
import { professionStore, type ProfessionState } from "./professionStore";

/** Abonnement React à l'état des métiers (niveaux/XP/endurance). */
export function useProfessions(): ProfessionState {
  useSyncExternalStore(professionStore.subscribe, professionStore.getVersion, professionStore.getVersion);
  return professionStore.get();
}
