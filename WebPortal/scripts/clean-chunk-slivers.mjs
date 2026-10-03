// ══════════════════════════════════════════════════════════════════════════════
// scripts/clean-chunk-slivers.mjs — Nettoie des chunks GLB DÉJÀ générés.
//
// Évite de repartir des 3 Go de source : le nettoyage ne touche que l'index
// buffer, il peut donc s'appliquer après coup sur les chunks livrés.
//
// Usage :
//   node scripts/clean-chunk-slivers.mjs <dossier> [--dry-run] [--aspect=500] [--edge=8]
//   node scripts/clean-chunk-slivers.mjs public/models/Maps/forge_map/chunks_v2
//
// Traite les trois variantes (.glb, .med.glb, .low.glb) d'un coup.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { cleanSlivers, SLIVER_DEFAULTS } from "./lib/clean-slivers.mjs";

const argv = process.argv.slice(2);
const dir = argv.find((a) => !a.startsWith("--"));
const flag = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? Number(hit.slice(n.length + 3)) : d;
};
const DRY = argv.includes("--dry-run");
const maxAspect = flag("aspect", SLIVER_DEFAULTS.maxAspect);
const minLongEdge = flag("edge", SLIVER_DEFAULTS.minLongEdge);

if (!dir || !fs.existsSync(dir)) {
  console.error("Usage: node scripts/clean-chunk-slivers.mjs <dossier> [--dry-run]");
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

const files = fs
  .readdirSync(dir)
  .filter((f) => /^chunk_\d+(\.med|\.low)?\.glb$/i.test(f))
  .sort();

if (files.length === 0) {
  console.error(`Aucun chunk trouvé dans ${dir}`);
  process.exit(1);
}

console.log(
  `[clean] ${files.length} chunk(s) · aspect>${maxAspect} ET arête>${minLongEdge}u` +
  (DRY ? " · DRY-RUN" : ""),
);

let totExamined = 0;
let totDegenerate = 0;
let totSlivers = 0;

for (const f of files) {
  const p = path.join(dir, f);
  const before = fs.statSync(p).size;
  const doc = await io.read(p);

  const r = cleanSlivers(doc, { maxAspect, minLongEdge });
  totExamined += r.examined;
  totDegenerate += r.degenerate;
  totSlivers += r.slivers;

  const removed = r.degenerate + r.slivers;
  const pct = r.examined ? ((removed / r.examined) * 100).toFixed(2) : "0";

  if (DRY) {
    console.log(`  [dry] ${f.padEnd(22)} ${r.degenerate} aire nulle + ${r.slivers} lames = ${pct} %`);
    continue;
  }

  if (removed === 0) {
    console.log(`  = ${f.padEnd(22)} déjà propre`);
    continue;
  }

  // prune() récupère les sommets devenus orphelins ; draco() ré-encode la
  // géométrie, sinon la sortie repart en brut et le fichier explose.
  // 18 bits : cohérent avec puzzle-chunks.mjs, et vérifié sans perte ici
  // (ré-encoder une entrée propre à 14 comme à 22 bits ne crée AUCUN triangle
  // d'aire nulle — mesuré, la quantification n'est pas en cause).
  await doc.transform(prune(), draco({ quantizePosition: 18, quantizeNormal: 12 }));
  await io.write(p, doc);

  const after = fs.statSync(p).size;
  console.log(
    `  ✓ ${f.padEnd(22)} ${r.degenerate} aire nulle + ${r.slivers} lames retirés (${pct} %) · ` +
    `${(before / 1048576).toFixed(1)} → ${(after / 1048576).toFixed(1)} Mo`,
  );
}

const removed = totDegenerate + totSlivers;
console.log(
  `\n[clean] ${removed.toLocaleString()} triangles retirés sur ${totExamined.toLocaleString()} ` +
  `(${((removed / totExamined) * 100).toFixed(2)} %) — ` +
  `${totDegenerate.toLocaleString()} d'aire nulle, ${totSlivers.toLocaleString()} lames`,
);
if (!DRY) {
  console.log("[clean] ⚠ Incrémenter CACHE_VERSION dans chunkCache.ts — mêmes noms de fichiers.");
}
