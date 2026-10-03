// Butin ennemi : cinq raretes, vrais ids persistants et configuration modulaire.
import fs from "node:fs";
import { LuaFactory } from "wasmoon";

const chemin = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Logic/ButinEnnemi.lua";
const source = fs.readFileSync(chemin, "utf8");
const lua = await new LuaFactory().createEngine();
let sortie;
try {
  sortie = await lua.doString(`
local reussis, echecs, messages = 0, 0, {}
local function ok(c, n) if c then reussis = reussis + 1 else echecs = echecs + 1; messages[#messages + 1] = "ECHEC " .. n end end
local function egal(a,b,n) ok(a == b, n .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end
local Butin = (function() ${source} end)()

local items = {
  pierre = { id="pierre", label="Pierre", type="material", rarity="common", level=1, value=5 },
  fusil = { id="fusil", label="Fusil", type="weapon", rarity="common", level=1, value=50, equipSlot="weapon" },
  lame = { id="lame", label="Lame", type="weapon", rarity="rare", level=1, equipSlot="weapon" },
  armure = { id="armure", label="Armure", type="armor", rarity="epique", level=1, equipSlot="armor" },
  relique = { id="relique", label="Relique", type="armor", rarity="legendary", level=1, equipSlot="armor" },
  mythe = { id="mythe", label="Mythe", type="armor", rarity="mythic", level=1, equipSlot="armor" },
}
local bilan = Butin.Configurer(items)
egal(bilan.total, 6, "six objets eligibles")
egal(items.pierre.rarity, "normal", "materiau ordinaire devient Normal")
egal(items.armure.rarity, "epic", "alias epique normalise")
egal(items.mythe.rarity, "legendary", "ancien Mythique replie sur Legendaire")

local function rng_de(...)
  local v, i = {...}, 0
  return function() i=i+1; return v[i] or 0 end
end
local essais = {
  {0.10, "normal"}, {0.60, "common"}, {0.85, "rare"},
  {0.95, "epic"}, {0.995, "legendary"},
}
for _, e in ipairs(essais) do
  local d = Butin.Tirer(1, 1, rng_de(0.0, e[1], 0.60, 0.0))[1]
  ok(d ~= nil, "tirage " .. e[2] .. " produit un objet")
  egal(d and d.rarete, e[2], "palier " .. e[2])
  ok(d and items[d.id] == d.def, "id " .. e[2] .. " appartient au catalogue persistant")
  ok(d and not d.id:find("^gen_"), "aucun id procedural " .. e[2])
end

egal(#Butin.Tirer(1, 1, rng_de(0.99)), 0, "la chance peut ne rien donner")
local anciens = Butin.POIDS_RARETE
Butin.CHANCE = 1
Butin.POIDS_RARETE = { normal=0, common=0, rare=0, epic=0, legendary=1 }
local force = Butin.Tirer(1, 1, rng_de(0, 0, 0.6, 0))[1]
egal(force and force.rarete, "legendary", "probabilites modifiables sans changer le moteur")
Butin.POIDS_RARETE = anciens

return reussis .. "|" .. echecs .. "|" .. table.concat(messages, "\\n")
`);
} catch (e) {
  console.error("ERREUR LUA :", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
if (sortie) {
  const [r,e,m] = String(sortie).split("|");
  if (m) console.log(m);
  console.log(`butin-ennemi : ${r} reussi(s), ${e} echec(s)`);
  if (Number(e) > 0) process.exitCode = 1;
}