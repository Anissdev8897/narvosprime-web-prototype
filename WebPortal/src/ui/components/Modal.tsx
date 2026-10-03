/**
 * ui/components/Modal.tsx — Modale thématique NARVOS PRIME
 *
 * Overlay semi-transparent + panneau modal centré avec biseau.
 * Supporte les animations d'entrée/sortie.
 * Accessible : fermeture via Escape + clique hors modale.
 */

import React, { useEffect, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { Panel } from './Panel';

export interface ModalProps {
  /** Si true, la modale est visible. */
  open: boolean;
  /** Callback de fermeture. */
  onClose: () => void;
  /** Titre affiché dans l'en-tête. */
  title?: string;
  /** Icône ou composant dans l'en-tête. */
  titleIcon?: ReactNode;
  /** Actions dans l'en-tête (boutons). */
  actions?: ReactNode;
  children: ReactNode;
  /** Largeur max (défaut: 620px). */
  width?: string;
  /** Si true, pas de fermeture au clique sur l'overlay. */
  closeOnOverlay?: boolean;
  style?: CSSProperties;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  titleIcon,
  actions,
  children,
  width = 'min(620px, 84vw)',
  closeOnOverlay = true,
  style,
}) => {
  const theme = useTheme();
  const { faction, typography } = theme;

  // Fermeture via Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Panel
          variant="solid"
          cut={9}
          style={{
            position: 'relative',
            width,
            maxHeight: '72vh',
            overflow: 'auto',
            padding: 22,
            cursor: 'default',
            ...style,
          }}
        >
        {/* Titre */}
        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {titleIcon && <span style={{ display: 'inline-flex', lineHeight: 0 }}>{titleIcon}</span>}
              <span style={{
                fontFamily: typography.fontDisplay,
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.bold,
                letterSpacing: typography.letterSpacing.wide,
                textTransform: 'uppercase',
                color: faction.accent,
              }}>
                {title}
              </span>
            </div>
            {actions && <div style={{ display: 'flex', gap: 6 }}>{actions}</div>}
          </div>
        )}

        {children}
      </Panel>
      </div>
    </div>
  );
};
