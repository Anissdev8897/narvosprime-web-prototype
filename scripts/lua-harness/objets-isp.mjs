import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// objets-isp.mjs — les données d'InventorySystemPro versées dans NOS catalogues,
// prouvées sur les VRAIS catalogues et dans l'ORDRE du chargement réel.
//
//   node scripts/lua-harness/objets-isp.mjs
//
// Shared/Index.lua verse Hyper PUIS ISP, par le même `Logic/ObjetsHyper.lua`
// (`IntegrerPack`). Ce qui y serait invisible en jeu :
//   · un objet NARVOS ou Hyper écrasé par ISP ;
//   · une recette ISP ajoutée sans être dans ORDRE (jamais à l'écran) ;
//   · une recette dont un ingrédient manque (infaisable à jamais) ;
//   · une station inconnue des ateliers posés ;
//   · un second passage qui ajouterait des doublons.
// ⚠ Un harnais qui ne trouve pas sa cible doit ÉCHOUER, pas rendre vert.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const LUA = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const CIBLES = ["Catalogs/Items.lua", "Catalogs/Recettes.lua", "Catalogs/ObjetsHyper.lua",
  "Catalogs/ObjetsIsp.lua", "Catalogs/Ateliers.lua", "Logic/ObjetsHyper.lua"];
for (const c of CIBLES) {
  if (!fs.existsSync(`${LUA}/${c}`)) { console.error(`CIBLE ABSENTE : ${c}`); process.exit(1); }
}
const lire = (f) => fs.readFileSync(`${LUA}/${f}`, "utf8");

const lua = await new LuaFactory().createEngine();
const brut = await lua.doString(`
Narvos = {}
Narvos.Items = (function() ${lire("Catalogs/Items.lua")} end)()
Narvos.Recettes = (function() ${lire("Catalogs/Recettes.lua")} end)()
Narvos.ObjetsHyper = (function() ${lire("Catalogs/ObjetsHyper.lua")} end)()
Narvos.ObjetsIsp = (function() ${lire("Catalogs/ObjetsIsp.lua")} end)()
local Ateliers = (function() ${lire("Catalogs/Ateliers.lua")} end)()
local OHL = (function() ${lire("Logic/ObjetsHyper.lua")} end)()

local function q(s) return string.format("%q", tostring(s)) end
local parts = {}
local function mettre(k, v) parts[#parts + 1] = q(k) .. ":" .. v end
local function liste(t) return "[" .. table.concat(t, ",") .. "]" end

-- L'ORDRE DU CHARGEMENT RÉEL : Hyper d'abord.
local bh = OHL.Integrer()
mettre("hyper_erreur", q(bh.erreur or ""))

local temoins, avant_ordre = {}, #(Narvos.Recettes.ORDRE or {})
for id, def in pairs(Narvos.Items.ITEM_DB) do temoins[id] = def end

local n_obj = 0
for _ in pairs(Narvos.ObjetsIsp.OBJETS) do n_obj = n_obj + 1 end
mettre("n_obj", tostring(n_obj))
mettre("n_rec", tostring(#Narvos.ObjetsIsp.ORDRE_RECETTES))

local b = OHL.IntegrerPack(Narvos.ObjetsIsp)
mettre("erreur", q(b.erreur or ""))
mettre("objets", tostring(b.objets or -1))
mettre("objets_deja", tostring(b.objets_deja or -1))
mettre("recettes", tostring(b.recettes or -1))
mettre("refusees", tostring(b.recettes_refusees or -1))

local ecrases = 0
for id, def in pairs(temoins) do if Narvos.Items.ITEM_DB[id] ~= def then ecrases = ecrases + 1 end end
mettre("ecrases", tostring(ecrases))

local dans_ordre = {}
for _, id in ipairs(Narvos.Recettes.ORDRE) do dans_ordre[id] = true end
local hors_ordre, incompletes, stations = {}, {}, {}
for _, id in ipairs(Narvos.ObjetsIsp.ORDRE_RECETTES) do
  local r = Narvos.Recettes.RECETTES[id]
  if r then
    if not dans_ordre[id] then hors_ordre[#hors_ordre + 1] = q(id) end
    local ok, raison = OHL.RecetteComplete(r, Narvos.Items.ITEM_DB)
    if not ok then incompletes[#incompletes + 1] = q(id .. " : " .. tostring(raison)) end
    if r.station ~= nil and not Ateliers.STATIONS[r.station] then stations[#stations + 1] = q(id .. " -> " .. tostring(r.station)) end
  end
end
mettre("hors_ordre", liste(hors_ordre))
mettre("incompletes", liste(incompletes))
mettre("stations_inconnues", liste(stations))
mettre("ordre_etendu", tostring(#Narvos.Recettes.ORDRE - avant_ordre))

local malformes, prefixe, meshes_mal = {}, {}, {}
for id, o in pairs(Narvos.ObjetsIsp.OBJETS) do
  if not (type(o.gridW) == "number" and o.gridW >= 1 and type(o.gridH) == "number" and o.gridH >= 1
          and type(o.maxStack) == "number" and o.maxStack >= 1 and type(o.label) == "string" and o.id == id) then
    malformes[#malformes + 1] = q(id)
  end
  if id:sub(1, 4) ~= "isp_" then prefixe[#prefixe + 1] = q(id) end
  if o.mesh ~= nil and (type(o.mesh) ~= "string" or o.mesh:sub(1, 8) ~= "narvos::") then meshes_mal[#meshes_mal + 1] = q(id) end
  if o.useEffect ~= nil then malformes[#malformes + 1] = q(id .. " porte un useEffect invente") end
end
mettre("malformes", liste(malformes))
mettre("prefixe", liste(prefixe))
mettre("meshes_mal", liste(meshes_mal))

local b2 = OHL.IntegrerPack(Narvos.ObjetsIsp)
mettre("second_objets", tostring(b2.objets or -1))
mettre("second_recettes", tostring(b2.recettes or -1))

return "{" .. table.concat(parts, ",") .. "}"
`);
lua.global.close();

const L = JSON.parse(brut);
let reussis = 0, echecs = 0;
const egal = (o, a, n) => { if (JSON.stringify(o) === JSON.stringify(a)) reussis++; else { echecs++; console.log(`  ECHEC  ${n}  obtenu=${JSON.stringify(o)}  attendu=${JSON.stringify(a)}`); } };
const vrai = (c, n) => { if (c) reussis++; else { echecs++; console.log(`  ECHEC  ${n}`); } };

console.log("[integration ISP apres Hyper]");
egal(L.hyper_erreur, "", "Hyper s'integre d'abord");
vrai(L.n_obj > 0, `le catalogue ISP porte des objets (${L.n_obj})`);
vrai(L.n_rec > 0, `le catalogue ISP porte des recettes (${L.n_rec})`);
egal(L.erreur, "", "IntegrerPack accepte le module ISP");
egal(L.objets + L.objets_deja, L.n_obj, "chaque objet ISP est ajoute ou deja present");
egal(L.objets_deja, 0, "aucun id ISP ne tombe sur un objet existant (prefixe isp_)");
egal(L.ecrases, 0, "aucun objet NARVOS ou Hyper ecrase");
egal(L.recettes, L.n_rec, "toutes les recettes ISP entrent (ingredients au catalogue)");
egal(L.refusees, 0, "aucune recette refusee");
egal(L.hors_ordre, [], "chaque recette ajoutee est dans Recettes.ORDRE");
egal(L.ordre_etendu, L.n_rec, "ORDRE etendu d'exactement les recettes ISP");
egal(L.incompletes, [], "chaque recette integree est complete");
egal(L.stations_inconnues, [], "chaque station est un atelier pose");
egal(L.malformes, [], "objets bien formes, sans useEffect invente");
egal(L.prefixe, [], "tous les ids portent le prefixe isp_");
egal(L.meshes_mal, [], "les meshes sont des cles narvos::");
egal(L.second_objets, 0, "second passage : aucun objet ajoute");
egal(L.second_recettes, 0, "second passage : aucune recette ajoutee");

console.log("");
console.log(`${reussis} reussis, ${echecs} echec(s)`);
if (reussis < 1) { console.error("AUCUNE ASSERTION EXECUTEE"); process.exitCode = 1; }
if (echecs > 0) process.exitCode = 1;