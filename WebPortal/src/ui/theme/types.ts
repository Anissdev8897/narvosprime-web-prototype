/**
 * ui/theme/types.ts — Types du système de theming NARVOS PRIME
 *
 * Système unifié pour tous les UI (HUD, Forge, Panneaux).
 * Migration progressive : chaque composant peut consommer le theme
 * sans réécrire tout son CSS.
 */

/** Factions jouables (palettes de thème UI). */
export type Faction = 'humain' | 'wraith' | 'murdock' | 'meshy';

/** Palette complète d'une faction. */
export interface FactionPalette {
  id: Faction;
  label: string;
  /** Couleur primaire (accent) */
  accent: string;
  accentBright: string;
  accentDim: string;
  accentFaint: string;
  /** Couleur secondaire */
  secondary: string;
  /** Couleur de texte sur fond sombre */
  text: string;
  textDim: string;
  textFaint: string;
}

/** Palette sémantique (indépendante de la faction). */
export interface SemanticPalette {
  danger: string;
  dangerBg: string;
  ok: string;
  warn: string;
  gold: string;
  hp: string;
  hpLow: string;
  shield: string;
  stamina: string;
  mana: string;
  xp: string;
}

/** Palette de rareté (loot). */
export interface RarityPalette {
  common: string;
  uncommon: string;
  rare: string;
  epic: string;
  legendary: string;
}

/** Surfaces de fond. */
export interface SurfacePalette {
  bg: string;
  panel: string;
  panelSolid: string;
  deep: string;
  hover: string;
  active: string;
}

/** Bordures. */
export interface BorderPalette {
  default: string;
  dim: string;
  focus: string;
}

/** Typographie. */
export interface TypographyTokens {
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  sizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  weights: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    black: number;
  };
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
    wider: string;
    widest: string;
  };
}

/** Espacement (grille 4px). */
export interface SpacingTokens {
  xs: string;   // 4px
  sm: string;   // 8px
  md: string;   // 16px
  lg: string;   // 24px
  xl: string;   // 32px
  '2xl': string; // 48px
}

/** Rayons et coupes. */
export interface ShapeTokens {
  radiusSm: string;
  radiusMd: string;
  cut: string; // biseau signature NARVOS
}

/** Effets. */
export interface EffectTokens {
  blur: string;
  transition: string;
  glowAccent: string;
}

/** Ensemble complet du thème. */
export interface NarvosTheme {
  faction: FactionPalette;
  semantic: SemanticPalette;
  rarity: RarityPalette;
  surface: SurfacePalette;
  border: BorderPalette;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  shape: ShapeTokens;
  effects: EffectTokens;
}
