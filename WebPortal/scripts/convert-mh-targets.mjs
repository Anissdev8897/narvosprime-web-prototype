// ══════════════════════════════════════════════════════════════════════════════
// convert-mh-targets.mjs — Cibles morphologiques MakeHuman → format runtime.
//
// Convertit les `.target.gz` de MPFB2 (CC0) en un binaire compact lisible par
// le navigateur, plus un index JSON. Alimente les curseurs « Détails du corps »
// de l'éditeur de personnage.
//
// Usage :
//   node scripts/convert-mh-targets.mjs --src="C:/.../mpfb2-master"
//   node scripts/convert-mh-targets.mjs --src=... --only=nose,eyes,mouth,ears
//   node scripts/convert-mh-targets.mjs --src=... --list        # catégories seules
//
// Sorties :
//   public/data/mh/base-positions.bin   positions du maillage de base (Float32)
//   public/data/mh/targets.bin          deltas épars concaténés
//   src/data/mh-targets.json            index : id, catégorie, offset, count
//
// ── POURQUOI PAS DES MORPH TARGETS glTF ──────────────────────────────────────
//
// Mesuré sur ce projet : Echo, avec 181 cibles morph, pesait 210 Mo à lui seul.
// Le coût est `sommets × cibles` et il explose. MPFB2 en compte 1273.
//
// Ces cibles ne sont PAS une animation : c'est une étape de MODELAGE. On les
// applique côté CPU quand un curseur bouge, et il en sort un maillage statique.
// Zéro morph target dans le fichier livré, zéro coût GPU, et des deltas épars
// qui tiennent en quelques Ko chacun.
//
// ⚠ Les indices pointent dans `base.obj` et NULLE PART AILLEURS. Remailler,
// décimer ou réordonner le maillage de base invalide les 1273 cibles d'un coup.
// ══════════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { parseTarget, parseObjPositions, targetIdFromPath, maxDelta } from "./lib/mh-target.mjs";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const has = (n) => process.argv.includes(`--${n}`);

const SRC = arg("src", "C:/Users/aniss/mes_projet/mpfb2-master/mpfb2-master");
const ONLY = arg("only", "")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
const OUT_BIN = "public/data/mh";
const OUT_INDEX = "src/data/mh-targets.json";

const DATA = path.join(SRC, "src", "mpfb", "data");
const BASE_OBJ = path.join(DATA, "3dobjs", "base.obj");
const TARGETS = path.join(DATA, "targets");

for (const p of [BASE_OBJ, TARGETS]) {
  if (!existsSync(p)) {
    console.error(`[mh] introuvable : ${p}\nVérifie --src=<racine mpfb2-master>`);
    process.exit(1);
  }
}

// ── Maillage de base ─────────────────────────────────────────────────────────

const positions = parseObjPositions(readFileSync(BASE_OBJ, "utf8"));
const vertexCount = positions.length / 3;
console.log(`Maillage de base : ${vertexCount} sommets (${(positions.byteLength / 1024).toFixed(0)} Ko)\n`);

// ── Collecte des cibles ──────────────────────────────────────────────────────

/** Parcours récursif, chemins RELATIFS à `targets/` — ils forment l'identifiant. */
async function collect(dir, rel = "") {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await collect(full, r)));
    else if (/\.target(\.gz)?$/i.test(e.name)) out.push({ full, rel: r });
  }
  return out;
}

const fichiers = await collect(TARGETS);

if (has("list")) {
  const cats = new Map();
  for (const f of fichiers) {
    const { category } = targetIdFromPath(f.rel);
    cats.set(category, (cats.get(category) ?? 0) + 1);
  }
  console.log("catégorie                                   cibles");
  console.log("─".repeat(54));
  for (const [c, n] of [...cats].sort((a, b) => b[1] - a[1])) {
    console.log(`${c.padEnd(44)} ${String(n).padStart(5)}`);
  }
  console.log(`\n${fichiers.length} cibles au total. Filtrer avec --only=nose,eyes,…`);
  process.exit(0);
}

const retenus = ONLY.length
  ? fichiers.filter((f) => ONLY.some((c) => targetIdFromPath(f.rel).category.startsWith(c)))
  : fichiers;

console.log(`${retenus.length} cibles retenues sur ${fichiers.length}${ONLY.length ? ` (filtre : ${ONLY.join(", ")})` : ""}\n`);

// ── Conversion ───────────────────────────────────────────────────────────────

const morceaux = [];
const index = [];
let offset = 0;          // en octets, depuis le début de targets.bin
let ignorés = 0, vides = 0;

for (const f of retenus) {
  const brut = f.full.endsWith(".gz")
    ? gunzipSync(readFileSync(f.full)).toString("utf8")
    : readFileSync(f.full, "utf8");

  const { indices, deltas, skipped } = parseTarget(brut, vertexCount);
  ignorés += skipped;

  // Une cible sans aucun sommet valide n'est pas une erreur : certaines cibles
  // MPFB2 sont des gabarits vides. L'inscrire à l'index ferait apparaître un
  // curseur sans effet dans l'UI.
  if (indices.length === 0) { vides++; continue; }

  const { id, category, name } = targetIdFromPath(f.rel);

  // Indices puis deltas, tous deux alignés sur 4 octets : concaténer sans
  // remplissage est sûr, et le navigateur peut créer ses vues typées
  // directement sur le buffer.
  morceaux.push(Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength));
  morceaux.push(Buffer.from(deltas.buffer, deltas.byteOffset, deltas.byteLength));

  index.push({
    id, category, name,
    offset,
    count: indices.length,
    maxDelta: Number(maxDelta(deltas).toFixed(5)),
  });
  offset += indices.byteLength + deltas.byteLength;
}

// ── Écriture ─────────────────────────────────────────────────────────────────

mkdirSync(OUT_BIN, { recursive: true });
mkdirSync(path.dirname(OUT_INDEX), { recursive: true });

const bin = Buffer.concat(morceaux);
writeFileSync(path.join(OUT_BIN, "targets.bin"), bin);
writeFileSync(path.join(OUT_BIN, "base-positions.bin"), Buffer.from(positions.buffer));

writeFileSync(OUT_INDEX, JSON.stringify({
  source: "MakeHuman / MPFB2 — CC0 1.0 Universal",
  vertexCount,
  // 16 octets par sommet touché : Uint32 indice + 3 × Float32 delta.
  strideBytes: 16,
  basePositions: "/data/mh/base-positions.bin",
  targetData: "/data/mh/targets.bin",
  targets: index,
}, null, 2), "utf8");

const mo = (b) => (b / 1048576).toFixed(2);
console.log(`✅ ${index.length} cibles converties`);
console.log(`   targets.bin        ${mo(bin.length).padStart(7)} Mo`);
console.log(`   base-positions.bin ${mo(positions.byteLength).padStart(7)} Mo`);
console.log(`   ${OUT_INDEX}`);
if (vides) console.log(`   ${vides} cibles vides ignorées (gabarits)`);
if (ignorés) console.log(`   ⚠ ${ignorés} lignes écartées (hors bornes ou malformées)`);