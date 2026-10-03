// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/StatusIndicators.tsx — Indicateurs de statut du joueur (SPECS §1.3)
//
// Position : haut de l'écran
// Affiche les effets de statut, le nom de la planète, l'état de combat, etc.
// ══════════════════════════════════════════════════════════════════════════════

import type { Faction } from "../../../types";
import type { PlayerStatus } from "./hudTypes";

export interface StatusIndicatorsProps {
  playerStatus: PlayerStatus | null;
  planetId: string | null;
  faction: Faction;
}

/**
 * Indicateurs de statut (zone, effets, combat).
 * Stub — retourne null. Implémentation visuelle complète à venir.
 */
export function StatusIndicators(_props: StatusIndicatorsProps): null {
  return null;
}
