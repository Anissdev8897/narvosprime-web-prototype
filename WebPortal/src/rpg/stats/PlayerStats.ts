// Port de StatsComponent.gd (Godot) → TypeScript
// Statistiques joueur avec calculs de dégâts / soins

import type { ClassId } from "../types";
import { CLASSES } from "../classes/classes";
import { equippedBonuses } from "../loot/gear";
import type { GearSlotKey } from "../loot/gear";
import type { LootItem } from "../loot/LootRegistry";
import { pointsForLevel, spentPoints, type ElementInvest } from "./characteristics";
import { aggregateTalents } from "../talents/talentEffects";

export const MAX_LEVEL = 50;

export interface PlayerStats {
  classId: ClassId;
  level: number;
  /** XP accumulé DANS le niveau courant (0 → xpForLevel(level)). */
  xp: number;
  maxHp: number;
  currentHp: number;
  maxShield: number;
  currentShield: number;
  maxStamina: number;
  currentStamina: number;
  maxMana: number;
  currentMana: number;
  /** Points d'action (PA) — réservé pour futur système tour-par-tour */
  pa: number;
  /** Points de mouvement (PM) */
  pm: number;
  /** Puissance magique / physique */
  puissance: number;
  defense: number;
  initiative: number;
  /** Taux de critique 0–100 (%) */
  critique: number;
  /** Réduction de cooldown des ultimes 0..0.8 (fournie par l'équipement : stat `cdr`). */
  cdReduction?: number;
  /** Points de caractéristiques disponibles (à investir dans les éléments). */
  charPoints: number;
  /** Points investis par élément (build). */
  elements: ElementInvest;
  /** Rangs investis par nœud de talent (id → rang). Cf talents/. */
  talents: Record<string, number>;
}

export function createStats(classId: ClassId, level = 1): PlayerStats {
  const cls = CLASSES[classId];
  const b = cls.baseStats;
  const lvlBonus = (level - 1) * 0.08; // +8% par niveau
  const hp = Math.round(b.hp * (1 + lvlBonus));
  const shield = Math.round(hp * 0.6);
  return {
    classId,
    level,
    xp: 0,
    maxHp: hp,
    currentHp: hp,
    maxShield: shield,
    currentShield: shield,
    maxStamina: 100,
    currentStamina: 100,
    maxMana:    Math.round(b.mana    * (1 + lvlBonus)),
    currentMana:Math.round(b.mana    * (1 + lvlBonus)),
    pa: 6,
    pm: 3,
    puissance:  Math.round(b.attackPower * (1 + lvlBonus)),
    defense:    Math.round(b.defense * (1 + lvlBonus)),
    initiative: 10 + level * 2,
    critique:   Math.round(b.critChance * 100),
    charPoints: pointsForLevel(level),
    elements: {},
    talents: {},
  };
}

export function applyDamage(stats: PlayerStats, raw: number): PlayerStats {
  const mitigated = Math.max(1, raw * (1 - stats.defense / (stats.defense + 80)));
  const shieldAbsorb = Math.min(stats.currentShield, mitigated);
  const hpDmg = mitigated - shieldAbsorb;
  return {
    ...stats,
    currentShield: stats.currentShield - shieldAbsorb,
    currentHp: Math.max(0, stats.currentHp - hpDmg),
  };
}

export function applyHeal(stats: PlayerStats, amount: number): PlayerStats {
  return { ...stats, currentHp: Math.min(stats.maxHp, stats.currentHp + amount) };
}

export function spendMana(stats: PlayerStats, cost: number): PlayerStats | null {
  if (stats.currentMana < cost) return null;
  return { ...stats, currentMana: stats.currentMana - cost };
}

export function regenMana(stats: PlayerStats, amount: number): PlayerStats {
  return { ...stats, currentMana: Math.min(stats.maxMana, stats.currentMana + amount) };
}

export function drainStamina(stats: PlayerStats, cost: number): PlayerStats | null {
  if (stats.currentStamina < cost) return null;
  return { ...stats, currentStamina: stats.currentStamina - cost };
}

/**
 * Régénération PV + Mana sur dt secondes.
 *   • en combat   : +1 PV/s, +1 Mana/s (lente)
 *   • hors combat : +6 % PVmax/s, +10 % Manamax/s (rapide)
 * Ne dépasse jamais le max ; aucun effet si mort (currentHp ≤ 0).
 * IMPORTANT : pure → à utiliser avec un updater fonctionnel setStats(s => regenTick(s,…))
 * pour ne JAMAIS écraser les dégâts/coûts (corrige le bug "PV/mana ne descendent pas").
 */
export function regenTick(
  stats: PlayerStats, dt: number, inCombat: boolean,
  maxHpOverride?: number, maxManaOverride?: number,
  manaRegenMult = 1,
): PlayerStats {
  if (stats.currentHp <= 0) return stats;
  const maxHp     = maxHpOverride   ?? stats.maxHp;
  const maxMana   = maxManaOverride ?? stats.maxMana;
  const maxShield = stats.maxShield;
  const hpRate      = inCombat ? 1 : maxHp * 0.06;
  const mpRate      = (inCombat ? 1 : maxMana * 0.10) * manaRegenMult;
  const shieldRate  = inCombat ? 0 : maxShield * 0.15;
  const staminaRate = inCombat ? 8 : 20;
  const currentHp      = Math.min(maxHp,              stats.currentHp      + hpRate * dt);
  const currentMana    = Math.min(maxMana,             stats.currentMana    + mpRate * dt);
  const currentShield  = Math.min(maxShield,           stats.currentShield  + shieldRate * dt);
  const currentStamina = Math.min(stats.maxStamina,    stats.currentStamina + staminaRate * dt);
  if (currentHp === stats.currentHp && currentMana === stats.currentMana
      && currentShield === stats.currentShield && currentStamina === stats.currentStamina) return stats;
  return { ...stats, currentHp, currentMana, currentShield, currentStamina };
}

/**
 * Stats EFFECTIVES = base + bonus de l'équipement porté.
 * Les valeurs courantes (currentHp/currentMana) sont conservées (clampées au
 * nouveau max). À recalculer (useMemo) quand `base` ou l'équipement change.
 */
export function effectiveStats(
  base: PlayerStats,
  equipped: Partial<Record<GearSlotKey, LootItem>>,
): PlayerStats {
  const b = equippedBonuses(equipped);
  // Bonus de talents (lus depuis base.talents) — appliqués APRÈS l'équipement :
  // %PV/%mana multiplient le total (base+équip), défense/crit s'ajoutent à plat.
  const t = aggregateTalents(base.talents);
  const maxHp     = Math.round((base.maxHp   + (b.maxHp   ?? 0)) * t.maxHpMult);
  const maxMana   = Math.round((base.maxMana + (b.maxMana ?? 0)) * t.maxManaMult);
  const maxShield = Math.round(maxHp * 0.6 + (b.maxShield ?? 0));
  return {
    ...base,
    maxHp,
    maxMana,
    maxShield,
    currentHp:      Math.min(base.currentHp,      maxHp),
    currentMana:    Math.min(base.currentMana,     maxMana),
    currentShield:  Math.min(base.currentShield,   maxShield),
    puissance: base.puissance + (b.puissance ?? 0),
    defense:   base.defense   + (b.defense   ?? 0) + t.defenseFlat,
    critique:  base.critique  + (b.critique  ?? 0) + t.critFlat,
    // Réduction de cooldown : la stat d'objet `cdr` est en POINTS (%) → fraction 0..0.8.
    cdReduction: Math.max(0, Math.min(0.8, (b.cdr ?? 0) / 100)),
  };
}

export function isCrit(stats: PlayerStats): boolean {
  return Math.random() * 100 < stats.critique;
}

// ── Expérience & montée de niveau (1 → 50) ────────────────────────────────────

/** XP requis pour passer DU niveau `level` au suivant. Courbe douce. */
export function xpForLevel(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(80 * Math.pow(level, 1.5));
}

/**
 * Ajoute de l'XP et gère les montées de niveau en cascade (cap à MAX_LEVEL).
 * À chaque palier : recalcule les stats max (createStats applique +8 %/niveau)
 * et soigne entièrement le joueur (récompense de level-up). L'XP restant reporte.
 */
export function addXp(stats: PlayerStats, amount: number): PlayerStats {
  if (stats.level >= MAX_LEVEL) return stats;
  let xp = stats.xp + Math.max(0, amount);
  let level = stats.level;
  while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  if (level === stats.level) return { ...stats, xp };
  const leveled = createStats(stats.classId, level);
  // Préserve le build élémentaire ET les talents ; les nouveaux points de niveau
  // (caractéristiques + talents) sont recalculés à partir du niveau atteint.
  return {
    ...leveled,
    xp: level >= MAX_LEVEL ? 0 : xp,
    elements: stats.elements,
    charPoints: pointsForLevel(level) - spentPoints(stats.elements),
    talents: stats.talents,
  };
}
