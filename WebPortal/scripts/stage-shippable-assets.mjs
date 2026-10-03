// ══════════════════════════════════════════════════════════════════════════════
// stage-shippable-assets.mjs — Prépare le sous-ensemble d'assets à EMBARQUER.
//
// `public/` pèse 244,8 Go ; le runtime n'en charge qu'une fraction. Ce script
// construit `build-assets/` avec uniquement ce qui part dans l'installeur, en
// conservant l'arborescence (`build-assets/models/...` reflète `public/models/...`).
//
// Usage :
//   node scripts/stage-shippable-assets.mjs            # dry-run, ne copie rien
//   node scripts/stage-shippable-assets.mjs --write    # copie réellement
//
// ── POURQUOI L'AUDIT STATIQUE NE SUFFIT PAS ──────────────────────────────────
//
// `audit-runtime-assets.mjs` extrait les littéraux `/models/….glb` du code. Ses
// expressions régulières excluent `$` et `{`, donc elle ne voit AUCUN chemin
// construit par calcul. Or c'est précisément ainsi que sont déclarés les chunks
// des deux maps qui comptent le plus :
//
//   forge    → `FORGE_CHUNKS` = Array.from({length: 8}, …)     (forgeChunks.ts)
//   orbital  → Array.from({length: 8}, …) en ligne             (assetManifest.ts)
//   donjon   → tableau de littéraux                            ← seul cas capté
//
// Se fier au seul audit produirait donc un installeur où la map de DÉPART
// (orbital) et la map principale (forge) ne chargent pas — sans la moindre
// erreur au build. Mesuré : l'audit remonte 4 chemins « chunk » alors que
// `chunks_v3` seul en contient 25 (751 Mo).
//
// La parade : ne pas tenter de résoudre les tableaux générés — c'est indécidable
// en statique — mais s'appuyer sur `chunkDir`, que chaque map à chunks déclare
// à côté de son tableau. On embarque le DOSSIER entier.
//
// ── GARDE-FOU ────────────────────────────────────────────────────────────────
// Toute map déclarant `chunks:` SANS `chunkDir:` fait échouer ce script. C'est
// exactement le cas qu'on ne saurait pas couvrir, et qui se remarquerait
// seulement une fois le jeu installé.
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const OUT = "build-assets";
const MANIFEST = "src/rpg/loaders/assetManifest.ts";

const mo = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/** Taille récursive d'un dossier, en octets. */
function dirSize(dir) {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    total += e.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

// ── 1. Fichiers repérés par l'audit statique ─────────────────────────────────
const staticFiles = JSON.parse(
  execFileSync("node", ["scripts/audit-runtime-assets.mjs", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
).map((p) => p.split(path.sep).join("/"));

// ── 2. Dossiers de chunks déclarés par le manifest ───────────────────────────
const manifestSrc = readFileSync(MANIFEST, "utf8");

// `chunkDir: `${MAPS_ROOT}/forge_map/chunks_v3`` → "models/Maps/forge_map/chunks_v3"
const MAPS_ROOT_RE = /const\s+MAPS_ROOT\s*=\s*["'`]([^"'`]+)["'`]/;
const mapsRoot = manifestSrc.match(MAPS_ROOT_RE)?.[1] ?? "/models/Maps";

const chunkDirs = [...manifestSrc.matchAll(/chunkDir:\s*`\$\{MAPS_ROOT\}([^`]*)`/g)]
  .map((m) => `public${mapsRoot}${m[1]}`);

// ── 3. Garde-fou — uniquement sur les chunks CONSTRUITS PAR CALCUL ───────────
//
// Un `chunks: [ "…", "…" ]` de littéraux est déjà capté par l'audit : il n'a
// besoin de rien. Le risque ne concerne que les valeurs non littérales —
// `chunks: FORGE_CHUNKS` ou `chunks: Array.from(…)` — dont aucune analyse
// statique raisonnable ne peut tirer les chemins. Celles-là exigent un `chunkDir`.
//
// Discriminant : le premier caractère non blanc après `chunks:`. `[` = tableau
// littéral (sûr) ; toute autre chose = identifiant ou appel (à couvrir).
const generatedChunks = (manifestSrc.match(/^\s*chunks:\s*(?!\[)\S/gm) ?? []).length;
if (generatedChunks > chunkDirs.length) {
  console.error(
    `\n❌ ${generatedChunks} map(s) construisent leur liste de chunks par CALCUL,\n` +
    `   mais seulement ${chunkDirs.length} déclarent \`chunkDir:\`.\n\n` +
    `   Ces chemins sont invisibles à l'analyse statique : sans \`chunkDir\`, la map\n` +
    `   ne serait pas embarquée et ne chargerait pas une fois installée — sans la\n` +
    `   moindre erreur au build.\n\n` +
    `   Ajouter \`chunkDir\` à la map concernée dans ${MANIFEST}.\n`,
  );
  process.exit(1);
}

// ── 4. Bilan ─────────────────────────────────────────────────────────────────
let staticBytes = 0;
const missing = [];
for (const f of staticFiles) {
  if (existsSync(f)) staticBytes += statSync(f).size;
  else missing.push(f);
}

console.log(`\n── Fichiers repérés par l'audit statique ──`);
console.log(`   ${staticFiles.length} chemins · ${mo(staticBytes)} Mo présents sur disque`);
if (missing.length) {
  console.log(`   ⚠ ${missing.length} référencés par le code mais ABSENTS du disque :`);
  for (const m of missing.slice(0, 10)) console.log(`      ${m}`);
  if (missing.length > 10) console.log(`      … et ${missing.length - 10} autres`);
}

console.log(`\n── Dossiers de chunks (invisibles à l'audit) ──`);
let chunkBytes = 0;
for (const d of chunkDirs) {
  if (!existsSync(d)) {
    console.log(`   ⚠ ${d} — DÉCLARÉ mais absent du disque`);
    continue;
  }
  const size = dirSize(d);
  chunkBytes += size;
  console.log(`   ${mo(size).padStart(9)} Mo  ${d}`);
}

console.log(`\n── Total à embarquer ──`);
console.log(`   ${mo(staticBytes + chunkBytes)} Mo`);
console.log(`   (public/ complet : ~244 800 Mo)`);

// ── 5. Copie ─────────────────────────────────────────────────────────────────
if (!WRITE) {
  console.log(`\nDry-run. Relancer avec --write pour produire ${OUT}/.\n`);
  process.exit(0);
}

rmSync(OUT, { recursive: true, force: true });
let copied = 0;
for (const f of staticFiles) {
  if (!existsSync(f)) continue;
  const dest = path.join(OUT, path.relative("public", f));
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(f, dest);
  copied++;
}
for (const d of chunkDirs) {
  if (!existsSync(d)) continue;
  cpSync(d, path.join(OUT, path.relative("public", d)), { recursive: true });
}
console.log(`\n✅ ${OUT}/ produit — ${copied} fichiers + ${chunkDirs.length} dossiers de chunks.\n`);
