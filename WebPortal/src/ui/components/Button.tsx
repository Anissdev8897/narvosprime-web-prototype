/**
 * ui/components/Button.tsx — Bouton thématique NARVOS PRIME
 *
 * Variants :
 *   - primary   : fond accent + glow
 *   - ghost     : contour fin (défaut)
 *   - danger    : rouge, actions destructrices
 *   - ghost-dark: sans bordure, hover background
 *
 * Tailles :
 *   - sm : 28px de hauteur
 *   - md : 36px (défaut)
 *   - lg : 44px
 */

import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'ghost-dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône ou composant à gauche du label. */
  leftIcon?: ReactNode;
  /** Icône ou composant à droite du label. */
  rightIcon?: ReactNode;
  /** Si true, le bouton prend toute la largeur. */
  fullWidth?: boolean;
  /** Si true, désactive les animations de transition. */
  noTransition?: boolean;
}

const SIZE_MAP: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
  sm: { height: 28, px: 10, fontSize: 10 },
  md: { height: 36, px: 16, fontSize: 11 },
  lg: { height: 44, px: 22, fontSize: 12 },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth,
  noTransition,
  children,
  style,
  ...rest
}) => {
  const theme = useTheme();
  const { faction, border, typography, shape } = theme;
  const dim = SIZE_MAP[size];

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: `0 ${dim.px}px`,
    height: dim.height,
    fontSize: dim.fontSize,
    fontWeight: typography.weights.black,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    fontFamily: typography.fontMono,
    cursor: 'pointer',
    borderRadius: shape.radiusSm,
    border: `1px solid ${faction.accentDim}`,
    transition: noTransition ? 'none' : 'background 0.15s, box-shadow 0.15s, border-color 0.15s',
    width: fullWidth ? '100%' : undefined,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    lineHeight: 1,
    ...style,
  };

  let variantStyle: React.CSSProperties;

  switch (variant) {
    case 'primary':
      variantStyle = {
        background: faction.accentFaint,
        color: faction.accent,
        border: `1px solid ${faction.accent}`,
        boxShadow: `0 0 14px ${faction.accentDim}`,
      };
      break;
    case 'danger':
      variantStyle = {
        background: 'rgba(255, 107, 107, 0.08)',
        color: '#ff6b6b',
        border: `1px solid rgba(255, 107, 107, 0.35)`,
      };
      break;
    case 'ghost-dark':
      variantStyle = {
        background: 'transparent',
        color: faction.textDim,
        border: 'none',
      };
      break;
    default: // ghost
      variantStyle = {
        background: 'rgba(8, 14, 24, 0.7)',
        color: faction.text,
        border: `1px solid ${faction.accentDim}`,
      };
  }

  const composed = { ...base, ...variantStyle };

  return (
    <button style={composed} {...rest}>
      {leftIcon && <span style={{ display: 'inline-flex', lineHeight: 0 }}>{leftIcon}</span>}
      {children}
      {rightIcon && <span style={{ display: 'inline-flex', lineHeight: 0 }}>{rightIcon}</span>}
    </button>
  );
};
