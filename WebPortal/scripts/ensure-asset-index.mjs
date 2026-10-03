// ══════════════════════════════════════════════════════════════════════════════
// ensure-asset-index.mjs — Garantit que les index d'assets existent avant de
// lancer un prototype.
//
// ── POURQUOI ────────────────────────────────────────────────────────────────
//
// `public/models_index.json` et `public/textures_index.json` sont GÉNÉRÉS et
// GITIGNORÉS (.gitignore:52-53) : un clone frais ne les a pas. Le jeu s'en
// sort — `npm run dev` les fabrique via `predev`. Les scripts `proto:*`
// appellent `vite` directement (pour rester rapides), donc sans ce garde-fou
// ils démarreraient sur des index absents.
//
// Et un index absent ne se voit PAS : le fallback SPA de Vite renvoie
// `text/html` en 200 au lieu d'un 404. Le scanner d'assets reçoit du HTML là
// où il attend du JSON, et l'éditeur s'ouvre avec une palette vide, sans une
// seule erreur dans la console. C'est le piège documenté du projet.
//
// Coût quand tout est là : deux `existsSync`. On ne régénère que si nécessaire.
// ══════════════════════════════════════════════════════════════════════════════

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

const INDEX_REQUIS = [
  "public/models_index.json",
  "public/textures_index.json",
  "src/data/assets-manifest.json",
];

const manquants = INDEX_REQUIS.filter((f) => !existsSync(join(RACINE, f)));

if (manquants.length === 0) {
  process.exit(0);
}

console.log(`[proto] Index d'assets manquants : ${manquants.join(", ")}`);
console.log("[proto] Génération (une seule fois — ils sont gitignorés)…");

try {
  execSync("npm run generate:assets", { cwd: RACINE, stdio: "inherit" });
} catch {
  // On n'échoue PAS le lancement : certains prototypes (combat, sandbox) ne
  // lisent aucun index et démarreraient très bien. Mais on prévient fort,
  // sinon l'éditeur s'ouvrirait avec une palette vide sans explication.
  console.error("\n[proto] ⚠ La génération a échoué.");
  console.error("[proto] ⚠ Un prototype qui scanne les assets (éditeur) aura une palette VIDE.");
  console.error("[proto] ⚠ Lance `npm run generate:assets` et regarde l'erreur.\n");
}
