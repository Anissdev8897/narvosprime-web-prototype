/**
 * ui/theme/palette.ts — Palettes de couleurs par faction NARVOS PRIME
 *
 * 4 factions jouables :
 *   - Humain  : bleu (héritage Akar'lys)
 *   - Wraith  : violet Spectral
 *   - Murdock : rouge/orange, mercenaires
 *   - Meshy   : vert/teal, tech biologique
 *
 * Référence les CSS custom properties --nv-* de tokens.css quand disponibles.
 */

import type { Faction, FactionPalette, SemanticPalette, RarityPalette, SurfacePalette, BorderPalette } from './types';

/* ── Faction palettes ─────────────────────────────────────────────────────── */

export const FACTION_PALETTES: Record<Faction, FactionPalette> = {
  humain: {
    id: 'humain',
    label: "Akar'lys",
    accent: '#0ea5e9',
    accentBright: '#38bdf8',
    accentDim: 'rgba(14, 165, 233, 0.35)',
    accentFaint: 'rgba(14, 165, 233, 0.12)',
    secondary: '#0284c7',
    text: '#e8ecf6',
    textDim: '#8b97b0',
    textFaint: '#48586b',
  },
  wraith: {
    id: 'wraith',
    label: 'Wraith',
    accent: '#a855f7',
    accentBright: '#c084fc',
    accentDim: 'rgba(168, 85, 247, 0.35)',
    accentFaint: 'rgba(168, 85, 247, 0.12)',
    secondary: '#7c3aed',
    text: '#ede9fe',
    textDim: '#a5b4fc',
    textFaint: '#6b7280',
  },
  murdock: {
    id: 'murdock',
    label: 'Murdock',
    accent: '#f97316',
    accentBright: '#fb923c',
    accentDim: 'rgba(249, 115, 22, 0.35)',
    accentFaint: 'rgba(249, 115, 22, 0.12)',
    secondary: '#ea580c',
    text: '#fff7ed',
    textDim: '#fdba74',
    textFaint: '#9a8c7a',
  },
  meshy: {
    id: 'meshy',
    label: 'Meshy',
    accent: '#22c55e',
    accentBright: '#4ade80',
    accentDim: 'rgba(34, 197, 94, 0.35)',
    accentFaint: 'rgba(34, 197, 94, 0.12)',
    secondary: '#16a34a',
    text: '#f0fdf4',
    textDim: '#86efac',
    textFaint: '#6b8f7a',
  },
};

/* ── Palette sémantique ───────────────────────────────────────────────────── */

export const SEMANTIC: SemanticPalette = {
  danger: '#ff6b6b',
  dangerBg: 'rgba(255, 107, 107, 0.15)',
  ok: '#7dffa6',
  warn: '#ffce6b',
  gold: '#d9b25a',
  hp: '#4ade80',
  hpLow: '#ef4444',
  shield: '#38bdf8',
  stamina: '#facc15',
  mana: '#818cf8',
  xp: '#a78bfa',
};

/* ── Palette de rareté ────────────────────────────────────────────────────── */

export const RARITY: RarityPalette = {
  common: '#9ca3af',
  uncommon: '#4ade80',
  rare: '#38bdf8',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

export const SURFACE: SurfacePalette = {
  bg: '#02030a',
  panel: 'rgba(6, 10, 18, 0.72)',
  panelSolid: 'rgba(5, 8, 15, 0.96)',
  deep: 'rgba(4, 6, 12, 0.92)',
  hover: 'rgba(255, 255, 255, 0.06)',
  active: 'rgba(255, 255, 255, 0.10)',
};

/* ── Bordures ─────────────────────────────────────────────────────────────── */

export const BORDER: BorderPalette = {
  default: 'rgba(34, 211, 238, 0.35)',
  dim: 'rgba(255, 255, 255, 0.08)',
  focus: 'rgba(34, 211, 238, 0.7)',
};

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

/** Retourne la palette d'une faction. Fallback → humain. */
export function getFactionPalette(faction?: Faction): FactionPalette {
  return faction ? FACTION_PALETTES[faction] : FACTION_PALETTES.humain;
}
