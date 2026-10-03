// ══════════════════════════════════════════════════════════════════════════════
// runtime/StreamingDebugHud.tsx — overlay de diagnostic streaming (toggle F10).
//
// Affiche : chunks chargés/en attente/échoués, budget VRAM WASM, textures GPU
// (compteur three.js + VRAM estimée), timings par chunk, erreurs de chargement.
// DOM pur (hors Canvas) — lit streamingDiagnostics + getStreamingStats().
// ══════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { streamingDiagnostics, useStreamingDiagnostics } from "./streamingDiagnostics";
import { getStreamingStats } from "../wasm/ChunkStreamingBridge";
import { getAssetBudgetStats } from "../wasm/AssetBudgetBridge";
import { toggleAutoMaterial, isAutoMaterialDisabled } from "../materials/autoMaterialStore";

/** Style d'un bouton de bascule — orange quand le système est coupé. */
function btn(off: boolean): React.CSSProperties {
  return {
    padding: "3px 8px",
    fontSize: 11,
    fontFamily: "inherit",
    cursor: "pointer",
    borderRadius: 4,
    border: `1px solid ${off ? "#fbbf24" : "#ffffff30"}`,
    background: off ? "#fbbf2422" : "transparent",
    color: off ? "#fbbf24" : "#94a3b8",
  };
}

const badge: Record<string, string> = {
  loaded: "#4ade80", loading: "#facc15", failed: "#f87171",
  pending: "#64748b", unloaded: "#94a3b8",
};

export function StreamingDebugHud({ onOpenTerrain }: { onOpenTerrain?: () => void } = {}) {
  useStreamingDiagnostics();
  // Re-poll 2×/s : stats WASM + gl.info ne sont pas réactifs
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const chunks = Array.from(streamingDiagnostics.get().values());
  const c = streamingDiagnostics.counts();
  const wasm = getStreamingStats();
  const budget = getAssetBudgetStats();
  const gl = streamingDiagnostics.getRenderer();
  const mem = gl?.info.memory;
  const render = gl?.info.render;
  const catEntries = Object.entries(budget.categoryUsedMB).filter(([, v]) => v > 0);

  return (
    <div style={{
      position: "fixed", top: 60, left: 12, zIndex: 9000,
      background: "rgba(5, 8, 14, 0.92)", border: "1px solid #1e3a5f",
      borderRadius: 8, padding: "10px 14px", minWidth: 340,
      fontFamily: "Consolas, monospace", fontSize: 11, color: "#cbd5e1",
      pointerEvents: "none", lineHeight: 1.5,
    }}>
      <div style={{ color: "#4fc3f7", fontWeight: 700, marginBottom: 6 }}>
        ⛁ STREAMING DIAGNOSTICS (F10)
      </div>

      <div>Chunks : <b style={{ color: "#4ade80" }}>{c.loaded}</b> chargés
        · <b style={{ color: "#facc15" }}>{c.loading}</b> en cours
        · <b style={{ color: "#64748b" }}>{c.pending}</b> en attente
        · <b style={{ color: c.failed ? "#f87171" : "#64748b" }}>{c.failed}</b> échoués
        · /{c.total}</div>

      <div>Budget WASM : <b>{wasm.budgetUsedMB.toFixed(0)} MB</b> utilisés
        · {wasm.loadedCount}/{wasm.chunkCount} chunks côté C++
        · {wasm.pendingCount} cmd en file</div>

      {/* BASCULES DE DIAGNOSTIC — en boutons, pas en raccourcis clavier.
          F6 et F7 étaient déjà pris (générateur de carte, stress-test) et les
          handlers ajoutés après eux étaient du code mort : la touche n'arrivait
          jamais. Un bouton ne peut pas entrer en collision. */}
      {/* pointerEvents:"auto" OBLIGATOIRE — le conteneur est en "none" pour que
          la souris traverse l'overlay et pilote la caméra. Sans ce rétablissement
          local, les boutons sont VISIBLES mais INERTES : aucun clic ne les
          atteint. C'est ce qui a fait croire pendant plusieurs sessions que le
          test discriminant avait été fait alors qu'il était impossible à faire. */}
      <div style={{ display: "flex", gap: 6, margin: "6px 0", flexWrap: "wrap", pointerEvents: "auto" }}>
        <button
          type="button"
          onClick={() => { streamingDiagnostics.toggleCulling(); setTick((t) => t + 1); }}
          style={btn(streamingDiagnostics.isCullingDisabled())}
          title="Rend TOUS les chunks sans test de frustum. Si les trous disparaissent, c'est le culling."
        >
          Culling : {streamingDiagnostics.isCullingDisabled() ? "COUPÉ" : "actif"}
        </button>
        <button
          type="button"
          onClick={() => { toggleAutoMaterial(); setTick((t) => t + 1); }}
          style={btn(isAutoMaterialDisabled())}
          title="Rend les matériaux bakés d'origine. Si les taches pâles disparaissent, c'est le shader triplanaire."
        >
          Auto-material : {isAutoMaterialDisabled() ? "COUPÉ" : "actif"}
        </button>
        {onOpenTerrain && (
          <button
            type="button"
            onClick={onOpenTerrain}
            style={{ ...btn(false), borderColor: "#4fc3f755", color: "#4fc3f7" }}
            title="Choisir les matières du terrain (plat / transition / parois) et la bande de bascule."
          >
            ⛰ Matière du terrain…
          </button>
        )}
      </div>
      <div>Textures chunks : <b>{c.texturesLoaded}</b> uploadées
        · VRAM estimée <b>{c.textureVramMB.toFixed(0)} MB</b></div>

      {mem && render && (
        <div>GPU three.js : {mem.textures} textures · {mem.geometries} géométries
          · {render.calls} draw calls · {(render.triangles / 1000).toFixed(0)}k tris</div>
      )}

      {budget.totalBudgetMB > 0 && (
        <div style={{ marginTop: 6, borderTop: "1px solid #1e3a5f", paddingTop: 6 }}>
          <div style={{ color: "#e0a8ff", fontWeight: 700, marginBottom: 4 }}>
            ⬡ ASSET BUDGET (WASM)
          </div>
          <div>VRAM : <b style={{ color: budget.totalUsedMB > budget.totalBudgetMB * 0.9 ? "#f87171" : "#4ade80" }}>
            {budget.totalUsedMB.toFixed(0)} MB</b> / {budget.totalBudgetMB.toFixed(0)} MB
            · {budget.loadedCount}/{budget.assetCount} chargés
            · {budget.pendingCount} en file</div>
          {catEntries.length > 0 && (
            <div style={{ color: "#94a3b8" }}>
              {catEntries.map(([cat, mb]) => (
                <span key={cat} style={{ marginRight: 8 }}>{cat}: {(mb as number).toFixed(0)}MB</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 6, borderTop: "1px solid #1e3a5f", paddingTop: 6 }}>
        {chunks.map((ch) => (
          <div key={ch.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ color: badge[ch.status] ?? "#cbd5e1", minWidth: 62 }}>
              ● {ch.status}
            </span>
            <span style={{ minWidth: 72 }}>{ch.file}</span>
            <span style={{ color: "#64748b" }}>
              {ch.sizeMB.toFixed(0)}MB
              {ch.essential ? " ★" : ""}
              {ch.status === "loaded" ? ` · ${ch.loadMs}ms · ${ch.textures}tex/${ch.textureVramMB}MB` : ""}
              {/* Un chunk CHARGÉ mais hors frustum est invisible à l'écran et
                  se confond avec de la géométrie manquante. On le nomme. */}
              {ch.status === "loaded" && !ch.inFrustum
                ? <span style={{ color: "#fbbf24" }}> · MASQUÉ (hors frustum)</span>
                : null}
            </span>
            {ch.error && <span style={{ color: "#f87171" }}>{ch.error.slice(0, 40)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
