// ══════════════════════════════════════════════════════════════════════════════
// npc/monsterAnimationAssignment.ts — "MonsterAnimationAssignmentSystem".
//
// Résout le pack d'animation FBX d'un monstre, en respectant DEUX règles du brief :
//   • un monstre avec anim PROPRE (ownAnims, ex: aquarys_crab) → JAMAIS modifié.
//   • un monstre marqué animPack (ex: "creature_melee") → utilise ce pack.
//   • sinon → défaut (anims biped partagées) = comportement actuel, zéro changement.
//
// Sûr par construction : aucun monstre n'a animPack par défaut → rien ne change tant
// que le designer n'assigne pas explicitement un pack dans le catalogue.
// ══════════════════════════════════════════════════════════════════════════════

import type { NpcDef } from "./npcCatalog";
import { CREATURE_MELEE_PACK, SHOOTER_PACK, type FbxAnimSpec } from "../animation/animationPacks";

/** Registre id → pack FBX (extensible : creature_ranged, creature_flying…). */
export const MONSTER_ANIM_PACKS: Record<string, FbxAnimSpec[]> = {
  creature_melee: CREATURE_MELEE_PACK,
  shooter: SHOOTER_PACK,        // guerrier futuriste à arme à feu (Tosus)
};

/**
 * Pack d'anim d'un monstre, ou null pour garder le défaut.
 *   null = anims embarquées (si ownAnims) OU anims biped partagées (sinon).
 */
export function resolveMonsterAnimPack(def: NpcDef): FbxAnimSpec[] | null {
  if (def.ownAnims) return null;                 // anim spécifique → ne pas toucher
  if (!def.animPack) return null;                // pas d'override → défaut partagé
  const pack = MONSTER_ANIM_PACKS[def.animPack];
  // Pack VIDE (assets GLB pas encore sur disque) = pack désactivé → défaut
  // partagé, sinon le monstre perdrait toute locomotion.
  return pack && pack.length > 0 ? pack : null;
}

/** true si le monstre doit jouer un pack FBX dédié (≠ défaut). */
export function hasCustomMonsterPack(def: NpcDef): boolean {
  return resolveMonsterAnimPack(def) !== null;
}
