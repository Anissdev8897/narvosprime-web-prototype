import { useSyncExternalStore } from "react";
import { consumableSlotsStore } from "./consumableSlots";
import type { ConsumableSlots } from "./consumableSlots";

/** Hook React qui retourne les 3 slots courants (réactif). */
export function useConsumableSlots(): ConsumableSlots {
  return useSyncExternalStore(
    (cb) => consumableSlotsStore.subscribe(cb),
    () => consumableSlotsStore.get(),
    () => consumableSlotsStore.get(),
  );
}
