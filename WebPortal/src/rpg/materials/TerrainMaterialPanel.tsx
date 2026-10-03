// ══════════════════════════════════════════════════════════════════════════════
// materials/TerrainMaterialPanel.tsx — Éditeur de couches de terrain (P3).
//
// Choisit quelle matière habille les surfaces plates, la transition et les
// parois, et où se situe la frontière entre les deux. Le rendu se met à jour
// SANS rechargement : la bibliothèque entière est en VRAM depuis le démarrage
// (cf. `allLayerTextureUrls`), donc changer de couche ne coûte qu'une
// recompilation de shader.
//
// DOM pur, hors Canvas — comme `StreamingDebugHud`. Le monde 3D ne se re-rend
// pas via React : il lit `autoMaterialGeneration()` à chaque frame.
// ══════════════════════════════════════════════════════════════════════════════

import { TERRAIN_LAYERS, TERRAIN_LAYER_ORDER, type TerrainLayerId } from "./autoMaterialConfig";
import {
  useTerrainSelection, setTerrainSelection, resetTerrainSelection,
} from "./terrainMaterialStore";

const CYAN = "#4fc3f7";

/** Une pastille de couche. La couleur vient de `tint`, cf. TERRAIN_LAYERS. */
function LayerChip({ id, active, onPick }: {
  id: TerrainLayerId; active: boolean; onPick: () => void;
}) {
  const layer = TERRAIN_LAYERS[id];
  return (
    <button
      type="button"
      onClick={onPick}
      title={`${layer.label} — carreau de ${layer.tileSize} unités monde`}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "3px 8px 3px 4px", borderRadius: 999, cursor: "pointer",
        fontFamily: "inherit", fontSize: 10.5, lineHeight: 1,
        border: `1px solid ${active ? CYAN : "#ffffff22"}`,
        background: active ? `${CYAN}1f` : "transparent",
        color: active ? CYAN : "#94a3b8",
        transition: "border-color 120ms, background 120ms, color 120ms",
      }}
    >
      <span style={{
        width: 12, height: 12, borderRadius: "50%", background: layer.tint,
        boxShadow: "inset 0 0 0 1px #00000055", flex: "0 0 auto",
      }} />
      {layer.label}
    </button>
  );
}

/** Une ligne « rôle → choix de couche ». `nullable` autorise « aucune ». */
function LayerRow({ label, hint, value, nullable, onPick }: {
  label: string;
  hint: string;
  value: TerrainLayerId | null;
  nullable?: boolean;
  onPick: (id: TerrainLayerId | null) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.06em" }}>
          {label.toUpperCase()}
        </span>
        <span style={{ color: "#64748b", fontSize: 9.5 }}>{hint}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {nullable && (
          <button
            type="button"
            onClick={() => onPick(null)}
            title="Transition directe entre surface plate et parois"
            style={{
              padding: "3px 9px", borderRadius: 999, cursor: "pointer",
              fontFamily: "inherit", fontSize: 10.5, lineHeight: 1,
              border: `1px solid ${value === null ? CYAN : "#ffffff22"}`,
              background: value === null ? `${CYAN}1f` : "transparent",
              color: value === null ? CYAN : "#94a3b8",
            }}
          >
            aucune
          </button>
        )}
        {TERRAIN_LAYER_ORDER.map((id) => (
          <LayerChip key={id} id={id} active={value === id} onPick={() => onPick(id)} />
        ))}
      </div>
    </div>
  );
}

function Slider({ label, hint, value, min, max, step, format, onChange }: {
  label: string; hint: string; value: number;
  min: number; max: number; step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ color: "#94a3b8", fontSize: 10.5 }}>
          {label} <span style={{ color: "#475569", fontSize: 9.5 }}>{hint}</span>
        </span>
        <b style={{ color: CYAN, fontSize: 10.5, fontVariantNumeric: "tabular-nums" }}>
          {format(value)}
        </b>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: CYAN, height: 16, cursor: "pointer" }}
      />
    </div>
  );
}

/** Pente → angle en degrés. `slope = 1 - |cos θ|`, donc `θ = acos(1 - slope)`. */
const asDegrees = (slope: number) =>
  `${Math.round((Math.acos(Math.max(-1, Math.min(1, 1 - slope))) * 180) / Math.PI)}°`;

export function TerrainMaterialPanel({ onClose }: { onClose?: () => void }) {
  const sel = useTerrainSelection();

  return (
    <div style={{
      position: "fixed", top: 60, right: 66, zIndex: 9000, width: 320,
      background: "rgba(5, 8, 14, 0.94)", border: "1px solid #1e3a5f",
      borderRadius: 8, padding: "10px 14px 12px",
      fontFamily: "Consolas, monospace", fontSize: 11, color: "#cbd5e1",
      lineHeight: 1.5, pointerEvents: "auto",
      boxShadow: "0 8px 32px #00000066",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: CYAN, fontWeight: 700 }}>⛰ MATIÈRE DU TERRAIN</span>
        {onClose && (
          <button
            type="button" onClick={onClose}
            style={{
              background: "transparent", border: "1px solid #ffffff22", borderRadius: 4,
              color: "#94a3b8", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: "1px 7px",
            }}
          >✕</button>
        )}
      </div>

      <LayerRow
        label="Surfaces plates" hint="sols, plateaux, dessus d'arches"
        value={sel.flat}
        onPick={(id) => id && setTerrainSelection({ flat: id })}
      />
      <LayerRow
        label="Transition" hint="entre les deux, culmine au milieu de la bande"
        value={sel.mid} nullable
        onPick={(mid) => setTerrainSelection({ mid })}
      />
      <LayerRow
        label="Parois" hint="falaises, flancs raides"
        value={sel.steep}
        onPick={(id) => id && setTerrainSelection({ steep: id })}
      />

      <div style={{ borderTop: "1px solid #1e3a5f", margin: "10px 0 8px" }} />

      <Slider
        label="Début de bascule" hint="la matière plate cède" value={sel.slopeStart}
        min={0} max={0.9} step={0.01} format={asDegrees}
        onChange={(v) => setTerrainSelection({ slopeStart: v })}
      />
      <Slider
        label="Fin de bascule" hint="les parois l'emportent" value={sel.slopeEnd}
        min={0.02} max={1} step={0.01} format={asDegrees}
        onChange={(v) => setTerrainSelection({ slopeEnd: v })}
      />
      <Slider
        label="Irrégularité" hint="casse la ligne de niveau" value={sel.variationStrength}
        min={0} max={0.4} step={0.01} format={(v) => v.toFixed(2)}
        onChange={(v) => setTerrainSelection({ variationStrength: v })}
      />

      {/* La variation DÉCALE la pente avant le seuil. Si son amplitude dépasse la
          largeur de la bande, elle peut à elle seule faire basculer une face
          plate en paroi : on voit alors des taches de roche au milieu d'un
          plateau — exactement le défaut qu'on a longtemps pris pour des trous. */}
      {sel.variationStrength >= sel.slopeEnd - sel.slopeStart && (
        <div style={{ color: "#fbbf24", fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>
          ⚠ L'irrégularité dépasse la largeur de la bande : des taches de parois
          vont apparaître en plein plateau. Élargir la bande ou baisser
          l'irrégularité.
        </div>
      )}

      <button
        type="button"
        onClick={() => resetTerrainSelection()}
        style={{
          width: "100%", marginTop: 10, padding: "5px", borderRadius: 4, cursor: "pointer",
          fontFamily: "inherit", fontSize: 10.5, background: "transparent",
          border: "1px solid #ffffff22", color: "#94a3b8",
        }}
      >
        ↺ Revenir au préréglage Forge
      </button>
    </div>
  );
}
