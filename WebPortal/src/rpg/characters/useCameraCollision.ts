// ══════════════════════════════════════════════════════════════════════════════
// characters/useCameraCollision.ts — Hook React pour lire le toggle collision
// (pont vers le store vanilla via useSyncExternalStore)
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { cameraCollisionStore } from "./cameraCollision";

/** True si la collision caméra TPS est active. Réactif. */
export function useCameraCollision(): boolean {
  return useSyncExternalStore(
    cameraCollisionStore.subscribe,
    cameraCollisionStore.get,
    cameraCollisionStore.get,
  );
}
