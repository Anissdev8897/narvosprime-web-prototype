// ══════════════════════════════════════════════════════════════════════════════
// _bundle.mjs — bundler un point d'entrée TS via l'API JS d'esbuild.
//
//   import { bundleTS } from "./_bundle.mjs";
//   await bundleTS(entree_ts, sortie_mjs);
//   await bundleTS(entree_ts, sortie_mjs, { define: {...}, logLevel: "error" });
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Les harnais lançaient `execFileSync("node", [ESBUILD, ...])` où ESBUILD pointait
// sur WebPortal/node_modules/esbuild/bin/esbuild. Ça suppose que ce `bin/esbuild`
// soit du JavaScript exécutable par `node` — VRAI sous Windows (un shim JS), FAUX
// sous Linux/macOS, où esbuild y installe directement son binaire NATIF : `node`
// tente alors de parser un ELF et lève « SyntaxError: ELF ». La barrière qualité
// ne tournait donc que sur Windows.
//
// L'API JS d'esbuild (`build`) résout elle-même le bon binaire selon la plateforme :
// un seul chemin de code, portable partout. esbuild vit dans le projet web, pas
// dans l'arbre node_modules des harnais, d'où l'import par CHEMIN explicite déduit
// de la racine du dépôt (jamais un chemin machine en dur).
// ══════════════════════════════════════════════════════════════════════════════

import { pathToFileURL } from "node:url";
import { RACINE_DEPOT } from "./_racine.mjs";

let _esbuild = null;
async function charger() {
  if (!_esbuild) {
    const main = RACINE_DEPOT + "/WebPortal/node_modules/esbuild/lib/main.js";
    _esbuild = await import(pathToFileURL(main).href);
  }
  return _esbuild;
}

/**
 * Bundle `entree` (TS) vers `sortie` (ESM), prêt pour un `import()`.
 * @param {string} entree   chemin du .ts d'entrée
 * @param {string} sortie   chemin du .mjs de sortie
 * @param {object} [options] options esbuild supplémentaires (define, logLevel, …)
 */
export async function bundleTS(entree, sortie, options = {}) {
  const esbuild = await charger();
  await esbuild.build({
    entryPoints: [entree],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: sortie,
    ...options,
  });
}
