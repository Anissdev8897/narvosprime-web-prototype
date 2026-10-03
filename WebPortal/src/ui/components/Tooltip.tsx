/**
 * ui/components/Tooltip.tsx — Infobulle thématique NARVOS PRIME
 *
 * Tooltip simple au survol. Style holographique discret.
 * Positions : top, bottom, left, right.
 */

import React, { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeProvider';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: TooltipPosition;
  /** Délai avant apparition (ms). Défaut: 400. */
  delay?: number;
  /** Largeur max du tooltip. */
  maxWidth?: number;
  style?: CSSProperties;
}

const POSITION_STYLES: Record<TooltipPosition, { container: CSSProperties; arrow: CSSProperties }> = {
  top: {
    container: { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    arrow: { top: '100%', left: '50%', transform: 'translateX(-50%)', borderTop: '5px solid rgba(6,10,18,0.95)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent' },
  },
  bottom: {
    container: { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    arrow: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderBottom: '5px solid rgba(6,10,18,0.95)', borderLeft: '5px solid transparent', borderRight: '5px solid transparent' },
  },
  left: {
    container: { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
    arrow: { left: '100%', top: '50%', transform: 'translateY(-50%)', borderLeft: '5px solid rgba(6,10,18,0.95)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' },
  },
  right: {
    container: { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
    arrow: { right: '100%', top: '50%', transform: 'translateY(-50%)', borderRight: '5px solid rgba(6,10,18,0.95)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' },
  },
};

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 400,
  maxWidth = 260,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const theme = useTheme();
  const { faction, typography } = theme;
  const pos = POSITION_STYLES[position];

  const show = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'absolute',
            zIndex: 200,
            pointerEvents: 'none',
            background: 'rgba(6, 10, 18, 0.95)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${faction.accentDim}`,
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 11,
            color: faction.text,
            fontFamily: typography.fontBody,
            maxWidth,
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            lineHeight: 1.4,
            boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 8px ${faction.accentFaint}`,
            animation: 'fadeIn 0.12s ease-out',
            ...pos.container,
          }}
        >
          {content}
          <div style={{
            position: 'absolute',
            width: 0, height: 0,
            ...pos.arrow,
          }} />
        </div>
      )}
    </div>
  );
};
