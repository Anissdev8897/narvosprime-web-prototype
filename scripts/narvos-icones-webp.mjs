// ══════════════════════════════════════════════════════════════════════════════
// narvos-icones-webp.mjs — les icones PNG exportees de l'editeur -> WebP servis
// par la WebUI.
//
//   node scripts/narvos-icones-webp.mjs            essai
//   node scripts/narvos-icones-webp.mjs --apply    conversion
//
// Entree : WebPortal/Server/adk/_icones_png/*.png  (adk-exporter-icones.py)
// Sortie : narvos-map-proto/Client/UI/img/items/<Nom>.webp
//
// ── POURQUOI WEBP, ET POURQUOI 128 PIXELS ────────────────────────────────────
// Le package WebUI est TELECHARGE par chaque client. Les 65 icones deja servies
// pesent 764 Ko (~12 Ko piece), en WebP. On garde la convention : une icone
// d'inventaire s'affiche a moins de 64 pixels, 128 laisse le double pour les
// ecrans denses. Un PNG 512 exporte tel quel pese dix a vingt fois plus, pour un
// detail que personne ne verra.
//
// ── ⚠ JAMAIS D'ECRASEMENT D'UNE ICONE NARVOS ─────────────────────────────────
// `img/items/` porte deja des icones du projet (`tex_bone_06`...). Une icone
// Hyper du meme nom ne REMPLACE PAS l'existante : elle est ignoree et nommee.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const RACINE = "E:/narvosprime-web-prototype";
const require = createRequire(`${RACINE}/WebPortal/package.json`);
const sharp = require("sharp");

const ENTREE = `${RACINE}/WebPortal/Server/adk/_icones_png`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI/img/items`;
const APPLY = process.argv.includes("--apply");
const TAILLE = 128;

if (!fs.existsSync(ENTREE)) {
  console.error(`ARRET : ${ENTREE} absent — lancer d'abord adk-exporter-icones.py`);
  process.exit(1);
}

const pngs = fs.readdirSync(ENTREE).filter((f) => f.toLowerCase().endsWith(".png"));
if (pngs.length === 0) {
  console.error("ARRET : aucun PNG exporte — l'export a echoue, rien n'est converti.");
  process.exit(1);
}

let converties = 0, ignorees = [], echecs = [], octets = 0;
for (const f of pngs.sort()) {
  const nom = f.slice(0, -4);
  const cible = path.join(SORTIE, `${nom}.webp`);
  // Une icone du PROJET du meme nom l'emporte : on ne l'ecrase pas. Les icones
  // Hyper portent toutes le prefixe `T_Icon_` ; celles du projet, `tex_`. Une
  // icone Hyper deja convertie (relance) est simplement refaite.
  if (fs.existsSync(cible) && !nom.startsWith("T_Icon_")) { ignorees.push(nom); continue; }
  if (!APPLY) { converties++; continue; }
  try {
    await sharp(path.join(ENTREE, f))
      .resize(TAILLE, TAILLE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82 })
      .toFile(cible);
    octets += fs.statSync(cible).size;
    converties++;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  }
}

console.log(`${pngs.length} PNG ; ${converties} ${APPLY ? "converti(s)" : "a convertir"} ; ${ignorees.length} ignore(s) ; ${echecs.length} echec(s)`);
if (APPLY) console.log(`poids ajoute : ${(octets / 1024).toFixed(0)} Ko (${TAILLE} px, WebP)`);
for (const i of ignorees.slice(0, 5)) console.log(`  ignore (icone du projet du meme nom) : ${i}`);
for (const e of echecs.slice(0, 5)) console.log(`  ECHEC ${e}`);
if (!APPLY) console.log("ESSAI — --apply pour convertir.");
if (echecs.length > 0) process.exitCode = 1;