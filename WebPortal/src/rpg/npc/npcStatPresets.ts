// npc/npcStatPresets.ts — presets PURS de difficulté / boss (multiplicateurs de stats)
export type Difficulty = "facile" | "difficile" | "expert";

export const DIFFICULTY_PRESETS: Record<Difficulty, { scaleMult: number; hpMult: number; resistMult: number }> = {
  facile:    { scaleMult: 0.95, hpMult: 0.7, resistMult: 0.0 },
  difficile: { scaleMult: 1.0,  hpMult: 1.6, resistMult: 0.15 },
  expert:    { scaleMult: 1.05, hpMult: 2.8, resistMult: 0.30 },
};

export const BOSS_STATS = { scaleMult: 1.8, hpMult: 4.0, resistMult: 0.2 };
export const MOB_STATS  = { scaleMult: 1.0, hpMult: 1.0, resistMult: 0.0 };

/** Résistance bornée 0..0.9 (un PNJ ne peut pas être invincible). */
export function clampResist(r: number): number { return Math.max(0, Math.min(0.9, r)); }
