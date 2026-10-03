// runtime/loading/AssetReloadButton.tsx — bouton ADMIN « Appliquer & recharger ».
//
// À la fin de ses modifications (nouveau modèle/monstre/env/offset…), l'admin clique ce
// bouton : une FENÊTRE de chargement apparaît, on RE-HYDRATE la base (capte les modifs) et
// on RE-PRÉPARE les assets (reprepareAssets → cache éditable purgé, le reste réutilisé), puis
// on referme. Tout est prêt + appliqué avant la reprise → aucun freeze. Composant AUTONOME
// (son propre état) : ne re-render PAS RpgGameWorld.
import { useState } from "react";
import { useEditMode } from "../gameModeStore";
import { reprepareAssets } from "./AssetPreloader";
import type { PreloadProgress } from "./AssetPreloader";
import { MAPS } from "../../loaders/assetManifest";

const CY = "#5bd6ff";

export function AssetReloadButton({ mapId }: { mapId: keyof typeof MAPS }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PreloadProgress>({ loaded: 0, total: 0, percent: 0, currentUrl: "" });

  if (!useEditMode()) return null;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setProgress({ loaded: 0, total: 0, percent: 0, currentUrl: "" });
    try {
      await reprepareAssets(mapId, (p) => setProgress(p));
    } catch (e) {
      console.warn("[AssetReload] échec :", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={run} disabled={busy}
        title="Re-hydrate la base + re-précharge tous les assets éditables (après modifs admin)"
        style={{
          position: "fixed", top: 350, right: 14, zIndex: 240, width: 42, height: 42, borderRadius: 21,
          background: "rgba(6,18,26,0.85)", border: `2px solid ${CY}`, color: CY, fontSize: 19, fontWeight: 900,
          cursor: busy ? "wait" : "pointer", boxShadow: `0 0 18px ${CY}55`,
          display: "flex", alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1,
        }}>🔄</button>

      {busy && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.82)",
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20,
          fontFamily: "monospace",
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: CY, letterSpacing: "0.3em", textTransform: "uppercase", textShadow: `0 0 20px ${CY}88` }}>
            Application des modifications
          </div>
          <div style={{ width: 460, maxWidth: "70vw", height: 8, background: `${CY}1f`, borderRadius: 4, overflow: "hidden", border: `1px solid ${CY}55` }}>
            <div style={{ width: `${progress.percent}%`, height: "100%", background: `linear-gradient(90deg, ${CY}, #a3e635)`, transition: "width 180ms ease-out" }} />
          </div>
          <div style={{ fontSize: 12, color: "#a3e635", fontWeight: 800 }}>{progress.percent}%</div>
          <div style={{ fontSize: 10, color: "#88aab8", maxWidth: 460, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {progress.loaded}/{progress.total} · {progress.currentUrl ? progress.currentUrl.split("/").pop()?.replace(/\.glb$/, "") : "Hydratation base…"}
          </div>
        </div>
      )}
    </>
  );
}
