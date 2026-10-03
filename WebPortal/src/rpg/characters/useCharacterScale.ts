// ══════════════════════════════════════════════════════════════════════════════
// characters/useCharacterScale.ts — Hook React pour lire le scale en LIVE
//
// Pont entre le store vanilla `characterScaleStore` et React, via le hook
// canonique React 18 `useSyncExternalStore`. Chaque composant qui appelle ce
// hook se re-render automatiquement quand le slider de l'AdminPanel bouge.
//
// Utilisé par :
//   • HumanCharacter — applique au mesh visuel du joueur (live)
//   • Npc            — applique au mesh visuel des PNJ + position billboards (live)
//
// NE PAS utiliser dans playerConfig.ts (qui est hors React) : pour la collision
// + caméra, on garde CHARACTER_SCALE_AT_BOOT (un reload applique le nouveau scale).
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { characterScaleStore } from "./characterScale";

/**
 * Retourne le scale courant et déclenche un re-render quand il change.
 * Compatible concurrent-mode (React 18+).
 */
export function useCharacterScale(): number {
  return useSyncExternalStore(
    characterScaleStore.subscribe,
    characterScaleStore.get,
    // getServerSnapshot : retourne la même chose côté SSR (jamais utilisé ici,
    // mais demandé par l'API pour éviter un warning).
    characterScaleStore.get,
  );
}
