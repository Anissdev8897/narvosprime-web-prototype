// ══════════════════════════════════════════════════════════════════════════════
// weapons/weaponAnimationBinder.ts — "WeaponAnimationBinder".
//
// Relie une ARME (fichier ou type) au PACK D'ANIMATION concret (FbxAnimSpec[]) que
// le personnage doit jouer quand il l'équipe. Combine :
//   weaponClassifier (asset → type → dossier de pack) + animationPacks (specs FBX).
//
// Flux : arme équipée → weaponAnimPackForFile() → FbxAnimSpec[] → useFbxAnimationPack
//        → AnimationController (le perso joue les bonnes anims).
// ══════════════════════════════════════════════════════════════════════════════

import type { FbxAnimSpec } from "../animation/animationPacks";
import { SWORD_SHIELD_PACK, WEAPON_MELEE_PACK, ARCHER_PACK, MAGIE_PACK, SHOOTER_PACK } from "../animation/animationPacks";
import { classifyWeapon, weaponTypeMeta, type WeaponType } from "./weaponClassifier";

/** Dossier de pack (sortie du classifieur) → specs FBX concrets. */
const PACK_BY_FOLDER: Record<string, FbxAnimSpec[]> = {
  animation_sword_and_shield: SWORD_SHIELD_PACK,
  animation_meelee:           WEAPON_MELEE_PACK,
  animation_archer:           ARCHER_PACK,
  animation_magie:            MAGIE_PACK,
  animation_shooter:          SHOOTER_PACK, // gun (guerrier spatial) → pack tireur dédié
};

/** Pack d'animation d'un TYPE d'arme ([] si non équipable / pack absent). */
export function weaponAnimPackForType(type: WeaponType): FbxAnimSpec[] {
  const folder = weaponTypeMeta(type).animPackFolder;
  return folder ? (PACK_BY_FOLDER[folder] ?? []) : [];
}

/** Pack d'animation déduit du NOM DE FICHIER d'une arme. */
export function weaponAnimPackForFile(fileOrPath: string): FbxAnimSpec[] {
  return weaponAnimPackForType(classifyWeapon(fileOrPath));
}
