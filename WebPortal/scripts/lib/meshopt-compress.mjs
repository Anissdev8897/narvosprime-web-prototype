// ══════════════════════════════════════════════════════════════════════════════
// scripts/lib/meshopt-compress.mjs — Meshoptimizer compression pour GLB.
//
// FONCTIONS EXPORTÉES :
//   compressWithMeshopt(doc, options)  → Transforme un Document en ajoutant
//                                        meshopt + reorder + quantize.
//   collectGlbs(dir)                   → Liste récursive des .glb.
//   estimateOriginalSize(file)         → Taille avant compression (peut lire
//                                        le backup ou le fichier actuel).
//   MB(bytes)                          → Afficheur lisible.
//
// Usage CLI :
//   node scripts/lib/meshopt-compress.mjs <fichier|dossier>... [options]
//
// Options :
//   --level=<high|medium>    Niveau de compression (défaut: high).
//                              high → FILTER mode (8-bit normal, meilleur ratio)
//                              medium → QUANTIZE mode (compatible, plus rapide)
//   --quant-position=<N>     Bits pour POSITION (défaut: 14)
//   --quant-normal=<N>       Bits pour NORMAL (défaut: 10)
//   --quant-texcoord=<N>     Bits pour TEXCOORD (défaut: 12)
//   --dry-run                Ne rien écrire, afficher les gains estimés
//   --skip-existing          Ignorer les .glb déjà compressés meshopt
//   --backup                 Archiver les originaux dans _meshopt_backup/
//
// PRÉREQUIS :
//   npm install meshoptimizer  (package déjà en dépendance)
//   Le module WASM meshoptimizer est chargé automatiquement.
//
// COMPATIBILITÉ :
//   EXT_meshopt_compression est supporté par Three.js r152+ via
//   MeshoptDecoder. Si le runtime charge un GLB meshopt sans décodeur,
//   Three.js throw. Vérifier que le loader passe bien MeshoptDecoder.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { existsSync, statSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

// ── Constantes ───────────────────────────────────────────────────────────────

/** Taille minimale pour que meshopt ait un intérêt (< cette taille = skip silencieux). */
const MIN_SIZE_BYTES = 1024;

/** Extensions meshopt. */
const MESHOPT_EXT = "EXT_meshopt_compression";

// ── Helpers ──────────────────────────────────────────────────────────────────

export const MB = (b) => (b / 1048576).toFixed(1);

/**
 * Liste récursivement tous les .glb sous un dossier (ou un fichier unique).
 */
export async function collectGlbs(entry) {
  const st = statSync(entry, { throwIfNoEntry: false });
  if (!st) { console.warn(`[meshopt] introuvable: ${entry}`); return []; }
  if (st.isFile()) return entry.toLowerCase().endsWith(".glb") ? [entry] : [];

  const out = [];
  for (const d of await readdir(entry, { withFileTypes: true })) {
    const full = path.join(entry, d.name);
    if (d.isDirectory()) {
      if (d.name.startsWith("_meshopt_backup") || d.name.startsWith("_ktx2_backup")) continue;
      out.push(...await collectGlbs(full));
    } else if (d.name.toLowerCase().endsWith(".glb")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Vérifie si un GLB a déjà la compression meshopt.
 * On checke la présence de l'extension EXT_meshopt_compression dans les accessors.
 * Rapide : lit les 200 premiers octets en mode texte pour éviter de charger tout le fichier.
 */
function hasMeshoptExtension(filePath) {
  try {
    const buf = readFileSync(filePath, { encoding: "utf8", flag: "r" });
    // Pour les .glb binaires, l'extension est dans le JSON chunk
    if (buf.includes(MESHOPT_EXT)) return true;
  } catch {
    // Lecture partielle peut échouer sur un binaire pur — on charge via IO dans ce cas
  }
  return false;
}

/**
 * Vérifie si un GLB a la compression meshopt en chargeant le document.
 * Plus fiable mais plus lent.
 */
async function hasMeshoptFull(filePath) {
  try {
    const doc = await getIO().read(filePath);
    const accessors = doc.getRoot().listAccessors();
    return accessors.some((a) => a.getExtension(MESHOPT_EXT) !== null);
  } catch {
    return false;
  }
}

let _io = null;
function getIO() {
  if (!_io) {
    _io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  }
  return _io;
}

/**
 * Estime la taille originale d'un GLB à partir du fichier actuel.
 * Avant meshopt = lecture brute du fichier (taille actuelle si meshopt est absent).
 */
export function estimateOriginalSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch { return 0; }
}

// ── Compression ──────────────────────────────────────────────────────────────

/**
 * Applique la compression meshoptimizer à un Document glTF.
 *
 * @param {import("@gltf-transform/core").Document} doc
 * @param {object} options
 * @param {'high'|'medium'} [options.level='high']  Niveau de compression
 * @param {number} [options.quantPosition=14]  Bits pour POSITION
 * @param {number} [options.quantNormal=10]    Bits pour NORMAL
 * @param {number} [options.quantTexcoord=12]  Bits pour TEXCOORD
 * @param {number} [options.quantColor=10]     Bits pour COLOR
 * @returns {Promise<{beforeBytes: number, afterBytes: number, accessors: number}>}
 */
export async function compressWithMeshopt(doc, options = {}) {
  const {
    level = "high",
    quantPosition = 14,
    quantNormal = 10,
    quantTexcoord = 12,
    quantColor = 10,
  } = options;

  // Attendre que le WASM meshoptimizer soit prêt
  await MeshoptEncoder.ready;

  // Stats avant
  const accessorsBefore = doc.getRoot().listAccessors().length;
  // On ne peut pas facilement calculer la taille binaire avant écriture.
  // On retournera la taille après écriture, et l'appelant compare.

  // Appliquer meshopt
  await doc.transform(
    meshopt({
      encoder: MeshoptEncoder,
      level,
      quantizePosition: quantPosition,
      quantizeNormal: quantNormal,
      quantizeTexcoord: quantTexcoord,
      quantizeColor: quantColor,
    })
  );

  // Stats après
  const accessorsAfter = doc.getRoot().listAccessors().filter(
    (a) => a.getExtension(MESHOPT_EXT) !== null
  ).length;

  return {
    accessorsBefore,
    accessorsCompressed: accessorsAfter,
    level,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith("--"));
  const inputs = args.filter((a) => !a.startsWith("--"));

  const has = (n) => flags.includes(`--${n}`);
  const val = (n, d) => {
    const f = flags.find((x) => x.startsWith(`--${n}=`));
    return f ? f.slice(n.length + 3) : d;
  };

  if (inputs.length === 0) {
    console.error("Usage: node scripts/lib/meshopt-compress.mjs <fichier|dossier>... [--level=high] [--dry-run] [--skip-existing]");
    process.exit(1);
  }

  const LEVEL        = val("level", "high");
  const DRY_RUN      = has("dry-run");
  const SKIP_EXISTING = has("skip-existing");
  const DO_BACKUP    = has("backup");
  const QUANT_POS    = parseInt(val("quant-position", "14"), 10);
  const QUANT_NORM   = parseInt(val("quant-normal", "10"), 10);
  const QUANT_TEX    = parseInt(val("quant-texcoord", "12"), 10);

  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  NARVOS PRIME - Meshoptimizer Compression");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  level=${LEVEL} · quant=${QUANT_POS}/${QUANT_NORM}/${QUANT_TEX}`);
  console.log(`  dry-run=${DRY_RUN} · skip-existing=${SKIP_EXISTING}`);
  console.log("");

  // Collecte des fichiers
  const allFiles = [];
  for (const i of inputs) {
    allFiles.push(...await collectGlbs(i));
  }

  if (allFiles.length === 0) {
    console.error("[meshopt] Aucun .glb trouvé.");
    process.exit(1);
  }

  console.log(`[meshopt] ${allFiles.length} GLB trouvés`);

  // On meshoptimize les fichiers
  const io = getIO();
  let totalBefore = 0;
  let totalAfter = 0;
  let totalCompressed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of allFiles) {
    const rel = path.relative(process.cwd(), file);
    const sizeBefore = statSync(file).size;

    // Skip les fichiers trop petits
    if (sizeBefore < MIN_SIZE_BYTES) {
      console.log(`  ~ ${rel} — trop petit (${MB(sizeBefore)} Mo), ignoré`);
      totalSkipped++;
      continue;
    }

    // Skip-existing
    if (SKIP_EXISTING) {
      try {
        const already = await hasMeshoptFull(file);
        if (already) {
          console.log(`  = ${rel} — déjà compressé meshopt, ignoré`);
          totalSkipped++;
          totalAfter += sizeBefore;
          continue;
        }
      } catch {
        // En cas d'erreur de lecture, on tente la compression
      }
    }

    if (DRY_RUN) {
      console.log(`  [dry] ${rel} — ${MB(sizeBefore)} Mo → estimation ~${MB(sizeBefore * 0.4)} Mo (-60%)`);
      totalBefore += sizeBefore;
      totalAfter += Math.round(sizeBefore * 0.4);
      totalCompressed++;
      continue;
    }

    // Chargement + compression
    try {
      const doc = await io.read(file);
      await MeshoptEncoder.ready;

      const result = await compressWithMeshopt(doc, {
        level: LEVEL,
        quantPosition: QUANT_POS,
        quantNormal: QUANT_NORM,
        quantTexcoord: QUANT_TEX,
      });

      // Backup si demandé
      if (DO_BACKUP) {
        const backupDir = path.join(path.dirname(file), "_meshopt_backup");
        mkdirSync(backupDir, { recursive: true });
        const dest = path.join(backupDir, path.basename(file));
        if (!existsSync(dest)) copyFileSync(file, dest);
      }

      // Écriture
      await io.write(file, doc);
      const sizeAfter = statSync(file).size;

      const ratio = sizeBefore > 0 ? ((1 - sizeAfter / sizeBefore) * 100).toFixed(1) : "?";

      totalBefore += sizeBefore;
      totalAfter += sizeAfter;
      totalCompressed++;

      console.log(
        `  ✓ ${rel}` +
        `\n      ${MB(sizeBefore)} → ${MB(sizeAfter)} Mo (${ratio}%)` +
        ` · ${result.accessorsCompressed}/${result.accessorsBefore} accessors compressés`
      );
    } catch (err) {
      totalErrors++;
      console.error(`  ✗ ${rel} : ${err.message}`);
    }
  }

  // ── Rapport final ──────────────────────────────────────────────
  const totalRatio = totalBefore > 0 ? ((1 - totalAfter / totalBefore) * 100).toFixed(1) : "?";
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  RAPPORT FINAL");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Traités    : ${totalCompressed} GLB`);
  console.log(`  Ignorés    : ${totalSkipped} GLB`);
  console.log(`  Erreurs    : ${totalErrors}`);
  console.log(`  Disque     : ${MB(totalBefore)} → ${MB(totalAfter)} Mo (${totalRatio}%)`);
  console.log(`  Économie   : ${MB(totalBefore - totalAfter)} Mo`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
}

// Exécution directe
const isMain = process.argv[1] && (
  process.argv[1].replace(/\\/g, "/").endsWith("meshopt-compress.mjs")
);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
