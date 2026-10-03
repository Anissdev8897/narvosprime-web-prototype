// Signature d'un pack = multiensemble {taille, nom de fichier} de tout son contenu.
// Insensible au nombre de niveaux d'emballage, qui varie d'un repack a l'autre.
import { readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const BASE = "E:/narvosprime-web-prototype/WebPortal/public/asset_game";
function fichiers(dir, out) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiers(p, out);
    else { try { out.push(`${statSync(p).size} ${e.name}`); } catch {} }
  }
  return out;
}
const packs = [];
function collecter(groupe, dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (!e.isDirectory()) { const s = statSync(p); packs.push({ chemin: `${groupe}/${e.name}`, n: 1, go: s.size / 1073741824, sig: createHash("sha1").update(`${s.size} ${e.name}`).digest("hex") }); continue; }
    const l = fichiers(p, []).sort();
    packs.push({ chemin: `${groupe}/${e.name}`, n: l.length, go: l.reduce((s, x) => s + Number(x.split(" ")[0]), 0) / 1073741824, sig: createHash("sha1").update(l.join("\n")).digest("hex") });
  }
}
for (const b of readdirSync(BASE, { withFileTypes: true })) {
  if (!b.isDirectory()) continue;
  if (["a_trier"].includes(b.name) && readdirSync(path.join(BASE, b.name), { withFileTypes: true }).every((x) => x.isDirectory()) && false) for (const s of readdirSync(path.join(BASE, b.name))) collecter(`a_trier/${s}`, path.join(BASE, b.name, s));
  else collecter(b.name, path.join(BASE, b.name));
}
const par = new Map();
for (const p of packs) { if (!par.has(p.sig)) par.set(p.sig, []); par.get(p.sig).push(p); }
let gache = 0, groupes = 0;
for (const [, g] of par) {
  if (g.length < 2) continue;
  groupes++; gache += g[0].go * (g.length - 1);
  console.log(`\nDOUBLON — ${g[0].n} fichiers, ${g[0].go.toFixed(2)} Go chacun :`);
  for (const p of g) console.log(`   ${p.chemin}`);
}
console.log(`\n${packs.length} packs, ${groupes} groupe(s) de doublons, ${gache.toFixed(2)} Go gaches.`);