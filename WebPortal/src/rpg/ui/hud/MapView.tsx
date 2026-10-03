// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/MapView.tsx — Carte plein écran (touche M) (SPECS §3)
//
// Affiche la forme complète de la map courante avec biomes, zones d'alliance,
// fog of war et position du joueur. Utilise Canvas 2D.
// Accessible via la touche M dans GameEngine.
// ══════════════════════════════════════════════════════════════════════════════

import { SceneMode, type Faction, type Vector3 } from "../../../types";
import type { MapData } from "./hudTypes";

export interface MapViewProps {
  isOpen: boolean;
  onClose: () => void;
  playerPosition: Vector3;
  playerFaction: Faction;
  planetId: string | null;
  sceneMode: SceneMode;
}

/**
 * Carte plein écran avec fog of war, biomes et zones d'alliance.
 * Stub — retourne null quand fermée, sinon un div placeholder.
 * L'implémentation Canvas 2D complète est à venir.
 */
export function MapView(props: MapViewProps): React.ReactNode {
  if (!props.isOpen) return null;

  // Placeholder minimal pour que tsc valide le return type
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ color: "#3b82f6", fontFamily: "monospace", fontSize: 24 }}>
        MAP — {props.planetId ?? "HUB"}
      </div>
    </div>
  );
}
