// Quel squelette les tenues MetaWardrobe visent-elles ?
// C'est la question qui décide : `AddSkeletalMeshAttached` exige le MÊME
// squelette que le corps. Kimi a mesuré `Skel_Dummy` sur les 37 pièces
// MetaCustom — inattachables. Les tenues achetées héritent-elles du défaut ?
//
// Méthode : la table de noms d'un .uasset vit près du DÉBUT et de la FIN. On lit
// 1 Mo de chaque bout — l'un des fichiers dépasse 512 Mo, la limite de chaîne V8.
import fs from "node:fs";
import path from "node:path";

const RACINE = process.argv[2];
const fichiers = [];
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) descendre(p);
    else if (e.name.endsWith(".uasset")) fichiers.push(p);
  }
})(RACINE);

function bouts(f) {
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
  } finally {
    fs.closeSync(fd);
  }
}

const squelettes = {};
const versions = {};
let lus = 0;
for (const f of fichiers) {
  let t;
  try { t = bouts(f); } catch { continue; }
  lus++;
  const motif = /(Skel_Dummy|metahuman_base_skel|SKEL_Mannequin|UE4_Mannequin_Skeleton|[A-Za-z0-9]{3,28}_Skeleton)/g;
  for (const m of t.matchAll(motif)) squelettes[m[1]] = (squelettes[m[1]] || 0) + 1;
  const v = t.match(/\+\+UE[45]\+Release-[0-9.]+/);
  if (v) versions[v[0]] = (versions[v[0]] || 0) + 1;
}

const tri = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log(`${lus} .uasset lus sur ${fichiers.length}`);
console.log("\nSQUELETTES :");
for (const [k, v] of tri(squelettes)) console.log(`  ${String(v).padStart(5)}  ${k}`);
console.log("\nVERSIONS UE :");
for (const [k, v] of tri(versions)) console.log(`  ${String(v).padStart(5)}  ${k}`);