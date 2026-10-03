// ══════════════════════════════════════════════════════════════════════════════
// asset-catalog.mjs — Indexe TOUT `public/models/` par catégorie et par tag.
//
//   node scripts/asset-catalog.mjs
//
// Produit deux sorties, à regénérer après tout ajout d'assets :
//   • public/models/CATALOG.md          — à lire, navigation par catégorie/thème
//   • src/data/asset-catalog.json       — à interroger, pour l'éditeur Forge
//
// POURQUOI UN INDEX PLUTÔT QU'UNE ARBORESCENCE THÉMATIQUE :
// 87 chemins sont codés en dur dans `src/` et visent 20 dossiers de premier
// niveau. Renommer `nature/` en `vegetation/` casserait 14 chargements sans que
// `tsc` bronche — ce sont des chaînes. L'index donne la navigation par thème que
// l'arborescence ne peut pas porter, sans toucher à un seul chemin.
//
// Le scan ne lit AUCUN contenu de fichier : uniquement les entrées de répertoire
// et la taille. 285 Go de données, mais seulement des métadonnées lues.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, TAGS, NEW_PACKS, tagsForPack, MESH_EXT, TEX_EXT, AUDIO_EXT, CODE_EXT } from "./lib/asset-taxonomy.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MODELS = path.join(ROOT, "public/models");

/** Dossiers de SOURCE, pas de contenu catalogable — on les liste sans les fouiller. */
const SHALLOW = new Set(["export"]);

/** Notes déclarées dans la taxonomie, indexées par nom de pack final. */
const NOTES = new Map();
for (const p of NEW_PACKS) {
  NOTES.set(p.rename ?? path.basename(p.from), { note: p.note, tags: p.tags, isNew: true });
}

const human = (b) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} Go` : b >= 1e6 ? `${(b / 1e6).toFixed(0)} Mo` : `${(b / 1e3).toFixed(0)} ko`;

/** Parcourt un pack et compte ce qu'il contient, par nature d'asset. */
function scanPack(dir) {
  const acc = { bytes: 0, files: 0, mesh: 0, tex: 0, audio: 0, code: 0, ext: new Map() };
  const stack = [dir];
  while (stack.length) {
    let entries;
    try { entries = fs.readdirSync(stack.pop(), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(e.parentPath ?? e.path, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.isFile()) continue;
      acc.files++;
      const ext = path.extname(e.name).toLowerCase();
      acc.ext.set(ext, (acc.ext.get(ext) ?? 0) + 1);
      if (MESH_EXT.has(ext)) acc.mesh++;
      else if (TEX_EXT.has(ext)) acc.tex++;
      else if (AUDIO_EXT.has(ext)) acc.audio++;
      else if (CODE_EXT.has(ext)) acc.code++;
      try { acc.bytes += fs.statSync(full).size; } catch { /* fichier verrouillé */ }
    }
  }
  return acc;
}

// ── SCAN ─────────────────────────────────────────────────────────────────────
const catalog = [];
const orphans = [];
const knownDirs = new Set(Object.values(CATEGORIES).map((c) => c.dir));

for (const entry of fs.readdirSync(MODELS, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (!knownDirs.has(entry.name)) { orphans.push(entry.name); continue; }

  const catKey = Object.keys(CATEGORIES).find((k) => CATEGORIES[k].dir === entry.name);
  const cat = CATEGORIES[catKey];
  const catDir = path.join(MODELS, entry.name);
  process.stderr.write(`  scan ${entry.name}…\n`);

  if (SHALLOW.has(entry.name)) {
    catalog.push({ category: catKey, dir: cat.dir, label: cat.label, desc: cat.desc, shallow: true, packs: [] });
    continue;
  }

  // ── Dossier d'EMBALLAGE ──────────────────────────────────────────────────
  //
  // Une catégorie dont l'unique enfant est un dossier qui contient, lui, les
  // vrais packs. `vfx/` est dans ce cas : ses 10 packs vivent sous `vfx/VFX/`,
  // rangés là après la génération du catalogue de juillet.
  //
  // Sans ce détour, la catégorie entière se réduit à UNE entrée nommée « VFX »,
  // et les 10 packs deviennent invisibles au catalogue — exact, mais inutile
  // pour s'y retrouver. Mesuré le 2026-09-04.
  //
  // ⚠ On ne descend QUE si l'enfant unique ne contient lui-même aucun fichier :
  // un pack légitime qui n'aurait qu'un sous-dossier ne doit pas être aplati.
  let racinePacks = catDir;
  let prefixe = `/models/${cat.dir}`;
  {
    const enfants = fs.readdirSync(catDir, { withFileTypes: true });
    const dossiers = enfants.filter((e) => e.isDirectory());
    if (enfants.length === 1 && dossiers.length === 1) {
      const dedans = fs.readdirSync(path.join(catDir, dossiers[0].name), { withFileTypes: true });
      if (dedans.length > 1 && dedans.every((e) => e.isDirectory())) {
        racinePacks = path.join(catDir, dossiers[0].name);
        prefixe = `${prefixe}/${dossiers[0].name}`;
        process.stderr.write(`    (emballage traverse : ${dossiers[0].name})\n`);
      }
    }
  }

  const packs = [];
  for (const p of fs.readdirSync(racinePacks, { withFileTypes: true })) {
    if (!p.isDirectory()) continue;
    const stats = scanPack(path.join(racinePacks, p.name));
    const declared = NOTES.get(p.name);
    packs.push({
      name: p.name,
      path: `${prefixe}/${p.name}`,
      tags: [...new Set([...(declared?.tags ?? []), ...tagsForPack(p.name, catKey)])].sort(),
      note: declared?.note,
      isNew: !!declared?.isNew,
      files: stats.files,
      bytes: stats.bytes,
      mesh: stats.mesh,
      tex: stats.tex,
      audio: stats.audio,
      code: stats.code,
    });
  }
  packs.sort((a, b) => b.bytes - a.bytes);
  catalog.push({ category: catKey, dir: cat.dir, label: cat.label, desc: cat.desc, isNew: !!cat.isNew, packs });
}

catalog.sort((a, b) => a.label.localeCompare(b.label, "fr"));

// ── SORTIE MACHINE ───────────────────────────────────────────────────────────
const totalPacks = catalog.reduce((n, c) => n + c.packs.length, 0);
const totalBytes = catalog.reduce((n, c) => n + c.packs.reduce((m, p) => m + p.bytes, 0), 0);
const totalMesh = catalog.reduce((n, c) => n + c.packs.reduce((m, p) => m + p.mesh, 0), 0);

const jsonPath = path.join(ROOT, "src/data/asset-catalog.json");
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify({
  generatedBy: "scripts/asset-catalog.mjs",
  totals: { categories: catalog.length, packs: totalPacks, bytes: totalBytes, meshFiles: totalMesh },
  tags: TAGS,
  categories: catalog,
}, null, 2));

// ── SORTIE HUMAINE ───────────────────────────────────────────────────────────
const byTag = new Map();
for (const c of catalog) {
  for (const p of c.packs) {
    for (const t of p.tags) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push({ ...p, cat: c.label });
    }
  }
}

const L = [];
L.push("# Catalogue des assets — NARVOS PRIME", "");
L.push("> Généré par `node scripts/asset-catalog.mjs`. **Ne pas éditer à la main.**");
L.push("> À regénérer après tout ajout ou déplacement d'assets.", "");
L.push(`**${totalPacks} packs · ${catalog.length} catégories · ${human(totalBytes)} · ${totalMesh.toLocaleString("fr")} fichiers de géométrie**`, "");
L.push("## Comment lire ce catalogue", "");
L.push("Chaque pack vit dans **un seul dossier**, choisi sur son type dominant, et porte");
L.push("**plusieurs tags**. Les thèmes (sci-fi, médiéval…) recoupent les types (bâtiments,");
L.push("props…) : les ranger tous les deux dans l'arborescence obligerait à dupliquer des");
L.push("dizaines de Go. La navigation par thème se fait donc [par tag](#navigation-par-tag).", "");
L.push("⚠️ **Les noms de dossiers ne se renomment pas.** 87 chemins sont codés en dur dans");
L.push("`src/` (`/models/vehicule/` ×29, `/models/Maps/` ×15, `/models/nature/` ×14…). Ce sont");
L.push("des chaînes de caractères : `tsc` ne verra jamais une rupture. Le libellé français");
L.push("de ce catalogue est un affichage, pas le nom sur le disque.", "");
L.push("## Catégories", "");
L.push("| Catégorie | Dossier | Packs | Poids | Contenu |");
L.push("|---|---|--:|--:|---|");
for (const c of catalog) {
  const b = c.packs.reduce((n, p) => n + p.bytes, 0);
  const isNew = c.isNew ? " 🆕" : "";
  const n = c.shallow ? "—" : c.packs.length;
  L.push(`| **${c.label}**${isNew} | \`${c.dir}/\` | ${n} | ${c.shallow ? "—" : human(b)} | ${c.desc} |`);
}
L.push("");

for (const c of catalog) {
  if (c.shallow || !c.packs.length) continue;
  L.push(`### ${c.label}${c.isNew ? " 🆕" : ""} — \`${c.dir}/\``, "");
  L.push(`${c.desc}`, "");
  L.push("| Pack | Poids | Meshes | Textures | Audio | Tags |");
  L.push("|---|--:|--:|--:|--:|---|");
  for (const p of c.packs) {
    const tags = p.tags.map((t) => `\`${t}\``).join(" ") || "—";
    L.push(`| ${p.isNew ? "🆕 " : ""}\`${p.name}\` | ${human(p.bytes)} | ${p.mesh || "—"} | ${p.tex || "—"} | ${p.audio || "—"} | ${tags} |`);
  }
  L.push("");
  const noted = c.packs.filter((p) => p.note);
  if (noted.length) {
    for (const p of noted) L.push(`- **${p.name}** — ${p.note}`);
    L.push("");
  }
}

L.push("## Navigation par tag", "");
for (const [tag, label] of Object.entries(TAGS)) {
  const items = byTag.get(tag);
  if (!items?.length) continue;
  const b = items.reduce((n, p) => n + p.bytes, 0);
  L.push(`### ${label} — \`${tag}\` · ${items.length} packs · ${human(b)}`, "");
  for (const p of items.sort((a, b2) => b2.bytes - a.bytes)) {
    L.push(`- \`${p.path}\` — ${p.cat} · ${human(p.bytes)}${p.mesh ? ` · ${p.mesh} meshes` : ""}`);
  }
  L.push("");
}

if (orphans.length) {
  L.push("## Non catalogué", "");
  L.push("Dossiers présents sur le disque mais absents de `scripts/lib/asset-taxonomy.mjs`.");
  L.push("Les ajouter à `CATEGORIES` pour qu'ils apparaissent ci-dessus.", "");
  for (const o of orphans) L.push(`- \`${o}/\``);
  L.push("");
}

fs.writeFileSync(path.join(MODELS, "CATALOG.md"), L.join("\n"));

console.log(`\n${totalPacks} packs · ${catalog.length} catégories · ${human(totalBytes)}`);
console.log(`  public/models/CATALOG.md`);
console.log(`  src/data/asset-catalog.json`);
if (orphans.length) console.log(`  ⚠ ${orphans.length} dossier(s) non catalogué(s) : ${orphans.join(", ")}`);
