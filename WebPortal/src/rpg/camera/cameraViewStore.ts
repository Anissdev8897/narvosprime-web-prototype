// ══════════════════════════════════════════════════════════════════════════════
// camera/cameraViewStore.ts — Vue caméra (FPS / TPS) lisible par React.
//
// POURQUOI CE FICHIER EXISTE :
// La vue vit dans `camState`, un `useRef` muté par la boucle de rendu
// (`PlayerRig`, dans un `useFrame`). C'est le bon choix pour le rendu — 60 fois
// par seconde, un `useState` re-rendrait tout l'arbre pour rien.
//
// Mais le viewmodel d'arme FPS est du JSX : `RpgGameWorld` testait
// `camState.current.view === "fps"` PENDANT LE RENDU. Muter un ref ne notifie
// jamais React. Appuyer sur F1 basculait donc bien la caméra, sans que le
// composant ne se re-rende — l'arme n'apparaissait dans les mains que si un
// AUTRE état changeait par hasard au même moment (dégainer, par exemple, qui
// lui est un vrai `useState`). D'où « il manque la vue avec l'arme en mains » :
// le code était là et complet, il n'était simplement jamais monté.
//
// Ce store est un MIROIR, pas la source : `camState` reste autoritaire pour la
// boucle de rendu. On ne publie qu'au CHANGEMENT — appelé depuis `useFrame`,
// notifier à chaque frame relancerait React 60 fois par seconde.
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

export type CameraView = "fps" | "tps";

let view: CameraView = "tps"; // DOIT correspondre à createPlayerState().view (mirror, pas source)
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const cameraViewStore = {
  get(): CameraView { return view; },

  /**
   * Publie la vue courante. NO-OP si elle n'a pas changé.
   *
   * Ce garde-fou n'est pas une optimisation de confort : la fonction est
   * appelée depuis `useFrame`, donc ~60 fois par seconde. Sans lui, chaque
   * frame déclencherait un re-render complet de `RpgGameWorld`.
   */
  set(next: CameraView): void {
    if (next === view) return;
    view = next;
    for (const l of listeners) l();
  },

  subscribe,
};

/** Pont React. Re-rend le composant quand la vue bascule, pas à chaque frame. */
export function useCameraView(): CameraView {
  return useSyncExternalStore(subscribe, cameraViewStore.get, cameraViewStore.get);
}
