// ══════════════════════════════════════════════════════════════════════════════
// stats/characteristics.ts — Caractéristiques élémentaires (build du joueur)
//
// Le joueur gagne des points à chaque niveau et les investit dans 8 éléments.
// Chaque point investi dans un élément :
//   • +DMG_PER_POINT de dégâts des sorts DE cet élément,
//   • +RES_PER_POINT de résistance AUX dégâts de cet élément (capé à MAX_RESIST).
//
// Module PUR (types only) → aucun cycle d'import runtime avec PlayerStats.
// ══════════════════════════════════════════════════════════════════════════════

import type { ElementId } from "../types";
import type { PlayerStats } from "./PlayerStats";

/** Les 8 éléments investissables (demande utilisateur). */
export const CHAR_ELEMENTS: ElementId[] = [
  "fire", "water", "ice", "electric", "poison", "earth", "light", "dark",
];

export type ElementInvest = Partial<Record<ElementId, number>>;

// ── Réglages d'équilibrage (ajustables) ───────────────────────────────────────
export const STARTING_POINTS  = 5;
export const POINTS_PER_LEVEL = 3;
const DMG_PER_POINT = 0.02;  // +2 % dégâts / point
const RES_PER_POINT = 0.015; // +1.5 % résistance / point
const MAX_RESIST    = 0.75;  // plafond de résistance (75 %)

/** Total de points GAGNÉS à ce niveau (dépensés + disponibles). */
export function pointsForLevel(level: number): number {
  return STARTING_POINTS + Math.max(0, level - 1) * POINTS_PER_LEVEL;
}

export function spentPoints(elements: ElementInvest): number {
  return Object.values(elements).reduce<number>((s, v) => s + (v ?? 0), 0);
}

/** Multiplicateur de DÉGÂTS pour un sort de l'élément `el`. */
export function elementDamageMult(elements: ElementInvest, el: ElementId): number {
  return 1 + (elements[el] ?? 0) * DMG_PER_POINT;
}

/** Multiplicateur de DÉGÂTS REÇUS de l'élément `el` (résistance). */
export function elementResistMult(elements: ElementInvest, el: ElementId): number {
  return 1 - Math.min(MAX_RESIST, (elements[el] ?? 0) * RES_PER_POINT);
}

/** Libellés des bonus pour un nombre de points donné (UI). */
export function elementBonusLabels(points: number): { dmg: string; res: string } {
  const res = Math.min(MAX_RESIST, points * RES_PER_POINT);
  return {
    dmg: `+${Math.round(points * DMG_PER_POINT * 100)}% dégâts`,
    res: `+${Math.round(res * 100)}% résist.`,
  };
}

// ── Mutations (retournent un nouveau PlayerStats) ─────────────────────────────
export function investPoint(stats: PlayerStats, el: ElementId): PlayerStats {
  if (stats.charPoints <= 0) return stats;
  return {
    ...stats,
    elements: { ...stats.elements, [el]: (stats.elements[el] ?? 0) + 1 },
    charPoints: stats.charPoints - 1,
  };
}

export function refundPoint(stats: PlayerStats, el: ElementId): PlayerStats {
  const cur = stats.elements[el] ?? 0;
  if (cur <= 0) return stats;
  return {
    ...stats,
    elements: { ...stats.elements, [el]: cur - 1 },
    charPoints: stats.charPoints + 1,
  };
}

export function resetElements(stats: PlayerStats): PlayerStats {
  return { ...stats, elements: {}, charPoints: stats.charPoints + spentPoints(stats.elements) };
}
