// ══════════════════════════════════════════════════════════════════════════════
// elements/elements.ts — Registre des 10 éléments magiques
//
// Chaque élément définit : couleurs (UI/albedo/emissive/particules), effet de
// statut, et le triangle de force/faiblesse (rock-paper-scissors élémentaire).
// ══════════════════════════════════════════════════════════════════════════════

import type { ElementDef, ElementId } from "../types";

export const ELEMENTS: Record<ElementId, ElementDef> = {
  fire: {
    id: "fire",
    label: "Feu",
    color: "#ff5722",
    emissive: "#ff8a00",
    particleColor: "#ffb347",
    statusEffect: "burn",        // DoT 5s
    strongVs: ["ice", "poison", "earth"],
    weakVs: ["water"],
    description: "Brûlure progressive + explosions AoE. Dégâts soutenus.",
  },
  water: {
    id: "water",
    label: "Eau",
    color: "#2196f3",
    emissive: "#42a5f5",
    particleColor: "#80d8ff",
    statusEffect: "soak",        // augmente dégâts électriques reçus
    strongVs: ["fire", "earth"],
    weakVs: ["electric", "ice"],
    description: "Soin allié + dégâts modérés. Mouille les ennemis (combo électrique).",
  },
  ice: {
    id: "ice",
    label: "Glace",
    color: "#80deea",
    emissive: "#b3e5fc",
    particleColor: "#e1f5fe",
    statusEffect: "freeze",      // ralentit puis gèle
    strongVs: ["water", "wind"],
    weakVs: ["fire"],
    description: "Ralentissement -30% puis gel total. Contrôle défensif.",
  },
  electric: {
    id: "electric",
    label: "Électrique",
    color: "#ffeb3b",
    emissive: "#fff176",
    particleColor: "#ffff8d",
    statusEffect: "shock",       // chaîne entre cibles
    strongVs: ["water", "wind"],
    weakVs: ["earth"],
    description: "Chaînes électriques entre 3 cibles. Burst rapide.",
  },
  poison: {
    id: "poison",
    label: "Poison",
    color: "#8bc34a",
    emissive: "#aed581",
    particleColor: "#ccff90",
    statusEffect: "toxic",       // DoT 8s croissant
    strongVs: ["earth", "light"],
    weakVs: ["void"],
    description: "Dégâts progressifs sur 8s. Contamination biologique alien.",
  },
  earth: {
    id: "earth",
    label: "Terre",
    color: "#8d6e63",
    emissive: "#a1887f",
    particleColor: "#bcaaa4",
    statusEffect: "root",        // immobilise
    strongVs: ["electric", "poison"],
    weakVs: ["fire", "water", "wind"],
    description: "Immobilisation + dégâts soutenus. Tank défensif.",
  },
  wind: {
    id: "wind",
    label: "Vent",
    color: "#b2dfdb",
    emissive: "#80cbc4",
    particleColor: "#e0f2f1",
    statusEffect: "knockback",   // repousse
    strongVs: ["earth", "poison"],
    weakVs: ["ice", "electric"],
    description: "Repousse + mobilité. Disperse les nuages toxiques.",
  },
  light: {
    id: "light",
    label: "Lumière",
    color: "#fff9c4",
    emissive: "#ffffff",
    particleColor: "#fffde7",
    statusEffect: "purify",      // dispel + soin
    strongVs: ["dark", "void"],
    weakVs: ["poison"],
    description: "Soin + dispel des debuffs. Fort contre l'ombre.",
  },
  dark: {
    id: "dark",
    label: "Ombre",
    color: "#6a1b9a",
    emissive: "#9c27b0",
    particleColor: "#ce93d8",
    statusEffect: "curse",       // réduit soins reçus
    strongVs: ["light"],
    weakVs: ["light", "void"],
    description: "Drain de vie + malédiction. Réduit les soins ennemis.",
  },
  void: {
    id: "void",
    label: "Vide",
    color: "#311b92",
    emissive: "#7c4dff",
    particleColor: "#b388ff",
    statusEffect: "rift",        // ignore une partie de la défense
    strongVs: ["dark", "poison"],
    weakVs: ["light"],
    description: "Distorsion d'espace + perce-armure. Téléportation.",
  },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS) as ElementId[];

export function getElement(id: ElementId): ElementDef {
  return ELEMENTS[id];
}

/**
 * Multiplicateur de dégâts élémentaires (triangle force/faiblesse).
 * 1.5 si attacker est fort vs defender, 0.5 si faible, 1.0 sinon.
 */
export function elementMultiplier(attacker: ElementId, defender: ElementId): number {
  const a = ELEMENTS[attacker];
  if (a.strongVs.includes(defender)) return 1.5;
  if (a.weakVs.includes(defender)) return 0.5;
  return 1.0;
}
