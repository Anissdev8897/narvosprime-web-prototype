// ══════════════════════════════════════════════════════════════════════════════
// forge/groundClickAction.ts — décision pure d'un clic au sol dans l'éditeur.
//
// Extrait de `ForgeBuilderScene.handleGroundClick`, qui mêlait la DÉCISION (que
// faire de ce clic ?) et l'EXÉCUTION (appeler les callbacks React). Seule la
// décision porte le risque de régression M1 — un objet posé à y = 0 au lieu du
// terrain réel — et elle est du TS pur : testable sans React, sans DOM, sans GPU.
//
// C'est le même partage que `runtime/movement/` : logique pure d'un côté,
// coquille R3F de l'autre. Les tests tournent en environnement `node`.
// ══════════════════════════════════════════════════════════════════════════════

import type * as THREE from "three";
import type { SurfacePick } from "../runtime/CollisionWorld";
// Type seulement : effacé à la compilation, donc pas de cycle d'import réel.
import type { ToolMode } from "./ForgeBuilderScene";

export type GroundClickAction =
  /** Ne toucher à RIEN — ni pose, ni sélection. */
  | { kind: "none" }
  /** Clic dans le vide sans outil en main → désélectionner. */
  | { kind: "deselect" }
  | { kind: "spline"; point: THREE.Vector3 }
  | { kind: "scatter"; point: THREE.Vector3 }
  | { kind: "place"; point: THREE.Vector3 };

/**
 * Que faire d'un clic au sol, à partir du résultat de `collisionWorld.pickSurface`.
 *
 * ── LES DEUX RÈGLES QUI TIENNENT M1 ──────────────────────────────────────────
 *
 * 1. **On ne pose JAMAIS sans `status === "hit"`.** Le point de repli historique
 *    était `event.point`, l'intersection avec le plan capteur de l'éditeur, à
 *    y ≈ 0. Sur la Forge (sol ≈ −51) tout objet posé se retrouvait 51 m en l'air.
 *
 * 2. **`empty` n'est pas `miss`.** Le monde de collision se peuple au fil des
 *    chargements (backdrop, chunks, terrain) : cliquer avant la fin est un cas
 *    NORMAL. On ne sait alors rien — donc on ne désélectionne pas non plus, et on
 *    garde l'asset en main pour que le joueur puisse recliquer.
 */
export function decideGroundClick(
  pick: SurfacePick,
  toolMode: ToolMode,
  hasPendingAsset: boolean,
): GroundClickAction {
  if (pick.status === "empty") return { kind: "none" };

  if (pick.status === "hit") {
    if (toolMode === "spline") return { kind: "spline", point: pick.point };
    if (toolMode === "vegetation" && hasPendingAsset) return { kind: "scatter", point: pick.point };
    if (hasPendingAsset) return { kind: "place", point: pick.point };
  }

  // `miss`, ou `hit` sans rien en main. Un asset en main ⇒ on ne désélectionne
  // pas : le joueur le conserve et vise à nouveau.
  return hasPendingAsset ? { kind: "none" } : { kind: "deselect" };
}
