// ══════════════════════════════════════════════════════════════════════════════
// skills/skillGenerator.ts — Génère les 100+ compétences (10 classes × 10 archétypes)
//
// Combine : ClassDef (élément, attackPower) × ArchetypeTemplate (mult, cooldown)
// → SkillDef thématisé. La VFX key = `${element}_${archetype}` pointe vers le
//   système de particules/shaders (vfx/).
// ══════════════════════════════════════════════════════════════════════════════

import type { ClassDef, ClassId, SkillDef } from "../types";
import { CLASSES, CLASS_IDS } from "../classes/classes";
import { ELEMENTS } from "../elements/elements";
import { ARCHETYPES, ARCHETYPE_IDS } from "./archetypes";

/**
 * Génère les 10 sorts d'une classe (un par archétype).
 */
export function generateSkillsForClass(classId: ClassId): SkillDef[] {
  const cls: ClassDef = CLASSES[classId];
  const element = ELEMENTS[cls.element];

  return ARCHETYPE_IDS.map((archId) => {
    const arch = ARCHETYPES[archId];
    // Nom thématisé : "Feu" + "Trait" → "Trait de Feu"
    const label =
      arch.archetype === "ultimate"
        ? `${arch.nameSuffix} ${element.label}` // "Apocalypse Feu"
        : `${arch.nameSuffix} de ${element.label}`; // "Trait de Feu"

    const skill: SkillDef = {
      id: `${classId}_${archId}`,
      classId,
      archetype: archId,
      element: cls.element,
      label,
      damage: Math.round(cls.baseStats.attackPower * arch.damageMult),
      heal: Math.round(arch.healMult * 10),
      manaCost: arch.manaCost,
      cooldown: arch.cooldown,
      animation: arch.animation,
      vfx: `${cls.element}_${archId}`, // ex: "fire_projectile"
      description: arch.descTemplate.replace("{element}", element.label.toLowerCase()),
    };
    return skill;
  });
}

/**
 * Catalogue complet : toutes les classes × tous les archétypes.
 * Calculé une fois (lazy) et mis en cache.
 */
let _allSkillsCache: SkillDef[] | null = null;

export function getAllSkills(): SkillDef[] {
  if (_allSkillsCache) return _allSkillsCache;
  const all: SkillDef[] = [];
  for (const classId of CLASS_IDS) {
    all.push(...generateSkillsForClass(classId));
  }
  _allSkillsCache = all;
  return all;
}

/**
 * Récupère un sort précis par son id (`classId_archetype`).
 */
export function getSkill(skillId: string): SkillDef | undefined {
  return getAllSkills().find((s) => s.id === skillId);
}

/**
 * Stats globales du catalogue (pour debug / rapport).
 */
export function getSkillCatalogStats(): { total: number; perClass: number; classes: number } {
  return {
    total: getAllSkills().length,
    perClass: ARCHETYPE_IDS.length,
    classes: CLASS_IDS.length,
  };
}
