// ══════════════════════════════════════════════════════════════════════════════
// components/IntroScreen.tsx — Cinématique d'intro NARVOS PRIME
//
// Joue NARVOSPRIME.mp4 (intro lore) en plein-écran avec :
//   - bouton "Passer" (bas-droite)
//   - avance automatiquement quand la vidéo se termine
//   - fade-in au montage, fade-out vers le menu principal
//   - onError / onCanPlay guards → si la vidéo ne charge pas, skip immédiat
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from "react";
import { INTRO_VIDEO } from "../rpg/loaders/launcherAssets";

interface IntroScreenProps {
  onDone: () => void;
}

export function IntroScreen({ onDone }: IntroScreenProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);        // animation fade-out
  const doneRef   = useRef(false);                    // guard : onDone appelé une seule fois

  // ── Transition fade-out → onDone ───────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, 420);          // laisse l'animation se terminer
  }, [onDone]);

  // ── Touches clavier : Espace / Entrée / Échap → skip ───────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", " ", "Enter"].includes(e.key)) { e.preventDefault(); handleSkip(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSkip]);

  return (
    <div
      onClick={handleSkip}
      style={{
        position: "fixed", inset: 0, background: "#000", zIndex: 9999,
        cursor: "pointer",
        opacity:    fading ? 0 : 1,
        transition: fading ? "opacity 0.4s ease-out" : "opacity 0.5s ease-in",
      }}
    >
      {/* Vidéo cinématique */}
      <video
        ref={videoRef}
        src={INTRO_VIDEO}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        autoPlay
        muted           // requis : autoplay bloqué par les navigateurs si audio non muet
        playsInline
        onEnded={handleSkip}
        onError={handleSkip}   // fichier absent → skip immédiat
      />

      {/* Overlay sombre léger pour lire le bouton */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 30%)" }} />

      {/* Bouton Passer */}
      <button
        onClick={(e) => { e.stopPropagation(); handleSkip(); }}
        style={{
          position: "absolute", bottom: 32, right: 32,
          padding: "10px 24px", borderRadius: 10, fontWeight: 900,
          textTransform: "uppercase", letterSpacing: "0.22em", fontSize: 12,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.65)",
          cursor: "pointer", transition: "all 0.15s",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          const b = e.currentTarget.style;
          b.background = "rgba(255,255,255,0.12)";
          b.color = "#fff";
          b.borderColor = "rgba(255,255,255,0.55)";
        }}
        onMouseLeave={(e) => {
          const b = e.currentTarget.style;
          b.background = "rgba(0,0,0,0.55)";
          b.color = "rgba(255,255,255,0.65)";
          b.borderColor = "rgba(255,255,255,0.2)";
        }}
      >
        Passer ↵
      </button>

      {/* Texte de clic discret (centre-bas) */}
      <div style={{
        position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.2em",
        textTransform: "uppercase", userSelect: "none", pointerEvents: "none",
      }}>
        Cliquez ou appuyez sur Échap pour passer
      </div>
    </div>
  );
}
