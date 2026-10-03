/**
 * ui/components/Input.tsx — Champ de saisie thématique NARVOS PRIME
 *
 * Style holographique : fond sombre, bordure accent, focus glow.
 */

import React from 'react';
import type { InputHTMLAttributes, ReactNode, CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeProvider';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icône ou label à gauche. */
  leftElement?: ReactNode;
  /** Message d'erreur (colore la bordure en rouge). */
  error?: string;
  /** Label flottant au-dessus. */
  label?: string;
  /** Si true, agrandit le padding (textarea-like). */
  large?: boolean;
}

export const Input: React.FC<InputProps> = ({
  leftElement,
  error,
  label,
  large,
  style,
  className,
  ...rest
}) => {
  const theme = useTheme();
  const { faction, typography } = theme;

  const inputStyle: CSSProperties = {
    flex: 1,
    width: '100%',
    background: 'rgba(2, 6, 12, 0.85)',
    color: faction.text,
    border: `1px solid ${error ? '#ff6b6b' : faction.accentDim}`,
    borderRadius: 3,
    padding: large ? '10px 12px' : '7px 9px',
    fontFamily: typography.fontMono,
    fontSize: 12,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: error ? '0 0 8px rgba(255, 107, 107, 0.3)' : undefined,
    ...style,
  };

  const wrapperStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  };

  return (
    <div>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 10,
          fontWeight: typography.weights.bold,
          letterSpacing: typography.letterSpacing.wide,
          textTransform: 'uppercase',
          color: faction.textDim,
          marginBottom: 4,
        }}>
          {label}
        </label>
      )}
      <div style={wrapperStyle}>
        {leftElement && (
          <span style={{ color: faction.textDim, display: 'inline-flex', lineHeight: 0 }}>
            {leftElement}
          </span>
        )}
        <input style={inputStyle} {...rest} />
      </div>
      {error && (
        <div style={{
          fontSize: 10, color: '#ff6b6b', marginTop: 3,
          fontFamily: typography.fontMono,
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * TextArea stylée pareil que Input.
 */
export interface TextAreaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, error, style, ...rest }) => {
  const theme = useTheme();
  const { faction, typography } = theme;

  return (
    <div>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 10,
          fontWeight: typography.weights.bold,
          letterSpacing: typography.letterSpacing.wide,
          textTransform: 'uppercase',
          color: faction.textDim,
          marginBottom: 4,
        }}>
          {label}
        </label>
      )}
      <textarea
        style={{
          width: '100%',
          background: 'rgba(2, 6, 12, 0.85)',
          color: faction.text,
          border: `1px solid ${error ? '#ff6b6b' : faction.accentDim}`,
          borderRadius: 3,
          padding: '8px 10px',
          fontFamily: typography.fontMono,
          fontSize: 12,
          outline: 'none',
          resize: 'vertical',
          minHeight: 60,
          ...style,
        }}
        {...rest}
      />
      {error && (
        <div style={{ fontSize: 10, color: '#ff6b6b', marginTop: 2, fontFamily: typography.fontMono }}>
          {error}
        </div>
      )}
    </div>
  );
};
