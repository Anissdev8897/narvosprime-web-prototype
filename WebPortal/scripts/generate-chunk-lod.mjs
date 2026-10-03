// ══════════════════════════════════════════════════════════════════════════════
// scripts/generate-chunk-lod.mjs — Génère les variantes LOD de géométrie
//
// Usage :
//   node scripts/generate-chunk-lod.mjs <chunksDir> [--ratio-med=0.5] [--ratio-low=0.25]
//
// Pour chaque chunk_XX.glb dans chunksDir, cette script produit :
//   chunk_XX.lod_med.glb   → décimé à 50% des triangles (ratio-med)
//   chunk_XX.lod_low.glb   → décimé à 25% des triangles (ratio-low)
//
// STRATÉGIE :
//   Utilise les fonctions Simplify (meshoptimizer) de @gltf-transform/functions
//   pour réduire le nombre de triangles de chaque mesh tout en préservant la
//   topologie (texture coordinates, normals). La décimation est agnostique à la
//   texture : les matériaux/textures originaux sont conservés (donc pas de
//   re-téléchargement pour le joueur si les textures sont déjà en cache).
//
// UTILISATION DANS LE PIPELINE COMPLET :
//   Les variantes .lod_med.glb / .lod_low.glb sont des variantes de GÉOMÉTRIE,
//   distinctes des variantes de QUALITÉ TEXTURE (.med.glb / .low.glb) produites
//   par rebuild-map-chunks.mjs. On peut les cumuler :
//     chunk_01.glb          → HIGH (2048px textures + full geometry)
//     chunk_01.med.glb      → texture MEDIUM (1024px) + full geometry
//     chunk_01.lod_med.glb  → HIGH textures + geometry LOD (50% tris)
//     chunk_01.low.glb      → texture LOW (512px) + full geometry
//     chunk_01.lod_low.glb  → HIGH textures + geometry LOD (25% tris)
//
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { simplify, prune, dedup } from "@gltf-transform/functions";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import process from "node:process";
import draco3d from "draco3dgltf";

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let chunksDir = args.find((a) => !a.startsWith("--")) || ".";
const RATIO_MED = parseFloat(args.find((a) => a.startsWith("--ratio-med="))?.split("=")[1] ?? "0.5");
const RATIO_LOW = parseFloat(args.find((a) => a.startsWith("--ratio-low="))?.split("=")[1] ?? "0.25");
const VERBOSE = args.includes("--verbose");

if (RATIO_MED <= 0 || RATIO_MED > 1 || RATIO_LOW <= 0 || RATIO_LOW > 1) {
  console.error("Les ratios doivent être entre 0 (exclusif) et 1.");
  process.exit(1);
}

if (!existsSync(chunksDir)) {
  console.error(`Dossier introuvable : ${chunksDir}`);
  process.exit(1);
}

// ── Config ───────────────────────────────────────────────────────────────────

const SUFFIX_MED = "lod_med";
const SUFFIX_LOW = "lod_low";

// ── IO setup ─────────────────────────────────────────────────────────────────

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

function chunkFilename(i) {
  const n = String(i + 1).padStart(2, "0");
  return `chunk_${n}.glb`;
}

// ── Stats tracking ───────────────────────────────────────────────────────────

let totalOriginalTris = 0;
let totalMedTris = 0;
let totalLowTris = 0;
let processed = 0;
let errors = 0;

// ── Décimation d'un chunk ────────────────────────────────────────────────────

async function generateLODVariants(chunkPath, chunkName) {
  const basenameNoExt = chunkName.replace(/\.glb$/i, "");
  const medPath = join(chunksDir, `${basenameNoExt}.${SUFFIX_MED}.glb`);
  const lowPath = join(chunksDir, `${basenameNoExt}.${SUFFIX_LOW}.glb`);

  // Skip si déjà générés
  if (existsSync(medPath) && existsSync(lowPath)) {
    if (VERBOSE) console.log(`  ↻ ${chunkName} — déjà généré, skip`);
    return;
  }

  console.log(`  λ ${chunkName} → ${SUFFIX_MED} (${(RATIO_MED * 100).toFixed(0)}%) + ${SUFFIX_LOW} (${(RATIO_LOW * 100).toFixed(0)}%)`);

  // Charger le document source
  const doc = await io.read(chunkPath);
  const root = doc.getRoot();

  // Compter les triangles originaux
  let origTris = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      if (idx) origTris += idx.getCount() / 3;
    }
  }

  // ── Génération MEDIUM ──
  await doc.transform(
    simplify({ ratio: RATIO_MED, error: 0.001 }),
    prune(),
    dedup(),
  );

  let medTris = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      if (idx) medTris += idx.getCount() / 3;
    }
  }

  // Ré-encoder avec Draco
  await doc.transform(
    (await import("@gltf-transform/functions")).draco({
      quantizePosition: 18,
      quantizeNormal: 12,
    }),
  );

  await io.write(medPath, doc);

  // ── Génération LOW (à partir du medium pour éviter double décimation) ──
  // On recharge la source pour partir du mesh original
  const docLow = await io.read(chunkPath);
  await docLow.transform(
    simplify({ ratio: RATIO_LOW, error: 0.002 }),
    prune(),
    dedup(),
  );

  let lowTris = 0;
  for (const mesh of docLow.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      if (idx) lowTris += idx.getCount() / 3;
    }
  }

  await docLow.transform(
    (await import("@gltf-transform/functions")).draco({
      quantizePosition: 18,
      quantizeNormal: 12,
    }),
  );

  await io.write(lowPath, docLow);

  // Stats
  const medSize = statSync(medPath).size;
  const lowSize = statSync(lowPath).size;

  totalOriginalTris += origTris;
  totalMedTris += medTris;
  totalLowTris += lowTris;
  processed++;

  console.log(
    `    ✓ ${basenameNoExt}.${SUFFIX_MED}.glb  ${(medSize / 1024).toFixed(0)} KB  ` +
    `${origTris.toLocaleString()} → ${medTris.toLocaleString()} tris ` +
    `(${((1 - medTris / origTris) * 100).toFixed(1)}% réduit)`
  );
  console.log(
    `    ✓ ${basenameNoExt}.${SUFFIX_LOW}.glb  ${(lowSize / 1024).toFixed(0)} KB  ` +
    `${origTris.toLocaleString()} → ${lowTris.toLocaleString()} tris ` +
    `(${((1 - lowTris / origTris) * 100).toFixed(1)}% réduit)`
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  console.log(`═ LOD Generation ═════════════════════════════════════════`);
  console.log(`Dossier : ${chunksDir}`);
  console.log(`Ratio MED : ${RATIO_MED} (${(RATIO_MED * 100).toFixed(0)}%)`);
  console.log(`Ratio LOW : ${RATIO_LOW} (${(RATIO_LOW * 100).toFixed(0)}%)`);

  // Lister tous les chunk_XX.glb (pas les variantes déjà générées)
  const files = readdirSync(chunksDir)
    .filter((f) => /^chunk_\d{2}\.glb$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error("Aucun fichier chunk_XX.glb trouvé.");
    process.exit(1);
  }

  console.log(`Chunks trouvés : ${files.length}`);

  for (const file of files) {
    const chunkPath = join(chunksDir, file);
    await generateLODVariants(chunkPath, file);
  }

  // ── Rapport final ──
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n═ Rapport LOD ════════════════════════════════════════════`);
  console.log(`Chunks traités   : ${processed}`);
  if (errors) console.log(`Erreurs          : ${errors}`);
  console.log(`Triangles totaux :`);
  console.log(`  HIGH   : ${totalOriginalTris.toLocaleString()}`);
  console.log(`  MEDIUM : ${totalMedTris.toLocaleString()} (${((1 - totalMedTris / totalOriginalTris) * 100).toFixed(1)}% réduction)`);
  console.log(`  LOW    : ${totalLowTris.toLocaleString()} (${((1 - totalLowTris / totalOriginalTris) * 100).toFixed(1)}% réduction)`);
  console.log(`Temps total : ${elapsed}s`);
  console.log(`\n⚠ N'oubliez pas d'incrémenter CACHE_VERSION dans chunkCache.ts`);
}

main().catch((err) => {
  console.error("ERREUR:", err);
  process.exit(1);
});
