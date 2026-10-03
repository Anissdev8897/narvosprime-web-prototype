// ══════════════════════════════════════════════════════════════════════════════
// check-ktx2-dims.mjs — Traque les dimensions KTX2 illégales pour le GPU.
//
// POURQUOI : les formats de bloc (BC1/BC7/S3TC/BPTC) encodent des tuiles de 4×4
// pixels. WebGL rejette `compressedTexImage2D` avec GL_INVALID_OPERATION quand
// la dimension d'un niveau de mip n'est pas un multiple de 4 — sauf pour les
// derniers niveaux (1, 2) qui sont tolérés.
//
// Or `sharp.resize(N, N, { fit: "inside" })` PRÉSERVE LE RATIO : une texture
// 1500×1000 devient 1024×683, et 683 n'est pas divisible par 4. La conversion
// réussit (l'encodeur Basis accepte), mais l'upload GPU échoue au runtime.
//
// Ce script lit l'en-tête KTX2 de chaque texture embarquée (offsets fixes) et
// signale les coupables.
//
// Usage : node scripts/check-ktx2-dims.mjs <fichier|dossier>...
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { readdir } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

const KTX2_ID = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

/** Lit l'en-tête KTX2 : identifiant + dimensions + nombre de niveaux. */
function readKtx2Header(bytes) {
  if (bytes.length < 48) return null;
  for (let i = 0; i < 12; i++) if (bytes[i] !== KTX2_ID[i]) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    vkFormat:    dv.getUint32(12, true),
    pixelWidth:  dv.getUint32(20, true),
    pixelHeight: dv.getUint32(24, true),
    levelCount:  dv.getUint32(36, true),
  };
}

async function collect(entry) {
  const st = statSync(entry, { throwIfNoEntry: false });
  if (!st) return [];
  if (st.isFile()) return entry.toLowerCase().endsWith(".glb") ? [entry] : [];
  const out = [];
  for (const d of await readdir(entry, { withFileTypes: true })) {
    const full = path.join(entry, d.name);
    if (d.isDirectory()) {
      if (d.name === "_ktx2_backup") continue;
      out.push(...await collect(full));
    } else if (d.name.toLowerCase().endsWith(".glb")) out.push(full);
  }
  return out;
}

const files = [];
for (const a of process.argv.slice(2)) files.push(...await collect(a));

let totalTex = 0, bad = 0, badFiles = 0;
const offenders = [];

for (const f of files.sort()) {
  const doc = await io.read(f);
  let fileBad = 0;
  for (const [idx, tex] of doc.getRoot().listTextures().entries()) {
    if (tex.getMimeType() !== "image/ktx2") continue;
    const img = tex.getImage();
    if (!img) continue;
    totalTex++;
    const h = readKtx2Header(img);
    if (!h) { continue; }
    const wBad = h.pixelWidth % 4 !== 0;
    const hBad = h.pixelHeight % 4 !== 0;
    if (wBad || hBad) {
      bad++; fileBad++;
      offenders.push(`${path.relative(process.cwd(), f)} tex#${idx} → ${h.pixelWidth}×${h.pixelHeight}`);
    }
  }
  if (fileBad > 0) badFiles++;
}

console.log(`\n${files.length} GLB · ${totalTex} textures KTX2 inspectées`);
if (bad === 0) {
  console.log("✓ Toutes les dimensions sont des multiples de 4 — pas de violation de bloc GPU.");
} else {
  console.log(`✗ ${bad} textures dans ${badFiles} fichiers ont une dimension NON multiple de 4 :\n`);
  for (const o of offenders.slice(0, 60)) console.log(`   ${o}`);
  if (offenders.length > 60) console.log(`   … et ${offenders.length - 60} autres`);
}
