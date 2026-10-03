// forge/forgeTheme.tsx — thème UI partagé des écrans FORGE (univers NARVOS PRIME).
//
// Look : HUD holographique cyan sur espace profond (cohérent avec le menu principal).
// Majuscules à tracking large, bordures fines + glow, panneaux semi-opaques, zéro rondeur
// "gamine". Tous les écrans Forge consomment ces tokens/helpers pour un rendu unifié.
import type { CSSProperties, ReactNode } from "react";

export const FORGE = {
  accent: "#22d3ee",      // cyan holographique (NARVOS PRIME)
  accentDim: "#22d3ee55",
  accentFaint: "#22d3ee22",
  bg: "#02030a",          // espace profond
  panel: "rgba(6,11,20,0.82)",
  panelSolid: "rgba(5,8,15,0.96)",
  text: "#e2f6ff",
  textDim: "#7e93a8",
  textFaint: "#48586b",
  danger: "#ff6b6b",
  ok: "#7dffa6",
  warn: "#ffce6b",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

/** Panneau HUD (carte / colonne). */
export function panel(extra?: CSSProperties): CSSProperties {
  return { background: FORGE.panel, border: `1px solid ${FORGE.accentDim}`, borderRadius: 4, ...extra };
}

/** Bouton HUD. variant: primary (plein cyan) · ghost (contour) · danger. */
export function hudButton(variant: "primary" | "ghost" | "danger" = "ghost", extra?: CSSProperties): CSSProperties {
  const base: CSSProperties = {
    padding: "8px 16px", fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase",
    fontFamily: FORGE.mono, cursor: "pointer", borderRadius: 3, transition: "background .15s, box-shadow .15s",
  };
  if (variant === "primary") return { ...base, background: FORGE.accentFaint, color: FORGE.accent, border: `1px solid ${FORGE.accent}`, boxShadow: `0 0 14px ${FORGE.accentDim}`, ...extra };
  if (variant === "danger") return { ...base, background: "transparent", color: FORGE.danger, border: `1px solid ${FORGE.danger}55`, ...extra };
  return { ...base, background: "rgba(8,14,24,0.7)", color: FORGE.text, border: `1px solid ${FORGE.accentDim}`, ...extra };
}

export function hudInput(extra?: CSSProperties): CSSProperties {
  return { background: "rgba(2,6,12,0.85)", color: FORGE.text, border: `1px solid ${FORGE.accentDim}`, borderRadius: 3, padding: "7px 9px", fontFamily: FORGE.mono, fontSize: 12, outline: "none", ...extra };
}

/** Titre de section : trait + label tracking large. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px" }}>
      <span style={{ width: 14, height: 1, background: FORGE.accent, boxShadow: `0 0 6px ${FORGE.accent}` }} />
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", color: FORGE.accent, textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

/** Cadre plein écran HUD : fond espace + grille + en-tête (titre + sous-titre + actions). */
export function ForgeShell({ title, subtitle, actions, children }: {
  title: string; subtitle?: string; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: FORGE.bg, color: FORGE.text, fontFamily: FORGE.mono, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* grille de fond + halo */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${FORGE.accentFaint} 1px, transparent 1px), linear-gradient(90deg, ${FORGE.accentFaint} 1px, transparent 1px)`,
        backgroundSize: "44px 44px", opacity: 0.35, maskImage: "radial-gradient(ellipse at center, #000 30%, transparent 85%)" }} />
      <div style={{ position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)", width: 600, height: 240, background: `radial-gradient(ellipse, ${FORGE.accentFaint}, transparent 70%)`, pointerEvents: "none" }} />

      {/* En-tête */}
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: `1px solid ${FORGE.accentDim}`, background: "rgba(2,4,10,0.6)" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "0.28em", color: FORGE.text, textShadow: `0 0 18px ${FORGE.accentDim}` }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 10, color: FORGE.textDim, letterSpacing: "0.1em", marginTop: 3 }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>{actions}</div>
      </div>

      <div style={{ position: "relative", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}
