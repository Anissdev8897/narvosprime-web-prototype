// ══════════════════════════════════════════════════════════════════════════════
// classes/classes.ts — Registre des 4 classes guerrier futuristes
//
// Chaque classe = élément + rôle + arme + identité visuelle (couleur PBR/emissive)
// + stats de base. Les sorts sont définis dans spells/spellCatalog.ts.
// ══════════════════════════════════════════════════════════════════════════════

import type { ClassDef, ClassId } from "../types";

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior_bruiser: {
    id: "warrior_bruiser",
    label: "Guerrier Bruiser",
    element: "electric",
    role: "dps",
    weaponKey: "claymore",
    outfitColor: "#1565c0",
    outfitEmissive: "#42a5f5",
    baseStats: { hp: 130, mana: 80, defense: 14, attackPower: 26, critChance: 0.14, moveSpeed: 1.05 },
    description: "Combattant au corps-à-corps brutal. Frappe lourde, impacts électriques dévastateurs.",
  },
  warrior_dps: {
    id: "warrior_dps",
    label: "Guerrier DPS",
    element: "fire",
    role: "dps",
    weaponKey: "gun_rifle",
    outfitColor: "#b71c1c",
    outfitEmissive: "#ff5722",
    baseStats: { hp: 100, mana: 90, defense: 10, attackPower: 30, critChance: 0.18, moveSpeed: 1.1 },
    description: "Tireur d'élite. Dégâts incendiaires à distance, burst critique maximal.",
  },
  warrior_tank: {
    id: "warrior_tank",
    label: "Guerrier Tank",
    element: "earth",
    role: "tank",
    weaponKey: "sword_shield",
    outfitColor: "#33691e",
    outfitEmissive: "#aed581",
    baseStats: { hp: 200, mana: 60, defense: 28, attackPower: 14, critChance: 0.06, moveSpeed: 0.9 },
    description: "Forteresse vivante. Encaisse, protège l'escouade et immobilise les ennemis.",
  },
  warrior_heal: {
    id: "warrior_heal",
    label: "Guerrier Heal",
    element: "light",
    role: "support",
    weaponKey: "gun_pistol",
    outfitColor: "#f9a825",
    outfitEmissive: "#ffffff",
    baseStats: { hp: 120, mana: 140, defense: 12, attackPower: 16, critChance: 0.09, moveSpeed: 1.0 },
    description: "Médic de combat. Soigne, purifie et maintient l'équipe en vie sous le feu.",
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export function getClass(id: ClassId): ClassDef {
  return CLASSES[id];
}
