// runtime/loading/BootLoadingScreen.tsx — écran de chargement du BOOT (login → serveurs).
//
// Charge UNE FOIS, derrière un overlay avec progression, tout ce qui est GLOBAL :
//   • assets 3D (avatar, packs d'anims, armes d'archétype, set PNJ) — fetch (cache HTTP)
//     puis useGLTF.preload (cache parsé drei) ;
//   • hydratation DB des stores (mémoïsée — l'entrée en jeu la réutilisera telle quelle) ;
//   • modèles de récolte.
// Les NOMS DE FICHIERS ne sont PAS affichés : la progression est habillée de messages
// immersifs (« Création de l'univers… », « Création des mondes… »).
// CACHE : une fois le boot fait, un flag de session saute l'écran instantanément aux
// logins suivants (les caches drei + THREE.Cache gardent les assets chauds en mémoire).
import { useEffect, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { collectBootAssets } from "./bootAssets";
import { hydrateAllStores } from "./hydrateAll";
import { preloadHarvestModels } from "../../professions/harvestModelCatalog";
import { isFetchablePath } from "../../loaders/assetQuality";

interface Props { onDone: () => void; }

// Messages immersifs, déroulés selon la progression (pas de noms de fichiers).
const LORE_STEPS: { at: number; label: string }[] = [
  { at: 0.00, label: "Création de l'univers…" },
  { at: 0.15, label: "Création des mondes…" },
  { at: 0.30, label: "Éveil des âmes et des esprits…" },
  { at: 0.45, label: "Tissage des animations vitales…" },
  { at: 0.60, label: "Forge des armes légendaires…" },
  { at: 0.75, label: "Naissance des créatures…" },
  { at: 0.90, label: "Stabilisation des portails…" },
  { at: 0.97, label: "Ouverture des serveurs…" },
];
function loreFor(ratio: number): string {
  let label = LORE_STEPS[0].label;
  for (const s of LORE_STEPS) if (ratio >= s.at) label = s.label;
  return label;
}

// Boot déjà fait cette session → les caches mémoire (drei + THREE.Cache) sont chauds,
// inutile de re-précharger : l'écran se saute instantanément (re-login, retour menu…).
let bootWarmed = false;

export function BootLoadingScreen({ onDone }: Props) {
  const [progress, setProgress] = useState({ loaded: 0, total: 1 });
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (bootWarmed) { onDoneRef.current(); return; } // cache de session → skip immédiat
    let cancelled = false;
    const safety = window.setTimeout(() => { if (!cancelled) onDoneRef.current(); }, 180000);

    (async () => {
      const urls = collectBootAssets();
      const total = urls.length + 1; // +1 = hydratation DB
      setProgress({ loaded: 0, total });

      // Hydratation DB en premier (thread totalement calme ici → jamais partielle).
      await hydrateAllStores();
      if (cancelled) return;
      let loaded = 1;
      setProgress({ loaded, total });

      // Assets séquentiels PAR PETITS LOTS (2 à la fois) : assez parallèle pour être rapide,
      // assez doux pour ne pas saturer le parse (pas de burst → pas de freeze d'overlay).
      const BATCH = 6;
      for (let i = 0; i < urls.length; i += BATCH) {
        if (cancelled) return;
        const batch = urls.slice(i, i + BATCH);
        await Promise.all(batch.map(async (u) => {
          // Les maps de la Forge portent un chemin virtuel `editor://<sceneId>`
          // (contenu en base, pas sur le serveur). Le fetcher lève
          // « URL scheme "editor" is not supported » — bruit inutile en console,
          // et un aller-retour perdu à chaque boot.
          if (!isFetchablePath(u)) return;
          try {
            await fetch(u);          // cache HTTP (octets prêts)
            useGLTF.preload(u);       // cache parsé drei (parse off-thread)
          } catch { /* asset absent → ignoré, le jeu a ses fallbacks */ }
        }));
        loaded += batch.length;
        setProgress({ loaded, total });
        // Laisse respirer une frame entre les lots (overlay fluide).
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }

      preloadHarvestModels(); // fire-and-forget (petits)
      if (!cancelled) { bootWarmed = true; onDoneRef.current(); }
    })();

    return () => { cancelled = true; window.clearTimeout(safety); };
  }, []);

  const ratio = progress.loaded / Math.max(1, progress.total);
  const pct = Math.min(100, Math.round(ratio * 100));
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "#04060c",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ color: "#5bd6ff", fontWeight: 900, fontSize: 22, letterSpacing: "0.35em", textTransform: "uppercase" }}>
        Narvos Prime
      </div>
      <div style={{ color: "#9bb8cc", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>
        {loreFor(ratio)}
      </div>
      <div style={{ width: 420, maxWidth: "80vw", height: 10, borderRadius: 5, background: "#0d1622", border: "1px solid #1d3247", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#1d8fd6,#5bd6ff)", transition: "width 0.15s" }} />
      </div>
      <div style={{ color: "#5b748a", fontSize: 11, fontFamily: "monospace", minHeight: 14 }}>{pct}%</div>
    </div>
  );
}
