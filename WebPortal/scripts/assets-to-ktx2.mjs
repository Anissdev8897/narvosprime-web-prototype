// ══════════════════════════════════════════════════════════════════════════════
// assets-to-ktx2.mjs — Compresse les textures des GLB de PERSONNAGES et de PROPS.
//
// POURQUOI CE SCRIPT EN PLUS DE chunks-to-ktx2.mjs
//
// Le poids en VRAM ne dépend PAS du poids du fichier : une texture PNG ou WebP
// est décompressée en RGBA8 brut sur le GPU. Un 2048² coûte 22 Mo de VRAM
// (mipmaps compris) quel que soit son poids sur disque. Mesuré sur ce projet :
//
//     Wraith.glb    27 textures (4× 4096²)  →  832 Mo de VRAM
//     Murdock.glb   40 textures 2048²       →  853 Mo de VRAM
//     Rampage.glb   32 textures 2048²       →  682 Mo de VRAM
//
// Trois personnages saturent donc n'importe quel GPU → "THREE.WebGLRenderer:
// Context Lost", écran noir, et l'invite « recharger le jeu ». KTX2/Basis reste
// COMPRESSÉ en VRAM (transcodé en BC7/ETC/ASTC selon la machine) : combiné à un
// downsize 2048→1024, l'empreinte tombe d'un facteur ~17.
//
// CE QUI LE DISTINGUE DE chunks-to-ktx2.mjs — et pourquoi il ne fallait pas
// réutiliser celui-là tel quel :
//
//   • PAS de draco() — Wraith et Rampage ont des MORPH TARGETS, et l'encodeur
//     edgebreaker de Draco réordonne les sommets, ce qui les désaligne. De
//     toute façon la géométrie est négligeable ici (30–50k sommets), tout le
//     poids est dans les textures.
//   • PAS de prune() — prune() supprime les nœuds vides ; or les points
//     d'attache d'armes et d'accessoires SONT des nœuds vides, recherchés par
//     nom au runtime (WeaponSocket, BoneAttachment). Les pruner casse
//     l'équipement sans aucune erreur visible.
//   • PAS de dedup() — gain marginal à l'échelle d'un fichier, risque non nul.
//
// Bref : ce script ne touche QUE les textures. Géométrie, squelette, skinning,
// morph targets, nœuds et animations sortent bit-pour-bit identiques.
//
// Usage :
//   node scripts/assets-to-ktx2.mjs <fichier|dossier>... [options]
//
// Options :
//   --max=1024          résolution maximale (défaut 1024)
//   --uastc-normals     UASTC pour les normal maps (défaut ON, --no-uastc-normals pour couper)
//   --no-backup         n'archive pas les originaux (déconseillé)
//   --backup=<dir>      dossier d'archive (défaut : _ktx2_backup/ à côté du fichier)
//   --skip-existing     ignore les GLB déjà entièrement en KTX2
//   --dry-run           n'écrit rien, affiche seulement ce qui serait gagné
//   --jobs=N            concurrence d'encodage (défaut : cœurs - 1)
//
// Exemple :
//   node scripts/assets-to-ktx2.mjs public/models/assets_character --max=1024
//
// Prérequis : le CLI `ktx` (KTX-Software ≥ 4.3), auto-détecté dans tools/, ou
// via la variable d'environnement KTX_CLI.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRTextureBasisu } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, rmSync, statSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  findKtxCli, convertDocumentTextures, dropUnusedWebpExtension,
  DEFAULT_CONCURRENCY, MB,
} from "./lib/ktx2-encode.mjs";

// ── Arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("--"));
const inputs = argv.filter((a) => !a.startsWith("--"));

const has = (n) => flags.includes(`--${n}`);
const val = (n, d) => {
  const f = flags.find((x) => x.startsWith(`--${n}=`));
  return f ? f.slice(n.length + 3) : d;
};

if (inputs.length === 0 && !flags.some((f) => f.startsWith("--from="))) {
  console.error("Usage: node scripts/assets-to-ktx2.mjs <fichier|dossier>... [--from=liste.txt] [--max=1024] [--no-backup] [--dry-run]");
  process.exit(1);
}

const MAX_SIZE      = parseInt(val("max", "1024"), 10);
const UASTC_NORMALS = !has("no-uastc-normals");
const DO_BACKUP     = !has("no-backup");
const BACKUP_DIR    = val("backup", null);
const SKIP_EXISTING = has("skip-existing");
const DRY_RUN       = has("dry-run");
const CONCURRENCY   = parseInt(val("jobs", String(DEFAULT_CONCURRENCY)), 10);

const KTX_CLI = findKtxCli();
if (!KTX_CLI && !DRY_RUN) {
  console.error("[ktx2] CLI `ktx` introuvable. Compilez KTX-Software ou exportez KTX_CLI=<chemin>.");
  process.exit(1);
}

// ── Collecte des GLB ─────────────────────────────────────────────────────────
async function collectGlbs(entry) {
  const st = statSync(entry, { throwIfNoEntry: false });
  if (!st) { console.warn(`[ktx2] introuvable, ignoré : ${entry}`); return []; }
  if (st.isFile()) return entry.toLowerCase().endsWith(".glb") ? [entry] : [];

  const out = [];
  for (const d of await readdir(entry, { withFileTypes: true })) {
    const full = path.join(entry, d.name);
    // On n'archive pas l'archive : sinon une seconde passe convertirait les
    // originaux mis de côté, rendant la sauvegarde inutile.
    if (d.isDirectory()) {
      if (d.name === "_ktx2_backup") continue;
      out.push(...await collectGlbs(full));
    } else if (d.name.toLowerCase().endsWith(".glb")) {
      out.push(full);
    }
  }
  return out;
}

const files = [];
for (const i of inputs) files.push(...await collectGlbs(i));

// `--from=<fichier>` : une liste de chemins, un par ligne. Indispensable parce que
// la cible utile n'est PAS un dossier : public/models pèse ~120 Go dont le runtime
// ne charge qu'une fraction (cf. scripts/audit-runtime-assets.mjs). Passer 150
// chemins en arguments dépasserait la limite de ligne de commande de Windows.
const FROM = val("from", null);
if (FROM) {
  const listed = (await readFile(FROM, "utf8"))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const l of listed) files.push(...await collectGlbs(l));
}

// Dédoublonne : un même GLB listé deux fois serait converti deux fois, et la
// seconde passe archiverait une version DÉJÀ convertie par-dessus l'original.
const seen = new Set();
const unique = files.filter((f) => {
  const k = path.resolve(f);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
files.length = 0;
files.push(...unique);
files.sort();

if (files.length === 0) {
  console.error("[ktx2] Aucun .glb trouvé.");
  process.exit(1);
}

console.log(`[ktx2] CLI          : ${KTX_CLI ?? "(dry-run)"}`);
console.log(`[ktx2] ${files.length} GLB · maxSize=${MAX_SIZE}px · jobs=${CONCURRENCY} · uastcNormals=${UASTC_NORMALS}`);
console.log(`[ktx2] sauvegarde   : ${DO_BACKUP ? (BACKUP_DIR ?? "_ktx2_backup/ (à côté de chaque fichier)") : "DÉSACTIVÉE"}`);
if (DRY_RUN) console.log("[ktx2] DRY-RUN : aucun fichier ne sera écrit\n"); else console.log("");

// ── IO gltf-transform ────────────────────────────────────────────────────────
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "ktx2-assets-"));

/** Archive l'original avant écrasement. Ne réécrase jamais une archive existante. */
function backup(file) {
  const dir = BACKUP_DIR ?? path.join(path.dirname(file), "_ktx2_backup");
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, path.basename(file));
  // Si l'archive existe déjà, c'est une 2e passe : la conserver telle quelle,
  // sinon on écraserait l'original par une version déjà convertie.
  if (!existsSync(dest)) copyFileSync(file, dest);
  return dest;
}

// ── Boucle principale ────────────────────────────────────────────────────────
let tBefore = 0, tAfter = 0, tVram = 0, tFailed = 0, converted = 0, skipped = 0;
const totalDiskBefore = files.reduce((s, f) => s + statSync(f).size, 0);
let totalDiskAfter = 0;

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const doc = await io.read(file);

  if (SKIP_EXISTING) {
    const texs = doc.getRoot().listTextures();
    if (texs.length > 0 && texs.every((t) => t.getMimeType() === "image/ktx2")) {
      console.log(`  = ${rel} — déjà en KTX2`);
      skipped++;
      totalDiskAfter += statSync(file).size;
      continue;
    }
  }

  const stats = await convertDocumentTextures(doc, {
    maxSize: MAX_SIZE, ktxCli: KTX_CLI, tmpDir,
    tag: path.basename(file, ".glb"),
    uastcNormals: UASTC_NORMALS, concurrency: CONCURRENCY,
  });

  if (stats.count === 0 || stats.after === 0) {
    console.log(`  = ${rel} — aucune texture à convertir`);
    skipped++;
    totalDiskAfter += statSync(file).size;
    continue;
  }

  // VRAM estimée après : les formats transcodés font ~1 octet/pixel (BC7/UASTC)
  // ou ~0,5 (BC1/ETC1S). On retient 1 pour rester conservateur, mipmaps inclus.
  const px = MAX_SIZE * MAX_SIZE;
  const vramAfter = stats.count * px * 1 * 1.3333;

  if (!DRY_RUN) {
    if (DO_BACKUP) backup(file);
    if (stats.failed < stats.count) {
      doc.createExtension(KHRTextureBasisu).setRequired(true);
    }
    dropUnusedWebpExtension(doc);
    await io.write(file, doc);
  }

  const sizeAfter = DRY_RUN ? statSync(file).size : readFileSync(file).byteLength;
  totalDiskAfter += sizeAfter;
  tBefore += stats.before; tAfter += stats.after; tVram += stats.vramBefore; tFailed += stats.failed;
  converted++;

  console.log(
    `  ✓ ${rel}\n` +
    `      ${stats.count} textures · disque ${MB(stats.before)} → ${MB(stats.after)} MB` +
    ` · VRAM ~${MB(stats.vramBefore)} → ~${MB(vramAfter)} MB` +
    (stats.failed ? ` · ${stats.failed} ÉCHECS (gardées telles quelles)` : ""),
  );
}

rmSync(tmpDir, { recursive: true, force: true });

const vramAfterTotal = tVram > 0 ? tVram / 17 : 0; // ratio mesuré sur ce pipeline
console.log(`\n[ktx2] TERMINÉ — ${converted} convertis, ${skipped} ignorés`);
console.log(`[ktx2] disque : ${MB(totalDiskBefore)} → ${MB(totalDiskAfter)} MB`);
console.log(`[ktx2] VRAM   : ~${MB(tVram)} → ~${MB(vramAfterTotal)} MB (estimation)`);
if (tFailed) console.log(`[ktx2] ${tFailed} textures conservées dans leur format d'origine (échec d'encodage)`);
if (DO_BACKUP && !DRY_RUN) console.log(`[ktx2] Originaux archivés dans _ktx2_backup/ — supprimez-les une fois le rendu validé en jeu.`);
