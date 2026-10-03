/**
 * ui/components/Panel.tsx — Panneau thématique NARVOS PRIME
 *
 * Panneau holographique biseauté (signature NARVOS).
 * Variants :
 *   - default : fond panel semi-transparent + blur
 *   - solid   : fond opaque (panneauSolide)
 *   - deep    : fond profond (panneau foncé)
 */

import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';

export type PanelVariant = 'default' | 'solid' | 'deep';

export interface PanelProps {
  variant?: PanelVariant;
  /** Largeur du biseau (cut). Défaut: 9px. */
  cut?: number;
  /** Si true, pas de clip-path (panneau rectangulaire). */
  noBevel?: boolean;
  /** Classes additionnelles. */
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
  /** Si true, réduit l'opacité a l'affichage. */
  transparent?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  variant = 'default',
  cut = 9,
  noBevel,
  children,
  style,
  transparent,
  ...rest
}) => {
  const theme = useTheme();
  const { surface, faction, effects, shape } = theme;

  const bgMap: Record<PanelVariant, string> = {
    default: surface.panel,
    solid: surface.panelSolid,
    deep: surface.deep,
  };

  const panelStyle: CSSProperties = {
    position: 'relative',
    background: bgMap[variant],
    backdropFilter: transparent ? undefined : `blur(${effects.blur})`,
    WebkitBackdropFilter: transparent ? undefined : `blur(${effects.blur})`,
    border: `1px solid ${faction.accentDim}`,
    boxShadow: `0 0 20px rgba(0,0,0,0.5), 0 0 16px ${faction.accentFaint}`,
    clipPath: noBevel ? undefined
      : `polygon(${cut}px 0, 100% 0, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, 0 100%, 0 ${cut}px)`,
    color: faction.text,
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.sizes.base,
    ...style,
  };

  return (
    <div style={panelStyle} {...rest}>
      {children}
    </div>
  );
};

/**
 * Propriétés section/titre de panneau.
 * Réutilise le style SectionTitle de forgeTheme.
 */
export interface SectionTitleProps {
  children: ReactNode;
  style?: CSSProperties;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ children, style }) => {
  const theme = useTheme();
  const { faction, typography, spacing } = theme;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 8px', ...style }}>
      <span style={{
        width: 14, height: 1, background: faction.accent,
        boxShadow: `0 0 6px ${faction.accent}`,
      }} />
      <span style={{
        fontSize: 10, fontWeight: typography.weights.black,
        letterSpacing: typography.letterSpacing.wider,
        color: faction.accent, textTransform: 'uppercase',
      }}>
        {children}
      </span>
    </div>
  );
};

/**
 * AccentBar : liseré gauche pulsant.
 */
export const AccentBar: React.FC<{ style?: CSSProperties }> = ({ style }) => {
  const theme = useTheme();
  return (
    <span style={{
      position: 'absolute', left: 0, top: 0, bottom: 0,
      width: 3, background: theme.faction.accent,
      boxShadow: `0 0 10px ${theme.faction.accent}`,
      animation: 'accentPulse 2s ease-in-out infinite',
      ...style,
    }} />
  );
};
