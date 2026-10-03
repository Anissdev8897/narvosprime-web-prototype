/**
 * ui/index.ts — Point d'entrée du système UI NARVOS PRIME
 *
 * Le système de theming complet, accessible depuis tout le projet.
 * Utilisation :
 *   import { ThemeProvider, useTheme, Button, Panel } from '@/src/ui';
 */

export { ThemeProvider, useTheme, useFaction, useFactions } from './theme';
export { FACTION_PALETTES, SEMANTIC, RARITY, TYPOGRAPHY, SPACING, SHAPE, EFFECTS, spacing } from './theme';
export type { NarvosTheme, Faction, FactionPalette, TypographyTokens, SpacingTokens } from './theme';

export { Button, Panel, SectionTitle, AccentBar, Input, TextArea, Modal, Tooltip } from './components';
export type {
  ButtonProps, ButtonVariant, ButtonSize,
  PanelProps, PanelVariant,
  InputProps, TextAreaProps,
  ModalProps,
  TooltipProps, TooltipPosition,
} from './components';
