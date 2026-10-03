// ══════════════════════════════════════════════════════════════════════════════
// characters/useCameraOffset.ts — Hook React pour lire l'offset caméra en LIVE
// (pont vers le store vanilla via useSyncExternalStore, comme useCharacterScale)
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { cameraOffsetStore } from "./cameraOffset";

/** Multiplicateur d'offset caméra TPS (1.0 = neutre). Réactif. */
export function useCameraOffset(): number {
  return useSyncExternalStore(
    cameraOffsetStore.subscribe,
    cameraOffsetStore.get,
    cameraOffsetStore.get,
  );
}
