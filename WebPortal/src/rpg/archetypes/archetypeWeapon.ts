// archetypes/archetypeWeapon.ts — archétype → arme représentative (profil du registre).
// Le joueur équipe cette arme (modèle FBX attaché + identité visuelle de la classe).
import type { ArchetypeId } from "./archetypeCatalog";

const ARCHETYPE_WEAPON: Record<ArchetypeId, string> = {
  mage:             "arch_staff",
  archer:           "arch_bow",
  guerrier:         "arch_sword",
  guerrier_spatial: "arch_gun",
  ninja:            "arch_dagger",
};

/** id de profil d'arme pour un archétype (undefined si aucun archétype). */
export function weaponForArchetype(id: ArchetypeId | null): string | undefined {
  return id ? ARCHETYPE_WEAPON[id] : undefined;
}
