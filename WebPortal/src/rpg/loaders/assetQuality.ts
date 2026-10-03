// ══════════════════════════════════════════════════════════════════════════════
// loaders/assetQuality.ts — Système centralisé de variantes de qualité
//
// Convention de nommage des assets :
//   `<name>.glb`      → version HIGH (qualité originale)
//   `<name>.med.glb`  → version MEDIUM (textures 1024)
//   `<name>.low.glb`  → version LOW (textures 512)
//
// Workflow :
//   1) Au démarrage : `precomputeQualityCache([allPaths])` fait un HEAD check
//      sur chaque variante potentielle et mémorise le path optimal disponible.
//   2) En runtime : tout consommateur (useGLTF, useFBX, MapModel, etc.) appelle
//      `qualityVariant(path)` qui retourne le path mémorisé (synchrone).
//   3) Si une variante n'existe pas (404 ou pas générée), fallback silencieux
//      sur la version HIGH (path original).
//
// API :
//   • qualityVariant(path)             — synchrone, retourne le path optimal
//   • assetExists(path)                — HEAD check async
//   • precomputeQualityCache(paths)    — appelée au boot (LoadingScreen)
//   • clearQualityCache()              — reset (tests / changement qualité runtime)
// ══════════════════════════════════════════════════════════════════════════════

import { gameSettings } from "../settings/gameSettings";

/** Cache synchrone : path original → path résolu (high ou variante dispo). */
let cache = new Map<string, string>();

/**
 * Transformation naïve d'un path en variante de qualité (sans vérifier
 * l'existence). Utilisé en interne par `precomputeQualityCache`.
 *
 * Quality "high"  → path inchangé
 * Quality "medium" → /foo/bar.glb → /foo/bar.med.glb
 * Quality "low"    → /foo/bar.glb → /foo/bar.low.glb
 *
 * Si le path ne se termine pas par .glb (ex: .fbx, .mp3), retourne tel quel.
 */
function variantSuffix(path: string): string {
  const q = gameSettings.video.quality;
  if (q === "high") return path;
  if (!/\.glb$/i.test(path)) return path; // pas un .glb → pas de variante
  const sfx = q === "medium" ? "med" : "low";
  return path.replace(/\.glb$/i, `.${sfx}.glb`);
}

/**
 * Vérifie l'existence d'un asset via HEAD HTTP. Renvoie false si :
 *   • HTTP non-OK (404, 500…)
 *   • Content-Type text/* (Vite SPA fallback = fichier absent)
 *   • Erreur réseau
 */
/**
 * Un chemin désigne-t-il un fichier réellement téléchargeable ?
 *
 * Les maps créées dans la Forge portent un chemin VIRTUEL `editor://<sceneId>` :
 * leur contenu vit en base, pas sur le serveur. Le passer à `fetch()` produit
 * « Fetch API cannot load editor://… — URL scheme "editor" is not supported ».
 * Le routage de rendu gère déjà ce schéma (RpgGameWorld monte ForgeBuiltMap),
 * mais les préchargeurs, eux, recevaient le chemin brut.
 *
 * Garde centrale plutôt qu'un test répété : tout nouveau schéma virtuel est
 * couvert d'office.
 */
export function isFetchablePath(path: string): boolean {
  if (!path) return false;
  // Chemins relatifs/absolus du serveur : toujours téléchargeables.
  if (path.startsWith("/") || path.startsWith("./") || path.startsWith("../")) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(path)?.[1]?.toLowerCase();
  if (!scheme) return true; // pas de schéma → chemin relatif
  return scheme === "http" || scheme === "https" || scheme === "blob" || scheme === "data";
}

/** Discriminated result for assetExists — "found", "not_found", or transient "error". */
export type AssetStatus =
  | { status: "found" }
  | { status: "not_found" }
  | { status: "error"; reason: string };

export async function assetExists(path: string): Promise<AssetStatus> {
  if (!isFetchablePath(path)) return { status: "not_found" };
  try {
    const res = await fetch(path, { method: "HEAD" });
    if (!res.ok) return { status: "not_found" };
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    // Vite SPA fallback retourne text/html pour les fichiers inconnus
    if (ct.startsWith("text/")) return { status: "not_found" };
    return { status: "found" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { status: "error", reason };
  }
}

/**
 * Pré-calcule le path optimal pour chaque entrée. Stocke le résultat en
 * cache → les appels synchrones suivants à `qualityVariant(path)` sont O(1).
 *
 * Stratégie par path :
 *   1) Si quality = high → cache directement le path original
 *   2) Sinon : test la variante (.med/.low). Si existe, l'utilise. Sinon, fallback path original.
 *
 * Fait en parallèle (Promise.all) → temps total ≈ latence max d'un HEAD.
 */
export async function precomputeQualityCache(paths: string[]): Promise<void> {
  const q = gameSettings.video.quality;

  await Promise.all(paths.map(async (path) => {
    if (cache.has(path)) return; // déjà résolu

    // Quality "high" → pas de variante, on cache le path original
    if (q === "high") {
      cache.set(path, path);
      return;
    }

    const variant = variantSuffix(path);
    if (variant === path) {
      // Path non transformable (ex: pas un .glb)
      cache.set(path, path);
      return;
    }

    const status = await assetExists(variant);
    if (status.status === "found") {
      cache.set(path, variant);
    } else if (status.status === "not_found") {
      cache.set(path, path); // fallback sur high (path original)
    }
    // status === "error" → ne pas cacher, retenter au prochain appel
  }));
}

/**
 * Retourne le path optimal pour un asset (résolu par precomputeQualityCache).
 * Si le path n'est pas dans le cache (cas : non précalculé), retourne le
 * path original — comportement sûr (high garanti).
 */
export function qualityVariant(path: string): string {
  return cache.get(path) ?? path;
}

/**
 * Variante immédiatement INFÉRIEURE d'un chemin d'asset, ou null si déjà au plus bas.
 *
 *   foo.glb → foo.med.glb → foo.low.glb → null
 *
 * Sert au repli automatique quand un chargement épuise la mémoire. Sans lui, un
 * joueur en qualité « high » sur une machine trop juste voit le chunk échouer,
 * être retenté À L'IDENTIQUE, échouer encore, et la map reste trouée pour la
 * session — c'est exactement ce qu'on observait : « chunk 0 failed: RangeError:
 * Array buffer allocation failed », deux fois, puis 6/8 résidents.
 *
 * Un cran plus bas divise la surface des textures par 4, donc la mémoire de
 * transcodage d'autant. Mieux vaut un chunk un peu moins net que pas de chunk.
 */
export function degradeVariant(path: string): string | null {
  if (/\.low\.glb$/i.test(path)) return null;
  if (/\.med\.glb$/i.test(path)) return path.replace(/\.med\.glb$/i, ".low.glb");
  if (/\.glb$/i.test(path)) return path.replace(/\.glb$/i, ".med.glb");
  return null;
}

/** Réinitialise le cache (utile pour changement de qualité runtime). */
export function clearQualityCache(): void {
  cache = new Map();
}

/**
 * Re-résout TOUS les chemins déjà connus pour la qualité courante.
 *
 * À appeler quand le joueur change la qualité en cours de partie. Sans ça, le
 * cache reste figé sur la résolution d'origine : la map se remonte bien (sa clé
 * React contient la qualité) mais `qualityVariant()` lui rend exactement les
 * mêmes fichiers, et le réglage n'a aucun effet visible.
 *
 * Le remplacement est ATOMIQUE — on remplit une nouvelle Map avant de basculer.
 * Vider le cache d'abord exposerait une fenêtre où `qualityVariant()` retombe
 * sur les chemins HIGH ; un remount pendant cette fenêtre chargerait les gros
 * fichiers sur une machine qui a justement demandé le contraire.
 */
export async function refreshQualityCache(): Promise<void> {
  const originals = [...cache.keys()];
  if (originals.length === 0) return;
  const next = new Map<string, string>();
  const q = gameSettings.video.quality;
  await Promise.all(originals.map(async (path) => {
    if (q === "high") { next.set(path, path); return; }
    const variant = variantSuffix(path);
    if (variant === path) {
      next.set(path, path);
      return;
    }
    const status = await assetExists(variant);
    if (status.status === "found") {
      next.set(path, variant);
    } else if (status.status === "not_found") {
      next.set(path, path);
    } else {
      // status === "error" → preserve old cache entry so qualityVariant() doesn't permanently fall back to HIGH
      next.set(path, cache.get(path) ?? path);
    }
  }));
  cache = next;
}

/** Combien d'assets ont été résolus en variante (pour debug). */
export function getQualityStats(): { total: number; fallbacks: number; variants: number } {
  let fallbacks = 0;
  let variants = 0;
  for (const [original, resolved] of cache) {
    if (original === resolved) fallbacks++;
    else variants++;
  }
  return { total: cache.size, fallbacks, variants };
}
