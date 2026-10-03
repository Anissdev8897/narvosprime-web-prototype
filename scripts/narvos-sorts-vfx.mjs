// ══════════════════════════════════════════════════════════════════════════════
// narvos-sorts-vfx.mjs — les ICÔNES des sorts, tirées des VFX 2D du prototype web.
//
//   node scripts/narvos-sorts-vfx.mjs            # simulation
//   node scripts/narvos-sorts-vfx.mjs --apply    # copie les images + écrit le catalogue
//
// ── POURQUOI (2026-09-14) ─────────────────────────────────────────────────────
// Demande de Hanibes : « fais en sorte que les sorts se lancent, on a des VFX :
// public/models/spells ». Chaque sort du catalogue TS nomme DÉJÀ son effet —
// `vfxPath` (motif « # » = numéro d'image) et `vfxFrames` — et le web les joue en
// billboard animé (spells/SpellVFX.tsx). Côté nanos, rien ne les lisait : le sort
// posait une particule du pack de base, immobile, et le joueur ne voyait rien
// partir.
//
// ── CE QU'IL FAIT ─────────────────────────────────────────────────────────────
//   1. EXÉCUTE spellCatalog.ts (esbuild) : la liste des sorts n'est jamais recopiée.
//   2. Choisit l'IMAGE D'ICÔNE : parmi les images de l'effet, celle qui couvre le
//      plus de pixels opaques (sharp), c'est-à-dire l'instant où l'effet est à son
//      plein ; les images absentes sont ignorées, et c'est DIT.
//   3. La copie seule, sous narvos-map-proto/Client/UI/img/sorts/<id_du_sort>.png.
//   4. Écrit Shared/Catalogs/SortsVfx.lua (GÉNÉRÉ).
//
// ⚠ 2026-09-14, retour de jeu : « remplace les effets pixel-art par les effets 3D
// du pack ; les images 2D pour l'ICÔNE des sorts ». Le billboard animé en jeu est
// retiré ; seule l'icône reste — une image par sort, pas les 87 de l'animation.
//
// ⚠ Le dossier de destination est VIDÉ avant la copie : une image retirée d'un
// sort ne doit pas survivre dans le paquet (le builder d'assets a déjà payé
// cette accumulation).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const RACINE = "E:/narvosprime-web-prototype";
const WEB = `${RACINE}/WebPortal`;
const SOURCE = `${WEB}/public/models/spells`;
const PAQUETS = `${WEB}/Server/nanos_world/packages`;
const DESTINATION = `${PAQUETS}/narvos-map-proto/Client/UI/img/sorts`;
// Ancien dossier des animations complètes (billboards retirés) : vidé s'il existe.
const ANCIEN = `${PAQUETS}/narvos-map-proto/Client/UI/vfx`;
const CATALOGUE = `${PAQUETS}/narvos/Shared/Catalogs/SortsVfx.lua`;
const APPLY = process.argv.includes("--apply");

const require = createRequire(`${WEB}/package.json`);
const sharp = require("sharp");

// ── 1. Le catalogue TS, exécuté ──────────────────────────────────────────────
const dossierTemp = fs.mkdtempSync(path.join(os.tmpdir(), "sorts-vfx-"));
const bundle = path.join(dossierTemp, "spells.mjs");
execFileSync("node", [`${WEB}/node_modules/esbuild/bin/esbuild`, `${WEB}/src/rpg/spells/spellCatalog.ts`,
  "--bundle", "--format=esm", "--platform=node", `--outfile=${bundle}`, "--log-level=error",
  "--define:import.meta.env.DEV=false", "--define:import.meta.env={}"]);
const { SPELL_CATALOG } = await import(pathToFileURL(bundle).href);
fs.rmSync(dossierTemp, { recursive: true, force: true });

if (!Array.isArray(SPELL_CATALOG) || SPELL_CATALOG.length === 0) {
  console.error("ARRET : SPELL_CATALOG vide ou illisible.");
  process.exit(1);
}

console.log(APPLY ? "=== APPLIQUÉ ===" : "=== SIMULATION (ajouter --apply) ===");

/** Nombre de pixels dont l'alpha dépasse un quart : la « plénitude » d'une image. */
async function Couverture(fichier) {
  const { data, info } = await sharp(fichier).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] > 64) n++;
  return { n, largeur: info.width, hauteur: info.height };
}

// ── 2. Les images de chaque sort ─────────────────────────────────────────────
const retenus = [];
let manquantes = 0;
for (const s of SPELL_CATALOG) {
  const motif = String(s.vfxPath || "");
  const attendues = Math.max(0, Number(s.vfxFrames) || 0);
  if (!s.id || !motif.includes("#") || attendues === 0) {
    console.log(`  ⚠ ${s.id} : pas de vfxPath exploitable — aucun effet 2D`);
    continue;
  }
  const presentes = [];
  for (let k = 1; k <= attendues; k++) {
    const f = path.join(SOURCE, motif.replace("#", String(k)));
    if (fs.existsSync(f)) presentes.push(f);
    else manquantes++;
  }
  if (presentes.length === 0) {
    console.log(`  ⚠ ${s.id} : AUCUNE image trouvée (${motif})`);
    continue;
  }
  let meilleure = 0, couverture = -1, largeur = 0, hauteur = 0;
  for (let i = 0; i < presentes.length; i++) {
    const c = await Couverture(presentes[i]);
    if (i === 0) { largeur = c.largeur; hauteur = c.hauteur; }
    if (c.n > couverture) { couverture = c.n; meilleure = i + 1; }
  }
  retenus.push({ id: s.id, images: presentes, icone: meilleure, largeur, hauteur, motif, attendues });
  const trou = presentes.length < attendues ? `  (${attendues - presentes.length} absente(s), ignorée(s))` : "";
  console.log(`  ${s.id.padEnd(22)} ${presentes.length} image(s) ${largeur}x${hauteur}, icône = ${meilleure}${trou}`);
}

// ── 3. Écriture ──────────────────────────────────────────────────────────────
const q = (v) => JSON.stringify(v);
const lignes = [
  "-- Généré depuis spells/spellCatalog.ts et public/models/spells par scripts/narvos-sorts-vfx.mjs",
  "-- Ne pas éditer à la main : régénérer après toute évolution du catalogue TS ou des images.",
  "",
  "local SortsVfx = {}",
  "",
  "--- Par sort : l'icône (chemin relatif à Client/UI), l'image retenue dans l'effet",
  "--- source, sa taille en pixels, et le motif d'images du catalogue web.",
  "SortsVfx.SORTS = {",
];
for (const r of retenus) {
  lignes.push(`    ${r.id} = { icone = ${q(`img/sorts/${r.id}.png`)}, image = ${r.icone}, largeur = ${r.largeur}, hauteur = ${r.hauteur}, source = ${q(r.motif)} },`);
}
lignes.push("}", "", "-- Ordre du catalogue TS.", "SortsVfx.SORTS_ORDER = {");
for (const r of retenus) lignes.push(`    ${q(r.id)},`);
lignes.push("}", "", "return SortsVfx", "");

if (APPLY) {
  fs.rmSync(DESTINATION, { recursive: true, force: true });
  fs.rmSync(ANCIEN, { recursive: true, force: true });
  fs.mkdirSync(DESTINATION, { recursive: true });
  for (const r of retenus) fs.copyFileSync(r.images[r.icone - 1], path.join(DESTINATION, `${r.id}.png`));
  fs.writeFileSync(CATALOGUE, lignes.join("\n"), "utf8");
  console.log(`\nÉcrit : ${retenus.length} icône(s) sous Client/UI/img/sorts, Catalogs/SortsVfx.lua`);
} else {
  console.log(`\n${retenus.length} icône(s) de sort. Rien écrit.`);
}
if (manquantes > 0) console.log(`⚠ ${manquantes} image(s) annoncée(s) par vfxFrames mais absentes du disque.`);