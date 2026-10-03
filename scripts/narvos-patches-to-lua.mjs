// ══════════════════════════════════════════════════════════════════════════════
// narvos-patches-to-lua.mjs — catalogue Lua des dalles qui bouchent les trous.
//
//   node scripts/narvos-patches-to-lua.mjs [--apply]
//
// ── POURQUOI UN CATALOGUE À PART ──────────────────────────────────────────────
// `narvos-map-to-lua.mjs` spawne tous les meshes de la carte à `Vector(0, 0, 0)` :
// leurs transforms sont CUITES dans les sommets. Nos dalles, elles, sont un cube
// GÉNÉRIQUE (`SM_Patch_Sol`) posé par transform — les faire passer par le même
// catalogue les enverrait toutes à l'origine, empilées les unes sur les autres.
//
// Elles ont donc leur propre catalogue, qui porte position ET échelle.
//
// ── D'OÙ VIENNENT LES DONNÉES ────────────────────────────────────────────────
// `adk/_patches-trous.json`, exporté depuis l'éditeur après le balayage par
// raycast (voir `.hermes/TROUS_HALO_MAP_2026-09-06.md`). Ne pas éditer à la
// main : relancer l'export si les dalles bougent.
//
// ⚠ `SM_Patch_Sol` vit sous `/Game/Narvos/halo_map/patches/`. Il n'existera dans
// le pack qu'APRÈS un cook. Tant que ce cook n'a pas eu lieu, le catalogue
// référence un mesh absent — `narvos-verifier-catalogues.mjs` le signalera, et
// c'est normal.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const SOURCE = `${RACINE}/WebPortal/Server/adk/_patches-trous.json`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Patches.lua`;

const APPLIQUER = process.argv.includes("--apply");

if (!fs.existsSync(SOURCE)) {
  console.error(`ARRÊT : ${SOURCE} est absent.`);
  console.error("Relancer l'export depuis l'éditeur (scripts adk-… du rapport de trous).");
  process.exit(1);
}

const donnees = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const patches = donnees.patches ?? [];
if (patches.length === 0) {
  console.error("ARRÊT : aucun patch dans la source.");
  process.exit(1);
}

// Le cube du moteur fait 100 uu de côté : l'échelle vaut donc la taille / 100.
// On l'écrit telle quelle et c'est le Lua qui appelle SetScale.
const lignes = patches.map((p) => {
  const [x, y, z] = p.position;
  const [sx, sy, sz] = p.echelle;
  const [pi, ya, ro] = p.rotation ?? [0, 0, 0];
  // Le matériau voyage PAR DALLE : chacune prend celui du sol qui la borde.
  // Un matériau unique ferait une pièce d'herbe au milieu de la roche.
  const mat = p.materiau ? `, materiau = "${p.materiau}"` : "";
  return `    { nom = "${p.nom}", position = { ${x}, ${y}, ${z} },`
       + ` rotation = { ${pi}, ${ya}, ${ro} },`
       + ` echelle = { ${sx}, ${sy}, ${sz} }${mat} },`;
});

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Patches.lua — dalles de collision qui bouchent les trous de la carte.
--
-- FICHIER GÉNÉRÉ par scripts/narvos-patches-to-lua.mjs — ne pas éditer à la main.
--
-- ${patches.length} dalles, relevées par un balayage de 1 525 681 rayons verticaux
-- (un tous les 250 uu), puis confirmées à 50 uu et mesurées contre le diamètre
-- de la capsule du joueur (90 uu). Détail : .hermes/TROUS_HALO_MAP_2026-09-06.md
--
-- ⚠ CE CATALOGUE PORTE DES TRANSFORMS, contrairement à Map_*.lua.
-- Les meshes de la carte ont leurs transforms cuites dans les sommets et se
-- spawnent à Vector(0,0,0) ; ces dalles-ci sont un cube générique réutilisé
-- ${patches.length} fois, donc position et échelle doivent voyager avec.
--
-- ⚠ Les 4 points restés « ouverts » après réparation ne sont PAS des trous :
-- ce sont des crevasses verticales entre deux parois (dénivelé 1 953 à 5 961 uu
-- autour du point). Un rayon vertical les manque, un joueur qui marche ne les
-- rencontre pas. Les boucher demandait des cubes de 18 x 18 x 62 m visibles de
-- partout — essayé, mesuré à 94-100 % de surface apparente, retiré.
-- ══════════════════════════════════════════════════════════════════════════════

local Patches = {}

--- Mesh réutilisé par toutes les dalles. Copie du cube moteur rangée sous
--- Narvos/ : un asset de /Engine/ ne serait jamais cuit dans le pack.
Patches.MESH = "narvos::${donnees.mesh}"

--- Carte visée. Les dalles sont calées sur SA géométrie : les rejouer sur une
--- autre version de la carte n'aurait pas de sens.
Patches.CARTE = "${donnees.carte ?? "?"}"

--- Une entrée par trou. Le cube source fait 100 uu de côté : l'échelle est donc
--- la taille voulue divisée par 100.
Patches.LISTE = {
${lignes.join("\n")}
}

return Patches
`;

if (!APPLIQUER) {
  console.log(`Simulation — ${patches.length} dalles seraient écrites dans :`);
  console.log(`  ${SORTIE}`);
  console.log("Rien écrit. Ajouter --apply.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, lua, "utf8");
console.log(`Écrit : ${SORTIE}`);
console.log(`${patches.length} dalles.`);