// pets/petSummons.ts — Catalogue des INVOCATIONS DE COMBAT (pets agressifs).
//
// Animaux prédateurs invoqués par une « pierre d'invocation » (consommable). Ils
// combattent aux côtés du joueur : cherchent l'ennemi le plus proche, le poursuivent
// et le frappent, puis suivent le joueur en l'absence de cible. Temporaires (lifetime).
//
// Réutilise npcRegistry (cibles) + AnimationController (idle/run/attack). Allié, donc
// PAS enregistré comme PNJ hostile.

export interface PetSummonDef {
  id: string;
  label: string;
  path: string;          // GLB (anims propres)
  targetSize: number;    // hauteur cible (m) — normalisation bbox
  damage: number;        // dégâts par coup
  attackCooldown: number;// s entre deux coups
  attackRange: number;   // portée de mêlée (m)
  aggroRange: number;    // rayon de détection des ennemis (m)
  moveSpeed: number;     // m/s
  lifetime: number;      // s avant disparition
}

export const PET_SUMMONS: Record<string, PetSummonDef> = {
  lion: {
    id: "lion", label: "Lion", path: "/models/pnj_monstre/lion/PSX_lion.glb",
    targetSize: 1.4, damage: 26, attackCooldown: 1.4, attackRange: 2.2,
    aggroRange: 16, moveSpeed: 4.8, lifetime: 45,
  },
  loup: {
    id: "loup", label: "Loup", path: "/models/pet/dog.glb",
    targetSize: 0.85, damage: 15, attackCooldown: 1.0, attackRange: 1.8,
    aggroRange: 14, moveSpeed: 5.6, lifetime: 45,
  },
};

export function getPetSummon(id: string): PetSummonDef | undefined {
  return PET_SUMMONS[id];
}

// ── Compagnons permanents (pas de lifetime, ont des PV, gagnent de l'XP) ──

export interface CompanionDef {
  id: string;
  label: string;
  icon: string;
  path: string;
  targetSize: number;
  baseHp: number;
  hpPerLevel: number;
  baseDamage: number;
  damagePerLevel: number;
  attackCooldown: number;
  attackRange: number;
  aggroRange: number;
  moveSpeed: number;
  respawnCooldown: number;
}

export const COMPANIONS: Record<string, CompanionDef> = {
  loup: {
    id: "loup", label: "Loup", icon: "🐺",
    path: "/models/pet/dog.glb", targetSize: 0.85,
    baseHp: 80, hpPerLevel: 12,
    baseDamage: 8, damagePerLevel: 2,
    attackCooldown: 1.2, attackRange: 1.8, aggroRange: 14, moveSpeed: 5.6,
    respawnCooldown: 30,
  },
  lion: {
    id: "lion", label: "Lion", icon: "🦁",
    path: "/models/pnj_monstre/lion/PSX_lion.glb", targetSize: 1.4,
    baseHp: 120, hpPerLevel: 18,
    baseDamage: 12, damagePerLevel: 3,
    attackCooldown: 1.6, attackRange: 2.2, aggroRange: 16, moveSpeed: 4.8,
    respawnCooldown: 45,
  },
  chat: {
    id: "chat", label: "Chat", icon: "🐱",
    path: "/models/pet/cat.glb", targetSize: 0.4,
    baseHp: 50, hpPerLevel: 8,
    baseDamage: 5, damagePerLevel: 1.5,
    attackCooldown: 0.8, attackRange: 1.2, aggroRange: 10, moveSpeed: 6.0,
    respawnCooldown: 20,
  },
};

export function getCompanion(id: string): CompanionDef | undefined {
  return COMPANIONS[id];
}

export function companionHp(def: CompanionDef, level: number): number {
  return Math.round(def.baseHp + def.hpPerLevel * (level - 1));
}

export function companionDamage(def: CompanionDef, level: number): number {
  return Math.round(def.baseDamage + def.damagePerLevel * (level - 1));
}
