/**
 * ui/theme/ThemeProvider.tsx — Contexte React du thème NARVOS PRIME
 *
 * Fournit le thème complet à l'arbre React. Permet de changer
 * la palette faction dynamiquement.
 *
 * Utilisation :
 *   <ThemeProvider faction="wraith">
 *     <App />
 *   </ThemeProvider>
 *
 *   // Dans un composant :
 *   const theme = useTheme();
 *   // ou
 *   const factions = useFactions(); // toutes les factions disponibles
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Faction, NarvosTheme } from './types';
import { FACTION_PALETTES, SEMANTIC, RARITY, SURFACE, BORDER, getFactionPalette } from './palette';
import { TYPOGRAPHY } from './typography';
import { SPACING, SHAPE, EFFECTS } from './spacing';

/* ── Contexte ─────────────────────────────────────────────────────────────── */

interface ThemeContextValue {
  theme: NarvosTheme;
  /** Change la faction active. */
  setFaction: (f: Faction) => void;
  /** Faction actuelle. */
  faction: Faction;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ── Props du Provider ────────────────────────────────────────────────────── */

interface ThemeProviderProps {
  children: ReactNode;
  /** Faction initiale (défaut: humain). */
  faction?: Faction;
}

/* ── Provider ─────────────────────────────────────────────────────────────── */

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  faction: initialFaction = 'humain',
}) => {
  const [faction, setFaction] = React.useState<Faction>(initialFaction);

  const theme = useMemo<NarvosTheme>(() => {
    const fp = getFactionPalette(faction);
    return {
      faction: fp,
      semantic: SEMANTIC,
      rarity: RARITY,
      surface: SURFACE,
      border: BORDER,
      typography: TYPOGRAPHY,
      spacing: SPACING,
      shape: SHAPE,
      effects: EFFECTS,
    };
  }, [faction]);

  // Synchronise les CSS custom properties sur :root
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--nv-accent', theme.faction.accent);
    root.style.setProperty('--nv-accent-bright', theme.faction.accentBright);
    root.style.setProperty('--nv-accent-dim', theme.faction.accentDim);
    root.style.setProperty('--nv-accent-faint', theme.faction.accentFaint);
    root.style.setProperty('--nv-text', theme.faction.text);
    root.style.setProperty('--nv-text-dim', theme.faction.textDim);
    root.style.setProperty('--nv-text-faint', theme.faction.textFaint);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setFaction, faction }}>
      {children}
    </ThemeContext.Provider>
  );
};

/* ── Hooks ────────────────────────────────────────────────────────────────── */

/** Récupère le thème complet. */
export function useTheme(): NarvosTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx.theme;
}

/** Récupère la faction active et le setter. */
export function useFaction(): [Faction, (f: Faction) => void] {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useFaction must be used within a <ThemeProvider>');
  return [ctx.faction, ctx.setFaction];
}

/** Retourne toutes les factions disponibles avec leurs palettes. */
export function useFactions(): Record<Faction, (typeof FACTION_PALETTES)[Faction]> {
  return FACTION_PALETTES;
}
