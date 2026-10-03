// audio/KillStreakHud.tsx — compteur de combo visuel (accompagne les annonces audio).
//
// Affiche la série en cours (≥2) au centre-haut : multiplicateur, libellé du palier
// (DOUBLE KILL…), et une barre de fenêtre qui se vide → tension « tue vite ou perds ».
// Lit le singleton killStreak (hors-React) via un tick léger.
import { useEffect, useReducer } from "react";
import { audioEvents } from "./audioEventManager";
import { killStreakLabel } from "./killStreakAudio";

/** Couleur du palier (monte en intensité avec la série). */
function streakColor(n: number): string {
  if (n >= 6) return "#ff3b3b"; // massacre
  if (n === 5) return "#ff6a00";
  if (n === 4) return "#ffaa00";
  if (n === 3) return "#ffd24d";
  return "#a3e635";             // double
}

export function KillStreakHud() {
  const [, force] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    const iv = setInterval(force, 100);
    return () => clearInterval(iv);
  }, []);

  const ks = audioEvents.killStreak;
  const streak = ks.streak;
  if (streak < 2) return null;

  const label = killStreakLabel(streak);
  const frac = ks.windowFraction();
  const color = streakColor(streak);

  return (
    <div style={{
      position: "fixed", top: 92, left: "50%", transform: "translateX(-50%)",
      zIndex: 41, pointerEvents: "none", textAlign: "center",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    }}>
      <div key={streak} style={{
        fontSize: 34, fontWeight: 900, color, lineHeight: 1,
        textShadow: `0 0 14px ${color}cc, 0 2px 4px #000`,
        animation: "ksPop 0.25s ease-out",
      }}>
        ×{streak}
      </div>
      {label && (
        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.18em", color, textShadow: "0 1px 3px #000" }}>
          {label}
        </div>
      )}
      <div style={{ width: 120, height: 5, borderRadius: 3, background: "rgba(0,0,0,0.55)", overflow: "hidden" }}>
        <div style={{ width: `${frac * 100}%`, height: "100%", background: color, transition: "width 0.1s linear" }} />
      </div>
      <style>{`@keyframes ksPop { 0% { transform: scale(1.6); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
