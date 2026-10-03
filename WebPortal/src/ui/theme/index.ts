/**
 * ui/theme/index.ts — Point d'entrée du système de theming
 *
 * Réexporte tous les tokens, le ThemeProvider, les hooks,
 * et les helpers utiles.
 */

export { ThemeProvider, useTheme, useFaction, useFactions } from './ThemeProvider';
export { FACTION_PALETTES, SEMANTIC, RARITY, SURFACE, BORDER, getFactionPalette } from './palette';
export { TYPOGRAPHY } from './typography';
export { SPACING, SHAPE, EFFECTS, spacing } from './spacing';

export type {
  NarvosTheme,
  Faction,
  FactionPalette,
  SemanticPalette,
  RarityPalette,
  SurfacePalette,
  BorderPalette,
  TypographyTokens,
  SpacingTokens,
  ShapeTokens,
  EffectTokens,
} from './types';
