// ══════════════════════════════════════════════════════════════════════════════
// narvos-clean-unreal-artifacts.mjs — Retire les fichiers propres à Unreal d'un
// dossier d'assets web.
//
//   node scripts/narvos-clean-unreal-artifacts.mjs <racine> [--apply]
//
// POURQUOI : un asset Unreal n'est pas UN fichier mais un trio —
//   .uasset  en-tête, métadonnées, références
//   .uexp    exports (le contenu sérialisé)
//   .ubulk   données lourdes : textures, géométrie
// Ne supprimer que le premier laisserait les deux autres, orphelins et illisibles
// par quiconque. `.umap` (niveaux) suit la même logique.
//
// Ces formats ne servent QU'À Unreal, et seulement sous son dossier `Content/`.
// Dans `public/models`, qui alimente le runtime web (Three.js lit du glTF), ils
// sont du poids mort. Le runtime web ne sait pas les ouvrir ; Unreal ne les voit
// plus. Personne ne les lit.
//
// ⚠ CE SCRIPT SUPPRIME DÉFINITIVEMENT. Il n'y a pas de corbeille, pas de git sur
// ce dossier. La simulation est le mode par défaut, et `--apply` est le seul
// moyen d'écrire — lire la simulation en entier avant.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const racine = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!racine || !fs.existsSync(racine)) {
  console.error("Usage : node scripts/narvos-clean-unreal-artifacts.mjs <racine> [--apply]");
  process.exit(1);
}

// Le trio Unreal + les niveaux. `.uplugin` et `.uproject` ne sont pas listés :
// ils décrivent un projet, pas un asset, et n'ont rien à faire ici de toute façon.
const EXTENSIONS = new Set([".uasset", ".uexp", ".ubulk", ".umap"]);

/**
 * Ce qu'on NE supprime pas, malgré l'extension.
 *
 * `Mannequin_UE4` porte SK_Mannequin — le squelette UE4 que nanos exige — et
 * RTG_UE5Manny_UE4Manny, un retargeter Manny UE5 → UE4 tout fait. Ces deux
 * assets débloquent la conversion des 89 animations en Manny UE5, ils ne pèsent
 * rien, et ils n'existent nulle part ailleurs sur le disque.
 */
const PRESERVER = [
  { motif: /[\\/]Mannequin_UE4[\\/]/i, raison: "squelette UE4 + retargeter Manny→UE4 exigés par nanos" },
];

const parcourir = (dir, acc = []) => {
  let entrees;
  try {
    entrees = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entrees) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) parcourir(f, acc);
    else if (EXTENSIONS.has(path.extname(e.name).toLowerCase())) acc.push(f);
  }
  return acc;
};

const fichiers = parcourir(racine);

const aSupprimer = [];
const preserves = [];

for (const f of fichiers) {
  const regle = PRESERVER.find((p) => p.motif.test(f));
  if (regle) preserves.push({ f, raison: regle.raison });
  else aSupprimer.push(f);
}

// ─── rapport ──────────────────────────────────────────────────────────────────

const parExtension = new Map();
let octets = 0;
for (const f of aSupprimer) {
  const ext = path.extname(f).toLowerCase();
  const taille = fs.statSync(f).size;
  const e = parExtension.get(ext) || { n: 0, octets: 0 };
  parExtension.set(ext, { n: e.n + 1, octets: e.octets + taille });
  octets += taille;
}

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`racine : ${racine}`);
console.log("");

for (const [ext, e] of [...parExtension].sort((a, b) => b[1].octets - a[1].octets)) {
  console.log(`  ${ext.padEnd(9)} ${String(e.n).padStart(7)} fichiers  ${(e.octets / 1024 ** 3).toFixed(2).padStart(7)} Go`);
}
console.log(`  ${"TOTAL".padEnd(9)} ${String(aSupprimer.length).padStart(7)} fichiers  ${(octets / 1024 ** 3).toFixed(2).padStart(7)} Go`);

if (preserves.length) {
  console.log("");
  console.log(`  PRÉSERVÉS : ${preserves.length} fichier(s)`);
  for (const r of [...new Set(preserves.map((p) => p.raison))]) console.log(`    · ${r}`);
}

if (!APPLY) {
  console.log("");
  console.log("Rien supprimé. Relire ce rapport avant --apply : la suppression est définitive.");
  process.exit(0);
}

// ─── suppression ──────────────────────────────────────────────────────────────

let supprimes = 0;
for (const f of aSupprimer) {
  try {
    fs.rmSync(f);
    supprimes++;
  } catch (err) {
    console.log(`  ÉCHEC  ${path.relative(racine, f)} — ${err.message}`);
  }
}

// Un dossier vidé de ses seuls .uasset n'a plus de raison d'exister. On remonte
// depuis les feuilles pour que les parents devenus vides partent aussi.
const dossiersParProfondeur = [];
const collecter = (dir, prof = 0) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(dir, e.name);
    dossiersParProfondeur.push({ f, prof });
    collecter(f, prof + 1);
  }
};
collecter(racine);
dossiersParProfondeur.sort((a, b) => b.prof - a.prof);

let vides = 0;
for (const { f } of dossiersParProfondeur) {
  try {
    if (fs.readdirSync(f).length === 0) {
      fs.rmdirSync(f);
      vides++;
    }
  } catch {
    /* dossier déjà retiré par un passage précédent */
  }
}

console.log("");
console.log(`${supprimes} fichier(s) supprimé(s), ${vides} dossier(s) vide(s) retiré(s).`);