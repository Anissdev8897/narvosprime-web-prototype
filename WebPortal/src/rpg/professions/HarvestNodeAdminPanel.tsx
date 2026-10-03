// professions/HarvestNodeAdminPanel.tsx — éditeur de nœuds de récolte (vert, F11).
// Choisit le métier (arbre/rocher/buisson), pose au clic, sélectionne via ✥ pour le
// gizmo, supprime. Même ergonomie que l'éditeur Portails (F10).
import { useEffect, type ReactNode } from "react";
import { useEditMode } from "../runtime/gameModeStore";
import { PROFESSIONS, getProfession } from "./professionCatalog";
import type { ProfessionId } from "./professionTypes";
import { harvestNodeAdminStore, useHarvestNodeAdmin } from "./harvestNodeAdminStore";
import { harvestNodeStore } from "./harvestNodeStore";
import { usePlacedHarvestNodes } from "./useHarvestNodeStore";
import { preloadHarvestModels } from "./harvestModelCatalog";

const GRN = "#5cb85c";
const GATHER_PROFS = PROFESSIONS.filter((p) => p.kind === "gather");

interface Props { open: boolean; onClose: () => void; currentMap: string; }

export function HarvestNodeAdminPanel({ open, onClose, currentMap }: Props) {
  const cfg = useHarvestNodeAdmin();
  const placed = usePlacedHarvestNodes(currentMap);
  // Préchauffe TOUS les modèles de récolte (arbres/rochers/buissons) à l'ouverture de
  // l'éditeur → poser un nœud ne parse plus le GLB au rendu = pas de freeze (pattern PNJ/arme).
  useEffect(() => { if (open) preloadHarvestModels(); }, [open]);
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", top: 60, right: 366, zIndex: 250, width: 320,
      background: "rgba(8, 18, 10, 0.94)", border: `1px solid ${GRN}59`, borderRadius: 12, padding: 18,
      color: "#dff0df", fontFamily: "monospace", fontSize: 12,
      boxShadow: `0 0 36px ${GRN}30, 0 0 80px rgba(0,0,0,0.6)`, backdropFilter: "blur(8px)",
      maxHeight: "82vh", overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${GRN}33` }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.22em", color: GRN, textTransform: "uppercase" }}>🪓 Nœuds de récolte · F11</div>
        <button onClick={onClose} style={{ background: "transparent", color: GRN, border: `1px solid ${GRN}55`, borderRadius: 6, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }}>✕</button>
      </div>

      {/* Métier du nœud */}
      <Label>Type de nœud (métier)</Label>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {GATHER_PROFS.map((p) => (
          <button key={p.id} onClick={() => harvestNodeAdminStore.set({ profession: p.id as ProfessionId })}
            style={{ flex: 1, padding: "7px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer",
              background: cfg.profession === p.id ? p.color : `${GRN}12`, color: cfg.profession === p.id ? "#08120a" : "#cfe6cf",
              border: `1px solid ${p.color}66`, borderRadius: 5, fontFamily: "monospace" }}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#8fb38f", marginBottom: 10 }}>
        {nodeHint(cfg.profession)}
      </div>

      {/* Mode placement */}
      <button onClick={() => harvestNodeAdminStore.set({ placementActive: !cfg.placementActive, selectedId: null })}
        style={{ width: "100%", padding: "8px", fontSize: 11, fontWeight: 900, cursor: "pointer",
          background: cfg.placementActive ? GRN : `${GRN}18`, color: cfg.placementActive ? "#08120a" : GRN,
          border: `1px solid ${GRN}`, borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
        🎯 {cfg.placementActive ? "Placement actif — clique dans la scène" : "Placer un nœud"}
      </button>

      {/* Gizmo de transformation (nœud sélectionné via ✥) */}
      {cfg.selectedId && (
        <div style={{ marginTop: 10, padding: 8, border: `1px solid ${GRN}33`, borderRadius: 6, background: `${GRN}0d` }}>
          <Label>Gizmo — nœud sélectionné</Label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["translate", "rotate"] as const).map((m) => (
              <button key={m} onClick={() => harvestNodeAdminStore.set({ gizmoMode: m })}
                style={{ flex: 1, padding: "5px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: cfg.gizmoMode === m ? GRN : `${GRN}12`, color: cfg.gizmoMode === m ? "#08120a" : "#cfe6cf",
                  border: `1px solid ${GRN}40`, borderRadius: 5, fontFamily: "monospace" }}>
                {m === "translate" ? "✥ Déplacer" : "⟳ Tourner"}
              </button>
            ))}
            <button onClick={() => harvestNodeAdminStore.set({ selectedId: null })}
              style={{ padding: "5px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "transparent", color: "#aed6ae", border: `1px solid ${GRN}40`, borderRadius: 5, fontFamily: "monospace" }}>✕</button>
          </div>
        </div>
      )}

      {/* Liste des nœuds posés */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${GRN}22`, paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Label>Nœuds sur cette map ({placed.length})</Label>
          {placed.length > 0 && <button onClick={() => harvestNodeStore.clear(currentMap)} style={{ background: "transparent", color: "#aed6ae", border: `1px solid ${GRN}40`, borderRadius: 5, padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>Tout supprimer</button>}
        </div>
        {placed.map((n) => {
          const def = getProfession(n.profession);
          return (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", fontSize: 10, background: cfg.selectedId === n.id ? `${GRN}1f` : "transparent", borderRadius: 5 }}>
              <span style={{ flex: 1, color: "#dff0df" }}>{def.icon} {def.label}</span>
              <button title="Déplacer / tourner (gizmo)" onClick={() => harvestNodeAdminStore.set({ selectedId: cfg.selectedId === n.id ? null : n.id, placementActive: false })}
                style={{ background: cfg.selectedId === n.id ? GRN : "transparent", border: `1px solid ${GRN}66`, color: cfg.selectedId === n.id ? "#08120a" : GRN, borderRadius: 5, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>✥</button>
              <button title="Supprimer" onClick={() => harvestNodeStore.remove(currentMap, n.id)}
                style={{ background: "transparent", border: `1px solid ${GRN}55`, color: GRN, borderRadius: 5, padding: "1px 7px", fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function nodeHint(p: ProfessionId): string {
  if (p === "mineur") return "Rocher de minerai — extrait fer / cristal / adamantite.";
  if (p === "recolteur") return "Buisson — cueille herbes / fleurs / essences.";
  return "Arbre — coupe bois usé → légendaire selon ton niveau.";
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10, color: "#9cc79c", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>{children}</div>;
}

// ── Bouton flottant 🌱 VERT (sous le violet Donjon, top 206) ───────────────────
export function HarvestNodeAdminFloatingButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button onClick={onClick} title="Nœuds de récolte (F11)"
      style={{ position: "fixed", top: 206, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(8, 18, 10, 0.85)", border: `2px solid ${GRN}`, color: GRN, fontSize: 20, fontWeight: 900,
        cursor: "pointer", boxShadow: `0 0 18px ${GRN}73`, fontFamily: "monospace",
        display: "flex", alignItems: "center", justifyContent: "center" }}>🌱</button>
  );
}
