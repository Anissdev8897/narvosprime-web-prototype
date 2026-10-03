// props/PropAdminPanel.tsx — panneau admin pour placer des props (décors) sur la map.
// Thème cyan, miroir du NpcAdminPanel (rouge). Monté si admin + panneau ouvert.
// Bouton flottant ⬡ pour ouvrir/fermer.
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useEditMode } from "../runtime/gameModeStore";
import { PROP_CATALOG, getPropDef } from "./propCatalog";
import { propPlacementStore, makePropUid, type PlacedProp } from "./propPlacementStore";

const CYAN = "#4de8ff";

// ── Hooks internes ─────────────────────────────────────────────────────────────

/** Hook réactif : liste des props placés pour la map donnée. */
function usePropPlacements(mapId: string): PlacedProp[] {
  useSyncExternalStore(propPlacementStore.subscribe, propPlacementStore.getVersion, propPlacementStore.getVersion);
  return propPlacementStore.getForMap(mapId);
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PropAdminState {
  /** id du prop sélectionné dans le catalogue (pour le prochain placement). */
  catalogPropId: string;
  /** uid du prop placé actuellement sélectionné pour le gizmo (null = aucun). */
  selectedUid: string | null;
  /** Mode du gizmo de transformation. */
  gizmoMode: "translate" | "rotate" | "scale";
}

// ── Composant principal ────────────────────────────────────────────────────────

interface PanelProps {
  open: boolean;
  onClose: () => void;
  currentMap: string;
  /** State admin partagé avec PropPlacer (gizmo). */
  adminState: PropAdminState;
  onAdminStateChange: (patch: Partial<PropAdminState>) => void;
}

export function PropAdminPanel({ open, onClose, currentMap, adminState, onAdminStateChange }: PanelProps) {
  const placed = usePropPlacements(currentMap);
  if (!open) return null;

  /** Ajoute un nouveau prop à la position (0,0,0) par défaut. */
  const handlePlace = () => {
    const def = getPropDef(adminState.catalogPropId);
    if (!def) return;
    const s = def.defaultScale;
    const newProp: PlacedProp = {
      uid: makePropUid(),
      propId: def.id,
      mapId: currentMap,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [s, s, s],
    };
    propPlacementStore.add(newProp);
    // Sélectionne automatiquement le prop fraîchement placé
    onAdminStateChange({ selectedUid: newProp.uid });
  };

  return (
    <div style={{
      position: "fixed", top: 60, right: 366, zIndex: 500, width: 320,
      background: "rgba(8, 14, 18, 0.94)", border: `1px solid ${CYAN}59`, borderRadius: 12, padding: 18,
      color: "#d6f0ff", fontFamily: "monospace", fontSize: 12,
      boxShadow: `0 0 36px ${CYAN}30, 0 0 80px rgba(0,0,0,0.6)`, backdropFilter: "blur(8px)",
      maxHeight: "82vh", overflowY: "auto",
    }}>
      {/* En-tête */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${CYAN}33` }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.28em", color: CYAN, textTransform: "uppercase" }}>⬡ Éditeur Props</div>
        <button onClick={onClose} style={{ background: "transparent", color: CYAN, border: `1px solid ${CYAN}55`, borderRadius: 6, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace", fontWeight: 700 }}>✕</button>
      </div>

      {/* Sélection dans le catalogue */}
      <Label>Prop à placer</Label>
      <select
        value={adminState.catalogPropId}
        onChange={(e) => onAdminStateChange({ catalogPropId: e.target.value })}
        style={{
          width: "100%", marginBottom: 10, padding: 5,
          background: "#0a1215", color: "#d6f0ff", border: `1px solid ${CYAN}40`,
          borderRadius: 5, fontFamily: "monospace", fontSize: 11,
        }}
      >
        {PROP_CATALOG.map((p) => (
          <option key={p.id} value={p.id}>{p.label} ({p.category})</option>
        ))}
      </select>

      {/* Bouton placer */}
      <button
        onClick={handlePlace}
        style={{
          width: "100%", padding: "8px", fontSize: 11, fontWeight: 900, cursor: "pointer",
          background: `${CYAN}18`, color: CYAN, border: `1px solid ${CYAN}`,
          borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase",
        }}
      >
        ⬡ Placer sur la map
      </button>

      {/* Gizmo de transformation (prop sélectionné) */}
      {adminState.selectedUid && (
        <div style={{ marginTop: 10, padding: 8, border: `1px solid ${CYAN}33`, borderRadius: 6, background: `${CYAN}0d` }}>
          <Label>Gizmo — Prop sélectionné</Label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["translate", "rotate", "scale"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onAdminStateChange({ gizmoMode: m })}
                style={{
                  flex: 1, padding: "5px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: adminState.gizmoMode === m ? CYAN : `${CYAN}12`,
                  color: adminState.gizmoMode === m ? "#0a1215" : "#b3e8ff",
                  border: `1px solid ${CYAN}40`, borderRadius: 5, fontFamily: "monospace",
                }}
              >
                {m === "translate" ? "✥ Déplacer" : m === "rotate" ? "⟳ Tourner" : "⤢ Échelle"}
              </button>
            ))}
            <button
              onClick={() => onAdminStateChange({ selectedUid: null })}
              style={{
                padding: "5px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                background: "transparent", color: "#9ad4ff", border: `1px solid ${CYAN}40`,
                borderRadius: 5, fontFamily: "monospace",
              }}
            >✕</button>
          </div>
        </div>
      )}

      {/* Liste des props placés sur cette map */}
      <div style={{ marginTop: 14, borderTop: `1px solid ${CYAN}22`, paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Label>Props placés ({placed.length})</Label>
          {placed.length > 0 && (
            <button
              onClick={() => propPlacementStore.clear(currentMap)}
              style={{
                background: "transparent", color: "#8ad4ff", border: `1px solid ${CYAN}40`,
                borderRadius: 5, padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace",
              }}
            >Tout supprimer</button>
          )}
        </div>

        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {placed.map((p) => {
            const def = getPropDef(p.propId);
            const label = def?.label ?? p.propId;
            const sel = adminState.selectedUid === p.uid;
            const posStr = `(${p.position[0].toFixed(1)}, ${p.position[1].toFixed(1)}, ${p.position[2].toFixed(1)})`;
            return (
              <div key={p.uid} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", fontSize: 10,
                background: sel ? `${CYAN}1f` : "transparent", borderRadius: 5,
              }}>
                <span style={{ flex: 1, color: "#d6f0ff" }}>
                  {label} <span style={{ color: "#7098a8" }}>{posStr}</span>
                </span>
                <button
                  title="Sélectionner (gizmo)"
                  onClick={() => onAdminStateChange({ selectedUid: sel ? null : p.uid })}
                  style={{
                    background: sel ? CYAN : "transparent", border: `1px solid ${CYAN}66`,
                    color: sel ? "#0a1215" : CYAN, borderRadius: 5, padding: "1px 6px",
                    fontSize: 11, cursor: "pointer",
                  }}
                >✥</button>
                <button
                  title="Supprimer"
                  onClick={() => {
                    if (sel) onAdminStateChange({ selectedUid: null });
                    propPlacementStore.remove(p.uid);
                  }}
                  style={{
                    background: "transparent", border: `1px solid ${CYAN}55`, color: CYAN,
                    borderRadius: 5, padding: "1px 7px", fontSize: 11, cursor: "pointer",
                  }}
                >✕</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Label utilitaire (style uniforme) ──────────────────────────────────────────

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10, color: "#88c8d8", letterSpacing: "0.14em",
      textTransform: "uppercase", marginBottom: 6, fontWeight: 700,
    }}>{children}</div>
  );
}

// ── Bouton flottant ⬡ CYAN ────────────────────────────────────────────────────

export function PropAdminFloatingButton({ onClick }: { onClick: () => void }) {
  if (!useEditMode()) return null;
  return (
    <button
      onClick={onClick}
      title="Éditeur Props (décors)"
      style={{
        position: "fixed", top: 160, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
        background: "rgba(8, 14, 18, 0.85)", border: `2px solid ${CYAN}`, color: CYAN,
        fontSize: 20, fontWeight: 900, cursor: "pointer", boxShadow: `0 0 18px ${CYAN}73`,
        fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >⬡</button>
  );
}

// ── Hook pour initialiser le state admin depuis le parent ──────────────────────

/** Crée le state admin initial pour PropAdminPanel + PropPlacer. */
export function useInitialPropAdminState(): [PropAdminState, (patch: Partial<PropAdminState>) => void] {
  const [adminState, setAdminState] = useState<PropAdminState>({
    catalogPropId: PROP_CATALOG[0]?.id ?? "",
    selectedUid: null,
    gizmoMode: "translate",
  });

  const updateState = (patch: Partial<PropAdminState>) => {
    setAdminState((prev) => ({ ...prev, ...patch }));
  };

  return [adminState, updateState];
}
