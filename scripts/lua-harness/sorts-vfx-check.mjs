// ══════════════════════════════════════════════════════════════════════════════
// sorts-vfx-check.mjs — les icônes de sorts annoncées existent-elles sur disque ?
//
//   node scripts/lua-harness/sorts-vfx-check.mjs
//
// `Catalogs/SortsVfx.lua` (GÉNÉRÉ par scripts/narvos-sorts-vfx.mjs) donne à chaque
// sort une icône `img/sorts/<id>.png`, chemin relatif à Client/UI. Une image
// absente ne lève RIEN : la page affiche la lettre de repli et personne ne le
// remarque. On confronte donc chaque entrée à son fichier, et le dossier au
// catalogue (un fichier sans entrée est une copie périmée livrée pour rien).
//
// 2026-09-14 : les billboards 2D en jeu sont retirés (retour de jeu : effets 3D
// du pack, images 2D pour l'icône seulement). Le garde refuse aussi le retour de
// l'ancien dossier d'animations complètes `Client/UI/vfx`.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const PAQUETS = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages";
const CATALOGUE = `${PAQUETS}/narvos/Shared/Catalogs/SortsVfx.lua`;
const SPELLS = `${PAQUETS}/narvos/Shared/Catalogs/Spells.lua`;
const UI = `${PAQUETS}/narvos-map-proto/Client/UI`;
const DOSSIER = `${UI}/img/sorts`;

let echecs = 0;
let reussis = 0;
const refus = (m) => { echecs++; console.log(`  ECHEC  ${m}`); };

const texte = fs.readFileSync(CATALOGUE, "utf8");
const entrees = [...texte.matchAll(/^\s{4}([a-z0-9_]+) = \{ icone = "([^"]+)"/gm)]
  .map((m) => ({ id: m[1], icone: m[2] }));
if (entrees.length === 0) refus("aucune entree lue dans Catalogs/SortsVfx.lua (format change ?)");

for (const e of entrees) {
  if (e.icone !== `img/sorts/${e.id}.png`) refus(`${e.id} : icone ${e.icone} hors de img/sorts/<id>.png`);
  const f = path.join(UI, e.icone);
  if (fs.existsSync(f) && fs.statSync(f).size > 0) reussis++;
  else refus(`${e.id} : ${e.icone} absente ou vide`);
}

const ids = new Set(entrees.map((e) => e.id));
for (const f of fs.existsSync(DOSSIER) ? fs.readdirSync(DOSSIER) : []) {
  if (ids.has(f.replace(/\.png$/, ""))) reussis++;
  else refus(`img/sorts/${f} sans entree au catalogue (copie perimee)`);
}

if (fs.existsSync(`${UI}/vfx`)) refus("Client/UI/vfx existe encore : animations 2D completes livrees pour rien");
else reussis++;

// Tout sort du catalogue de jeu a son icône.
const sorts = [...fs.readFileSync(SPELLS, "utf8").matchAll(/^\s{8}id = "([a-z0-9_]+)",\s*\r?\n\s*classId/gm)].map((m) => m[1]);
if (sorts.length === 0) refus("aucun sort lu dans Catalogs/Spells.lua (format change ?)");
for (const s of sorts) {
  if (ids.has(s)) reussis++;
  else refus(`sort ${s} sans icone dans Catalogs/SortsVfx.lua (relancer narvos-sorts-vfx.mjs --apply)`);
}

console.log(`\n${reussis} reussi(s), ${echecs} echec(s) — ${entrees.length} icone(s), ${sorts.length} sort(s) au catalogue de jeu.`);
if (echecs > 0) process.exitCode = 1;