// camera/RecoilAdminPanel.tsx — réglage LIVE du recul caméra (par profil).
//
// Sélectionne un profil (spell_fire, melee_heavy, boss_slam…), ajuste l'intensité /
// durée / courbe / trauma, et clique « Tester » pour SENTIR le recul immédiatement.
// Persisté via recoilProfileStore. 100% data : aucun recompil pour régler le feeling.
import { useState } from "react";
import { useEditMode } from "../runtime/gameModeStore";
import { cameraRecoil } from "./CameraRecoilController";
import { recoilProfileStore, useRecoilProfiles } from "./recoilProfileStore";
import type { CameraRecoilProfile } from "./recoilProfiles";
import type { EaseId } from "./ease";

const VIOLET = "#9d6bff";
const EASES: EaseId[] = ["linear", "easeOutQuad", "easeOutCubic", "easeInOutCubic", "spring"];

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#e6dcff" }}>
      <span style={{ width: 62 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 52, textAlign: "right", fontFamily: "monospace" }}>{value.toFixed(3)}</span>
    </label>
  );
}

export function RecoilAdminButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Réglage du recul caméra"
      style={{ position: "fixed", top: 350, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(16,10,28,0.85)", border: `2px solid ${VIOLET}`, color: VIOLET, fontSize: 20, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${VIOLET}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>🎥</button>
  );
}

export function RecoilAdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useRecoilProfiles(); // re-render au réglage
  const ids = recoilProfileStore.ids();
  const [selId, setSelId] = useState<string>(ids[0] ?? "");
  if (!open) return null;

  const p = recoilProfileStore.get(selId);
  if (!p) return null;

  // Écrit le profil entier patché (le store stocke des profils complets).
  const apply = (patch: Partial<CameraRecoilProfile>) =>
    recoilProfileStore.set(selId, {
      ...p, ...patch,
      rot: { ...p.rot, ...(patch.rot ?? {}) },
      pos: { ...p.pos, ...(patch.pos ?? {}) },
    });

  return (
    <div style={{
      position: "fixed", top: 60, right: 66, zIndex: 250, width: 340, maxHeight: "84vh", overflowY: "auto",
      background: "rgba(14,9,24,0.96)", border: `1px solid ${VIOLET}59`, borderRadius: 12, padding: 16,
      color: "#ece4ff", fontFamily: "monospace", fontSize: 12, boxShadow: `0 0 36px ${VIOLET}30`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", color: VIOLET }}>🎥 RECUL CAMÉRA</div>
        <button onClick={onClose} style={{ background: "transparent", color: VIOLET, border: `1px solid ${VIOLET}55`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>✕</button>
      </div>

      <select value={selId} onChange={(e) => setSelId(e.target.value)}
        style={{ width: "100%", marginBottom: 10, padding: 5, background: "#180f28", color: "#ece4ff", border: `1px solid ${VIOLET}40`, borderRadius: 5, fontFamily: "monospace" }}>
        {ids.map((id) => <option key={id} value={id}>{id}{recoilProfileStore.isOverridden(id) ? " ✎" : ""}</option>)}
      </select>

      <button onClick={() => cameraRecoil.applyRecoil(p)}
        style={{ width: "100%", marginBottom: 12, padding: "8px", fontSize: 12, fontWeight: 900, cursor: "pointer",
          background: VIOLET, color: "#1a1030", border: "none", borderRadius: 7 }}>
        ▶ Tester le recul
      </button>

      <div style={{ fontSize: 10, color: "#a98fe0", margin: "2px 0 6px" }}>Rotation (rad)</div>
      <Slider label="pitch" value={p.rot.pitch} min={-0.3} max={0.3} step={0.005} onChange={(v) => apply({ rot: { ...p.rot, pitch: v } })} />
      <Slider label="yaw"   value={p.rot.yaw}   min={-0.3} max={0.3} step={0.005} onChange={(v) => apply({ rot: { ...p.rot, yaw: v } })} />
      <Slider label="roll"  value={p.rot.roll}  min={-0.3} max={0.3} step={0.005} onChange={(v) => apply({ rot: { ...p.rot, roll: v } })} />

      <div style={{ fontSize: 10, color: "#a98fe0", margin: "10px 0 6px" }}>Position (m)</div>
      <Slider label="pos X" value={p.pos.x} min={-0.3} max={0.3} step={0.005} onChange={(v) => apply({ pos: { ...p.pos, x: v } })} />
      <Slider label="pos Y" value={p.pos.y} min={-0.3} max={0.3} step={0.005} onChange={(v) => apply({ pos: { ...p.pos, y: v } })} />
      <Slider label="pos Z" value={p.pos.z} min={-0.3} max={0.3} step={0.005} onChange={(v) => apply({ pos: { ...p.pos, z: v } })} />

      <div style={{ fontSize: 10, color: "#a98fe0", margin: "10px 0 6px" }}>Timing & secousse</div>
      <Slider label="attack" value={p.attack}      min={0.005} max={0.2} step={0.005} onChange={(v) => apply({ attack: v })} />
      <Slider label="durée"  value={p.duration}    min={0.05}  max={1}   step={0.01}  onChange={(v) => apply({ duration: v })} />
      <Slider label="trauma" value={p.shakeTrauma} min={0}     max={1}   step={0.01}  onChange={(v) => apply({ shakeTrauma: v })} />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#e6dcff", marginTop: 8 }}>
        <span style={{ width: 62 }}>courbe</span>
        <select value={p.returnEase} onChange={(e) => apply({ returnEase: e.target.value as EaseId })}
          style={{ flex: 1, padding: 4, background: "#180f28", color: "#ece4ff", border: `1px solid ${VIOLET}40`, borderRadius: 5, fontFamily: "monospace" }}>
          {EASES.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>

      <button onClick={() => recoilProfileStore.reset(selId)}
        style={{ width: "100%", marginTop: 14, padding: "7px", fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "transparent", color: VIOLET, border: `1px solid ${VIOLET}55`, borderRadius: 6, fontFamily: "monospace" }}>
        ↺ Réinitialiser (profil usine)
      </button>
      <div style={{ fontSize: 10, color: "#a98fe0", marginTop: 10, lineHeight: 1.4 }}>
        « Tester » applique le recul immédiatement. Les réglages persistent (monde + local).
      </div>
    </div>
  );
}
