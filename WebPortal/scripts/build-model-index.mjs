// scripts/build-model-index.mjs — SCAN AUTO des modèles 3D pour l'éditeur Forge.
//
// Parcourt public/models/** et liste tous les fichiers de géométrie (.glb) avec leur
// taille, groupés par dossier → public/models_index.json, consommé par la palette de
// l'éditeur. Relancer après tout ajout de modèles :  node scripts/build-model-index.mjs
// (intégrable au script dev plus tard).
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(process.cwd(), "public", "models");
const OUT = join(process.cwd(), "public", "models_index.json");
// Dossiers exclus : sauvegardes, sources, index lui-même.
const EXCLUDE = /(^|[\\/])(_orig_chunks|source|sources|textures|\.fbm)([\\/]|$)/i;

const entries = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (EXCLUDE.test(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.glb$/i.test(name)) {
      const rel = relative(join(process.cwd(), "public"), full).split(sep).join("/");
      entries.push({
        path: `/${rel}`,
        name: name.replace(/\.glb$/i, ""),
        folder: rel.split("/").slice(1, -1).join("/") || "(racine)",
        sizeKb: Math.round(st.size / 1024),
      });
    }
  }
}
walk(ROOT);
entries.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: entries.length, models: entries }, null, 1));
console.log(`[model-index] ${entries.length} modèles indexés → public/models_index.json`);
