// ══════════════════════════════════════════════════════════════════════════════
// runtime/loading/AssetPreloader.ts — Préchargeur d'assets avec progression
//
// Stratégie : utiliser THREE.DefaultLoadingManager qui track automatiquement
// tous les loads (GLTFLoader, TextureLoader, etc.) sans avoir à les wrapper.
// On précharge les GLB critiques avant de monter le Canvas → plus de freeze
// 3-10s à l'entrée de la map.
//
// API :
//   preloadMapAssets(mapId, onProgress) → Promise qui résout quand tout est chargé
//
// Le caller (RpgGameWorld) await cette promise avant de rendre le Canvas.
// Pendant l'attente, un overlay affiche la progression % visible.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MAPS, getMapChunks } from "../../loaders/assetManifest";
import { SHIP_FORGE, SHIP_TOWER, SHIP_LONGSWORD, SHIP_BACKGROUND } from "../SpaceEnvironment";
import { precomputeQualityCache, qualityVariant, getQualityStats } from "../../loaders/assetQuality";
import { hydrateAllStores, invalidateHydration } from "./hydrateAll";
import { collectWarmAssets, collectMapAssets, collectGlobalAssets } from "./gameAssets";
import { disposeAsset } from "./assetDisposal";
import { configureGLTFLoader } from "../../loaders/sharedLoaders";
import { getCachedAsset, storeCachedAsset, validateAssetFingerprint } from "./chunkCache";
import { getAssetBudgetFingerprint } from "../../wasm/AssetBudgetBridge";

export interface PreloadProgress {
  loaded: number;
  total: number;
  percent: number;
  currentUrl: string;
}

/** Cache des GLBs déjà préchargés — évite de recharger entre les voyages. */
const preloadedCache = new Set<string>();

/** Dernière map préparée → permet d'évincer ses assets PER-MAP en changeant de map. */
let lastMapId: keyof typeof MAPS | null = null;

/**
 * Libère le cache (RAM/parse drei + file cache) des assets PER-MAP de `prevMapId` qui ne
 * sont PAS requis par `keepMapId` (ni épinglés globaux) → mémoire bornée sur longues
 * sessions (sinon le cache drei croît à chaque map sans éviction = fuite mémoire).
 */
function evictMapAssets(prevMapId: keyof typeof MAPS, keepMapId: keyof typeof MAPS): void {
  const keep = new Set([...collectGlobalAssets(), ...collectMapAssets(keepMapId)]);
  let n = 0;
  for (const u of collectMapAssets(prevMapId)) {
    if (keep.has(u)) continue;            // partagé avec la nouvelle map ou épinglé → on garde
    disposeAsset(u);                      // LIBÈRE LE GPU (geo/mat/tex) — useGLTF.clear ne le fait pas
    try { useGLTF.clear(u); } catch { /* noop */ } // purge le cache PARSÉ drei
    THREE.Cache.remove(u);               // purge les octets bruts (double-buffering)
    preloadedCache.delete(u);             // purge le gate de re-préchargement
    n++;
  }
  if (n > 0) console.info(`[Preloader] éviction : ${n} assets de « ${prevMapId} » libérés`);
}

/**
 * Précharge un ensemble de GLB en parallèle, avec cache IndexedDB.
 * Pipeline : IDB hit → parse direct | IDB miss → fetch + store IDB → parse.
 */
function preloadGLBs(urls: string[], onProgress: (p: PreloadProgress) => void): Promise<void> {
  const toLoad = urls.filter((u) => !preloadedCache.has(u));
  if (toLoad.length === 0) {
    onProgress({ loaded: 1, total: 1, percent: 100, currentUrl: "" });
    return Promise.resolve();
  }

  let loaded = 0;
  const total = toLoad.length;
  const loader = new GLTFLoader();
  configureGLTFLoader(loader);

  const MAX_CONCURRENT = 3;
  const queue = [...toLoad];
  let inflight = 0;

  return new Promise<void>((resolve) => {
    const done = (url: string) => {
      preloadedCache.add(url);
      THREE.Cache.remove(url);
      inflight--;
      loaded++;
      onProgress({ loaded, total, percent: Math.round((loaded / total) * 100), currentUrl: url });
      if (loaded >= total) resolve();
      else loadNext();
    };

    const fail = (url: string, err: unknown) => {
      console.warn("[AssetPreloader] échec chargement :", url, err);
      inflight--;
      loaded++;
      onProgress({ loaded, total, percent: Math.round((loaded / total) * 100), currentUrl: url });
      if (loaded >= total) resolve();
      else loadNext();
    };

    const loadOne = async (url: string) => {
      try {
        const basePath = url.substring(0, url.lastIndexOf("/") + 1);

        // ── IDB cache hit → parse direct ──
        const cached = await getCachedAsset(url);
        if (cached) {
          loader.parse(cached, basePath, () => done(url), (e: unknown) => fail(url, e));
          return;
        }

        // ── IDB miss → fetch réseau ──
        const resp = await fetch(url);
        if (!resp.ok) { fail(url, `HTTP ${resp.status}`); return; }
        const ct = resp.headers.get("content-type") ?? "";
        if (ct.includes("text/html")) { fail(url, "SPA fallback (text/html)"); return; }
        const buf = await resp.arrayBuffer();
        storeCachedAsset(url, buf);
        loader.parse(buf, basePath, () => done(url), (e: unknown) => fail(url, e));
      } catch (err) {
        fail(url, err);
      }
    };

    const loadNext = () => {
      while (inflight < MAX_CONCURRENT && queue.length > 0) {
        const url = queue.shift()!;
        inflight++;
        loadOne(url);
      }
    };
    loadNext();
  });
}

/**
 * Précharge tous les assets critiques pour démarrer une map donnée :
 *   • GLB de la map (le plus gros, 142-171 MB)
 *   • Tous les vaisseaux pilotables
 *   • Catalogue PNJ (les modèles peuvent spawn à tout moment via le système
 *     de combat IA et les events procéduraux)
 *
 * @param mapId  id de la map active (forge/orbital/tower)
 * @param onProgress  callback de progression (0-100)
 */
// ── Sérialisation des préparations ───────────────────────────────────────────
// preloadMapAssets (transition de map) et reprepareAssets (reload admin) mutent un état
// module partagé (lastMapId, preloadedCache). Deux exécutions CONCURRENTES (reload admin
// pendant un voyage) s'entrelaceraient → tracking d'éviction corrompu + re-téléchargements
// inutiles. On les passe dans une FILE : une seule préparation active à la fois.
let prepChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = prepChain.then(job, job); // s'exécute après la précédente (succès OU échec)
  prepChain = next.catch(() => {});       // garde la file vivante même sur rejet
  return next;
}

/** Précharge tous les assets d'une map (sérialisé via la file). */
export function preloadMapAssets(
  mapId: keyof typeof MAPS,
  onProgress: (p: PreloadProgress) => void,
): Promise<void> {
  return enqueue(() => preloadMapAssetsImpl(mapId, onProgress));
}

async function preloadMapAssetsImpl(
  mapId: keyof typeof MAPS,
  onProgress: (p: PreloadProgress) => void,
): Promise<void> {
  // ── Étape 0 : hydrate les stores éditables EN PREMIER (ATTENDU, borné) ──────────
  console.info("[Preloader] étape 0 — hydrateAllStores…");
  await hydrateAllStores();
  console.info("[Preloader] étape 0 ✓ hydratation terminée");

  // ── Étape 1 : collecter tous les paths HIGH (originaux) ──────────────────
  const allHighPaths: string[] = [];
  // Map CHUNKÉE → on NE préfetche PAS les chunks ici : PuzzleMap les charge
  // lui-même (parse + upload GPU) pendant l'écran de chargement, et la
  // révélation est gatée sur sa complétion. Préfetcher en plus = double
  // téléchargement inutile. Pour une map NON chunkée (fallback), on garde le
  // préchargement du GLB unique (MapModel le consomme via useGLTF).
  const chunks = getMapChunks(mapId);
  // Map d'ÉDITEUR (editor://…) : pas de GLB de map à précharger (objets streamés au rendu).
  if (!chunks && !MAPS[mapId].path.startsWith("editor://")) allHighPaths.push(MAPS[mapId].path);
  allHighPaths.push(SHIP_FORGE, SHIP_TOWER, SHIP_LONGSWORD, SHIP_BACKGROUND); // vaisseaux
  // PNJ : SEULEMENT ceux PLACÉS sur CETTE map (connus car hydratation faite) — précharger
  // les ~60 modèles du catalogue saturait le réseau + le parse pendant que PuzzleMap
  // chargeait ses chunks → « chunk 0 timeout ». Les autres PNJ chargent à la demande.
  for (const url of collectMapAssets(mapId)) allHighPaths.push(url);

  // ── Étape 2 : précomputer les variantes optimales (HEAD checks parallèles)
  //
  // Les chunks sont RÉSOLUS ICI mais PAS PRÉCHARGÉS (voir étape 3) : deux besoins
  // distincts qu'on confondait. StreamingPuzzleMap appelle `qualityVariant()` sur
  // chaque chunk, et cette fonction lit un cache alimenté uniquement par
  // `precomputeQualityCache`. Comme les chunks n'étaient dans aucune des deux
  // listes, elle retombait sur le chemin HIGH : le réglage vidéo n'avait donc
  // AUCUN effet sur les maps chunkées, quelle que soit la qualité choisie.
  // Les résoudre ici ne déclenche que des HEAD, pas de téléchargement.
  // `getMapChunks` rend des chemins COMPLETS (cf. forgeChunks.ts), pas des noms
  // de fichiers : les concaténer avec chunkDir produisait un chemin doublé
  // (« …/chunks_v2//models/Maps/forge_map/chunks/chunk_01.glb ») dont le HEAD
  // renvoyait le fallback SPA — donc zéro variante résolue, en silence.
  const qualityOnlyPaths: string[] = chunks ? [...chunks] : [];
  console.info(
    `[Preloader] étape 2 — qualityCache pour ${allHighPaths.length} paths` +
    (qualityOnlyPaths.length ? ` + ${qualityOnlyPaths.length} chunks (résolus, non préchargés)` : "") + "…",
  );
  await precomputeQualityCache([...allHighPaths, ...qualityOnlyPaths]);
  const stats = getQualityStats();
  // eslint-disable-next-line no-console
  console.info(
    `%c[Preloader] variantes %c${stats.variants}/${stats.total}%c · fallbacks high : ${stats.fallbacks}`,
    "color:#5bd6ff;font-weight:bold", "color:#a3e635", "color:inherit",
  );

  // ── Validation empreinte cache assets (C++ = source de vérité) ──
  const assetFp = getAssetBudgetFingerprint();
  if (assetFp !== 0) {
    validateAssetFingerprint(assetFp).then((ok) => {
      if (!ok) console.info("[Preloader] cache IDB purgé — assets re-exportés");
    });
  }

  // Éviction des assets PER-MAP de la map PRÉCÉDENTE (mémoire bornée). Les globaux épinglés
  // (avatar/armes/packs) et les assets partagés avec la nouvelle map sont conservés.
  if (lastMapId && lastMapId !== mapId) evictMapAssets(lastMapId, mapId);
  lastMapId = mapId;

  // ── Étape 3 : précharge la MAP + vaisseaux (le lot critique, gate la révélation) ──
  const urls = allHighPaths.map(qualityVariant);
  console.info(`[Preloader] étape 3 — preloadGLBs (${urls.length} fichiers)…`);
  await preloadGLBs(urls, onProgress);
  console.info("[Preloader] étape 3 ✓ préchargement terminé — preloadDone imminent");

  // ── Étape 4 : warm des assets GLOBAUX en idle (avatar/armes/packs — PETITS) ──────
  // Les PNJ placés sont déjà préchargés (étape 3) ; ici on chauffe les globaux légers
  // pendant les temps morts, sans bloquer la révélation.
  warmIdle(collectGlobalAssets());
}

/** Warm le cache parsé drei UN asset à la fois, en temps mort → zéro burst RAM/GPU. */
function warmIdle(urls: string[]): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    ?? ((cb: () => void) => setTimeout(cb, 150));
  let i = 0;
  const step = () => {
    const u = urls[i++];
    if (!u) return;
    try { useGLTF.preload(u); } catch { /* asset absent → ignoré */ }
    ric(step, { timeout: 2500 });
  };
  ric(step, { timeout: 2500 });
}

/**
 * RE-PRÉPARE les assets APRÈS des modifications admin (nouveau modèle/monstre/env/offset…) :
 * ré-hydrate la base (nouvelles données) puis re-précharge. Le `preloadedCache` + le cache
 * parsé drei sont RÉUTILISÉS → seuls les NOUVEAUX assets se chargent (préchargement
 * intelligent, pas de re-téléchargement). À brancher derrière une fenêtre de chargement
 * (overlay) déclenchée à la fin des modifs de l'admin → tout est prêt avant la reprise.
 */
export function reprepareAssets(
  mapId: keyof typeof MAPS,
  onProgress: (p: PreloadProgress) => void,
): Promise<void> {
  // TOUT dans la file (sérialisé) → la purge des caches + la re-préparation ne s'entrelacent
  // jamais avec une transition de map concurrente.
  return enqueue(async () => {
    invalidateHydration();    // force une nouvelle lecture base (capte les modifs admin)
    // Un asset REMPLACÉ à la MÊME URL (même chemin, nouveaux octets) serait servi périmé si on
    // garde les caches → on PURGE le cache raw + le cache parsé drei des assets warm avant de
    // re-préparer. Le reste (grande map/vaisseaux, URLs inchangées) reste en cache (réutilisé).
    const warm = collectWarmAssets(mapId);
    for (const u of warm) { preloadedCache.delete(u); try { useGLTF.clear(u); } catch { /* noop */ } }
    await preloadMapAssetsImpl(mapId, onProgress);
  });
}

/** Réinitialise le cache (utile pour les tests / changements de session). */
export function clearPreloadCache(): void {
  preloadedCache.clear();
}

/** True si un asset spécifique a déjà été préchargé. */
export function isPreloaded(url: string): boolean {
  return preloadedCache.has(url);
}

/**
 * Helper pour brancher le `THREE.DefaultLoadingManager` global → utile si
 * on veut tracker AUSSI les loads non-anticipés (textures dynamiques, etc.).
 * Optionnel.
 */
export function attachGlobalLoadingListener(
  onProgress: (loaded: number, total: number) => void,
  onComplete: () => void,
): () => void {
  const prevProgress = THREE.DefaultLoadingManager.onProgress;
  const prevLoad = THREE.DefaultLoadingManager.onLoad;

  THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
    onProgress(loaded, total);
  };
  THREE.DefaultLoadingManager.onLoad = () => {
    onComplete();
  };

  return () => {
    THREE.DefaultLoadingManager.onProgress = prevProgress;
    THREE.DefaultLoadingManager.onLoad = prevLoad;
  };
}
