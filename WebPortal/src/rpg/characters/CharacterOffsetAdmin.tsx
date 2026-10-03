// characters/CharacterOffsetAdmin.tsx — réglage LIVE de l'orientation PAR ANIMATION.
//
// Sélectionne un perso + une de ses animations (idle / marche / attaque / sort…) et règle
// l'offset (rotation + position) appliqué QUAND CETTE ANIMATION JOUE. Persisté par
// (avatar × animation). Raccourcis « flip » ±180° pour redresser vite une anim retournée.
import { useState } from "react";
import { useEditMode } from "../runtime/gameModeStore";
import { PLAYER_AVATARS } from "./playerAvatars";
import { characterOffsetStore, useCharacterOffset, OFFSET_ACTIONS, type OffsetMode } from "./characterOffsetStore";
import { animClipStore, useAnimClips } from "../animation/animClipStore";
import { useDraggablePanel } from "../runtime/admin/useDraggablePanel";
import type { ActionId } from "../types";

const TEAL = "#3fd0c7";

const ACTION_LABELS: Partial<Record<ActionId, string>> = {
  idle: "Idle", walk: "Marche", run: "Course", sprint: "Sprint", jump: "Saut",
  attack: "Attaque", cast: "Sort", channeling: "Incantation", hit: "Touché",
  death: "Mort", dodge: "Esquive", ultimate: "Ultime",
};

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#cdeee9" }}>
      <span style={{ width: 50 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 52, textAlign: "right", fontFamily: "monospace" }}>{value.toFixed(3)}</span>
    </label>
  );
}

export function CharacterOffsetAdminButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Calibrage des animations du personnage"
      style={{ position: "fixed", top: 398, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(6,20,18,0.85)", border: `2px solid ${TEAL}`, color: TEAL, fontSize: 18, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${TEAL}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>🧍</button>
  );
}

const PI = Math.PI;
const SELECT: React.CSSProperties = {
  width: "100%", padding: 5, background: "#0a1f1d", color: "#dffaf6",
  border: `1px solid ${TEAL}40`, borderRadius: 5, fontFamily: "monospace",
};

export function CharacterOffsetAdmin({ open, onClose }: { open: boolean; onClose: () => void }) {
  useCharacterOffset();
  useAnimClips(); // re-render quand un perso enregistre ses clips / override change
  const { dragHandlers, dragStyle, transform } = useDraggablePanel();
  const [avatar, setAvatar] = useState<string>(PLAYER_AVATARS[0]?.id ?? "wraith");
  const [mode, setModeState] = useState<OffsetMode>("base");
  const [action, setAction] = useState<ActionId>("idle");
  if (!open) return null;

  const off = characterOffsetStore.get(avatar, mode, action);
  const setRot = (i: number, v: number) => {
    const r = [...off.rotation] as [number, number, number]; r[i] = v;
    characterOffsetStore.set(avatar, mode, action, { rotation: r });
  };
  const setPos = (i: number, v: number) => {
    const p = [...off.position] as [number, number, number]; p[i] = v;
    characterOffsetStore.set(avatar, mode, action, { position: p });
  };
  const flip = (axis: 0 | 1 | 2) => {
    const r = [...off.rotation] as [number, number, number];
    r[axis] = Math.abs(r[axis]) > 0.01 ? 0 : PI; // toggle ±180°
    characterOffsetStore.set(avatar, mode, action, { rotation: r });
  };

  const btn: React.CSSProperties = {
    flex: 1, padding: "5px 2px", fontSize: 10, fontWeight: 800, cursor: "pointer", borderRadius: 5,
    fontFamily: "monospace", background: "transparent", color: TEAL, border: `1px solid ${TEAL}66`,
  };

  return (
    <div style={{
      position: "fixed", top: 60, right: 66, zIndex: 250, width: 322, maxHeight: "84vh", overflowY: "auto",
      background: "rgba(4,16,15,0.96)", border: `1px solid ${TEAL}59`, borderRadius: 12, padding: 16,
      color: "#dffaf6", fontFamily: "monospace", fontSize: 12, boxShadow: `0 0 36px ${TEAL}30`, transform,
    }}>
      <div {...dragHandlers} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, ...dragStyle }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.13em", color: TEAL }}>🧍 CALIBRAGE ANIMATION</div>
        <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()}
          style={{ background: "transparent", color: TEAL, border: `1px solid ${TEAL}55`, borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>

      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "2px 0 4px" }}>Personnage</div>
      <select value={avatar} onChange={(e) => setAvatar(e.target.value)} style={{ ...SELECT, marginBottom: 10 }}>
        {PLAYER_AVATARS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>

      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "2px 0 4px" }}>État (anims SÉPARÉES)</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {([["base", "🧍 Arme rangée"], ["drawn", "⚔️ Dégainé"]] as const).map(([m, label]) => (
          <button key={m} onClick={() => setModeState(m)}
            style={{ flex: 1, padding: "5px 2px", fontSize: 10, fontWeight: 800, cursor: "pointer", borderRadius: 5,
              fontFamily: "monospace",
              background: mode === m ? TEAL : "transparent",
              color: mode === m ? "#04100f" : TEAL, border: `1px solid ${TEAL}66` }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "2px 0 4px" }}>Animation</div>
      <select value={action} onChange={(e) => setAction(e.target.value as ActionId)} style={{ ...SELECT, marginBottom: 4 }}>
        {OFFSET_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
      </select>
      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "0 0 10px", lineHeight: 1.35 }}>
        ● Réglage LIVE quand <b style={{ color: TEAL }}>{ACTION_LABELS[action] ?? action}</b> joue. Mets-toi dans cet état (bouge, dégaine, attaque…) pour voir.
      </div>

      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "2px 0 4px" }}>Clip assigné à cette action</div>
      <select
        value={animClipStore.getOverride(avatar, mode, action) ?? ""}
        onChange={(e) => animClipStore.setOverride(avatar, mode, action, e.target.value || null)}
        style={{ ...SELECT, marginBottom: 10 }}>
        <option value="">(auto — résolution par défaut)</option>
        {animClipStore.listClips(avatar, mode).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "2px 0 4px" }}>Retourner vite (±180°)</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button style={btn} onClick={() => flip(0)}>⟲ Flip X</button>
        <button style={btn} onClick={() => flip(1)}>⟲ Flip Y</button>
        <button style={btn} onClick={() => flip(2)}>⟲ Flip Z</button>
      </div>

      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "2px 0 6px" }}>Rotation (rad)</div>
      <Slider label="rot X" value={off.rotation[0]} min={-PI} max={PI} step={0.02} onChange={(v) => setRot(0, v)} />
      <Slider label="rot Y" value={off.rotation[1]} min={-PI} max={PI} step={0.02} onChange={(v) => setRot(1, v)} />
      <Slider label="rot Z" value={off.rotation[2]} min={-PI} max={PI} step={0.02} onChange={(v) => setRot(2, v)} />

      <div style={{ fontSize: 10, color: "#7fb9b2", margin: "10px 0 6px" }}>Position (m)</div>
      <Slider label="pos X" value={off.position[0]} min={-1} max={1} step={0.01} onChange={(v) => setPos(0, v)} />
      <Slider label="pos Y" value={off.position[1]} min={-1} max={1} step={0.01} onChange={(v) => setPos(1, v)} />
      <Slider label="pos Z" value={off.position[2]} min={-1} max={1} step={0.01} onChange={(v) => setPos(2, v)} />

      <button onClick={() => characterOffsetStore.reset(avatar, mode, action)}
        style={{ width: "100%", marginTop: 14, padding: "7px", fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "transparent", color: TEAL, border: `1px solid ${TEAL}55`, borderRadius: 6, fontFamily: "monospace" }}>
        ↺ Réinitialiser (cet état · cette animation)
      </button>
      <div style={{ fontSize: 10, color: "#7fb9b2", marginTop: 10, lineHeight: 1.4 }}>
        Sauvegarde <b style={{ color: TEAL }}>{avatar} · {mode === "drawn" ? "dégainé" : "rangé"} · {ACTION_LABELS[action] ?? action}</b>.
        Mets-toi dans cet état (dégaine = F) pour caler la bonne anim. Perso à l'envers → <b style={{ color: TEAL }}>Flip X</b>.
      </div>
    </div>
  );
}
