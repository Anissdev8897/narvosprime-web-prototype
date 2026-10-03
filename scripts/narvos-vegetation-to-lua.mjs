// ══════════════════════════════════════════════════════════════════════════════
// narvos-vegetation-to-lua.mjs — catalogue Lua du semis de végétation.
//
//   node scripts/narvos-vegetation-to-lua.mjs [--apply]
//
// Même raison d'être que `narvos-patches-to-lua.mjs` : les meshes de carte ont
// leurs transforms CUITES dans les sommets et se spawnent à `Vector(0,0,0)` ;
// la végétation, elle, est une poignée de meshes réutilisés des centaines de
// fois, donc position, rotation et échelle doivent voyager avec chaque touffe.
//
// ── CE QUI GOUVERNE LE SEMIS ─────────────────────────────────────────────────
// Le placement est fait dans l'éditeur (`herbe.py`) sous trois contraintes du
// skill `narvos-level-design` :
//   - pente locale sous 25° (le moteur marche jusqu'à 60°, l'herbe ne pousse pas
//     sur une paroi) ;
//   - le sol touché doit porter un matériau d'HERBE — lu, pas deviné ;
//   - échelle et rotation variées DANS le groupe : « la végétation est la
//     première source de bruit visuel », quatre clones alignés se voient.
//
// ⚠ Le coût du tick nanos est le NOMBRE d'entités, pas leur poids. La Forge en
// pose 623 ; le semis est plafonné à 300 pour ne pas doubler ce budget. Monter
// ce plafond est une décision de perf, pas de décoration.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const SOURCE = `${RACINE}/WebPortal/Server/adk/_vegetation.json`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Vegetation.lua`;

const APPLIQUER = process.argv.includes("--apply");

if (!fs.existsSync(SOURCE)) {
  console.error(`ARRÊT : ${SOURCE} est absent — relancer l'export depuis l'éditeur.`);
  process.exit(1);
}

const donnees = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const plantes = donnees.plantes ?? [];
if (plantes.length === 0) {
  console.error("ARRÊT : aucune plante dans la source.");
  process.exit(1);
}

const parMesh = new Map();
for (const p of plantes) parMesh.set(p.mesh, (parMesh.get(p.mesh) ?? 0) + 1);

const lignes = plantes.map((p) => {
  const [x, y, z] = p.position;
  const [, yaw] = p.rotation;
  const [sx, sy, sz] = p.echelle;
  return `    { mesh = "${p.mesh}", position = { ${x}, ${y}, ${z} },`
       + ` rotation = { 0, ${yaw}, 0 }, echelle = { ${sx}, ${sy}, ${sz} } },`;
});

const repartition = [...parMesh.entries()]
  .map(([m, n]) => `--   ${String(n).padStart(4)}  ${m}`)
  .join("\n");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Vegetation.lua — semis d'herbe sur la carte.
--
-- FICHIER GÉNÉRÉ par scripts/narvos-vegetation-to-lua.mjs — ne pas éditer à la main.
--
-- ${plantes.length} touffes, réparties sur ${parMesh.size} variantes :
${repartition}
--
-- Placement mesuré, pas semé au hasard : pente locale sous 25°, sol dont le
-- matériau EST de l'herbe (lu au raycast), position bruitée pour casser la
-- grille, échelle et rotation variées dans le groupe.
--
-- ⚠ PLAFOND À 300. Le coût du tick nanos est le NOMBRE d'entités : la Forge en
-- pose déjà 623. Sur 2 355 emplacements éligibles, on n'en garde que 300 —
-- augmenter ce chiffre est un arbitrage de performance, à mesurer.
--
-- ⚠ PAS D'ARBRES. Le pack de base nanos n'en contient aucun, et l'ADK non plus :
-- les seules plantes disponibles sont ces quatre touffes du pack
-- MWLandscapeAutoMaterial. Poser des arbres demande d'abord d'importer un pack
-- de nature (public/models/nature/ en a 695, au format GLB).
-- ══════════════════════════════════════════════════════════════════════════════

local Vegetation = {}

--- Carte visée. Le semis est calé sur SA géométrie.
Vegetation.CARTE = "${donnees.carte ?? "?"}"

Vegetation.LISTE = {
${lignes.join("\n")}
}

return Vegetation
`;

if (!APPLIQUER) {
  console.log(`Simulation — ${plantes.length} touffes seraient écrites dans :`);
  console.log(`  ${SORTIE}`);
  console.log("Rien écrit. Ajouter --apply.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, lua, "utf8");
console.log(`Écrit : ${SORTIE}`);
console.log(`${plantes.length} touffes, ${parMesh.size} variantes.`);