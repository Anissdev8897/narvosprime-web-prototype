// ══════════════════════════════════════════════════════════════════════════════
// scripts/compress-all-glbs.mjs — Pipeline batch de compression assets.
//
// APPLIQUE (dans l'ordre) :
//   1. meshoptimizer → compression vertex (-60% géométrie)
//   2. KTX2 → compression textures (BC7/ETC1S)
//
// Usage :
//   node scripts/compress-all-glbs.mjs <dossier>... [options]
//
// Options :
//   --meshopt-level=<high|medium>   Niveau meshopt (défaut: high)
//   --ktx2-max=<N>                  Taille max textures KTX2 (défaut: 1024)
//   --dry-run                       Simule sans écrire
//   --skip-existing                 Ignore les .glb déjà compressés
//   --backup                        Archive les originaux
//   --jobs=<N>                      Concurrence d'encodage (défaut: cœurs-1)
//   --only-meshopt                  Ne faire que la compression meshopt
//   --only-ktx2                     Ne faire que la compression KTX2
//
// Exemples :
//   node scripts/compress-all-glbs.mjs public/models/assets_character
//   node scripts/compress-all-glbs.mjs public/models --skip-existing --backup
//
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRTextureBasisu } from "@gltf-transform/extensions";
import { statSync, mkdirSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { MeshoptEncoder } from "meshoptimizer";
import path from "node:path";
import os from "node:os";
import {
  findKtxCli, convertDocumentTextures, dropUnusedWebpExtension,
  DEFAULT_CONCURRENCY, MB,
} from "./lib/ktx2-encode.mjs";
import { collectGlbs, compressWithMeshopt } from "./lib/meshopt-compress.mjs";

// ── Arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const inputs = argv.filter((a) => !a.startsWith("--"));

const has = (n) => flags.has(`--${n}`);
const val = (n, d) => {
  for (const f of flags) {
    if (f.startsWith(`--${n}=`)) return f.slice(n.length + 3);
  }
  return d;
};

if (inputs.length === 0) {
  console.error("Usage: node scripts/compress-all-glbs.mjs <dossier>... [--meshopt-level=high] [--ktx2-max=1024] [--dry-run]");
  process.exit(1);
}

const MESHOPT_LEVEL  = val("meshopt-level", "high");
const KTX2_MAX       = parseInt(val("ktx2-max", "1024"), 10);
const DRY_RUN        = has("dry-run");
const SKIP_EXISTING  = has("skip-existing");
const DO_BACKUP      = has("backup");
const CONCURRENCY    = parseInt(val("jobs", String(DEFAULT_CONCURRENCY)), 10);
const ONLY_MESHOPT   = has("only-meshopt");
const ONLY_KTX2      = has("only-ktx2");

// ── Collecte ─────────────────────────────────────────────────────────────────
const allFiles = [];
for (const i of inputs) allFiles.push(...await collectGlbs(i));

// Dédoublonne
const seen = new Set();
const files = allFiles.filter((f) => {
  const k = path.resolve(f);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
}).sort();

if (files.length === 0) {
  console.error("[compress] Aucun .glb trouvé.");
  process.exit(1);
}

console.log("");
console.log("═══════════════════════════════════════════════════");
console.log("  NARVOS PRIME - Pipeline de compression batch");
console.log("═══════════════════════════════════════════════════");
console.log(`  ${files.length} GLB · meshopt=${MESHOPT_LEVEL} · ktx2=${KTX2_MAX}px`);
console.log(`  dry-run=${DRY_RUN} · skip-existing=${SKIP_EXISTING} · backup=${DO_BACKUP}`);
if (ONLY_MESHOPT) console.log("  [mode] meshopt seulement");
if (ONLY_KTX2)    console.log("  [mode] KTX2 seulement");
if (!ONLY_MESHOPT && !ONLY_KTX2) console.log("  [mode] meshopt + KTX2");
console.log("");

const KTX_CLI = ONLY_MESHOPT ? null : findKtxCli();
if (!KTX_CLI && !ONLY_MESHOPT && !DRY_RUN) {
  console.error("[compress] ❌ CLI `ktx` introuvable pour la compression KTX2.");
  console.error("[compress]    Compilez KTX-Software ou exportez KTX_CLI=<chemin>.");
  console.error("[compress]    Utilisez --only-meshopt pour ne compresser que la géométrie.");
  process.exit(1);
}

// ── IO ───────────────────────────────────────────────────────────────────────
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Stats globales
let stats = {
  meshoptBefore: 0, meshoptAfter: 0, meshoptCount: 0, meshoptSkipped: 0,
  ktx2Before: 0, ktx2After: 0, ktx2VramBefore: 0, ktx2Failed: 0, ktx2Count: 0, ktx2Skipped: 0,
  errors: 0,
};

const t0 = Date.now();

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const sizeBefore = statSync(file).size;

  process.stdout.write(`  ${rel} …`);

  if (DRY_RUN) {
    console.log(` ${MB(sizeBefore)} Mo → estimation meshopt ${MB(sizeBefore * 0.4)} Mo + KTX2 ${MB(Math.max(sizeBefore * 0.3, 0.1))} Mo`);
    stats.meshoptBefore += sizeBefore;
    stats.meshoptAfter += Math.round(sizeBefore * 0.4);
    stats.ktx2Before += sizeBefore;
    stats.ktx2After += Math.round(sizeBefore * 0.2);
    stats.meshoptCount++;
    stats.ktx2Count++;
    continue;
  }

  try {
    const doc = await io.read(file);

    // ── 1. Meshoptimizer ─────────────────────────────────────
    if (!ONLY_KTX2) {
      const alreadyMeshopt = doc.getRoot().listAccessors().some(
        (a) => a.getExtension("EXT_meshopt_compression") !== null
      );

      if (SKIP_EXISTING && alreadyMeshopt) {
        stats.meshoptSkipped++;
      } else {
        await MeshoptEncoder.ready;
        await compressWithMeshopt(doc, { level: MESHOPT_LEVEL });
        stats.meshoptCount++;
      }
    }

    // ── 2. KTX2 textures ─────────────────────────────────────
    if (!ONLY_MESHOPT && KTX_CLI) {
      const texs = doc.getRoot().listTextures();
      const alreadyKtx2 = texs.length > 0 && texs.every((t) => t.getMimeType() === "image/ktx2");

      if (SKIP_EXISTING && alreadyKtx2) {
        stats.ktx2Skipped++;
      } else {
        const ktxResult = await convertDocumentTextures(doc, {
          maxSize: KTX2_MAX, ktxCli: KTX_CLI,
          tmpDir: path.join(os.tmpdir(), "compress-all-ktx2"),
          tag: path.basename(file, ".glb"),
          uastcNormals: true,
          concurrency: CONCURRENCY,
        });

        if (ktxResult.after > 0 && ktxResult.failed < ktxResult.count) {
          doc.createExtension(KHRTextureBasisu).setRequired(true);
        }
        dropUnusedWebpExtension(doc);

        stats.ktx2Before += ktxResult.before;
        stats.ktx2After += ktxResult.after;
        stats.ktx2VramBefore += ktxResult.vramBefore;
        stats.ktx2Failed += ktxResult.failed;
        if (ktxResult.count > 0) stats.ktx2Count++;
        else stats.ktx2Skipped++;
      }
    }

    // ── Backup original ──────────────────────────────────────
    if (DO_BACKUP && !ONLY_KTX2) {
      const backupDir = path.join(path.dirname(file), "_compress_backup");
      mkdirSync(backupDir, { recursive: true });
      const dest = path.join(backupDir, path.basename(file));
      if (!existsSync(dest)) copyFileSync(file, dest);
    }

    // ── Écriture ─────────────────────────────────────────────
    await io.write(file, doc);
    const sizeAfter = statSync(file).size;
    stats.meshoptBefore += sizeBefore;
    stats.meshoptAfter += sizeAfter;

    const ratio = sizeBefore > 0 ? ((1 - sizeAfter / sizeBefore) * 100).toFixed(1) : "?";
    console.log(` ✓ ${MB(sizeBefore)} → ${MB(sizeAfter)} Mo (${ratio}%)`);
  } catch (err) {
    stats.errors++;
    console.error(` ✗ ERREUR: ${err.message}`);
  }
}

// ── Rapport final ────────────────────────────────────────────────────────────
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const totalBefore = stats.meshoptBefore;
const totalAfter = stats.meshoptAfter;
const totalRatio = totalBefore > 0 ? ((1 - totalAfter / totalBefore) * 100).toFixed(1) : "?";

console.log("");
console.log("═══════════════════════════════════════════════════");
console.log("  RAPPORT DE COMPRESSION");
console.log("═══════════════════════════════════════════════════");
console.log(`  Fichiers          : ${files.length} GLB`);
console.log(`  Temps             : ${elapsed}s`);
console.log(`  Disque total      : ${MB(totalBefore)} → ${MB(totalAfter)} Mo (${totalRatio}%)`);
console.log(`  Économie          : ${MB(totalBefore - totalAfter)} Mo`);
if (stats.errors) console.log(`  Erreurs           : ${stats.errors}`);
console.log("");
if (!ONLY_KTX2) {
  console.log(`  Meshoptimizer     : ${stats.meshoptCount} compressés, ${stats.meshoptSkipped} ignorés`);
}
if (!ONLY_MESHOPT) {
  console.log(`  KTX2              : ${stats.ktx2Count} convertis, ${stats.ktx2Skipped} ignorés`);
  if (stats.ktx2Failed) console.log(`  KTX2 échecs       : ${stats.ktx2Failed}`);
  console.log(`  VRAM avant        : ~${MB(stats.ktx2VramBefore)} Mo`);
}
console.log("═══════════════════════════════════════════════════");
console.log("");
console.log("⚠️  Après compression, vérifiez le runtime Three.js :");
console.log("   1. MeshoptDecoder doit être passé au GLTFLoader");
console.log("   2. KTX2Loader doit être configuré");
console.log("");
