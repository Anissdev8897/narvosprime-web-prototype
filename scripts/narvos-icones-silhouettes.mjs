// ══════════════════════════════════════════════════════════════════════════════
// narvos-icones-silhouettes.mjs — icones d'inventaire de REPLI tirees des
// vignettes embarquees dans les .uasset, sans ouvrir l'editeur.
//
//   node scripts/narvos-icones-silhouettes.mjs            essai
//   node scripts/narvos-icones-silhouettes.mjs --apply    ecriture
//
// Sortie : narvos-map-proto/Client/UI/img/items/<T_Icon_...>.webp
//
// ── ⚠ CE SONT DES SILHOUETTES, PAS LES ICONES DU PACK ────────────────────────
// Nuit du 2026-09-12 au 13. L'export propre a ECHOUE :
//
//     adk-exporter-icones.py  ->  TextureExporterPNG
//     Assertion failed: SupportsTexture(Texture)  [EditorFactories.cpp:4621]
//
// Une assertion tue le processus sur la PREMIERE icone ; aucun `try` Python ne
// la rattrape. Piste non verifiee : les icones sont chargees depuis
// `/Game/Narvos/Hyper/` (liens durs + PackageRedirects) alors que leur nom de
// paquet interne est `/Game/Hyper/...` ; la source differee (bulk data) ne se
// charge peut-etre pas sous le chemin redirige, et `Source.IsValid()` echoue.
//
// Chaque .uasset d'editeur porte en tete une VIGNETTE PNG 256x256 (celle du
// Content Browser). Mesure : 181 icones sur 198 en ont une. Mais pour ces
// textures d'icone, la vignette a sa couleur a ZERO et la forme dans l'ALPHA —
// une silhouette. On la teinte a la couleur du texte de l'interface : l'objet se
// reconnait (un AK-47 est un AK-47), sans etre l'icone coloree que montre le pack.
//
// C'est un REPLI. Le jour ou les vraies icones sortent de l'editeur, les
// convertir avec `narvos-icones-webp.mjs` : elles portent les MEMES noms et
// remplacent ces silhouettes sans rien toucher d'autre.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const RACINE = "E:/narvosprime-web-prototype";
const require = createRequire(`${RACINE}/WebPortal/package.json`);
const sharp = require("sharp");

const SOURCE = `${RACINE}/WebPortal/Server/adk/Content/Narvos/Hyper/ResourcePack/Icons`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/UI/img/items`;
const APPLY = process.argv.includes("--apply");
const TAILLE = 128;

// `--texte` de Client/UI/style.css : la silhouette prend la couleur du texte,
// pas une couleur inventee. #d7e3ec
const TEINTE = { r: 0xd7, g: 0xe3, b: 0xec };

const SIG_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IEND = Buffer.from("IEND");

const fichiers = [];
(function descendre(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) descendre(p);
    else if (/^T_Icon_.*\.uasset$/.test(e.name)) fichiers.push(p);
  }
})(SOURCE);

if (fichiers.length === 0) {
  console.error(`ARRET : aucune icone sous ${SOURCE} — liens durs absents ?`);
  process.exit(1);
}

let ecrites = 0, sansVignette = [], echecs = [], octets = 0;
for (const f of fichiers.sort()) {
  const nom = path.basename(f, ".uasset");
  const d = fs.readFileSync(f);
  const i = d.indexOf(SIG_PNG);
  const j = i >= 0 ? d.indexOf(IEND, i) : -1;
  if (i < 0 || j < 0) { sansVignette.push(nom); continue; }
  const png = d.subarray(i, j + 8);   // IEND + son CRC

  if (!APPLY) { ecrites++; continue; }
  try {
    // ⚠ L'ALPHA DE LA VIGNETTE EST INVERSE : le FOND y est opaque, l'objet
    // transparent. Premiere version, meme nuit : alpha repris tel quel, et
    // l'apercu compose sur le fond de l'interface montrait une arme SOMBRE dans
    // un carre CLAIR — l'inverse d'une icone. La mesure le disait deja (alpha
    // moyen 228/255 : c'est la grande surface, le fond, qui est opaque) ; je
    // l'avais lue comme « tres opaque » sans en tirer la consequence.
    const alpha = await sharp(png).ensureAlpha().extractChannel(3).resize(TAILLE, TAILLE).raw().toBuffer();
    const rgba = Buffer.alloc(TAILLE * TAILLE * 4);
    for (let k = 0; k < TAILLE * TAILLE; k++) {
      rgba[k * 4] = TEINTE.r;
      rgba[k * 4 + 1] = TEINTE.g;
      rgba[k * 4 + 2] = TEINTE.b;
      rgba[k * 4 + 3] = 255 - alpha[k];
    }
    const cible = path.join(SORTIE, `${nom}.webp`);
    await sharp(rgba, { raw: { width: TAILLE, height: TAILLE, channels: 4 } })
      .webp({ quality: 85, alphaQuality: 90 })
      .toFile(cible);
    octets += fs.statSync(cible).size;
    ecrites++;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  }
}

console.log(`${fichiers.length} icone(s) ; ${ecrites} ${APPLY ? "silhouette(s) ecrite(s)" : "a ecrire"} ; ${sansVignette.length} sans vignette ; ${echecs.length} echec(s)`);
if (APPLY) console.log(`poids : ${(octets / 1024).toFixed(0)} Ko`);
if (sansVignette.length) console.log(`sans vignette (emoji de repli) : ${sansVignette.slice(0, 6).join(", ")}${sansVignette.length > 6 ? " ..." : ""}`);
for (const e of echecs.slice(0, 5)) console.log(`  ECHEC ${e}`);
if (!APPLY) console.log("ESSAI — --apply pour ecrire.");
if (echecs.length > 0) process.exitCode = 1;