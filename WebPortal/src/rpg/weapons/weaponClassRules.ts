// weapons/weaponClassRules.ts — LOGIQUE DE CLASSE : quelles armes chaque archétype peut
// équiper, et qui peut recharger. Pur (aucun runtime Three/React) → testable.
//
// Règle métier : un archer ne prend pas d'arme à feu, un mage ne porte pas d'épée, etc.
// Seules les armes à FEU (gun) se rechargent (munitions) → les autres classes ne déclenchent
// jamais l'animation de rechargement.
import type { ArchetypeId } from "../archetypes/archetypeCatalog";
import type { WeaponType } from "./weaponClassifier";

// Familles d'armes autorisées par archétype. Modifier ici pour ajuster la logique de classe.
//   mage             → magie (bâton)
//   archer           → arc UNIQUEMENT (pas d'arme à feu)
//   guerrier         → mêlée complète (+ bouclier offhand)
//   guerrier_spatial → arme à feu (seule classe qui recharge)
//   ninja            → lames légères (dague, épée 1 main)
const ALLOWED: Record<ArchetypeId, WeaponType[]> = {
  mage:             ["staff"],
  archer:           ["bow"],
  guerrier:         ["sword_1h", "sword_2h", "dagger", "axe", "blunt", "spear", "shield"],
  guerrier_spatial: ["gun"],
  ninja:            ["dagger", "sword_1h"],
};

/** L'archétype peut-il équiper ce type d'arme ? (non-armes ammo/throwable/ignore → false) */
export function archetypeAllowsWeapon(arch: ArchetypeId, type: WeaponType): boolean {
  return ALLOWED[arch]?.includes(type) ?? false;
}

/** Seules les armes à feu se rechargent (munitions). */
export function weaponTypeCanReload(type: WeaponType): boolean {
  return type === "gun";
}

/** L'archétype possède-t-il une arme rechargeable dans sa logique de base ? */
export function archetypeCanReload(arch: ArchetypeId): boolean {
  return ALLOWED[arch]?.some(weaponTypeCanReload) ?? false;
}

/** Types d'armes autorisés pour un archétype (copie défensive). */
export function allowedWeaponsFor(arch: ArchetypeId): WeaponType[] {
  return [...(ALLOWED[arch] ?? [])];
}
