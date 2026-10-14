import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// liaisons-loot.mjs — preuves des liaisons de l'audit (2026-09-19) :
//   · les 101 définitions de LOOT_CATALOG sont reliées au sac ;
//   · les objets des packs portent value/weight/icône/stats/useEffect ;
//   · les recettes sans station sont assignées à l'établi ;
//   · un drop procédural gen_* s'inscrit, se verse et reste visible.
// Rejoue le VRAI Shared/Index.lua (Package.Require réel, stubs nanos).
//   node scripts/lua-harness/liaisons-loot.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";

const RACINE = RACINE_DEPOT + "";
const BASE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

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
  if prof and prof > 8 then return "null" end
  if serialiseur.deja[v] then return "null" end
  serialiseur.deja[v] = true
  local parties, n = {}, 0
  local estTableau = true
  for k in pairs(v) do
    if type(k) ~= "number" then estTableau = false break end
    n = n + 1
  end
  if estTableau and n == #v then
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

const REQUIRES = `
Package = {}
Package.Require = function(rel)
  local src, err = JSRequire(rel)
  if not src then error("Package.Require introuvable: " .. rel, 2) end
  local env = { Package = Package, Console = Console, Events = Events, Timer = Timer, Narvos = Narvos }
  setmetatable(env, { __index = _G })
  local chunk, cerr = load(src, "@" .. rel, "t", env)
  if not chunk then error("Package.Require erreur " .. rel .. ": " .. tostring(cerr), 2) end
  return chunk()
end
Package.GetPersistentData = function() return {} end
Package.SetPersistentData = function() end
Package.Call = function() end
Package.Export = function() end
Console = { Log = function(...) local p = {} for i = 1, select("#", ...) do p[#p + 1] = tostring(select(i, ...)) end table.insert(JOURNAL, table.concat(p, " ")) end,
           Warn = function(...) Console.Log(...) end,
           Error = function(...) Console.Log(...) end }
Events = { Subscribe = function() end, CallRemote = function() end, Call = function() end }
Timer = { SetInterval = function() return 1 end, ClearInterval = function() end }
Vector = function(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
Rotator = function(x, y, z) return { Pitch = x or 0, Yaw = y or 0, Roll = z or 0, X = x or 0, Y = y or 0, Z = z or 0 } end
Trigger = function(...) return { Subscribe = function() end, IsValid = function() return true end, Destroy = function() end } end
Prop = function(...) return { IsValid = function() return true end, SetValue = function() end, SetLocation = function() end } end
StaticMesh = function(...) return { IsValid = function() return true end } end
Character = function(...) return { IsValid = function() return true end, GetLocation = function() return Vector() end } end
Color = function(...) return { ToRGB = function() return 0 end, ToHex = function() return "#ffffff" end } end
JOURNAL = {}
Narvos = {}
`;

const lua = await new LuaFactory().createEngine();
lua.global.set("JSRequire", (rel) => {
  try {
    return fs.readFileSync(path.join(BASE, rel.replace(/\//g, path.sep)), "utf8");
  } catch {
    return null;
  }
});

await lua.doString(REQUIRES + "\n" + SERIALISEUR);

const indexSrc = fs.readFileSync(`${BASE}/Index.lua`, "utf8");
const err = await lua.doString(indexSrc);
if (err) { console.error("ERREUR CHARGEMENT:", err); process.exit(1); }

// ── Les preuves, calculées EN LUA sur l'état final ────────────────────────────
const brut = await lua.doString(`
local function q(s) return string.format("%q", tostring(s)) end
local parts = {}
local function mettre(k, v) parts[#parts + 1] = q(k) .. ":" .. tostring(v) end

local items = Narvos.Items.ITEM_DB

-- 1. Chaque définition de LOOT_CATALOG est dans ITEM_DB.
local absents = {}
for id in pairs(Narvos.Loot.LOOT_CATALOG) do
  if items[id] == nil then absents[#absents + 1] = q(id) end
end
mettre("loot_absents", "[" .. table.concat(absents, ",") .. "]")

-- 2. Les objets des packs : value ET weight posés (non nil), icône posée.
local sans_value, sans_weight, sans_icone = {}, {}, {}
for id, def in pairs(items) do
  if id:match("^hyper_") or id:match("^isp_") then
    if def.value == nil then sans_value[#sans_value + 1] = q(id) end
    if def.weight == nil then sans_weight[#sans_weight + 1] = q(id) end
    if def.icon == nil then sans_icone[#sans_icone + 1] = q(id) end
  end
end
mettre("pack_sans_value", "[" .. table.concat(sans_value, ",") .. "]")
mettre("pack_sans_weight", "[" .. table.concat(sans_weight, ",") .. "]")
mettre("pack_sans_icone", "[" .. table.concat(sans_icone, ",") .. "]")

-- 3. Chaque consommable du pack a un effet utilisable (heal ou mana > 0).
local consos_inertes = {}
for id, def in pairs(items) do
  if (id:match("^hyper_") or id:match("^isp_")) and def.type == "consumable" then
    local e = def.useEffect
    if type(e) ~= "table" or ((tonumber(e.heal) or 0) <= 0 and (tonumber(e.mana) or 0) <= 0) then
      consos_inertes[#consos_inertes + 1] = q(id)
    end
  end
end
mettre("consos_inertes", "[" .. table.concat(consos_inertes, ",") .. "]")

-- 4. Chaque arme du pack a des dégâts propres (attackPower > 0).
local armes_sans_degats = {}
for id, def in pairs(items) do
  if (id:match("^hyper_") or id:match("^isp_")) and def.type == "weapon"
      and (tonumber(def.stats.attackPower) or 0) <= 0 then
    armes_sans_degats[#armes_sans_degats + 1] = q(id)
  end
end
mettre("armes_sans_degats", "[" .. table.concat(armes_sans_degats, ",") .. "]")

-- 5. Aucune recette intégrée sans station ; les 21 « à la main » sont à l'établi.
local sans_station, a_l_etabli = {}, 0
for id, r in pairs(Narvos.Recettes.RECETTES) do
  if r.station == nil then sans_station[#sans_station + 1] = q(id)
  elseif r.station == "workbench" then a_l_etabli = a_l_etabli + 1 end
end
mettre("recettes_sans_station", "[" .. table.concat(sans_station, ",") .. "]")
mettre("recettes_etabli", tostring(a_l_etabli))
mettre("nb_recettes_total", tostring(0 + (function() local n = 0 for _ in pairs(Narvos.Recettes.RECETTES) do n = n + 1 end return n end)()))

-- 6. Un drop procédural gen_* : inscrit, versé au sac, VISIBLE dans la vue.
local inv = Narvos.Inventory
local def = Narvos.LootLogic.EnregistrerDef(items, {
  id = "gen_rare_weapon_9999_42", label = "Lame de test", rarity = "rare",
  kind = "weapon", category = "resource", statBonus = { puissance = 12 }, value = 120,
})
mettre("gen_inscrit", tostring(items["gen_rare_weapon_9999_42"] ~= nil))
mettre("gen_def_resolue", tostring(inv.GetItemDef("gen_rare_weapon_9999_42") ~= nil))

local grille = inv.CreateGridState()
local suivante = inv.AddItemToGrid(grille, def, 1)
mettre("gen_verse", tostring(suivante ~= nil))

local vue = Narvos.InventaireVue.Construire({ grid = suivante, equipment = {} })
local visible = false
for _, o in ipairs(vue.objets) do
  if o.id == "gen_rare_weapon_9999_42" then visible = true end
end
mettre("gen_visible_vue", tostring(visible))

return "{" .. table.concat(parts, ",") .. "}"
`);
lua.global.close();

const L = JSON.parse(brut);
let reussis = 0, echecs = 0;
const vrai = (c, n) => { if (c) reussis++; else { echecs++; console.log(`  ECHEC  ${n}`); } };
const egal = (o, a, n) => { if (JSON.stringify(o) === JSON.stringify(a)) reussis++; else { echecs++; console.log(`  ECHEC  ${n}  obtenu=${JSON.stringify(o)}  attendu=${JSON.stringify(a)}`); } };

console.log("[catalogue de loot relié au sac]");
egal(L.loot_absents, [], "aucune définition de LOOT_CATALOG hors du sac");

console.log("[champs des packs]");
egal(L.pack_sans_value, [], "tous les objets pack ont une valeur");
egal(L.pack_sans_weight, [], "tous les objets pack ont un poids");
egal(L.pack_sans_icone, [], "tous les objets pack ont une icône");
egal(L.consos_inertes, [], "aucun consommable pack inerte (heal ou mana)");
egal(L.armes_sans_degats, [], "aucune arme pack sans dégâts propres");

console.log("[recettes]");
egal(L.recettes_sans_station, [], "aucune recette intégrée sans station");
vrai(L.nb_recettes_total >= 147, "147+ recettes intégrées");
vrai(L.recettes_etabli >= 21, "les 21 recettes « à la main » sont à l'établi");

console.log("[drop procédural]");
vrai(L.gen_inscrit, "un gen_* s'inscrit dans ITEM_DB");
vrai(L.gen_def_resolue, "GetItemDef résout le gen_*");
vrai(L.gen_verse, "le gen_* se verse dans la grille");
vrai(L.gen_visible_vue, "le gen_* est visible dans la vue d'inventaire");

console.log(`\n${reussis} réussi(s), ${echecs} échec(s)`);
process.exit(echecs > 0 ? 1 : 0);