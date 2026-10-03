// professions/ForgeMiniGame.tsx — mini-jeu d'artisanat interactif (température → qualité).
//
// Une jauge de chaleur oscille (bleu → orange → blanc). Il faut FRAPPER quand la
// chaleur est dans la bande optimale (orange). N frappes ; la qualité finale = moyenne
// des frappes → bonus de fabrication. Thème adapté au métier (forge/distillation/sertissage).
import { useEffect, useRef, useState } from "react";
import type { ProfessionId } from "./professionTypes";

interface Props {
  profession: ProfessionId;
  color: string;
  recipeLabel: string;
  onComplete: (quality: number) => void;
  onCancel: () => void;
}

const STRIKES = 4;
const BAND_LO = 0.56;
const BAND_HI = 0.84;
const BAND_MID = (BAND_LO + BAND_HI) / 2;
const SPEED = 0.85; // allers-retours / s

function theme(p: ProfessionId): { title: string; verb: string } {
  if (p === "alchimiste") return { title: "Distillation — stabilise la chaleur", verb: "Doser" };
  if (p === "joaillier")  return { title: "Sertissage — chauffe la monture", verb: "Sertir" };
  return { title: "Forge — chauffe puis frappe", verb: "Frapper" };
}

export function ForgeMiniGame({ profession, color, recipeLabel, onComplete, onCancel }: Props) {
  const [heat, setHeat] = useState(0);
  const [strikes, setStrikes] = useState<number[]>([]);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const strikesRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const lastRef = useRef(performance.now());
  const { title, verb } = theme(profession);

  // Oscillation de la chaleur (ping-pong 0↔1).
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      let p = posRef.current + dirRef.current * SPEED * dt;
      if (p >= 1) { p = 1; dirRef.current = -1; }
      else if (p <= 0) { p = 0; dirRef.current = 1; }
      posRef.current = p;
      setHeat(p);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const doStrike = () => {
    const h = posRef.current;
    let q = 0;
    if (h >= BAND_LO && h <= BAND_HI) {
      const half = (BAND_HI - BAND_LO) / 2;
      q = 0.55 + 0.45 * (1 - Math.abs(h - BAND_MID) / half); // 0.55..1 dans la bande
    }
    const next = [...strikesRef.current, q];
    strikesRef.current = next;
    setStrikes(next);
    if (next.length >= STRIKES) {
      const quality = next.reduce((a, b) => a + b, 0) / next.length;
      onComplete(quality);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
      if (e.code === "KeyE" || e.code === "Space") { e.preventDefault(); e.stopPropagation(); doStrike(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCancel]);

  return (
    <div
      onClick={doStrike}
      style={{ position: "fixed", left: "50%", bottom: 150, transform: "translateX(-50%)", zIndex: 70, pointerEvents: "auto", userSelect: "none" }}
    >
      <div style={{
        background: "rgba(10,8,6,0.94)", border: `1px solid ${color}`, borderRadius: 12, padding: "14px 18px 16px", width: 420,
        boxShadow: `0 8px 30px rgba(0,0,0,0.55), 0 0 16px ${color}44`, fontFamily: "system-ui, sans-serif", textAlign: "center",
      }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{title}</div>
        <div style={{ color: "#c9a98a", fontSize: 12, margin: "1px 0 10px" }}>{recipeLabel} · {verb} dans la zone chaude</div>

        {/* Jauge de chaleur */}
        <div style={{ position: "relative", height: 30, borderRadius: 6, overflow: "hidden", border: "1px solid #000",
          background: "linear-gradient(90deg,#1c3a6e 0%,#7a3a12 45%,#ff7a18 70%,#ffd98a 90%,#ffffff 100%)" }}>
          {/* bande optimale */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${BAND_LO * 100}%`, width: `${(BAND_HI - BAND_LO) * 100}%`,
            border: "2px solid #ffec9e", boxShadow: "inset 0 0 10px #ff9d3caa", background: "rgba(255,210,120,0.18)" }} />
          {/* curseur de chaleur */}
          <div style={{ position: "absolute", top: -2, bottom: -2, left: `calc(${heat * 100}% - 2px)`, width: 4, background: "#fff", boxShadow: "0 0 8px #fff" }} />
        </div>

        {/* Indicateur de frappes */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
          {Array.from({ length: STRIKES }, (_, i) => {
            const q = strikes[i];
            const done = q !== undefined;
            const c = !done ? "#3a3128" : q >= 0.55 ? "#7ce08a" : "#e06b5c";
            return <div key={i} style={{ width: 36, height: 8, borderRadius: 4, background: c }} />;
          })}
        </div>
        <div style={{ color: "#9aa3b2", fontSize: 11, marginTop: 8 }}>E / Espace / clic · Échap pour annuler</div>
      </div>
    </div>
  );
}
