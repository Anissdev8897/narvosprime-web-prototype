// professions/GatherMiniGame.tsx — mini-jeu de précision (timing) pour la récolte.
//
// Une barre horizontale, une zone verte fixe au centre, un curseur qui fait des
// allers-retours. Au signal (E / Espace / clic), on mesure la distance du curseur
// au centre de la zone verte → quality 0..1 (0 = hors zone = raté). Le parent
// applique le coup au nœud via le registre. Échap annule.
import { useEffect, useRef, useState } from "react";

interface Props {
  verb: string;                       // "Couper", "Miner"...
  color: string;                      // teinte d'accent du métier
  onStrike: (quality: number) => void;
  onCancel: () => void;
}

const GREEN_CENTER = 0.5; // position 0..1 du centre de la zone verte
const GREEN_HALF = 0.12;  // demi-largeur de la zone verte (fenêtre de réussite)
const SPEED = 0.95;       // allers-retours par seconde

export function GatherMiniGame({ verb, color, onStrike, onCancel }: Props) {
  const [cursor, setCursor] = useState(0);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const rafRef = useRef(0);
  const lastRef = useRef(performance.now());

  // Boucle d'animation du curseur (ping-pong 0↔1).
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      let p = posRef.current + dirRef.current * SPEED * dt;
      if (p >= 1) { p = 1; dirRef.current = -1; }
      else if (p <= 0) { p = 0; dirRef.current = 1; }
      posRef.current = p;
      setCursor(p);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Entrées clavier (E / Espace = frapper, Échap = annuler).
  useEffect(() => {
    const strike = () => {
      const d = Math.abs(posRef.current - GREEN_CENTER);
      const quality = d <= GREEN_HALF ? 1 - d / GREEN_HALF : 0;
      onStrike(quality);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { e.preventDefault(); onCancel(); return; }
      if (e.code === "KeyE" || e.code === "Space") { e.preventDefault(); e.stopPropagation(); strike(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onStrike, onCancel]);

  const handleClick = () => {
    const d = Math.abs(posRef.current - GREEN_CENTER);
    onStrike(d <= GREEN_HALF ? 1 - d / GREEN_HALF : 0);
  };

  return (
    <div
      style={{
        position: "fixed", left: "50%", bottom: 140, transform: "translateX(-50%)",
        zIndex: 60, pointerEvents: "auto", userSelect: "none",
      }}
      onClick={handleClick}
    >
      <div
        style={{
          background: "rgba(10,12,18,0.92)", border: `1px solid ${color}`,
          borderRadius: 12, padding: "14px 18px 16px", width: 380,
          boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 14px ${color}44`,
          fontFamily: "system-ui, sans-serif", textAlign: "center",
        }}
      >
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: 0.4 }}>
          {verb} — frappe dans la zone verte
        </div>
        <div style={{ color: "#9aa3b2", fontSize: 11, marginTop: 2, marginBottom: 12 }}>
          E / Espace / clic · Échap pour arrêter
        </div>

        <div
          style={{
            position: "relative", height: 26, borderRadius: 6,
            background: "linear-gradient(90deg,#2a1414,#3a2a14,#2a1414)",
            border: "1px solid #00000088", overflow: "hidden",
          }}
        >
          {/* zone verte */}
          <div
            style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${(GREEN_CENTER - GREEN_HALF) * 100}%`,
              width: `${GREEN_HALF * 2 * 100}%`,
              background: "rgba(90,220,120,0.45)",
              borderLeft: "2px solid #5cff8a", borderRight: "2px solid #5cff8a",
            }}
          />
          {/* cœur de la zone (bonus parfait) */}
          <div
            style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${(GREEN_CENTER - 0.02) * 100}%`, width: `${0.04 * 100}%`,
              background: "rgba(255,255,255,0.55)",
            }}
          />
          {/* curseur */}
          <div
            style={{
              position: "absolute", top: -2, bottom: -2,
              left: `calc(${cursor * 100}% - 2px)`, width: 4,
              background: "#fff", boxShadow: "0 0 6px #fff",
            }}
          />
        </div>
      </div>
    </div>
  );
}
