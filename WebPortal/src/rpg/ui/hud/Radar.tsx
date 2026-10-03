// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/Radar.tsx — Radar amélioré au sol (SPECS §2)
//
// Rayon de 5 mètres, détection entités/objets, scanline rotative, curseur
// zoom (1x/2x/4x). Rendu via Canvas 2D.
//
// NOTE : SpaceRadar (src/rpg/runtime/radar/SpaceRadar.tsx) reste utilisé
// pour le mode orbital. Ce composant est le radar de proximité au sol.
// ══════════════════════════════════════════════════════════════════════════════

import type { Faction, Vector3 } from "../../../types";
import type { RadarEntity } from "./hudTypes";

export interface RadarProps {
  playerPosition: Vector3;
  playerRotation: number;
  entities?: RadarEntity[];
  playerFaction: Faction;
  /** Réputation optionnelle pour la coloration des entités. */
  playerReputation?: Record<string, number>;
}

/**
 * Radar de proximité (5 mètres) avec détection d'entités, scanline et zoom.
 * Stub — retourne null. L'implémentation Canvas 2D complète est à venir.
 */
export function Radar(_props: RadarProps): null {
  return null;
}
