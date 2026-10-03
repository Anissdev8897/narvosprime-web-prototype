// ══════════════════════════════════════════════════════════════════════════════
// audit-runtime-assets.mjs — Quels GLB le runtime charge-t-il VRAIMENT, et à
// quel coût en VRAM ?
//
// Le dossier public/models pèse 83 Go, mais l'écrasante majorité n'est jamais
// chargée (packs bruts, variantes, démos Unreal). Optimiser au hasard est donc
// du gâchis : ce script part du CODE, pas du disque.
//
// Méthode : on collecte tous les littéraux `"/models/....glb"` de src/rpg/**,
// on reconstruit ceux bâtis par concaténation de constantes (`${CHAR}/x.glb`),
// puis on mesure chaque fichier existant.
//
// Usage : node scripts/audit-runtime-assets.mjs [--json]
// ══════════════════════════════════════════════════════════════════════════════

import { readdir, readFile } from "node:fs/promises";
import { statSync, existsSync } from "node:fs";
import path from "node:path";

const SRC = "src/rpg";
const PUBLIC = "public";

/** Parcourt récursivement un dossier et renvoie les fichiers .ts/.tsx. */
async function walk(dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...await walk(full));
    // ⚠ `.bench.ts` est exclu au même titre que `.test.ts`. `timeToPlay.bench.ts`
    // contient un `makeMockUrls()` de 15 chemins INVENTÉS (`/models/ships/…`,
    // `/models/npc/…`) qui n'ont jamais existé : ils ne servent qu'à vérifier le
    // classement par priorité, qui lit le motif du chemin et ne charge rien.
    // Les compter comme références mortes noyait les vraies sous du décor.
    else if (/\.tsx?$/.test(d.name) && !/\.(test|bench)\.tsx?$/.test(d.name)) out.push(full);
  }
  return out;
}

const files = await walk(SRC);

// Constantes de chemin déclarées dans les catalogues : `const CHAR = "/models/x"`.
// Sans elles, tous les chemins en template literal seraient manqués.
const constants = new Map();
const CONST_RE = /(?:const|let)\s+([A-Z_][A-Z0-9_]*)\s*=\s*["'`](\/models\/[^"'`$]*)["'`]/g;
for (const f of files) {
  const src = await readFile(f, "utf8");
  for (const m of src.matchAll(CONST_RE)) constants.set(m[1], m[2]);
}

const paths = new Set();
// Littéral direct : "/models/.../x.glb"
const LITERAL_RE = /["'`](\/models\/[^"'`${}\n]*\.glb)["'`]/gi;
// Template : `${CONST}/reste.glb`
const TEMPLATE_RE = /`\$\{([A-Z_][A-Z0-9_]*)\}([^`${}\n]*\.glb)`/gi;

for (const f of files) {
  const src = await readFile(f, "utf8");
  for (const m of src.matchAll(LITERAL_RE)) paths.add(m[1]);
  for (const m of src.matchAll(TEMPLATE_RE)) {
    const base = constants.get(m[1]);
    if (base) paths.add(base + m[2]);
  }
}

// ── Mesure ───────────────────────────────────────────────────────────────────
const rows = [];
// ⚠ Un chemin manquant ne lève RIEN au runtime : le fallback SPA de Vite renvoie
// du `text/html` en 200 au lieu d'un 404. Les compter ne suffit pas — il faut
// pouvoir les LIRE, sinon on sait qu'il y a un trou sans savoir lequel.
const manquants = [];
for (const p of paths) {
  const disk = path.join(PUBLIC, p.replace(/^\//, ""));
  if (!existsSync(disk)) { manquants.push(p); continue; }
  rows.push({ p, size: statSync(disk).size, disk });
}
const missing = manquants.length;
rows.sort((a, b) => b.size - a.size);

const MB = (b) => (b / 1048576).toFixed(1);
const total = rows.reduce((s, r) => s + r.size, 0);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows.map((r) => r.disk), null, 2));
} else {
  console.log(`\nGLB référencés par src/rpg/** : ${rows.length} présents, ${missing} introuvables`);
  console.log(`Poids disque total : ${MB(total)} MB\n`);
  console.log("── Les 30 plus lourds ──");
  for (const r of rows.slice(0, 30)) console.log(`${MB(r.size).padStart(8)} MB  ${r.p}`);

  // Regroupement par dossier de 1er niveau : montre où porter l'effort.
  const byDir = new Map();
  for (const r of rows) {
    const k = r.p.split("/").slice(0, 3).join("/");
    byDir.set(k, (byDir.get(k) ?? 0) + r.size);
  }
  console.log("\n── Poids par dossier ──");
  for (const [k, v] of [...byDir].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`${MB(v).padStart(8)} MB  ${k}`);
  }

  if (manquants.length) {
    console.log(`\n── RÉFÉRENCES MORTES (${manquants.length}) ──`);
    console.log("Le code les demande, le disque ne les a pas. Aucune erreur au");
    console.log("runtime : Vite répond 200 text/html sur un fichier absent.");
    for (const p of manquants.sort()) console.log(`  ${p}`);
  }
}
