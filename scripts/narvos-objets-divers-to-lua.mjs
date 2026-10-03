// ══════════════════════════════════════════════════════════════════════════════
// narvos-objets-divers-to-lua.mjs — les meshes des objets de communication et de
// la porte a code, choisis par CHEMIN dans Assets.toml.
//
//   node scripts/narvos-objets-divers-to-lua.mjs [--apply]
//
// Produit `Shared/Catalogs/ObjetsDivers.lua`, lu par Server/Communications.lua
// (talkie-walkie et smartphone en main) et Server/Digicode.lua (porte, cadre,
// clavier).
//
// ── POURQUOI UN GENERATEUR, POUR CINQ CLES ───────────────────────────────────
// Une cle `narvos::X` n'est pas un NOM, c'est un RANG (CLAUDE.md, pieges connus) :
// le constructeur de pack suffixe les homonymes dans l'ordre des dossiers. Ecrire
// `narvos::SM_2m_door_leaf` a la main tient jusqu'au jour ou un pack qui trie
// avant CITY_PACK apporte son propre `SM_2m_door_leaf` — la cle existe toujours,
// tous les controles restent verts, et elle designe une autre porte. Ici on part
// du CHEMIN, et la cle est relue a chaque construction du pack.
//
// Les trois objets GLB (talkie-walkie, smartphone, clavier) viennent de
// `public/models/divers/`, importes par `adk-import-narvos.py` avec
// NARVOS_COMBINE=1 : UN mesh par dossier. Plusieurs meshes dans un dossier =
// import sans fusion, et le script S'ARRETE plutot que de choisir au hasard.
// Un dossier absent n'est pas une erreur : l'objet n'est pas encore cuit, le
// catalogue le dit, et les executants fonctionnent sans le geste visuel.
//
// ⚠ A lancer APRES `nanos-build-asset-pack.mjs --apply` : avant, il lit le pack
// precedent et se declare content.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const SORTIE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/ObjetsDivers.lua`;
const APPLIQUER = process.argv.includes("--apply");

/** Un objet de sac et le DOSSIER cuit de son mesh. */
const OBJETS = [
  { id: "talkie_walkie", dossier: "Narvos/divers/walkie_talkie/", role: "en main pendant une emission radio" },
  { id: "smartphone", dossier: "Narvos/divers/smartphone/", role: "en main quand on consulte le telephone" },
  { id: "digicode", dossier: "Narvos/divers/keypad_door_lock/", role: "clavier pose a cote de la porte" },
];

/** Les pieces de la porte, par CHEMIN EXACT. Obligatoires : sans elles, pas de porte. */
const PORTE = [
  { id: "cadre", chemin: "Narvos/CITY_PACK/INTERIORS/SCI_FI_LABORATORY/Meshes/SM_2m_door_frame" },
  { id: "battant", chemin: "Narvos/CITY_PACK/INTERIORS/SCI_FI_LABORATORY/Meshes/SM_2m_door_leaf" },
];

if (!fs.existsSync(TOML)) {
  console.error(`ARRÊT : ${TOML} est absent — le pack n'est pas construit.`);
  process.exit(1);
}

// ── Lecture du seul bloc [assets.static_meshes] ──────────────────────────────
const meshes = [];
{
  let dans = false;
  for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
    const section = ligne.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) { dans = section[1] === "assets.static_meshes"; continue; }
    if (!dans) continue;
    const m = ligne.match(/^\s*([^\s=#]+)\s*=\s*"([^"]+)"\s*$/);
    if (m) meshes.push({ cle: m[1], chemin: m[2] });
  }
}
if (meshes.length === 0) {
  console.error("ARRÊT : aucun static mesh dans [assets.static_meshes].");
  process.exit(1);
}

// ── Résolution ───────────────────────────────────────────────────────────────
let arret = false;
const objets = OBJETS.map((o) => {
  const trouves = meshes.filter((m) => m.chemin.startsWith(o.dossier));
  if (trouves.length > 1) {
    console.error(`ARRÊT : ${trouves.length} meshes sous ${o.dossier} — import sans NARVOS_COMBINE=1 ?`);
    for (const t of trouves) console.error(`    ${t.cle} = ${t.chemin}`);
    arret = true;
  }
  return { ...o, cle: trouves.length === 1 ? trouves[0].cle : null, chemin: trouves[0]?.chemin ?? null };
});
const porte = PORTE.map((p) => {
  const trouve = meshes.find((m) => m.chemin === p.chemin);
  if (!trouve) {
    console.error(`ARRÊT : piece de porte absente d'Assets.toml : ${p.chemin}`);
    arret = true;
  }
  return { ...p, cle: trouve ? trouve.cle : null };
});
if (arret) process.exit(1);

for (const o of objets) {
  console.log(`  ${o.id.padEnd(14)} ${o.cle ? `${o.cle}  (${o.chemin})` : `ABSENT — ${o.dossier} pas encore cuit`}`);
}
for (const p of porte) console.log(`  porte.${p.id.padEnd(8)} ${p.cle}  (${p.chemin})`);

if (!APPLIQUER) {
  console.log("");
  console.log(`Simulation — rien écrit. Ajouter --apply pour produire :\n  ${SORTIE}`);
  process.exit(0);
}

// ── Écriture ─────────────────────────────────────────────────────────────────
const absents = objets.filter((o) => !o.cle);
const lignesObjets = objets.map((o) => (o.cle
  ? `    ${o.id} = "narvos::${o.cle}",   -- ${o.role}`
  : `    -- ${o.id} : ABSENT (${o.dossier} pas encore cuit) — ${o.role}`)).join("\n");
const lignesPorte = porte.map((p) => `    ${p.id} = "narvos::${p.cle}",`).join("\n");

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- ObjetsDivers.lua — les meshes du talkie-walkie, du smartphone, du clavier a code
-- et de la porte que ce clavier commande.
--
-- FICHIER GENERE par scripts/narvos-objets-divers-to-lua.mjs depuis Assets.toml.
-- Ne pas editer a la main : regenerer apres chaque construction du pack.
--
-- Les cles sont choisies par CHEMIN, jamais par nom : une cle suffixee est un
-- rang, qu'un pack triant plus tot decale sans qu'aucun controle d'existence ne
-- le voie.
--
-- ${objets.length - absents.length} objet(s) sur ${objets.length} avec leur mesh cuit${absents.length > 0 ? ` — absent(s) : ${absents.map((o) => o.id).join(", ")}` : ""}.
-- Un objet absent reste utilisable : seul le geste visuel manque.
-- ══════════════════════════════════════════════════════════════════════════════

local ObjetsDivers = {}

--- Mesh de chaque objet de sac, par identifiant d'objet (Items.ITEM_DB).
ObjetsDivers.MESHES = {
${lignesObjets}
}

--- Les pieces de la porte a code.
ObjetsDivers.PORTE = {
${lignesPorte}
}

--- Le mesh d'un objet, ou nil s'il n'est pas cuit.
---@param id any
---@return string|nil
function ObjetsDivers.Mesh(id)
    if (type(id) ~= "string") then return nil end
    return ObjetsDivers.MESHES[id]
end

return ObjetsDivers
`;

fs.writeFileSync(SORTIE, lua);
console.log("");
console.log(`écrit : ${SORTIE}`);