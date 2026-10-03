// weapons/WeaponOffsetAdmin.tsx — "InGameWeaponEditorTool" : calibrage d'arme LIVE.
//
// Règle l'offset (position/rotation/échelle) d'une arme sur le personnage, EN DIRECT,
// et le sauvegarde PAR COMBINAISON (type de perso × type d'arme) dans le
// weaponCalibrationStore. Ainsi « Guerrier + épée 1 main » a ses propres offsets,
// réutilisés par TOUTES les épées 1 main d'un guerrier — sans re-régler arme par arme.
//
// Aperçu temps réel : pour voir le réglage sur le joueur, sélectionne le type de perso
// = ton archétype actif et une arme du même type que celle équipée.
import { useEffect, useState } from "react";
import { useEditMode } from "../runtime/gameModeStore";
import { weaponRegistry } from "./weaponRegistry";
import { resolveOffset } from "./resolveOffset";
import { classifyWeapon } from "./weaponClassifier";
import { archetypeStore } from "../archetypes/archetypeStore";
import { weaponForArchetype } from "../archetypes/archetypeWeapon";
import type { ArchetypeId } from "../archetypes/archetypeCatalog";
import {
  weaponCalibrationStore, useWeaponCalibration, CHARACTER_KINDS, type CharacterKind, type CalibMode,
} from "./weaponCalibrationStore";
import { weaponEditorStore, useWeaponEditor, type GizmoMode } from "./weaponEditorStore";
import { useDraggablePanel } from "../runtime/admin/useDraggablePanel";

const ORANGE = "#ff9d3c";

const GIZMO_MODES: { id: GizmoMode; label: string }[] = [
  { id: "off",       label: "Off" },
  { id: "translate", label: "⬌ Déplacer" },
  { id: "rotate",    label: "⟳ Tourner" },
  { id: "scale",     label: "⤢ Échelle" },
];

/** Barre de modes du gizmo 3D — manipule l'arme ÉQUIPÉE directement dans la scène. */
function GizmoBar() {
  useWeaponEditor();
  const mode = weaponEditorStore.getMode();
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
      {GIZMO_MODES.map((g) => (
        <button key={g.id} onClick={() => weaponEditorStore.setMode(g.id)}
          style={{ flex: 1, padding: "5px 2px", fontSize: 10, fontWeight: 800, cursor: "pointer", borderRadius: 5,
            fontFamily: "monospace",
            background: mode === g.id ? ORANGE : "transparent",
            color: mode === g.id ? "#1c130a" : ORANGE,
            border: `1px solid ${ORANGE}66` }}>
          {g.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#ffe0c0" }}>
      <span style={{ width: 58 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 52, textAlign: "right", fontFamily: "monospace" }}>{value.toFixed(3)}</span>
    </label>
  );
}

export function WeaponOffsetAdminButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Calibrage d'arme (offset par classe × type)"
      style={{ position: "fixed", top: 302, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(22,14,6,0.85)", border: `2px solid ${ORANGE}`, color: ORANGE, fontSize: 20, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${ORANGE}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>🔧</button>
  );
}

const SELECT_STYLE: React.CSSProperties = {
  width: "100%", padding: 5, background: "#1c130a", color: "#ffe8d0",
  border: `1px solid ${ORANGE}40`, borderRadius: 5, fontFamily: "monospace",
};

export function WeaponOffsetAdmin({ open, onClose }: { open: boolean; onClose: () => void }) {
  useWeaponCalibration(); // re-render au réglage
  const { dragHandlers, dragStyle, transform } = useDraggablePanel();
  const weapons = weaponRegistry.all();
  // Défaut : type de perso = archétype actif (→ aperçu live), arme = 1re du registre.
  const [kind, setKind] = useState<CharacterKind>((archetypeStore.get() as CharacterKind) ?? "guerrier");
  // Défaut = arme RÉELLEMENT équipée par l'archétype joué → le calibrage vise le bon TYPE
  // d'arme, donc l'arme suit les modifs en jeu après fermeture (sinon on réglait weapons[0]
  // = un autre type, et l'arme équipée ne bougeait pas).
  const [selId, setSelId] = useState<string>(
    weaponForArchetype(archetypeStore.get() as ArchetypeId | null) ?? weapons[0]?.id ?? ""
  );
  // Mode réglé : DÉGAINÉE (en main) ou RANGÉE (au repos). Deux offsets distincts par combo.
  const [calMode, setCalMode] = useState<CalibMode>("drawn");
  // Panneau ouvert → on ÉQUIPE l'arme sélectionnée + on FORCE l'aperçu du mode réglé
  // (l'arme se place selon dégainé/rangé sans avoir à la sortir/ranger en jeu).
  // Panneau fermé → gizmo off + arme de classe par défaut + aperçu suit le joueur.
  useEffect(() => {
    if (open) {
      weaponEditorStore.setForcedWeaponId(selId);
      weaponEditorStore.setPreviewMode(calMode);
      weaponEditorStore.setFreezePose(true);  // calibrage : perso FIGÉ (aucune anim) → réglages précis
    } else {
      weaponEditorStore.setMode("off");
      weaponEditorStore.setForcedWeaponId(null);
      weaponEditorStore.setPreviewMode(null);
      weaponEditorStore.setFreezePose(false);
    }
  }, [open, selId, calMode]);
  // Filet de sécurité : si le panneau est DÉMONTÉ (parent {open && <…/>}) sans repasser
  // par la branche else, on libère quand même l'aperçu forcé + le gel de pose.
  useEffect(() => () => { weaponEditorStore.setPreviewMode(null); weaponEditorStore.setFreezePose(false); }, []);
  if (!open) return null;

  const profile = weaponRegistry.get(selId);
  if (!profile) return null;

  // Le calibrage est PAR TYPE d'arme (pas par arme exacte) → toutes les armes du même
  // type héritent du réglage. On dérive le type depuis le profil (ou son chemin).
  const weaponType = (profile.type || classifyWeapon(profile.path)) as string;

  const base = resolveOffset(profile, "mixamo");
  const cal = weaponCalibrationStore.getExact(kind, weaponType, calMode);
  const pos = cal?.position ?? base.position;
  const rot = cal?.rotation ?? base.rotation;
  const scale = cal?.scale ?? base.scale; // base.scale=1 par défaut (l'auto-scale s'applique si non réglé)

  // Ne transmettre QUE le champ modifié : le store fusionne par-dessus l'existant.
  // (Sinon bouger la position réécrirait scale=1 et casserait l'auto-scale.)
  const apply = (patch: { position?: [number, number, number]; rotation?: [number, number, number]; scale?: number }) =>
    weaponCalibrationStore.set(kind, weaponType, patch, calMode);

  const liveKind = archetypeStore.get();
  const isLive = liveKind === kind; // aperçu direct uniquement si on règle l'archétype joué

  return (
    <div style={{
      position: "fixed", top: 60, right: 66, zIndex: 250, width: 330, maxHeight: "84vh", overflowY: "auto",
      background: "rgba(18,12,6,0.96)", border: `1px solid ${ORANGE}59`, borderRadius: 12, padding: 16,
      color: "#ffe8d0", fontFamily: "monospace", fontSize: 12, boxShadow: `0 0 36px ${ORANGE}30`, transform,
    }}>
      <div {...dragHandlers} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, ...dragStyle }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", color: ORANGE }}>🔧 CALIBRAGE D'ARME</div>
        <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()}
          style={{ background: "transparent", color: ORANGE, border: `1px solid ${ORANGE}55`, borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>

      <div style={{ fontSize: 10, color: "#c79a6a", margin: "2px 0 4px" }}>Gizmo 3D — manipule l'arme équipée (sauvé au relâché)</div>
      <GizmoBar />

      {/* Mode réglé : DÉGAINÉE (combat) vs RANGÉE (repos). Aperçu forcé sur le mode choisi. */}
      <div style={{ fontSize: 10, color: "#c79a6a", margin: "8px 0 4px" }}>Mode de port (2 offsets distincts)</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {([["drawn", "⚔ Dégainée"], ["sheathed", "🛡 Rangée"]] as [CalibMode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setCalMode(m)}
            style={{ flex: 1, padding: "6px 2px", fontSize: 11, fontWeight: 800, cursor: "pointer", borderRadius: 5,
              fontFamily: "monospace",
              background: calMode === m ? ORANGE : "transparent",
              color: calMode === m ? "#1c130a" : ORANGE,
              border: `1px solid ${ORANGE}66` }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10, color: "#c79a6a", margin: "2px 0 4px" }}>Type de personnage</div>
      <select value={kind} onChange={(e) => setKind(e.target.value as CharacterKind)} style={{ ...SELECT_STYLE, marginBottom: 10 }}>
        {CHARACTER_KINDS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      <div style={{ fontSize: 10, color: "#c79a6a", margin: "2px 0 4px" }}>Arme (→ type : <b style={{ color: ORANGE }}>{weaponType}</b>)</div>
      <select value={selId} onChange={(e) => setSelId(e.target.value)} style={{ ...SELECT_STYLE, marginBottom: 6 }}>
        {weapons.map((w) => <option key={w.id} value={w.id}>{w.id} ({w.type})</option>)}
      </select>

      <div style={{ fontSize: 10, color: isLive ? "#8fe388" : "#c79a6a", margin: "0 0 10px", lineHeight: 1.35 }}>
        {isLive
          ? "● Aperçu LIVE : réglage visible sur ton perso (même classe). Équipe une arme de ce type."
          : `Réglage hors-ligne (ton archétype = ${liveKind ?? "aucun"}). Sauvé pour « ${CHARACTER_KINDS.find((c) => c.id === kind)?.label} ».`}
      </div>

      <div style={{ fontSize: 10, color: "#c79a6a", margin: "2px 0 6px" }}>Position (m)</div>
      <Slider label="pos X" value={pos[0]} min={-0.5} max={0.5} step={0.005} onChange={(v) => apply({ position: [v, pos[1], pos[2]] })} />
      <Slider label="pos Y" value={pos[1]} min={-0.5} max={0.5} step={0.005} onChange={(v) => apply({ position: [pos[0], v, pos[2]] })} />
      <Slider label="pos Z" value={pos[2]} min={-0.5} max={0.5} step={0.005} onChange={(v) => apply({ position: [pos[0], pos[1], v] })} />

      <div style={{ fontSize: 10, color: "#c79a6a", margin: "10px 0 6px" }}>Rotation (rad)</div>
      <Slider label="rot X" value={rot[0]} min={-Math.PI} max={Math.PI} step={0.05} onChange={(v) => apply({ rotation: [v, rot[1], rot[2]] })} />
      <Slider label="rot Y" value={rot[1]} min={-Math.PI} max={Math.PI} step={0.05} onChange={(v) => apply({ rotation: [rot[0], v, rot[2]] })} />
      <Slider label="rot Z" value={rot[2]} min={-Math.PI} max={Math.PI} step={0.05} onChange={(v) => apply({ rotation: [rot[0], rot[1], v] })} />

      <div style={{ fontSize: 10, color: "#c79a6a", margin: "10px 0 6px" }}>Échelle <span style={{ color: "#8a6a44" }}>(0 = auto par bbox)</span></div>
      <Slider label="échelle" value={scale} min={0} max={3} step={0.005} onChange={(v) => apply({ scale: v === 0 ? undefined : v })} />

      <button onClick={() => weaponCalibrationStore.reset(kind, weaponType, calMode)}
        style={{ width: "100%", marginTop: 14, padding: "7px", fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "transparent", color: ORANGE, border: `1px solid ${ORANGE}55`, borderRadius: 6, fontFamily: "monospace" }}>
        ↺ Réinitialiser ({calMode === "drawn" ? "dégainée" : "rangée"})
      </button>
      <div style={{ fontSize: 10, color: "#c79a6a", marginTop: 10, lineHeight: 1.4 }}>
        Sauvegarde <b style={{ color: ORANGE }}>{CHARACTER_KINDS.find((c) => c.id === kind)?.label} × {weaponType}</b>.
        Toutes les armes de ce type, sur cette classe, hériteront de ce réglage.
      </div>
    </div>
  );
}
