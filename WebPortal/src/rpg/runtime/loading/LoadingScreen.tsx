// ══════════════════════════════════════════════════════════════════════════════
// runtime/loading/LoadingScreen.tsx — Overlay de chargement (2 phases)
//
// Phase 1 — Préchargement HTTP : `preloadMapAssets` télécharge les octets
//           (chunks de map, vaisseaux, PNJ) → remplit le cache HTTP.
// Phase 2 — Assemblage GPU : `PuzzleMap` (dans le Canvas masqué) parse les
//           chunks et les upload sur le GPU, segment par segment. C'est CETTE
//           phase qui, avant, se faisait APRÈS la révélation → map incomplète
//           au spawn + freeze. Désormais on l'attend ici, derrière l'overlay.
//
// La révélation (et le fade-out) ne se déclenchent que lorsque `done` est vrai
// (= préchargement terminé ET map 100 % assemblée), piloté par le parent.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { preloadMapAssets } from "./AssetPreloader";
import type { PreloadProgress } from "./AssetPreloader";
import { MAPS } from "../../loaders/assetManifest";

interface LoadingScreenProps {
  mapId: keyof typeof MAPS;
  /** Progression de l'assemblage GPU de la map (chunks parsés/uploadés). */
  mapProgress?: { loaded: number; total: number };
  /** Appelé quand le préchargement HTTP est terminé (phase 1 finie). */
  onPreloadDone: () => void;
  /** True quand TOUT est prêt (préchargement + map assemblée) → fade-out. */
  done: boolean;
  /** Appelé après le fade-out → le parent démonte l'overlay. */
  onHidden: () => void;
}

export function LoadingScreen({ mapId, mapProgress, onPreloadDone, done, onHidden }: LoadingScreenProps) {
  const [progress, setProgress] = useState<PreloadProgress>({ loaded: 0, total: 0, percent: 0, currentUrl: "" });
  const [preloadFinished, setPreloadFinished] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const onPreloadDoneRef = useRef(onPreloadDone);
  onPreloadDoneRef.current = onPreloadDone;
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  // ── Phase 1 : préchargement HTTP ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPreloadFinished(false);
    setProgress({ loaded: 0, total: 0, percent: 0, currentUrl: "" });
    preloadMapAssets(mapId, (p) => { if (!cancelled) setProgress(p); })
      .then(() => {
        if (cancelled) return;
        setPreloadFinished(true);
        onPreloadDoneRef.current();
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // ── Fade-out quand TOUT est prêt (préchargement + assemblage) ───────────────
  useEffect(() => {
    if (!done) return;
    const t1 = setTimeout(() => setFadingOut(true), 250); // laisse voir le 100 %
    const t2 = setTimeout(() => onHiddenRef.current(), 250 + 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [done]);

  // ── Affichage : libellé + % selon la phase ──────────────────────────────────
  const inAssembly = preloadFinished;
  const mapPct = mapProgress && mapProgress.total > 0
    ? Math.round((mapProgress.loaded / mapProgress.total) * 100)
    : 0;
  const pct = done ? 100 : inAssembly ? mapPct : progress.percent;
  const phaseLabel = inAssembly ? "Assemblage de la map" : "Préchargement des assets";
  const detail = inAssembly
    ? `${mapProgress?.loaded ?? 0}/${mapProgress?.total ?? 0} segments`
    : (() => {
        const file = progress.currentUrl
          ? progress.currentUrl.split("/").pop()?.replace(/\.glb$/, "") ?? ""
          : "Initialisation…";
        return `${progress.loaded}/${progress.total} · ${file}`;
      })();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      opacity: fadingOut ? 0 : 1,
      transition: "opacity 800ms ease-out",
      pointerEvents: fadingOut ? "none" : "auto",
    }}>
      <video
        src="/models/launcher/ecran_dechargement.mp4"
        autoPlay loop muted playsInline
        // Cache Electron refuse parfois la vidéo (ERR_CACHE_OPERATION_NOT_SUPPORTED) → on
        // masque proprement l'élément cassé ; le dégradé radial sert de fond. Décoratif.
        onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%)",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 22, padding: 40, minWidth: 480, maxWidth: "80vw",
      }}>
        <div style={{
          fontSize: 38, fontWeight: 900, color: "#5bd6ff", letterSpacing: "0.4em",
          textTransform: "uppercase", fontFamily: "monospace", textShadow: "0 0 24px rgba(91,214,255,0.6)",
        }}>
          Chargement
        </div>
        <div style={{
          fontSize: 14, color: "#c0e8ff", letterSpacing: "0.25em",
          textTransform: "uppercase", fontFamily: "monospace", opacity: 0.85,
        }}>
          {MAPS[mapId]?.label ?? mapId}
        </div>

        {/* Indicateur de phase (préchargement → assemblage) */}
        <div style={{ display: "flex", gap: 16, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em" }}>
          <span style={{ color: inAssembly ? "#4ade80" : "#5bd6ff", fontWeight: 800 }}>
            {inAssembly ? "✓" : "▸"} TÉLÉCHARGEMENT
          </span>
          <span style={{ color: done ? "#4ade80" : inAssembly ? "#5bd6ff" : "#475569", fontWeight: 800 }}>
            {done ? "✓" : inAssembly ? "▸" : "·"} ASSEMBLAGE
          </span>
        </div>

        <div style={{
          width: 480, maxWidth: "70vw", height: 8,
          background: "rgba(91, 214, 255, 0.12)", borderRadius: 4, overflow: "hidden",
          border: "1px solid rgba(91, 214, 255, 0.35)", boxShadow: "0 0 16px rgba(91, 214, 255, 0.2)",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: "linear-gradient(90deg, #5bd6ff 0%, #a3e635 100%)",
            transition: "width 200ms ease-out", boxShadow: "0 0 12px rgba(91, 214, 255, 0.8)",
          }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: "monospace" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#a3e635", letterSpacing: "0.1em", textShadow: "0 0 14px rgba(163, 230, 53, 0.5)" }}>
            {pct}%
          </div>
          <div style={{
            fontSize: 11, color: "#88aab8", letterSpacing: "0.1em",
            maxWidth: 460, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {phaseLabel} · {detail}
          </div>
        </div>

        <div style={{
          fontSize: 9, color: "#5a7080", letterSpacing: "0.18em",
          textTransform: "uppercase", marginTop: 8, fontFamily: "monospace",
        }}>
          Map assemblée intégralement avant l'entrée — aucun freeze en jeu
        </div>
      </div>
    </div>
  );
}
