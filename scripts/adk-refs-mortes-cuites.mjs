// Un asset CUIT qui reference encore l'ANCIEN chemin pointe dans le vide :
// `unreal_folders = ["Narvos"]` ne cuit pas `/Game/City_Traffic_Pro/`, donc le
// redirecteur reste a la source, hors du pack. C'est la forme exacte du defaut
// qui a laisse 2 382 assets morts le 2026-09-09.
//
// On lit 1 Mo a chaque bout : la table d'imports d'un .uasset y vit.
import fs from "node:fs";
import path from "node:path";

const RACINE = process.argv[2];
const ANCIEN = process.argv[3];      // ex. /Game/City_Traffic_Pro/
const NOUVEAU = process.argv[4];     // ex. /Game/Narvos/City_Traffic_Pro/

const fichiers = [];
(function descendre(d) {
  let es;
  try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) descendre(p);
    else if (e.name.endsWith(".uasset") || e.name.endsWith(".umap")) fichiers.push(p);
  }
})(RACINE);

function texte(f) {
  const T = 1048576;
  const st = fs.statSync(f);
  const fd = fs.openSync(f, "r");
  try {
    const a = Buffer.alloc(Math.min(T, st.size));
    fs.readSync(fd, a, 0, a.length, 0);
    const dep = Math.max(0, st.size - T);
    const b = Buffer.alloc(Math.min(T, st.size - dep));
    fs.readSync(fd, b, 0, b.length, dep);
    return a.toString("latin1") + " " + b.toString("latin1");
  } finally { fs.closeSync(fd); }
}

const coupables = [];
for (const f of fichiers) {
  let t;
  try { t = texte(f); } catch { continue; }
  // On cherche l'ancien chemin SANS le nouveau prefixe : `/Game/Narvos/City_...`
  // contient `/Game/City_...`? Non — mais on protege quand meme.
  const brut = [...t.matchAll(new RegExp(ANCIEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[A-Za-z0-9_/]*", "g"))].map((m) => m[0]);
  const morts = brut.filter((x) => !x.startsWith(NOUVEAU));
  if (morts.length) coupables.push({ f: path.relative(RACINE, f), morts: [...new Set(morts)] });
}

console.log(`${fichiers.length} asset(s) cuit(s) examine(s) sous ${path.basename(RACINE)}`);
if (!coupables.length) {
  console.log(`AUCUN ne reference encore ${ANCIEN} — les redirecteurs ne manquent a personne.`);
  process.exit(0);
}
console.log(`\n${coupables.length} asset(s) referencent encore l'ancien chemin :`);
for (const c of coupables.slice(0, 15)) {
  console.log(`  ${c.f}`);
  for (const m of c.morts.slice(0, 3)) console.log(`      -> ${m}`);
}
process.exit(1);