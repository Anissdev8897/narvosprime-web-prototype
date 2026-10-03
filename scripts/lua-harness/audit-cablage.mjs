import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// audit-cablage.mjs — rejoue le chargement RÉEL de Shared/Index.lua dans wasmoon
// avec un Package.Require qui lit les vrais fichiers, puis dump l'état final
// (ITEM_DB post-intégrations, recettes, logs du câblage) vers %TEMP%.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RACINE = RACINE_DEPOT + "";
const BASE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

// ── Sérialiseur JSON tolérant ─────────────────────────────────────────────────
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

const lua = await new LuaFactory().createEngine();

// ── Environnement : Package.Require via PONT JS + stubs nanos ─────────────────
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
-- Stubs des types geométriques nanos utilisés par les catalogues au chargement.
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

lua.global.set("JSRequire", (rel) => {
  const chemin = path.join(BASE, rel.replace(/\//g, path.sep));
  try {
    return fs.readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
});

await lua.doString(REQUIRES + "\n" + SERIALISEUR);

const indexSrc = fs.readFileSync(`${BASE}/Index.lua`, "utf8");
const r = await lua.doString(indexSrc, { env: true });
if (r) {
  console.error("ERREUR CHARGEMENT Index.lua:", r);
  process.exit(1);
}

// ── Dump de l'état final ──────────────────────────────────────────────────────
const out = {};
out.journal = await lua.doString("return JOURNAL");
out.item_count = await lua.doString("local n = 0 for _ in pairs(Narvos.Items.ITEM_DB) do n = n + 1 end return n");
out.item_db = await lua.doString("return encjson(Narvos.Items.ITEM_DB)");
out.item_order = await lua.doString("return encjson(Narvos.Items.ITEM_DB_ORDER or {})");
out.recettes = await lua.doString("return encjson(Narvos.Recettes)");
out.loot = await lua.doString("return encjson(Narvos.Loot and Narvos.Loot.LOOT_CATALOG or {})");
out.gisements = await lua.doString("return encjson(Narvos.Gisements and Narvos.Gisements.GISEMENTS or {})");
out.ateliers = await lua.doString("return encjson(Narvos.Ateliers and Narvos.Ateliers.STATIONS or {})");
out.roue = await lua.doString("return encjson(Narvos.Roue and Narvos.Roue.Contenu and Narvos.Roue.Contenu() or {})");
out.butin = await lua.doString("return encjson(Narvos.ButinEnnemi)");

const sortie = path.join(os.tmpdir(), "audit-narvos-cablage.json");
fs.writeFileSync(sortie, JSON.stringify(out, null, 1));
console.log("dump écrit:", sortie);
console.log("ITEM_DB final:", out.item_count, "items");
const journal = out.journal;
if (Array.isArray(journal)) {
  for (const ligne of journal.slice(-30)) console.log("  ·", ligne);
}
lua.global.close();