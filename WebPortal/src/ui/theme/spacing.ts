/**
 * ui/theme/spacing.ts — Grille d'espacement 4px NARVOS PRIME
 *
 * Basé sur --nv-space-* de tokens.css. Tous les composants
 * utilisent ces tokens pour une cohérence parfaite.
 */

import type { SpacingTokens, ShapeTokens, EffectTokens } from './types';

export const SPACING: SpacingTokens = {
  xs: '4px',   // 1×
  sm: '8px',   // 2×
  md: '16px',  // 4×
  lg: '24px',  // 6×
  xl: '32px',  // 8×
  '2xl': '48px', // 12×
};

export const SHAPE: ShapeTokens = {
  radiusSm: '3px',
  radiusMd: '4px',
  cut: '9px',
};

export const EFFECTS: EffectTokens = {
  blur: '8px',
  transition: '0.15s ease',
  glowAccent: '0 0 16px rgba(34, 211, 238, 0.4)',
};

/** Multiplie la grille de base (4px). */
export function spacing(multiplier: number): string {
  return `${multiplier * 4}px`;
}
