// runtime/combat/ArrowMutationAdmin.tsx — panneau ADMIN des mutations de flèche.
//
// Règle EN DIRECT les mutations appliquées à chaque tir d'arc (persistées par
// arrowMutationStore) : multishot (éventail), pierce (perforation), split (éclatement).
// Pastille 🏹 + panneau. Composant autonome (n'impacte pas RpgGameWorld).
import { useState } from "react";
import { useEditMode } from "../gameModeStore";
import { arrowMutationStore, useArrowMutations } from "./arrowMutationStore";

const GR = "#a3e635";

function Row({ label, value, min, max, hint, onChange }: {
  label: string; value: number; min: number; max: number; hint: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#dfffb0", fontWeight: 700 }}>
        <span>{label}</span><span style={{ color: GR, fontFamily: "monospace" }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))} style={{ width: "100%" }} />
      <div style={{ fontSize: 9, color: "#7e9a52" }}>{hint}</div>
    </div>
  );
}

export function ArrowMutationButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Mutations de flèche (archer)"
      style={{ position: "fixed", top: 398, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(14,22,6,0.85)", border: `2px solid ${GR}`, color: GR, fontSize: 19, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${GR}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>🏹</button>
  );
}

export function ArrowMutationAdmin({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = useArrowMutations(); // re-render au réglage
  const isEdit = useEditMode();
  // TOUS les hooks AVANT le moindre retour anticipé. `!open || !useEditMode()`
  // court-circuitait : panneau fermé → `useEditMode()` jamais appelé, panneau
  // ouvert → appelé. Le nombre de hooks changeait entre deux rendus et React
  // levait « Rendered more hooks than during the previous render », que
  // GameErrorBoundary rattrapait en DÉTRUISANT tout le monde de jeu.
  if (!open || !isEdit) return null;
  return (
    <div style={{
      position: "fixed", top: 60, right: 66, zIndex: 250, width: 280,
      background: "rgba(12,18,6,0.96)", border: `1px solid ${GR}55`, borderRadius: 12, padding: 16,
      color: "#eaffce", fontFamily: "monospace", fontSize: 12, boxShadow: `0 0 30px ${GR}25`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", color: GR }}>🏹 MUTATIONS FLÈCHE</div>
        <button onClick={onClose} style={{ background: "transparent", color: GR, border: `1px solid ${GR}55`, borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      <Row label="Multishot (flèches/tir)" value={m.multishot} min={1} max={9}
        hint="Éventail : N flèches par tir." onChange={(v) => arrowMutationStore.set({ multishot: v })} />
      <Row label="Perforation (pierce)" value={m.pierce} min={0} max={9}
        hint="Ennemis traversés en plus du premier." onChange={(v) => arrowMutationStore.set({ pierce: v })} />
      <Row label="Éclatement (split)" value={m.split} min={0} max={6}
        hint="Flèches filles projetées à l'impact." onChange={(v) => arrowMutationStore.set({ split: v })} />
      <button onClick={() => arrowMutationStore.set({ multishot: 1, pierce: 0, split: 0 })}
        style={{ width: "100%", marginTop: 6, padding: "7px", fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "transparent", color: GR, border: `1px solid ${GR}55`, borderRadius: 6, fontFamily: "monospace" }}>
        ↺ Flèche simple (réinitialiser)
      </button>
    </div>
  );
}
