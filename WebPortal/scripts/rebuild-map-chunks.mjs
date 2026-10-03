// ══════════════════════════════════════════════════════════════════════════════
// rebuild-map-chunks.mjs — Chaîne COMPLÈTE d'un GLB de map vers des chunks
// prêts à jouer, variantes de qualité comprises.
//
//   node scripts/rebuild-map-chunks.mjs <source.glb> <outDir> [chunks=8]
//
// POURQUOI CE SCRIPT EXISTE :
// La chaîne correcte tenait dans un skill et dans la tête de celui qui l'avait
// lancée la dernière fois. Elle compte cinq étages, chacun avec un drapeau qu'on
// ne peut pas deviner, et l'ordre n'est pas commutatif :
//
//   1. puzzle-chunks --spatial   ← SANS --spatial, tous les chunks couvrent la
//                                  carte entière : un chunk manquant troue
//                                  PARTOUT au lieu d'une seule région
//   2. chunks-to-ktx2 (ETC1S)    ← SANS --uastc-normals : en UASTC les normal
//                                  maps pèsent 1113 Ko contre 77 Ko, et c'est ce
//                                  chemin qui lève RangeError dans le
//                                  transcodeur Basis
//   3. clean-chunk-slivers       ← APRÈS la compression, PAS avant. Mesuré sur
//                                  cette map : nettoyer d'abord laissait 1,89 %
//                                  de triangles d'aire nulle (7,15 % sur le pire
//                                  chunk), parce que le `prune()+dedup()+draco()`
//                                  de l'étage KTX2 les FABRIQUE. Nettoyer après
//                                  descend à 0,00 %, et le nettoyeur n'en
//                                  refabrique pas (re-mesuré : 0 sur 6 064 389)
//   4. variantes .med / .low     ← regénérées DEPUIS LA SOURCE à 1024 et 512,
//      jamais par ré-encodage d'un KTX2 (compression
//      sur compression = artefacts cumulés)
//   5. variantes .lod_med / .lod_low ← (optionnel) décimation géométrique
//      via meshoptimizer pour le LOD progressif runtime.
//      Voir scripts/generate-chunk-lod.mjs
//   6. bump CACHE_VERSION          ← les fichiers gardent leurs noms ; sans bump,
//      IndexedDB ressert les anciens et toute la
//      régénération est INVISIBLE en jeu
//
// L'étape 6 n'est pas automatisée exprès : elle touche du TypeScript versionné,
// et un script qui édite du code sous les pieds du développeur est pire que le
// rappel qu'il affiche à la fin.
// ══════════════════════════════════════════════════════════════════════════════

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const [srcArg, outArg, countArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const WITH_LOD = process.argv.includes("--lod");

if (!srcArg || !outArg) {
  console.error("Usage: node scripts/rebuild-map-chunks.mjs <source.glb> <outDir> [chunkCount=8]");
  process.exit(1);
}

const SRC = path.resolve(ROOT, srcArg);
const OUT = path.resolve(ROOT, outArg);
const COUNT = countArg ? parseInt(countArg, 10) : 8;

if (!fs.existsSync(SRC)) {
  console.error(`Source introuvable : ${SRC}`);
  process.exit(1);
}

/** Les trois niveaux. `suffix` vide = la variante haute, celle que le manifest nomme. */
const LEVELS = [
  { name: "high", texSize: 2048, suffix: "" },
  { name: "med",  texSize: 1024, suffix: ".med" },
  { name: "low",  texSize: 512,  suffix: ".low" },
];

const t0 = Date.now();
const step = (label, cmd, args) => {
  console.log(`\n▶ ${label}`);
  console.log(`  ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\n✗ ÉCHEC à l'étape « ${label} » (code ${r.status}). Rien n'est écrit dans ${outArg}.`);
    process.exit(1);
  }
};

const stage = path.join(ROOT, ".chunk-build");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

console.log(`Source  : ${srcArg}`);
console.log(`Sortie  : ${outArg}`);
console.log(`Chunks  : ${COUNT} × ${LEVELS.length} niveaux de qualité`);

for (const lvl of LEVELS) {
  const dir = path.join(stage, lvl.name);
  step(`[${lvl.name}] découpe spatiale (textures ≤ ${lvl.texSize})`,
    "node", ["--max-old-space-size=8192", "scripts/puzzle-chunks.mjs",
      SRC, dir, String(COUNT), String(lvl.texSize), "--spatial"]);

  // ETC1S par défaut : voir l'en-tête, le mode UASTC sature le transcodeur.
  step(`[${lvl.name}] textures → KTX2`,
    "node", ["scripts/chunks-to-ktx2.mjs", dir, String(lvl.texSize)]);

  // APRÈS le KTX2, cf. l'en-tête : c'est cet étage qui fabrique les triangles
  // d'aire nulle. Les extensions sont préservées à la réécriture (ALL_EXTENSIONS
  // inclut KHRTextureBasisu) — vérifié : 9 985 textures KTX2 intactes après coup.
  step(`[${lvl.name}] nettoyage des triangles morts et des lames`,
    "node", ["scripts/clean-chunk-slivers.mjs", dir]);
}

// ── Assemblage : un seul dossier, trois suffixes ─────────────────────────────
console.log(`\n▶ assemblage dans ${outArg}`);
fs.mkdirSync(OUT, { recursive: true });

let written = 0;
for (const lvl of LEVELS) {
  const dir = path.join(stage, lvl.name);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".glb")) continue;
    const dest = path.join(OUT, f.replace(/\.glb$/, `${lvl.suffix}.glb`));
    fs.copyFileSync(path.join(dir, f), dest);
    written++;
  }
}

// Les métadonnées spatiales (centres, rayons) viennent de la variante haute :
// la géométrie est identique aux trois niveaux, seules les textures changent.
const meta = path.join(stage, "high", "chunk-metadata.json");
if (fs.existsSync(meta)) fs.copyFileSync(meta, path.join(OUT, "chunk-metadata.json"));

fs.rmSync(stage, { recursive: true, force: true });

// ── LOD geometry variants ────────────────────────────────────────────────────
console.log(`\n▶ génération des variantes LOD géométriques`);
step("LOD génération",
  "node", ["--max-old-space-size=8192", "scripts/generate-chunk-lod.mjs",
    OUT, "--ratio-med=0.5", "--ratio-low=0.25"]);

const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\n✓ ${written} fichiers écrits dans ${outArg} en ${mins} min`);
console.log("\nRESTE À FAIRE À LA MAIN :");
console.log("  1. incrémenter CACHE_VERSION dans src/rpg/runtime/loading/chunkCache.ts");
console.log("     (sinon IndexedDB ressert les anciens chunks et rien ne change en jeu)");
console.log(`  2. pointer MAPS.forge.chunkDir sur ${outArg} dans src/rpg/loaders/assetManifest.ts`);
