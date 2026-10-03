// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/WeaponDisplay.tsx — Affichage de l'arme équipée (SPECS §1.3)
//
// Position : bas-droite de l'écran
// Affiche le nom, les dégâts, les munitions et l'icône de l'arme courante.
// ══════════════════════════════════════════════════════════════════════════════

import type { Faction } from "../../../types";
import type { WeaponData } from "./hudTypes";

export interface WeaponDisplayProps {
  weapon: WeaponData;
  faction: Faction;
}

/**
 * Affichage de l'arme équipée.
 * Stub — retourne null. Implémentation visuelle complète à venir.
 */
export function WeaponDisplay(_props: WeaponDisplayProps): null {
  return null;
}
