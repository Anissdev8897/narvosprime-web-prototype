// runtime/donjon/DonjonAdminPanel.tsx — panneau admin DONJON (violet, F10).
// Pose un portail (clic), choisit la map cible + la quête de déverrouillage + le
// mode de verrou, override admin pour tester, et liste les portails de la map.
import type { ReactNode } from "react";
import { useEditMode } from "../gameModeStore";
import { MAPS } from "../../loaders/assetManifest";
import { QUESTS } from "../../quests/questCatalog";
import { portalAdminStore } from "./portalAdminStore";
import { portalStore } from "./portalStore";
import { usePortalAdmin } from "./usePortalAdmin";
import { usePortals } from "./usePortals";
import type { LockMode } from "./portalStore";

const VIO = "#a06bff";

interface Props { open: boolean; onClose: () => void; currentMap: string; }

export function DonjonAdminPanel({ open, onClose, currentMap }: Props) {
  const cfg = usePortalAdmin();
  const placed = usePortals(currentMap);
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", top: 60, right: 366, zIndex: 250, width: 320,
      background: "rgba(14, 8, 22, 0.94)", border: `1px solid ${VIO}59`, borderRadius: 12, padding: 18,
      color: "#e6d6ff", fontFamily: "monospace", fontSize: 12,
      boxShadow: `0 0 36px ${VIO}30, 0 0 80px rgba(0,0,0,0.6)`, backdropFilter: "blur(8px)",
      maxHeight: "82vh", overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${VIO}33` }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.22em", color: VIO, textTransform: "uppercase" }}>⚙ Portails Donjon · F10</div>
        <button onClick={onClose} style={{ background: "transparent", color: VIO, border: `1px solid ${VIO}55`, borderRadius: 6, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }}>✕</button>
      </div>

      {/* Map cible (instance) */}
      <Label>Instance cible</Label>
      <select value={cfg.target} onChange={(e) => portalAdminStore.set({ target: e.target.value })}
        style={selStyle}>
        {Object.keys(MAPS).map((k) => <option key={k} value={k}>{MAPS[k].label} ({k})</option>)}
      </select>

      {/* Quête de déverrouillage */}
      <Label>Quête de déverrouillage</Label>
      <select value={cfg.unlockQuest} onChange={(e) => portalAdminStore.set({ unlockQuest: e.target.value })}
        style={selStyle}>
        <option value="">— aucune (verrouillé sauf override) —</option>
        {QUESTS.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
      </select>

      {/* Mode de verrou */}
      <Label>Condition d'ouverture</Label>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {(["active", "completed"] as LockMode[]).map((m) => (
          <button key={m} onClick={() => portalAdminStore.set({ lockMode: m })}
            style={{ flex: 1, padding: "6px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer",
              background: cfg.lockMode === m ? VIO : `${VIO}12`, color: cfg.lockMode === m ? "#160a22" : "#cdb3ff",
              border: `1px solid ${VIO}40`, borderRadius: 5, textTransform: "uppercase", fontFamily: "monospace" }}>
            {m === "active" ? "Quête active" : "Quête terminée"}
          </button>
        ))}
      </div>

      {/* Ouverture admin — PERSISTÉE + PARTAGÉE (tous les joueurs, survit au reload) */}
      <button onClick={() => portalAdminStore.set({ adminUnlock: !cfg.adminUnlock })}
        style={{ width: "100%", marginBottom: 4, padding: "7px", fontSize: 11, fontWeight: 900, cursor: "pointer",
          background: cfg.adminUnlock ? "#7ce0a0" : `${VIO}12`, color: cfg.adminUnlock ? "#06140b" : "#7ce0a0",
          border: "1px solid #7ce0a066", borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
        🔓 Donjon ouvert (tous) : {cfg.adminUnlock ? "OUVERT" : "FERMÉ"}
      </button>
      <div style={{ fontSize: 9, color: "#8f77b8", marginBottom: 10, lineHeight: 1.35 }}>
        Sauvegardé + partagé : reste ouvert pour tous les joueurs jusqu'à fermeture.
      </div>

      {/* Mode placement */}
      <button onClick={() => portalAdminStore.set({ placementActive: !cfg.placementActive, selectedId: null })}
        style={{ width: "100%", padding: "8px", fontSize: 11, fontWeight: 900, cursor: "pointer",
          background: cfg.placementActive ? VIO : `${VIO}18`, color: cfg.placementActive ? "#0e0816" : VIO,
          border: `1px solid ${VIO}`, borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
        🎯 {cfg.placementActive ? "Placement actif — clique dans la scène" : "Placer un portail"}
      </button>

      {/* Gizmo de transformation (portail sélectionné via ✥) */}
      {cfg.selectedId && (
        <div style={{ marginTop: 10, padding: 8, border: `1px solid ${VIO}33`, borderRadius: 6, background: `${VIO}0d` }}>
          <Label>Gizmo — portail sélectionné</Label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["translate", "rotate"] as const).map((m) => (
              <button key={m} onClick={() => portalAdminStore.set({ gizmoMode: m })}
                style={{ flex: 1, padding: "5px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: cfg.gizmoMode === m ? VIO : `${VIO}12`, color: cfg.gizmoMode === m ? "#0e0816" : "#cdb3ff",
                  border: `1px solid ${VIO}40`, borderRadius: 5, fontFamily: "monospace" }}>
                {m === "translate" ? "✥ Déplacer" : "⟳ Tourner"}
              </button>
            ))}
            <button onClick={() => portalAdminStore.set({ selectedId: null })}
              style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "transparent", color: "#c89aff", border: `1px solid ${VIO}40`, borderRadius: 5, fontFamily: "monospace" }}>✕</button>
          </div>
        </div>
      )}

      {/* Liste des portails posés */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${VIO}22`, paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Label>Portails sur cette map ({placed.length})</Label>
          {placed.length > 0 && <button onClick={() => portalStore.clear(currentMap)} style={{ background: "transparent", color: "#c89aff", border: `1px solid ${VIO}40`, borderRadius: 5, padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>Tout supprimer</button>}
        </div>
        {placed.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", fontSize: 10, background: cfg.selectedId === p.id ? `${VIO}1f` : "transparent", borderRadius: 5 }}>
            <span style={{ flex: 1, color: "#e6d6ff" }}>🌀 → {MAPS[p.target]?.label ?? p.target} <span style={{ color: "#8f77b8" }}>{p.unlockQuest ? `· ${p.lockMode === "completed" ? "fini" : "actif"}` : "· libre"}</span></span>
            <button title="Déplacer / tourner (gizmo)" onClick={() => portalAdminStore.set({ selectedId: cfg.selectedId === p.id ? null : p.id, placementActive: false })}
              style={{ background: cfg.selectedId === p.id ? VIO : "transparent", border: `1px solid ${VIO}66`, color: cfg.selectedId === p.id ? "#0e0816" : VIO, borderRadius: 5, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>✥</button>
            <button title="Supprimer" onClick={() => portalStore.remove(currentMap, p.id)}
              style={{ background: "transparent", border: `1px solid ${VIO}55`, color: VIO, borderRadius: 5, padding: "1px 7px", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = {
  width: "100%", marginBottom: 10, padding: 5, background: "#150e22", color: "#e6d6ff",
  border: `1px solid ${VIO}40`, borderRadius: 5, fontFamily: "monospace", fontSize: 11,
};

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10, color: "#b39ad6", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>{children}</div>;
}

// ── Bouton flottant ⚙ VIOLET (sous le rouge PNJ) ───────────────────────────
export function DonjonAdminFloatingButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Portails Donjon (F10)"
      style={{ position: "fixed", top: 158, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(14, 8, 22, 0.85)", border: `2px solid ${VIO}`, color: VIO, fontSize: 20, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${VIO}73`, fontFamily: "monospace",
        display: "flex", alignItems: "center", justifyContent: "center" }}>⚙</button>
  );
}
