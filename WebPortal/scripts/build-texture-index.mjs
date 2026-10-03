// scripts/build-texture-index.mjs — index des TEXTURES (images) pour le navigateur Forge.
//
// Scanne public/textures (textures utilisateur) + public/models (textures webp/png des
// assets, decals) → public/textures_index.json. Consommé par TextureBrowser (vignettes
// <img>, zéro WebGL). Relancer après ajout :  node scripts/build-texture-index.mjs
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const PUBLIC = join(process.cwd(), "public");
const ROOTS = [join(PUBLIC, "textures"), join(PUBLIC, "models")];
const EXCLUDE = /(^|[\\/])(_orig_chunks|node_modules|\.fbm)([\\/]|$)/i;
const IMG = /\.(png|jpe?g|webp)$/i;

const entries = [];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (EXCLUDE.test(full)) continue;
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full);
    else if (IMG.test(name)) {
      const rel = relative(PUBLIC, full).split(sep).join("/");
      entries.push({
        path: `/${rel}`,
        name: name.replace(IMG, ""),
        folder: rel.split("/").slice(0, -1).join("/") || "(racine)",
        sizeKb: Math.round(st.size / 1024),
        user: rel.startsWith("textures/"),   // déposée par l'utilisateur (priorité)
      });
    }
  }
}
for (const r of ROOTS) walk(r);
// Textures utilisateur d'abord, puis par dossier/nom.
entries.sort((a, b) => (a.user === b.user ? a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name) : a.user ? -1 : 1));
writeFileSync(join(PUBLIC, "textures_index.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: entries.length, textures: entries }, null, 0));
console.log(`[texture-index] ${entries.length} textures indexées → public/textures_index.json`);
