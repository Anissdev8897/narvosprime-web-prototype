// ══════════════════════════════════════════════════════════════════════════════
// narvos-minimap-to-lua.mjs — ce dont la minimap Ako a besoin côté client : le
// widget, l'acteur de bornes, nos deux proxies, et la taille MESURÉE de la boîte.
//
//   node scripts/narvos-minimap-to-lua.mjs [--apply]
//
// Produit `Shared/Catalogs/Minimap.lua`, lu par `narvos-map-proto/Client/Minimap.lua`.
//
// ── POURQUOI UN CATALOGUE GÉNÉRÉ ─────────────────────────────────────────────
// Les quatre clés vivent sous [assets.blueprints] d'Assets.toml, qu'aucune n'avait
// avant le lot 3 : écrites à la main dans le client, elles seraient quatre
// références mortes jusqu'au cook, et un RANG ensuite (CLAUDE.md, pièges connus).
// Ici elles sont relues par CHEMIN à chaque construction du pack ; tant qu'une
// manque, `Minimap.PRETE = false` et le client ne tente rien — le radar WebUI (H)
// reste la carte.
//
// La taille de la boîte vient de `adk/_manifests/ako-bornes.json`, écrit par
// `scripts/adk-mesurer-bornes-ako.py` (lecture du mesh Box_board et de l'échelle du
// composant BOX_Bounds). Sans cette mesure, le script S'ARRÊTE : une boîte devinée
// placerait le joueur au mauvais endroit de la carte, sans erreur.
//
// ⚠ À lancer APRÈS `nanos-build-asset-pack.mjs --apply`.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const MESURE = `${RACINE}/WebPortal/Server/adk/_manifests/ako-bornes.json`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Minimap.lua`;
const APPLIQUER = process.argv.includes("--apply");

/** Chaque pièce, par CHEMIN EXACT sous le pack. */
const PIECES = [
  { id: "WIDGET", chemin: "Narvos/Ako_Mini_Map_sys/ako_mini_map_Content/ui/ui_minimap_showup", role: "widget a l'ecran (disque, fleche, pictogrammes)" },
  { id: "BORNES", chemin: "Narvos/Ako_Mini_Map_sys/ako_mini_map_Content/map_data_blueprint/ACTORS/BP_MAP_Bounds", role: "boite de bornes, une par monde" },
  { id: "JOUEUR", chemin: "Narvos/Minimap/BP_NarvosCarteJoueur", role: "proxy attache au personnage local (player ref du DataAsset)" },
  { id: "REPERE", chemin: "Narvos/Minimap/BP_NarvosCarteRepere", role: "proxy d'un repere du radar (item_setting du DataAsset)" },
];

if (!fs.existsSync(TOML)) {
  console.error(`ARRÊT : ${TOML} absent — le pack n'est pas construit.`);
  process.exit(1);
}
if (!fs.existsSync(MESURE)) {
  console.error(`ARRÊT : ${MESURE} absent — lancer scripts/adk-mesurer-bornes-ako.py dans l'ADK.`);
  process.exit(1);
}

// ── La boîte mesurée ─────────────────────────────────────────────────────────
const mesure = JSON.parse(fs.readFileSync(MESURE, "utf8"));
const ext = mesure.box_board?.demi_etendue;
const ech = mesure.box_bounds?.echelle;
if (!ext || !ech || !(ext.x > 0) || !(ext.y > 0) || !(ech.x > 0) || !(ech.y > 0)) {
  console.error(`ARRÊT : mesure incomplète dans ${MESURE} : ${JSON.stringify(mesure)}`);
  process.exit(1);
}
const boite = { x: ext.x * ech.x, y: ext.y * ech.y };

// ── Les clés, par chemin ─────────────────────────────────────────────────────
const blueprints = [];
{
  let dans = false;
  for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
    const section = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) { dans = section[1] === "assets.blueprints"; continue; }
    if (!dans) continue;
    const m = ligne.match(/^\s*([^\s=#]+)\s*=\s*"([^"]+)"\s*$/);
    if (m) blueprints.push({ cle: m[1], chemin: m[2] });
  }
}
const pieces = PIECES.map((p) => ({ ...p, cle: blueprints.find((b) => b.chemin === p.chemin)?.cle ?? null }));
const absentes = pieces.filter((p) => !p.cle);
for (const p of pieces) console.log(`  ${p.id.padEnd(7)} ${p.cle ? `${p.cle}  (${p.chemin})` : `ABSENT — ${p.chemin}`}`);
console.log(`  boite   demi-etendue ${boite.x} x ${boite.y} cm (Box_board ${ext.x} x echelle ${ech.x})`);
console.log(`  prete   ${absentes.length === 0}`);

if (!APPLIQUER) {
  console.log(`\nSimulation — rien écrit. Ajouter --apply pour produire :\n  ${SORTIE}`);
  process.exit(0);
}

const lignes = pieces.map((p) => (p.cle
  ? `Minimap.${p.id} = "narvos::${p.cle}"   -- ${p.role}`
  : `-- Minimap.${p.id} : ABSENT d'Assets.toml (${p.chemin}) — ${p.role}`)).join("\n");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Minimap.lua — les pieces de la minimap Ako et la taille mesuree de sa boite.
--
-- FICHIER GENERE par scripts/narvos-minimap-to-lua.mjs depuis Assets.toml et
-- adk/_manifests/ako-bornes.json. Ne pas editer a la main : regenerer apres chaque
-- construction du pack.
--
-- ${pieces.length - absentes.length} piece(s) sur ${pieces.length} declaree(s)${absentes.length > 0 ? ` — absente(s) : ${absentes.map((p) => p.id).join(", ")}` : ""}.
-- PRETE = false tant qu'une piece manque : le client ne pose rien, le radar WebUI
-- reste la carte.
-- ══════════════════════════════════════════════════════════════════════════════

local Minimap = {}

${lignes}

Minimap.PRETE = ${absentes.length === 0}

--- Demi-etendue (cm) de la boite de BP_MAP_Bounds a l'echelle 1 : Box_board
--- (${ext.x} x ${ext.y} cm) fois l'echelle du composant BOX_Bounds (${ech.x} x ${ech.y}).
Minimap.BOITE_DEMI_ETENDUE_CM = { x = ${boite.x}, y = ${boite.y} }

return Minimap
`;

fs.writeFileSync(SORTIE, lua);
console.log(`\nécrit : ${SORTIE}`);