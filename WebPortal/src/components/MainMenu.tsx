// ══════════════════════════════════════════════════════════════════════════════
// components/MainMenu.tsx — Écran Menu principal NARVOS PRIME
//
// Fond vidéo (Menuprincipal.mp4) + logo + boutons :
//   Jouer / Continuer / Paramètres / Crédits / Quitter
// Paramètres réutilise <SettingsPanel> (partagé avec le menu Pause).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { Play, Hammer, Settings as SettingsIcon, Info, Power, X } from "lucide-react";
import { MENU_VIDEO, GAME_LOGO } from "../rpg/loaders/launcherAssets";
import { SettingsPanel } from "../rpg/runtime/SettingsPanel";

interface MainMenuProps {
  onPlay: () => void;
  /** Mode FORGE MAP : atelier de création de cartes (connexion réservée aux admins). */
  onForgeMap: () => void;
  onQuit: () => void;
}

const ACCENT = "#22d3ee";

export function MainMenu({ onPlay, onForgeMap, onQuit }: MainMenuProps) {
  const [overlay, setOverlay] = useState<"none" | "settings" | "credits">("none");

  const menuBtn = (label: string, Icon: typeof Play, onClick: () => void, opts?: { primary?: boolean; danger?: boolean; disabled?: boolean }) => (
    <button
      onClick={opts?.disabled ? undefined : onClick}
      disabled={opts?.disabled}
      style={{
        width: 300, padding: "15px 22px", borderRadius: 12, fontWeight: 800,
        textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 15,
        display: "flex", alignItems: "center", gap: 14, cursor: opts?.disabled ? "not-allowed" : "pointer",
        opacity: opts?.disabled ? 0.4 : 1, transition: "all .15s",
        border: `1px solid ${opts?.danger ? "#ef444466" : opts?.primary ? ACCENT : `${ACCENT}44`}`,
        background: opts?.primary ? `${ACCENT}22` : "rgba(5,9,16,0.78)",
        color: opts?.danger ? "#fca5a5" : "#e2f6ff",
        boxShadow: opts?.primary ? `0 0 22px ${ACCENT}44` : "none",
      }}
    >
      <Icon size={20} /> {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#02030a" }}>
      {/* Fond vidéo */}
      <video
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}
        src={MENU_VIDEO}
        autoPlay loop muted playsInline
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(2,3,10,0.9) 0%, rgba(2,3,10,0.4) 50%, rgba(2,3,10,0.85) 100%)" }} />

      {/* Contenu */}
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: "8vw", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <img src={GAME_LOGO} alt="NARVOS PRIME" style={{ width: 280, maxWidth: "60vw", filter: `drop-shadow(0 0 20px ${ACCENT}66)` }}
            onError={(e) => { (e.currentTarget.style.display = "none"); }} />
          <h1 style={{ color: "#fff", fontWeight: 900, letterSpacing: "0.35em", fontSize: 34, textShadow: `0 0 24px ${ACCENT}` }}>
            NARVOS <span style={{ color: ACCENT }}>PRIME</span>
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {menuBtn("Jouer", Play, onPlay, { primary: true })}
          {menuBtn("Forge Map", Hammer, onForgeMap)}
          {menuBtn("Paramètres", SettingsIcon, () => setOverlay("settings"))}
          {menuBtn("Crédits", Info, () => setOverlay("credits"))}
          {menuBtn("Quitter", Power, onQuit, { danger: true })}
        </div>

        <div style={{ position: "absolute", bottom: 18, right: 22, color: "#475569", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          NARVOS ENGINE · Prototype
        </div>
      </div>

      {/* Overlay Paramètres / Crédits */}
      {overlay !== "none" && (
        <div onClick={() => setOverlay("none")} style={{
          position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(2,3,10,0.8)", backdropFilter: "blur(4px)",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: overlay === "settings" ? 720 : 520, maxWidth: "92vw", maxHeight: "86vh", overflow: "auto",
            background: "rgba(5,8,15,0.96)", border: `1px solid ${ACCENT}55`, borderRadius: 18, padding: 28, boxShadow: `0 0 40px ${ACCENT}33`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ color: ACCENT, fontWeight: 900, letterSpacing: "0.3em", fontSize: 20 }}>
                {overlay === "settings" ? "PARAMÈTRES" : "CRÉDITS"}
              </h2>
              <button onClick={() => setOverlay("none")} style={{
                padding: "8px 14px", borderRadius: 10, fontWeight: 800, cursor: "pointer",
                border: `1px solid ${ACCENT}44`, background: "rgba(8,12,20,0.8)", color: "#e2f6ff",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <X size={16} /> Fermer
              </button>
            </div>
            {overlay === "settings" ? (
              <SettingsPanel />
            ) : (
              <div style={{ color: "#cbd5e1", lineHeight: 1.9, fontSize: 14 }}>
                <p style={{ color: ACCENT, fontWeight: 800, letterSpacing: "0.2em", marginBottom: 10 }}>NARVOS PRIME</p>
                <p>RPG/MMORPG futuriste fantasy — prototype web.</p>
                <p style={{ marginTop: 14, color: "#94a3b8" }}>Moteur : React · React Three Fiber · Three.js</p>
                <p style={{ color: "#94a3b8" }}>Personnages, sorts, hub spatial & système de progression maison.</p>
                <p style={{ marginTop: 14, color: "#64748b", fontSize: 12 }}>Assets : Quaternius · Meshy · Mixamo · packs pixel-art VFX.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
