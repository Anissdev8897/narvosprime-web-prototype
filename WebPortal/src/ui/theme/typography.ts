/**
 * ui/theme/typography.ts — Tokens typographiques NARVOS PRIME
 *
 * Polices :
 *   - Display : Chakra Petch / Rajdhani (titres, UI accents)
 *   - Body    : Inter / system-ui (corps de texte)
 *   - Mono    : JetBrains Mono / ui-monospace (code, données)
 *
 * Taille de base : 14px (--nv-text-base).
 * Grille verticale : 4px.
 */

import type { TypographyTokens } from './types';

export const TYPOGRAPHY: TypographyTokens = {
  fontDisplay: "'Chakra Petch', 'Rajdhani', system-ui, sans-serif",
  fontBody: "'Inter', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
  sizes: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '17px',
    xl: '22px',
    '2xl': '30px',
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.08em',
    wider: '0.16em',
    widest: '0.28em',
  },
};
