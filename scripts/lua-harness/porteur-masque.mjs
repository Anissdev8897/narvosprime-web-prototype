import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// porteur-masque.mjs — Builder.MasquerPorteur / RendrePorteur (Logic/Character.lua)
//
//   node scripts/lua-harness/porteur-masque.mjs
//
// ── LE DEFAUT QU'IL FERME (rapport Fable du 2026-09-13) ───────────────────────
// Deux ponts MetaHuman masquaient le MEME porteur de deux facons :
// Builder.HabillerBlueprint le CACHAIT (SetMeshSettings(..., false)), et
// Server/MetaHumain.lua le rendait sous Mat_Invisible — parce qu'un mesh non rendu
// peut cesser de rafraichir ses os, et le MetaHuman qui copie sa pose figerait.
// Une seule methode, ici. Ce harnais charge le VRAI Character.lua et verifie :
//   · materiau au catalogue -> mesh RENDU + Mat_Invisible, jamais cache ;
//   · pas de materiau, ou materiau refuse -> repli sur le masquage, DIT ;
//   · RendrePorteur -> materiaux d'origine ET mesh visible ;
//   · HabillerBlueprint passe par la methode commune.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const RACINE = RACINE_DEPOT + "";
const module = fs.readFileSync(`${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Logic/Character.lua`, "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local reussis, echecs = 0, 0
local function ok(c, nom) if (c) then reussis = reussis + 1 else echecs = echecs + 1; print("  ECHEC  " .. nom) end end
local function egal(a, b, nom) ok(a == b, nom .. "  obtenu=" .. tostring(a) .. "  attendu=" .. tostring(b)) end

local journal = {}
Console = {
    Log = function(m) journal[#journal + 1] = m end,
    Warn = function(m) journal[#journal + 1] = "W:" .. m end,
    Error = function(m) journal[#journal + 1] = "E:" .. m end,
}
Vector = function(x, y, z) return { X = x, Y = y, Z = z } end
Rotator = function(p, y, r) return { Pitch = p, Yaw = y, Roll = r } end
Package = { Require = function() return {} end }
Narvos = { Classes = {}, MetaHumainCatalogue = { MATERIAU_INVISIBLE = "narvos::Mat_Invisible" } }

local Builder = (function()
${module}
end)()

local function FauxPerso(refuser)
    local p = { appels = {} }
    local function note(...) p.appels[#p.appels + 1] = { ... } end
    function p:SetMeshSettings(loc, rot, visible)
        if (refuser == "mesh") then error("SetMeshSettings indisponible") end
        note("SetMeshSettings", loc, rot, visible)
    end
    function p:SetMaterial(chemin, index)
        if (refuser == "materiau" or refuser == "mesh") then error("materiau refuse") end
        note("SetMaterial", chemin, index)
    end
    function p:ResetMaterial(index) note("ResetMaterial", index) end
    function p:GetValue() return {} end
    function p:SetValue() end
    return p
end

print("[masquer : materiau au catalogue]")
local a = FauxPerso()
egal(Builder.MasquerPorteur(a), "materiau", "methode materiau")
egal(a.appels[1][1], "SetMeshSettings", "d'abord le mesh")
egal(a.appels[1][4], true, "le mesh reste RENDU (sinon ses os peuvent figer)")
egal(a.appels[1][2].X + a.appels[1][2].Y + a.appels[1][2].Z, 0, "position relative (0, 0, 0)")
egal(a.appels[1][3].Yaw, -90, "rotation nanos (0, -90, 0)")
egal(a.appels[2][1], "SetMaterial", "puis le materiau")
egal(a.appels[2][2], "narvos::Mat_Invisible", "le materiau invisible du CATALOGUE")
egal(a.appels[2][3], -1, "sur tous les emplacements")

print("[masquer : replis]")
Narvos.MetaHumainCatalogue = nil
local b = FauxPerso()
egal(Builder.MasquerPorteur(b), "cache", "sans materiau au catalogue : repli sur le masquage")
egal(b.appels[#b.appels][4], false, "le repli CACHE le mesh")
local dit = false
for _, l in ipairs(journal) do if (l:find("W:", 1, true)) then dit = true end end
ok(dit, "le repli est DIT (avertissement)")
Narvos.MetaHumainCatalogue = { MATERIAU_INVISIBLE = "narvos::Mat_Invisible" }
egal(Builder.MasquerPorteur(FauxPerso("materiau")), "cache", "materiau refuse par le moteur : repli")
egal(Builder.MasquerPorteur(FauxPerso("mesh")), "echec", "rien ne passe : echec, pas d'exception")

print("[rendre]")
local c = FauxPerso()
Builder.RendrePorteur(c)
egal(c.appels[1][1], "ResetMaterial", "materiaux d'origine d'abord")
egal(c.appels[2][1], "SetMeshSettings", "puis le mesh")
egal(c.appels[2][4], true, "le mesh redevient VISIBLE")

print("[HabillerBlueprint passe par la methode commune]")
Narvos.MetaHumainBP = { Poser = function() return true end }
local d = FauxPerso()
local pose = Builder.HabillerBlueprint(d, { blueprint = "narvos::BP_NarvosMH_M", genre = "M", asset = "narvos::X" })
ok(pose, "HabillerBlueprint rend true")
local materiau, cache = false, false
for _, x in ipairs(d.appels) do
    if (x[1] == "SetMaterial" and x[2] == "narvos::Mat_Invisible") then materiau = true end
    if (x[1] == "SetMeshSettings" and x[4] == false) then cache = true end
end
ok(materiau, "le porteur passe sous Mat_Invisible")
ok(not cache, "le porteur n'est PLUS cache par SetMeshSettings(..., false)")

print("")
print(reussis .. " reussis, " .. echecs .. " echec(s)")
if (echecs > 0) then error("echecs") end
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}