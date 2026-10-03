// ══════════════════════════════════════════════════════════════════════════════
// organize-new-assets.mjs — Range les packs de `export/bullet/content/new/`
// dans l'arborescence de catégories de `public/models/`.
//
//   node scripts/organize-new-assets.mjs              → simulation (rien n'est écrit)
//   node scripts/organize-new-assets.mjs --apply      → déplace pour de bon
//   node scripts/organize-new-assets.mjs --undo       → rejoue le journal à l'envers
//
// SIMULATION PAR DÉFAUT : déplacer 26 Go est difficile à défaire de tête. Le mode
// réel est explicite, et il écrit un journal qui rend l'opération réversible.
//
// `fs.renameSync` est instantané ici — source et destination sont sur D:, donc
// c'est un renommage NTFS, pas une copie. Le repli copie+suppression n'existe que
// pour le jour où quelqu'un déplacera `public/` sur un autre volume.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { NEW_PACKS, CATEGORIES } from "./lib/asset-taxonomy.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_ROOT = path.join(ROOT, "public/models/export/bullet/content/new");
const DST_ROOT = path.join(ROOT, "public/models");
const JOURNAL = path.join(ROOT, "public/models/.organize-journal.json");

const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");

/** Déplace en renommant, avec repli copie+suppression inter-volumes. */
function move(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
}

// ── UNDO ─────────────────────────────────────────────────────────────────────
if (undo) {
  if (!fs.existsSync(JOURNAL)) {
    console.error("Aucun journal — rien à défaire.");
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(JOURNAL, "utf8")).moves;
  let done = 0;
  for (const m of entries.reverse()) {
    if (!fs.existsSync(m.to)) { console.warn(`  absent, ignoré : ${m.to}`); continue; }
    if (fs.existsSync(m.from)) { console.warn(`  origine occupée, ignoré : ${m.from}`); continue; }
    move(m.to, m.from);
    done++;
  }
  fs.rmSync(JOURNAL, { force: true });
  console.log(`\n${done} pack(s) remis à leur place d'origine.`);
  process.exit(0);
}

// ── VÉRIFICATION AVANT TOUT DÉPLACEMENT ──────────────────────────────────────
// Tout ou rien : un plan à moitié appliqué serait pire que pas de plan du tout,
// parce que le prochain lancement ne saurait plus ce qui a bougé.
const plan = [];
const problems = [];

for (const pack of NEW_PACKS) {
  const from = path.join(SRC_ROOT, pack.from);
  const cat = CATEGORIES[pack.to];
  if (!cat) { problems.push(`catégorie inconnue « ${pack.to} » pour ${pack.from}`); continue; }

  const name = pack.rename ?? path.basename(pack.from);
  const to = path.join(DST_ROOT, cat.dir, name);

  if (!fs.existsSync(from)) { problems.push(`source absente : ${pack.from}`); continue; }
  if (fs.existsSync(to)) { problems.push(`destination DÉJÀ OCCUPÉE : ${cat.dir}/${name}`); continue; }

  plan.push({ from, to, pack, name, cat });
}

const declared = new Set(NEW_PACKS.map((p) => p.from));
for (const group of ["unreal", "."]) {
  const dir = path.join(SRC_ROOT, group);
  if (!fs.existsSync(dir)) continue;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (group === "." && e.name === "unreal") continue;   // conteneur, pas un pack
    const rel = group === "." ? e.name : `${group}/${e.name}`;
    if (!declared.has(rel)) problems.push(`pack NON DÉCLARÉ dans la taxonomie : ${rel}`);
  }
}

console.log(`\n${plan.length} pack(s) à ranger · ${problems.length} problème(s)\n`);

const byCat = new Map();
for (const p of plan) {
  if (!byCat.has(p.cat.dir)) byCat.set(p.cat.dir, []);
  byCat.get(p.cat.dir).push(p);
}
for (const [dir, items] of [...byCat].sort()) {
  const isNew = CATEGORIES[Object.keys(CATEGORIES).find((k) => CATEGORIES[k].dir === dir)]?.isNew;
  console.log(`  ${dir}/${isNew ? "  ← NOUVEAU DOSSIER" : ""}`);
  for (const it of items) {
    const ren = it.pack.rename ? `  (renommé depuis « ${path.basename(it.pack.from)} »)` : "";
    console.log(`      ${it.name}${ren}`);
    if (it.pack.note) console.log(`         · ${it.pack.note}`);
  }
}

if (problems.length) {
  console.log("\nPROBLÈMES :");
  for (const p of problems) console.log(`  ✗ ${p}`);
}

if (!apply) {
  console.log("\n── SIMULATION — rien n'a été écrit. Relancer avec --apply pour exécuter.");
  process.exit(problems.length ? 1 : 0);
}

if (problems.length) {
  console.error("\nARRÊT : des problèmes subsistent. Rien n'a été déplacé.");
  process.exit(1);
}

// ── EXÉCUTION ────────────────────────────────────────────────────────────────
const moves = [];
for (const it of plan) {
  move(it.from, it.to);
  moves.push({ from: it.from, to: it.to });
  console.log(`  → ${path.relative(DST_ROOT, it.to)}`);
}

fs.writeFileSync(JOURNAL, JSON.stringify({ movedAt: new Date().toISOString(), moves }, null, 2));
console.log(`\n${moves.length} pack(s) rangés. Journal : ${path.relative(ROOT, JOURNAL)}`);
console.log("Pour annuler : node scripts/organize-new-assets.mjs --undo");
