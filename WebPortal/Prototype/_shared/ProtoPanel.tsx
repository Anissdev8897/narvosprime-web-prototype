/**
 * Prototype/_shared/ProtoPanel.tsx — Coque du panneau de debug, commune aux prototypes.
 *
 * Volontairement bête : une colonne repliable à droite, des sections, des
 * curseurs. Aucune dépendance au jeu, aucune bibliothèque d'UI. Le panneau doit
 * pouvoir être copié dans un prototype neuf sans traîner de dépendances
 * (cf. docs/ARCHITECTURE_PROTOTYPES.md §3).
 */
import { useState, type ReactNode } from "react";

const CADRE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: 330,
  padding: "12px 14px",
  overflowY: "auto",
  background: "rgba(10, 12, 22, 0.92)",
  borderLeft: "1px solid #2b3350",
  color: "#dbe3f4",
  font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
  backdropFilter: "blur(6px)",
};

export function ProtoPanel({ titre, children }: { titre: string; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(true);

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} style={BOUTON_REPLI}>
        ▸ {titre}
      </button>
    );
  }

  return (
    <aside style={CADRE}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ letterSpacing: 0.5, color: "#8fb8ff" }}>{titre}</strong>
        <button onClick={() => setOuvert(false)} style={BOUTON_PLAT}>◂ replier</button>
      </header>
      {children}
    </aside>
  );
}

export function Section({ titre, children, defautOuvert = true }: {
  titre: string;
  children: ReactNode;
  defautOuvert?: boolean;
}) {
  const [ouvert, setOuvert] = useState(defautOuvert);
  return (
    <section style={{ marginBottom: 12, borderTop: "1px solid #232b45", paddingTop: 8 }}>
      <button onClick={() => setOuvert(!ouvert)} style={{ ...BOUTON_PLAT, width: "100%", textAlign: "left", color: "#9fb4dd" }}>
        {ouvert ? "▾" : "▸"} {titre}
      </button>
      {ouvert && <div style={{ marginTop: 6 }}>{children}</div>}
    </section>
  );
}

export function Curseur({ label, valeur, min, max, pas = 1, unite = "", onChange }: {
  label: string;
  valeur: number;
  min: number;
  max: number;
  pas?: number;
  unite?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: 6 }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "#7fd1a8" }}>{valeur}{unite}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#4f7fff" }}
      />
    </label>
  );
}

export function Bascule({ label, valeur, onChange }: {
  label: string;
  valeur: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, cursor: "pointer" }}>
      <input type="checkbox" checked={valeur} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "#4f7fff" }} />
      <span>{label}</span>
    </label>
  );
}

export function Jauge({ label, valeur, max, couleur }: {
  label: string;
  valeur: number;
  max: number;
  couleur: string;
}) {
  const pct = Math.max(0, Math.min(100, (valeur / max) * 100));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: couleur }}>{Math.round(valeur)} / {max}</span>
      </div>
      <div style={{ height: 6, background: "#1b2138", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: couleur, transition: "width 80ms linear" }} />
      </div>
    </div>
  );
}

export const BOUTON_PLAT: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#7f8db0",
  cursor: "pointer",
  font: "inherit",
  padding: 0,
};

const BOUTON_REPLI: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  padding: "6px 10px",
  background: "rgba(10, 12, 22, 0.92)",
  border: "1px solid #2b3350",
  borderRadius: 4,
  color: "#8fb8ff",
  cursor: "pointer",
  font: "12px ui-monospace, monospace",
};
