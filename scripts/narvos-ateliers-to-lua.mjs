// ══════════════════════════════════════════════════════════════════════════════
// narvos-ateliers-to-lua.mjs — le MESH de chaque atelier, seulement s'il existe.
//
//   node scripts/narvos-ateliers-to-lua.mjs [--apply]
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Nos 4 stations de craft sont posées avec `nanos-world::SM_Cube` depuis le
// premier jour (Server/Index.lua, `PoserAteliers`). Le pack « Survival Crafting
// Stations » apporte les vraies : établi, four, station de chimie, alambic.
//
// ── LA RÈGLE QUE CE GÉNÉRATEUR APPLIQUE ──────────────────────────────────────
// Une clé qui n'est PAS dans `Assets.toml` ne sort pas. nanos ne lève rien sur
// une référence morte : le prop n'apparaît pas, et rien ne le dit. Tant que le
// pack n'est pas reconstruit, ce catalogue sort donc avec `cuit = false` partout
// et le jeu garde ses cubes — un repli visible vaut mieux qu'un vide silencieux.
//
// La source des noms est le MANIFESTE d'import (`_manifests/crafting-stations.json`,
// section `branchement`) : un seul endroit décide, et il porte déjà la raison de
// chaque choix.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";

const RACINE = "E:/narvosprime-web-prototype";
const MANIFESTE = `${RACINE}/WebPortal/Server/adk/_manifests/crafting-stations.json`;
const TOML = `${RACINE}/WebPortal/Server/Assets/narvos/Assets.toml`;
const CIBLE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Ateliers.lua`;
const APPLIQUER = process.argv.includes("--apply");

const PACK = "narvos";
const REPLI = "nanos-world::SM_Cube";

for (const f of [MANIFESTE, TOML]) {
  if (!fs.existsSync(f)) {
    console.error(`ARRÊT : ${f} introuvable.`);
    process.exit(1);
  }
}

const manifeste = JSON.parse(fs.readFileSync(MANIFESTE, "utf8"));
const branchement = manifeste.branchement;
if (!branchement || !Array.isArray(branchement.stations)) {
  console.error("ARRÊT : le manifeste ne porte pas de section `branchement.stations`.");
  process.exit(1);
}

// ── Les clés RÉELLEMENT déclarées ────────────────────────────────────────────
const declarees = new Set();
for (const ligne of fs.readFileSync(TOML, "utf8").split(/\r?\n/)) {
  const m = ligne.match(/^\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))\s*=\s*"/);
  if (m) declarees.add(m[1] !== undefined ? JSON.parse(`"${m[1]}"`) : m[2]);
}

const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const lignes = [];
let cuits = 0;
for (const s of branchement.stations) {
  const present = declarees.has(s.mesh);
  if (present) cuits++;
  const anim = s.animee && declarees.has(s.animee.skeletal) && declarees.has(s.animee.animation)
    ? s.animee
    : null;
  const champs = [
    `mesh = ${q(present ? `${PACK}::${s.mesh}` : REPLI)}`,
    `attendu = ${q(s.mesh)}`,
    `cuit = ${present}`,
    `label = ${q(s.libelle)}`,
  ];
  if (s.en_plus) champs.push(`en_plus = ${q(declarees.has(s.en_plus) ? `${PACK}::${s.en_plus}` : "")}`);
  if (anim) {
    champs.push(`squelettique = ${q(`${PACK}::${anim.skeletal}`)}`);
    champs.push(`animation = ${q(`${PACK}::${anim.animation}`)}`);
  }
  lignes.push(`    ${s.notre_id} = { ${champs.join(", ")} },`);
}

// L etabli d assemblage suit la meme regle que les stations : sa cle, ou le cube.
const etabli = branchement.etabli_assemblage ?? null;
const etabliPresent = etabli ? declarees.has(etabli.mesh) : false;
const ligneEtabli = etabli
  ? `    mesh = ${q(etabliPresent ? `${PACK}::${etabli.mesh}` : REPLI)}, `
    + `attendu = ${q(etabli.mesh)}, cuit = ${etabliPresent},`
  : `    mesh = ${q(REPLI)}, attendu = "", cuit = false,`;

const lua = `-- ══════════════════════════════════════════════════════════════════════════════
-- Ateliers.lua — le mesh de chaque station de craft.
--
-- FICHIER GÉNÉRÉ par scripts/narvos-ateliers-to-lua.mjs — ne pas éditer à la main.
-- Source des noms : WebPortal/Server/adk/_manifests/crafting-stations.json,
-- section \`branchement\`. Source de la VÉRITÉ : Assets.toml.
--
-- ${cuits} station(s) sur ${branchement.stations.length} portent leur vrai mesh ; les autres gardent le cube.
--
-- ── POURQUOI LE REPLI EST UN CUBE, ET POURQUOI C'EST VOULU ────────────────────
-- nanos ne lève RIEN sur une référence morte : un prop nommé par une clé absente
-- n'apparaît pas, et le joueur croit à un trou du monde. Tant que le pack ne
-- déclare pas la vraie station, on pose donc \`nanos-world::SM_Cube\` — laid,
-- mais visible, et \`cuit = false\` le dit à qui lit ce fichier.
--
-- Regénérer APRÈS chaque reconstruction du pack :
--   node scripts/narvos-ateliers-to-lua.mjs --apply
-- ══════════════════════════════════════════════════════════════════════════════

local Ateliers = {}

Ateliers.STATIONS = {
${lignes.join("\n")}
}

--- L etabli d assemblage (Server/Assemblage.lua) : meme regle, meme repli.
Ateliers.ETABLI = {
${ligneEtabli}
}

--- Le mesh de l etabli d assemblage, jamais nil.
---@return string
function Ateliers.MeshEtabli()
    return Ateliers.ETABLI.mesh
end

--- Le mesh à poser pour une station, jamais nil : le cube sert de repli.
---@param station any
---@return string
function Ateliers.Mesh(station)
    local s = Ateliers.STATIONS[tostring(station or "")]
    return (s and s.mesh) or ${q(REPLI)}
end

--- La station animée, ou nil. Un CharacterSimple + PlayAnimation feront le reste.
---@param station any
---@return table|nil
function Ateliers.Animee(station)
    local s = Ateliers.STATIONS[tostring(station or "")]
    if (s == nil or s.squelettique == nil or s.animation == nil) then return nil end
    return { mesh = s.squelettique, animation = s.animation }
end

--- Combien de stations portent leur vrai mesh. Pour le journal de démarrage :
--- un catalogue qui ment se voit au premier lancement.
---@return integer, integer
function Ateliers.Compte()
    local cuits, total = 0, 0
    for _, s in pairs(Ateliers.STATIONS) do
        total = total + 1
        if (s.cuit) then cuits = cuits + 1 end
    end
    return cuits, total
end

return Ateliers
`;

console.log(`${branchement.stations.length} station(s) ; ${cuits} avec leur vrai mesh, `
  + `${branchement.stations.length - cuits} au cube.`);
for (const s of branchement.stations) {
  console.log(`  ${s.notre_id.padEnd(10)} ${declarees.has(s.mesh) ? "OK  " : "cube"}  ${s.mesh}`);
}

if (APPLIQUER) {
  fs.writeFileSync(CIBLE, lua, "utf8");
  console.log(`\nÉcrit : ${CIBLE}`);
} else {
  console.log("\nEssai — relancer avec --apply pour écrire le catalogue.");
}