// ══════════════════════════════════════════════════════════════════════════════
// talents/talentEffects.ts — Agrégation des talents + économie de points
//
// `aggregateTalents(talents)` somme les effets de tous les rangs investis en un
// bonus unique (TalentBonus), appliqué au plus près de chaque usage (combat,
// effectiveStats, régén/coût mana, vitesse).
//
// Économie : 1 point tous les LEVELS_PER_TALENT_POINT niveaux. Points
// disponibles = gagnés(niveau) − dépensés. Mêmes mutations pures que
// characteristics.ts (retournent un nouveau PlayerStats).
//
// Import de PlayerStats en TYPE uniquement → pas de cycle runtime (PlayerStats
// importe aggregateTalents en valeur ; ici on n'importe que le type, effacé au
// build).
// ══════════════════════════════════════════════════════════════════════════════

import type { PlayerStats } from "../stats/PlayerStats";
import { TALENTS, getTalent, type TalentNode } from "./talentCatalog";

/** Cadence d'obtention des points. 5 = 1 point tous les 5 niveaux (10 à L50).
 *  ⚠ Tunable : mets 10 pour "1 point tous les 10 niveaux". */
export const LEVELS_PER_TALENT_POINT = 5;

export interface TalentBonus {
  damageMult: number;     // ×dégâts des sorts
  critFlat: number;       // +crit (%)
  maxHpMult: number;      // ×PV max
  defenseFlat: number;    // +défense
  maxManaMult: number;    // ×mana max
  manaCostMult: number;   // ×coût mana (≤ 1)
  manaRegenMult: number;  // ×régén mana
  moveSpeedMult: number;  // ×vitesse
}

export const NO_TALENT_BONUS: TalentBonus = {
  damageMult: 1, critFlat: 0, maxHpMult: 1, defenseFlat: 0,
  maxManaMult: 1, manaCostMult: 1, manaRegenMult: 1, moveSpeedMult: 1,
};

/** Somme les effets de tous les rangs investis. */
export function aggregateTalents(talents: Record<string, number> | undefined): TalentBonus {
  const b: TalentBonus = { ...NO_TALENT_BONUS };
  if (!talents) return b;
  let dmg = 0, hp = 0, mana = 0, costRed = 0, regen = 0, move = 0;
  for (const [id, rank] of Object.entries(talents)) {
    const node = getTalent(id);
    if (!node || !rank || rank <= 0) continue;
    const e = node.effect;
    if (e.damagePct)            dmg     += e.damagePct * rank;
    if (e.critFlat)             b.critFlat   += e.critFlat * rank;
    if (e.maxHpPct)             hp      += e.maxHpPct * rank;
    if (e.defenseFlat)          b.defenseFlat += e.defenseFlat * rank;
    if (e.maxManaPct)           mana    += e.maxManaPct * rank;
    if (e.manaCostReductionPct) costRed += e.manaCostReductionPct * rank;
    if (e.manaRegenPct)         regen   += e.manaRegenPct * rank;
    if (e.moveSpeedPct)         move    += e.moveSpeedPct * rank;
  }
  b.damageMult    = 1 + dmg;
  b.maxHpMult     = 1 + hp;
  b.maxManaMult   = 1 + mana;
  b.manaCostMult  = Math.max(0.4, 1 - costRed); // plancher : pas de gratuité totale
  b.manaRegenMult = 1 + regen;
  b.moveSpeedMult = 1 + move;
  return b;
}

// ── Économie de points ────────────────────────────────────────────────────────
export function talentPointsEarned(level: number): number {
  return Math.floor(level / LEVELS_PER_TALENT_POINT);
}
export function talentPointsSpent(talents: Record<string, number> | undefined): number {
  if (!talents) return 0;
  return Object.values(talents).reduce<number>((s, v) => s + Math.max(0, v ?? 0), 0);
}
export function talentPointsAvailable(stats: PlayerStats): number {
  return talentPointsEarned(stats.level) - talentPointsSpent(stats.talents);
}

/** Le nœud est-il déverrouillé ? (prérequis ≥ 1 rang). */
export function talentUnlocked(stats: PlayerStats, node: TalentNode): boolean {
  if (!node.requires) return true;
  return (stats.talents?.[node.requires] ?? 0) >= 1;
}

// ── Mutations pures ───────────────────────────────────────────────────────────
export function investTalent(stats: PlayerStats, id: string): PlayerStats {
  const node = getTalent(id);
  if (!node || talentPointsAvailable(stats) <= 0) return stats;
  const cur = stats.talents?.[id] ?? 0;
  if (cur >= node.maxRank || !talentUnlocked(stats, node)) return stats;
  return { ...stats, talents: { ...stats.talents, [id]: cur + 1 } };
}

export function refundTalent(stats: PlayerStats, id: string): PlayerStats {
  const cur = stats.talents?.[id] ?? 0;
  if (cur <= 0) return stats;
  const next = cur - 1;
  // Interdit de retirer le dernier rang d'un prérequis encore utilisé par un enfant.
  if (next === 0) {
    const blockedByChild = TALENTS.some(
      (t) => t.requires === id && (stats.talents?.[t.id] ?? 0) > 0,
    );
    if (blockedByChild) return stats;
  }
  return { ...stats, talents: { ...stats.talents, [id]: next } };
}

export function resetTalents(stats: PlayerStats): PlayerStats {
  return { ...stats, talents: {} };
}
