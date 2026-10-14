import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// audit-dump.mjs — AUDIT récolte/craft/inventaire (brief 2026-09-19).
// Charge les catalogues et la logique RÉELS (wasmoon) et dump leurs structures
// en JSON vers %TEMP%/audit-narvos-dump.json pour croisement hors-moteur.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RACINE = RACINE_DEPOT + "";
const BASE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;
const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

// ── Modules à charger, dans l'ordre des dépendances ───────────────────────────
const CATALOGS = [
  ["Items", "Catalogs/Items.lua"],
  ["Recettes", "Catalogs/Recettes.lua"],
  ["Gisements", "Catalogs/Gisements.lua"],
  ["Ateliers", "Catalogs/Ateliers.lua"],
  ["Metiers", "Catalogs/Metiers.lua"],
  ["Stats", "Catalogs/Stats.lua"],
  ["ObjetsDivers", "Catalogs/ObjetsDivers.lua"],
  ["ObjetsHyper", "Catalogs/ObjetsHyper.lua"],
  ["ObjetsIsp", "Catalogs/ObjetsIsp.lua"],
  ["Loot", "Catalogs/Loot.lua"],
  ["ArmesBase", "Catalogs/ArmesBase.lua"],
  ["Merchants", "Catalogs/Merchants.lua"],
  ["PropsNarvos", "Catalogs/PropsNarvos.lua"],
  ["Props", "Catalogs/Props.lua"],
  ["Spawnables", "Catalogs/Spawnables.lua"],
];

const LOGIQUE = [
  ["Inventory", "Logic/Inventory.lua"],
  ["Craft", "Logic/Craft.lua"],
  ["Recolte", "Logic/Recolte.lua"],
  ["ArmesInventaire", "Logic/ArmesInventaire.lua"],
  ["Assemblage", "Logic/Assemblage.lua"],
  ["Ramassage", "Logic/Ramassage.lua"],
  ["Boutique", "Logic/Boutique.lua"],
  ["ButinEnnemi", "Logic/ButinEnnemi.lua"],
  ["MetiersLog", "Logic/Metiers.lua"],
  ["LootLog", "Logic/Loot.lua"],
];

// ── Sérialiseur JSON tolérant (fonctions/cycles ignorés) ──────────────────────
const SERIALISEUR = `
serialiseur = {}
serialiseur.deja = {}
function serialiseur.enc(v, prof)
  local t = type(v)
  if t == "nil" then return "null" end
  if t == "boolean" then return v and "true" or "false" end
  if t == "number" then
    if v ~= v then return "null" end
    if v == math.huge then return "null" end
    return tostring(v)
  end
  if t == "string" then
    local s = v:gsub("\\\\", "\\\\\\\\"):gsub("\\"", "\\\\\\"")
    return '"' .. s .. '"'
  end
  if t == "function" or t == "userdata" or t == "thread" then return "null" end
  if t ~= "table" then return "null" end
  if prof and prof > 6 then return "null" end
  if serialiseur.deja[v] then return "null" end
  serialiseur.deja[v] = true
  local parties, n = {}, 0
  local estTableau = true
  for k in pairs(v) do
    if type(k) ~= "number" then estTableau = false break end
    n = n + 1
  end
  if estTableau and n == #v and n >= 0 then
    for i = 1, n do parties[#parties + 1] = serialiseur.enc(v[i], prof and (prof + 1) or 1) end
    serialiseur.deja[v] = nil
    return "[" .. table.concat(parties, ",") .. "]"
  end
  local cles = {}
  for k in pairs(v) do
    if type(k) == "string" then cles[#cles + 1] = k end
  end
  table.sort(cles)
  for _, k in ipairs(cles) do
    parties[#parties + 1] = '"' .. k .. '":' .. serialiseur.enc(v[k], prof and (prof + 1) or 1)
  end
  serialiseur.deja[v] = nil
  return "{" .. table.concat(parties, ",") .. "}"
end

function encjson(v)
  serialiseur.deja = {}
  return serialiseur.enc(v, 1)
end
`;

const lua = await new LuaFactory().createEngine();
let luaCode = `Narvos = {}
-- Stubs d'API nanos pour les modules de logique qui touchent le monde au chargement.
Package = { GetPersistentData = function() return {} end, SetPersistentData = function() end, Require = function() return {} end, Call = function() end, Export = function() end }
Console = { Log = function() end, Warn = function() end, Error = function() end }
Events = { Subscribe = function() end, CallRemote = function() end, Call = function() end }
Timer = { SetInterval = function() return 1 end, ClearInterval = function() end }
${SERIALISEUR}\n`;
const charges = [];

for (const [nom, rel] of CATALOGS) {
  const src = lire(rel);
  luaCode += `Narvos.${nom} = (function()\n${src}\nend)()\n`;
  charges.push(`Narvos.${nom}`);
}
for (const [nom, rel] of LOGIQUE) {
  const src = lire(rel);
  luaCode += `${nom} = (function()\n${src}\nend)()\n`;
  charges.push(nom);
}

const r = await lua.doString(luaCode);
if (r) {
  console.error("ERREUR CHARGEMENT:", r);
  process.exit(1);
}

// ── Dump : clés publiques de chaque module + échantillon par catalogue ────────
const dump = {};
for (const nom of charges) {
  const cles = await lua.doString(`
    local t = {}
    for k, v in pairs(${nom}) do
      if type(k) == "string" then t[#t + 1] = k end
    end
    table.sort(t)
    return t
  `);
  dump[nom] = { cles: Array.isArray(cles) ? cles : [] };
}

// Pour chaque catalogue "données", dumper le contenu entier (tables d'items).
const cibles = ["Narvos.Items", "Narvos.Recettes", "Narvos.Gisements", "Narvos.Ateliers",
  "Narvos.ObjetsDivers", "Narvos.ObjetsHyper", "Narvos.ObjetsIsp", "Narvos.Loot",
  "Narvos.ArmesBase", "Narvos.Stats", "Narvos.Metiers"];
for (const nom of cibles) {
  const texte = await lua.doString(`return encjson(${nom})`);
  dump[nom + "_DATA"] = texte;
}

const sortie = path.join(os.tmpdir(), "audit-narvos-dump.json");
fs.writeFileSync(sortie, JSON.stringify(dump, null, 1));
console.log("dump écrit:", sortie);
for (const nom of charges) {
  console.log(`  ${nom}: ${dump[nom].cles.length} clés publiques`);
}
lua.global.close();