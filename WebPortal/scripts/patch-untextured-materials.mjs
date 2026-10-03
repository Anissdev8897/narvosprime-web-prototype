// ══════════════════════════════════════════════════════════════════════════════
// patch-untextured-materials.mjs — Donne une texture aux matériaux qui rendent BLANC.
//
// POURQUOI CE N'EST PAS QU'UNE COPIE DE FICHIERS
//
// Poser les PNG du pack à côté du GLB ne change RIEN : un matériau glTF sans
// `baseColorTexture` s'affiche avec sa seule `baseColorFactor` (blanche par
// défaut), et aucun mécanisme ne va chercher un fichier voisin. Il faut écrire
// la liaison DANS le document : créer la Texture, la rattacher au Material.
//
// C'est exactement ce que perd un auto-material Unreal à l'export : son mélange
// roche/herbe/neige est calculé par un graphe de shader, or glTF ne stocke qu'un
// matériau PBR par primitive. Ce script recolle donc une texture PLAUSIBLE en
// devinant d'après le nom du matériau — ce n'est pas le rendu d'origine, mais
// c'est du décor crédible au lieu d'une surface blanche.
//
// Usage :
//   node scripts/patch-untextured-materials.mjs <fichier.glb>... [--pack=<dir>] [--apply]
//
// Sans `--apply` : DRY-RUN, affiche ce qui serait fait sans rien écrire.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { readFileSync, existsSync, copyFileSync, statSync, readdirSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("--"));
const files = argv.filter((a) => !a.startsWith("--"));
const APPLY = flags.includes("--apply");
const PACK = (flags.find((f) => f.startsWith("--pack=")) ?? "").slice(7)
  || "public/models/export/bullet/content/new/unreal/MWLandscapeAutoMaterial/Textures";

if (files.length === 0) {
  console.error("Usage: node scripts/patch-untextured-materials.mjs <fichier.glb>... [--pack=<dir>] [--apply]");
  process.exit(1);
}

/**
 * Mots-clés de nom de matériau → texture du pack. Premier trouvé gagne, d'où
 * l'ordre : les termes SPÉCIFIQUES avant les génériques (« snow » avant « rock »,
 * sinon un « snowy_rock » recevrait de la roche).
 */
const RULES = [
  [/snow|neige|ice|glacier/i,            "TEX_MWAM_Snow_col.png"],
  [/sand|desert|dune/i,                  "TEX_MWAM_SandA_col.png"],
  [/grass|herbe|foliage|meadow/i,        "TEX_MWAM_Grass_col.png"],
  [/dirt|mud|terre|soil|ground/i,        "TEX_MWAM_Dirt_col.png"],
  [/stone|gravel|pebble|cobble/i,        "TEX_MWAM_Stones_col.png"],
  [/rock|cliff|mountain|montagne|bsp/i,  "TEX_MWAM_Rock_col.png"],
];
/** Repli quand aucun mot-clé ne matche : la roche passe partout en extérieur. */
const DEFAULT_TEX = "TEX_MWAM_Rock_col.png";

function pickTexture(name) {
  for (const [re, tex] of RULES) if (re.test(name)) return tex;
  return DEFAULT_TEX;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

/**
 * Index récursif du pack : nom de fichier → chemin complet.
 *
 * Les textures d'un pack Unreal sont réparties en sous-dossiers thématiques
 * (Textures/Cover, Materials/MASTER/Textures…). Chercher à plat dans la racine
 * n'en trouvait aucune.
 */
function indexPack(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      // Premier trouvé gagne : les doublons de nom sont rares et équivalents.
      else if (!out.has(e.name)) out.set(e.name, full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

// On indexe la RACINE du pack, pas seulement son dossier Textures/.
const PACK_ROOT = PACK.endsWith("Textures") ? path.dirname(PACK) : PACK;
const packIndex = indexPack(PACK_ROOT);
console.log(`[patch] pack : ${PACK_ROOT} — ${packIndex.size} fichiers indexés`);

/** Cache disque : une même texture est réutilisée par des dizaines de matériaux. */
const texCache = new Map();
function loadTex(file) {
  if (texCache.has(file)) return texCache.get(file);
  const p = packIndex.get(file);
  if (!p) { texCache.set(file, null); return null; }
  const buf = new Uint8Array(readFileSync(p));
  texCache.set(file, buf);
  return buf;
}

let totalPatched = 0;
for (const file of files) {
  if (!existsSync(file)) { console.warn(`  ? introuvable : ${file}`); continue; }
  const doc = await io.read(file);
  const root = doc.getRoot();

  // Sommets par matériau — pour hiérarchiser ce qui compte visuellement.
  const verts = new Map();
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      if (m) verts.set(m, (verts.get(m) ?? 0) + (prim.getAttribute("POSITION")?.getCount() ?? 0));
    }
  }

  const targets = root.listMaterials().filter((m) => m.getBaseColorTexture() === null);
  if (targets.length === 0) { console.log(`  = ${path.basename(file)} : rien à corriger`); continue; }

  const lines = [];
  let patched = 0;
  // Un Sampler partagé : répéter la texture, sinon un terrain de 200 m
  // afficherait un seul pixel étiré.
  const sampler = { wrapS: 10497, wrapT: 10497 }; // REPEAT / REPEAT

  for (const mat of targets) {
    const name = mat.getName() || "(sans nom)";
    const texFile = pickTexture(name);
    const data = loadTex(texFile);
    if (!data) { lines.push(`      ! texture absente du pack : ${texFile}`); continue; }

    if (APPLY) {
      const tex = doc.createTexture(texFile).setImage(data).setMimeType("image/png");
      mat.setBaseColorTexture(tex);
      const info = mat.getBaseColorTextureInfo();
      if (info) { info.setWrapS(sampler.wrapS); info.setWrapT(sampler.wrapT); }
      // La factor blanche multiplierait la texture sans la teinter ; on la
      // remet à blanc pur au cas où elle porterait une couleur d'export.
      mat.setBaseColorFactor([1, 1, 1, mat.getBaseColorFactor()[3]]);
    }
    patched++;
    lines.push(`      ${String(verts.get(mat) ?? 0).padStart(8)} sommets  ${name}  →  ${texFile}`);
  }

  console.log(`\n── ${path.basename(file)} : ${patched}/${targets.length} matériaux ${APPLY ? "corrigés" : "à corriger"}`);
  for (const l of lines.slice(0, 20)) console.log(l);
  if (lines.length > 20) console.log(`      … et ${lines.length - 20} autres`);

  if (APPLY && patched > 0) {
    // Sauvegarde avant écrasement — même règle que les autres scripts d'assets.
    const bkDir = path.join(path.dirname(file), "_untextured_backup");
    const bk = path.join(bkDir, path.basename(file));
    if (!existsSync(bk)) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(bkDir, { recursive: true });
      copyFileSync(file, bk);
    }
    await io.write(file, doc);
    console.log(`      écrit · ${(statSync(file).size / 1048576).toFixed(1)} MB`);
  }
  totalPatched += patched;
}

console.log(`\n[patch] ${totalPatched} matériaux ${APPLY ? "corrigés" : "seraient corrigés"}`);
if (!APPLY) console.log("[patch] DRY-RUN — relancez avec --apply pour écrire.");
else console.log("[patch] ⚠ Incrémentez CACHE_VERSION dans chunkCache.ts si vous avez patché des chunks.");
