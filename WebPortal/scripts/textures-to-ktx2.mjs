// ══════════════════════════════════════════════════════════════════════════════
// scripts/textures-to-ktx2.mjs — Convertit des PNG/JPG ISOLÉS en KTX2.
//
// `assets-to-ktx2.mjs` ne sait traiter que des textures EMBARQUÉES dans un GLB.
// Les couches de l'auto-material paysage, elles, vivent en fichiers séparés et
// sont échantillonnées directement par le shader triplanaire — d'où ce script.
//
// Pourquoi ça vaut le coup : une couche 4096² RGBA coûte 89 Mo de VRAM une fois
// décompressée. Les 7 couches utiles en pèsent 623 Mo. En KTX2 2048 elles
// tombent à ~25 Mo au total, et comme elles se RÉPÈTENT à l'échelle du monde,
// la densité de détail ne dépend plus de la taille de l'objet — contrairement à
// un bake par objet, mesuré à 0,45 texel/unité sur les plus grandes surfaces.
//
// Usage :
//   node scripts/textures-to-ktx2.mjs <fichier|dossier>... [--max=2048] [--out=DIR]
//   node scripts/textures-to-ktx2.mjs public/.../Textures/Ground --max=2048 \
//        --out=public/models/materials/mwam
//
// Convention de suffixe (issue du pack MW) :
//   *_col  → couleur, encodée en sRGB + ETC1S (compact)
//   *_nrm  → normal map, encodée LINÉAIRE + UASTC (ETC1S bloque visiblement
//            sur les dégradés doux d'une normal map)
//   *_msk  → masque, LINÉAIRE + ETC1S
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findKtxCli, runPool, encodeToKtx2, DEFAULT_CONCURRENCY, MB } from "./lib/ktx2-encode.mjs";

const argv = process.argv.slice(2);
const flags = argv.filter((a) => a.startsWith("--"));
const inputs = argv.filter((a) => !a.startsWith("--"));

const val = (name, fallback) => {
  const hit = flags.find((f) => f.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => flags.includes(`--${name}`);

if (inputs.length === 0) {
  console.error("Usage: node scripts/textures-to-ktx2.mjs <fichier|dossier>... [--max=2048] [--out=DIR] [--dry-run]");
  process.exit(1);
}

const MAX_SIZE = parseInt(val("max", "2048"), 10);
const OUT_DIR = val("out", null);
const DRY = has("dry-run");
const CONCURRENCY = parseInt(val("jobs", String(DEFAULT_CONCURRENCY)), 10);

const IMAGE_RE = /\.(png|jpg|jpeg)$/i;

/** Aplatit fichiers et dossiers en une liste d'images. */
function collect(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return IMAGE_RE.test(target) ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...collect(p));
    else if (IMAGE_RE.test(entry.name)) out.push(p);
  }
  return out;
}

/**
 * Rôle de la texture d'après son suffixe → décide espace colorimétrique et codec.
 *
 * Se tromper ici est VISIBLE : une normal map encodée en sRGB voit ses valeurs
 * passées par une courbe gamma, et l'éclairage part de travers sur toute la
 * surface. Une couleur encodée en linéaire ressort délavée.
 */
function classify(file) {
  const base = path.basename(file).toLowerCase();
  if (/_nrm|_normal|_n\./.test(base)) return { srgb: false, uastc: true, role: "normal" };
  if (/_msk|_mask|_rough|_ao|_orm|_mtl/.test(base)) return { srgb: false, uastc: false, role: "masque" };
  return { srgb: true, uastc: false, role: "couleur" };
}

const files = inputs.flatMap(collect);
if (files.length === 0) {
  console.error("Aucune image trouvée.");
  process.exit(1);
}

const ktxCli = findKtxCli();
if (!ktxCli) {
  console.error("`ktx` (KTX-Software) introuvable dans le PATH — installez-le pour encoder en KTX2.");
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tex2ktx-"));
console.log(`[tex2ktx] ${files.length} image(s) · maxSize=${MAX_SIZE}px · jobs=${CONCURRENCY}`);
if (OUT_DIR) fs.mkdirSync(OUT_DIR, { recursive: true });

let totalIn = 0;
let totalOut = 0;
let totalVram = 0;
let failed = 0;

const tasks = files.map((file, i) => async () => {
  const { srgb, uastc, role } = classify(file);
  const inBytes = fs.statSync(file).size;
  const dest = OUT_DIR
    ? path.join(OUT_DIR, path.basename(file).replace(IMAGE_RE, ".ktx2"))
    : file.replace(IMAGE_RE, ".ktx2");

  if (DRY) {
    console.log(`  [dry] ${path.basename(file).padEnd(38)} ${role.padEnd(8)} srgb=${srgb} uastc=${uastc} → ${dest}`);
    return;
  }

  try {
    const buf = fs.readFileSync(file);
    const out = await encodeToKtx2(buf, {
      srgb, uastc, maxSize: MAX_SIZE, ktxCli, tmpDir, tag: `t${i}`,
    });
    fs.writeFileSync(dest, out);
    totalIn += inBytes;
    totalOut += out.byteLength;
    // Bloc 4×4 : 8 octets en ETC1S→BC1, 16 en UASTC→BC7. ×1.33 = mipmaps.
    totalVram += (MAX_SIZE / 4) * (MAX_SIZE / 4) * (uastc ? 16 : 8) * 1.33;
    console.log(
      `  ✓ ${path.basename(file).padEnd(38)} ${role.padEnd(8)} ${MB(inBytes)} → ${MB(out.byteLength)} Mo`,
    );
  } catch (err) {
    failed++;
    console.error(`  ✗ ${path.basename(file)} : ${err.message}`);
  }
});

await runPool(tasks, CONCURRENCY);

fs.rmSync(tmpDir, { recursive: true, force: true });

if (!DRY) {
  console.log(`\n[tex2ktx] TERMINÉ — ${files.length - failed} converties${failed ? `, ${failed} ÉCHECS` : ""}`);
  console.log(`[tex2ktx] disque : ${MB(totalIn)} → ${MB(totalOut)} Mo`);
  console.log(`[tex2ktx] VRAM   : ~${MB(totalVram)} Mo une fois transcodées (mipmaps inclus)`);
}
