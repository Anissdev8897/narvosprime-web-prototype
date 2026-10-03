// Port de SpellResource.gd (Godot) → TypeScript
// Sorts liés aux classes via spellCatalog.ts

import type { ClassId, ElementId, SkillArchetype } from "../types";

export type DamageType = "direct" | "dot" | "aoe" | "heal" | "shield";

export interface SpellDef {
  id: string;
  classId: ClassId;
  element: ElementId;
  archetype: SkillArchetype;
  label: string;
  description: string;
  damage: number;
  heal: number;
  manaCost: number;
  cooldown: number;      // secondes
  speed: number;         // vitesse du projectile (0 = instant)
  range: number;         // portée en unités Three.js
  aoeRadius: number;     // 0 = pas d'AoE
  /** Template de chemin des frames VFX (sous /models/spells/) — "#" = n° de frame */
  vfxPath: string;
  /** Nombre de frames à tenter de charger (les manquantes sont ignorées) */
  vfxFrames: number;
  hotkey: string;        // "1"–"8"
  /**
   * Sort CIBLÉ "point & click" : au lancer, on verrouille l'ennemi le plus
   * proche dans `range` (portée courte ~5 m) et le projectile VOYAGE jusqu'à lui
   * (suit sa position live) avant d'appliquer les dégâts à l'impact. Si false/
   * absent → sort directionnel/instantané classique.
   */
  homing?: boolean;
}

/** Résultat d'un jet de sort */
export interface SpellCastResult {
  spellId: string;
  damage: number;
  heal: number;
  isCrit: boolean;
}

export function calcDamage(spell: SpellDef, puissance: number, isCrit: boolean): number {
  const base = spell.damage * (1 + puissance / 100);
  return isCrit ? base * 1.5 : base;
}
