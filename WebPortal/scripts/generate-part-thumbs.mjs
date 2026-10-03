// ══════════════════════════════════════════════════════════════════════════════
// generate-part-thumbs.mjs — Vignettes des pièces modulaires.
//
// Rend chaque GLB de pièce en PNG, pour les carrousels de l'écran de création.
// Aucun GPU : projection orthographique + z-buffer logiciel
// (`scripts/lib/soft-raster.mjs`).
//
// Usage :
//   node scripts/generate-part-thumbs.mjs            # tout
//   node scripts/generate-part-thumbs.mjs --force    # réécrit les existantes
//
// Sortie : public/thumbs/parts/<id>.png  (id = identifiant de `partCatalog`)
//          src/data/part-thumbs.json     (id → chemin, pour l'UI)
//
// ⚠ Les pièces sont rendues en POSE DE BIND, et le squelette est ignoré. Une
// pièce skinnée stocke ses positions dans l'espace du modèle : les afficher
// telles quelles donne la pose en T, ce qui est exactement ce qu'on veut voir.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { rasterize } from "./lib/soft-raster.mjs";

const FORCE = process.argv.includes("--force");
const W = 192, H = 256;                       // ratio 3:4, celui des tuiles d'UI
const OUT_DIR = "public/thumbs/parts";
const INDEX = "src/data/part-thumbs.json";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/**
 * Toutes les positions et tous les triangles d'un GLB, en un seul tableau.
 *
 * Les primitives sont CONCATÉNÉES : une pièce comme `boris/head` en compte 5
 * (visage, yeux, dents…). Les rendre séparément ne montrerait qu'un morceau.
 * Les index sont décalés du nombre de sommets déjà émis.
 */
function collectGeometry(doc) {
  const pos = [];
  const idx = [];
  let base = 0;

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute("POSITION");
      if (!P) continue;
      const arr = P.getArray();
      for (let i = 0; i < arr.length; i++) pos.push(arr[i]);

      const I = prim.getIndices();
      if (I) {
        const a = I.getArray();
        for (let i = 0; i < a.length; i++) idx.push(a[i] + base);
      } else {
        for (let i = 0; i < P.getCount(); i++) idx.push(i + base);
      }
      base += P.getCount();
    }
  }
  return { positions: pos, indices: idx };
}

/** Liste des pièces à rendre : catalogue Biker + pièces découpées. */
function collectParts() {
  const out = [];

  // Le catalogue Biker vit dans un module TS non importable ici. On lit les
  // chemins par expression régulière plutôt que de dupliquer la liste : un
  // ajout de pièce ne doit pas demander de toucher deux fichiers.
  const src = readFileSync("src/rpg/characters/modular/partCatalog.ts", "utf8");
  const ROOT = "/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta";
  for (const m of src.matchAll(/id:\s*"([^"]+)"[^}]*?path:\s*`\$\{([MF])\}([^`]+)`/g)) {
    out.push({ id: m[1], path: `${ROOT}/${m[2] === "M" ? "Male" : "Female"}${m[3]}` });
  }

  for (const hero of JSON.parse(readFileSync("src/data/parts-manifest.json", "utf8"))) {
    for (const p of hero.parts) out.push({ id: `${hero.id}_${p.region}`, path: p.path });
  }
  return out;
}

const parts = collectParts();
console.log(`${parts.length} pièces à traiter · ${W}×${H}\n`);

mkdirSync(OUT_DIR, { recursive: true });
const index = {};
let rendus = 0, ignorés = 0, absents = 0;

for (const part of parts) {
  const dest = `${OUT_DIR}/${part.id}.png`;
  const url = "/" + path.relative("public", dest).split(path.sep).join("/");

  if (!FORCE && existsSync(dest)) { index[part.id] = url; ignorés++; continue; }

  const file = "public" + part.path;
  if (!existsSync(file)) {
    console.warn(`  ⚠ ${part.id} — fichier absent : ${part.path}`);
    absents++;
    continue;
  }

  const doc = await io.read(file);
  const { positions, indices } = collectGeometry(doc);
  if (positions.length < 9) {
    console.warn(`  ⚠ ${part.id} — aucune géométrie`);
    absents++;
    continue;
  }

  const rgba = rasterize(Float32Array.from(positions), indices, { width: W, height: H });
  await sharp(Buffer.from(rgba.buffer), { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);

  index[part.id] = url;
  rendus++;
  process.stdout.write(`  ✓ ${part.id.padEnd(24)}\r`);
}

writeFileSync(INDEX, JSON.stringify(index, null, 2), "utf8");
console.log(`\n\n${rendus} rendues · ${ignorés} déjà présentes · ${absents} sans géométrie`);
console.log(`→ ${INDEX} (${Object.keys(index).length} entrées)`);
if (ignorés) console.log("Relancer avec --force pour tout réécrire.");
