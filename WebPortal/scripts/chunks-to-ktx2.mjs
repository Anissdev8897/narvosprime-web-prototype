// ══════════════════════════════════════════════════════════════════════════════
// chunks-to-ktx2.mjs — Convertit les textures des chunks de map en KTX2/Basis.
//
// POURQUOI : WebP est compact sur DISQUE mais le GPU le décompresse en RGBA8 brut.
// Un 2048² = 22 Mo de VRAM quel que soit le poids du fichier. Les chunks forge
// portent ~730 textures (dont 544 en 2048²) → ~13,5 Go de VRAM PAR CHUNK, soit
// ~108 Go pour les 8. D'où la perte de contexte WebGL et le freeze en jeu.
//
// KTX2/Basis reste COMPRESSÉ sur le GPU (transcodé en BC7/ETC/ASTC selon la
// machine) → 4 à 8× moins de VRAM. Combiné à un downsize vers 1024, on divise
// l'empreinte VRAM par ~16.
//
// DIFFÉRENCE AVEC assets-to-ktx2.mjs : ici on RE-COMPRESSE aussi la géométrie
// (draco + prune + dedup). C'est sans danger sur des chunks de DÉCOR — pas de
// squelette, pas de morph target, pas de socket d'arme. Sur des personnages ce
// serait destructeur, d'où le script séparé.
//
// L'encodage des textures lui-même vit dans lib/ktx2-encode.mjs, partagé par les
// deux scripts : c'est là qu'est appliquée la contrainte de dimensions en
// puissance de deux, sans laquelle le GPU rejette l'upload.
//
// Usage :
//   node scripts/chunks-to-ktx2.mjs <chunkDir> [maxSize] [--uastc-normals] [--skip-existing]
// Exemple :
//   node scripts/chunks-to-ktx2.mjs public/models/Maps/forge_map/chunks 1024
//
// Prérequis : le CLI `ktx` (KTX-Software ≥ 4.3). Chemin auto-détecté dans
// tools/KTX-Software-main/, ou via la variable d'environnement KTX_CLI.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRTextureBasisu } from "@gltf-transform/extensions";
import { prune, dedup, draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  findKtxCli, convertDocumentTextures, dropUnusedWebpExtension,
  DEFAULT_CONCURRENCY, MB,
} from "./lib/ktx2-encode.mjs";

// ── Arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const positional = argv.filter((a) => !a.startsWith("--"));
const [chunkDir, maxSizeArg] = positional;

if (!chunkDir) {
  console.error("Usage: node chunks-to-ktx2.mjs <chunkDir> [maxSize] [--uastc-normals] [--skip-existing]");
  process.exit(1);
}
const MAX_SIZE = maxSizeArg ? parseInt(maxSizeArg, 10) : 1024;
const UASTC_NORMALS = flags.has("--uastc-normals");
const SKIP_EXISTING = flags.has("--skip-existing");

const KTX_CLI = findKtxCli();
if (!KTX_CLI) {
  console.error("[ktx2] CLI `ktx` introuvable. Compilez KTX-Software ou exportez KTX_CLI=<chemin>.");
  process.exit(1);
}
console.log(`[ktx2] CLI : ${KTX_CLI}`);
console.log(`[ktx2] maxSize=${MAX_SIZE}px · concurrence=${DEFAULT_CONCURRENCY} · uastcNormals=${UASTC_NORMALS}`);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "ktx2-"));

async function convertChunk(filePath) {
  const name = path.basename(filePath);
  const doc = await io.read(filePath);

  process.stdout.write(`[ktx2] ${name} …`);
  const stats = await convertDocumentTextures(doc, {
    maxSize: MAX_SIZE, ktxCli: KTX_CLI, tmpDir, tag: name,
    uastcNormals: UASTC_NORMALS, concurrency: DEFAULT_CONCURRENCY,
  });

  // On ne déclare l'extension que si au moins une texture est réellement en KTX2,
  // sinon le GLB exige une extension que son contenu n'utilise pas.
  if (stats.after > 0 && stats.failed < stats.count) {
    doc.createExtension(KHRTextureBasisu).setRequired(true);
  }

  await doc.transform(prune(), dedup(), draco());
  dropUnusedWebpExtension(doc);
  await io.write(filePath, doc);

  const size = readFileSync(filePath).byteLength;
  console.log(
    ` ${stats.count} textures · ${MB(stats.before)} → ${MB(stats.after)} MB` +
    ` · VRAM ~${MB(stats.vramBefore)} MB → compressée · fichier ${MB(size)} MB` +
    (stats.failed ? ` · ${stats.failed} échecs` : "") +
    (stats.skipped ? ` · ${stats.skipped} ignorées` : ""),
  );
  return stats;
}

// ── Boucle principale ────────────────────────────────────────────────────────
const entries = (await readdir(chunkDir)).filter((f) => f.endsWith(".glb")).sort();

if (entries.length === 0) {
  console.error(`[ktx2] Aucun .glb dans ${chunkDir}`);
  process.exit(1);
}

console.log(`[ktx2] ${entries.length} chunks à traiter dans ${chunkDir}\n`);
let totalBefore = 0, totalAfter = 0, totalVram = 0, totalFailed = 0;

for (const entry of entries) {
  const full = path.join(chunkDir, entry);
  if (SKIP_EXISTING) {
    const doc = await io.read(full);
    const texs = doc.getRoot().listTextures();
    if (texs.length > 0 && texs.every((t) => t.getMimeType() === "image/ktx2")) {
      console.log(`[ktx2] ${entry} : déjà en KTX2, ignoré`);
      continue;
    }
  }
  const r = await convertChunk(full);
  totalBefore += r.before; totalAfter += r.after; totalVram += r.vramBefore; totalFailed += r.failed;
}

rmSync(tmpDir, { recursive: true, force: true });

const ratio = totalAfter > 0 ? (totalBefore / totalAfter).toFixed(1) : "?";
console.log(`\n[ktx2] TERMINÉ — textures ${MB(totalBefore)} → ${MB(totalAfter)} MB (÷${ratio})`);
console.log(`[ktx2] VRAM avant : ~${MB(totalVram)} MB`);
if (totalFailed) console.log(`[ktx2] ${totalFailed} textures conservées en WebP (échec d'encodage)`);
console.log(`[ktx2] ⚠ Incrémentez CACHE_VERSION dans src/rpg/runtime/loading/chunkCache.ts`);
console.log(`[ktx2]   pour forcer le re-téléchargement (le cache IndexedDB sert encore l'ancien).`);
console.log(`[ktx2] ⚠ Puis vérifiez : node scripts/diagnostics/check-ktx2-dims.mjs ${chunkDir}`);
