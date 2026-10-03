import { RACINE_DEPOT } from "./_racine.mjs";
import { bundleTS } from "./_bundle.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// generateur-cartes.mjs — parité TS ↔ Lua du générateur de cartes (mapGenerator).
//
//   node scripts/lua-harness/generateur-cartes.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const RACINE = RACINE_DEPOT + "";
const LUA = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

// 1. TS : bundle mapGenerator.ts → generateMap/validateGeneration/biomeOf.
const tmp = path.join(os.tmpdir(), `mapgen-ts-${Date.now()}.mjs`);
await bundleTS(`${RACINE}/WebPortal/src/rpg/mapgen/mapGenerator.ts`, tmp);
const ts = await import(pathToFileURL(tmp).href);

// 2. Lua : GenerateurCartes.
const lua = await new LuaFactory().createEngine();
await lua.doString(`G = (function()\n${fs.readFileSync(`${LUA}/Logic/GenerateurCartes.lua`, "utf8")}\nend)()`);
const LuaG = await lua.global.get("G");
const luaToArr = (tbl) => { const a = []; for (const v of tbl) a.push(v); return a; };

// 3. Config de test.
const CFG = {
  seed: 7, bounds: { minX: -800, maxX: 800, minZ: -800, maxZ: 800 }, hub: { x: 0, z: 0 },
  safeRadius: 150, spawnY: 40, monsterPoints: 30, maxPack: 4, resources: 20, pois: 6,
  levelRange: [1, 12], enemyFolders: ["bandit", "zombie", "scorpion"],
};
const tsR = ts.generateMap(CFG);
const tsV = ts.validateGeneration(tsR, CFG);
// Config LUa + résultat, sérialisés en JSON (contourne l'interop table wasmoon).
await lua.doString(`
CFGL = { seed=7, bounds={minX=-800,maxX=800,minZ=-800,maxZ=800}, hub={x=0,z=0}, safeRadius=150, spawnY=40, monsterPoints=30, maxPack=4, resources=20, pois=6, levelRange={1,12}, enemyFolders={"bandit","zombie","scorpion"} }
RG = G.Generer(CFGL); VG = G.Valider(RG, CFGL)
local function enc(v)
  local t = type(v)
  if t == "number" or t == "boolean" then return tostring(v) end
  if t == "string" then return string.format("%q", v) end
  if t == "table" then
    local n = 0; for _ in pairs(v) do n = n + 1 end
    local mt = getmetatable(v)
    if n == 0 then return "[]" end
    local arr = true
    for i = 1, n do if v[i] == nil then arr = false; break end end
    if arr and n > 0 then
      local parts = {}; for i = 1, n do parts[i] = enc(v[i]) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    local parts = {}; for k, val in pairs(v) do parts[#parts+1] = enc(k) .. ":" .. enc(val) end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  return "null"
end
JSONR = enc(RG); JSONV = enc(VG)`);
const luaR = JSON.parse(await lua.global.get("JSONR"));
const luaV = JSON.parse(await lua.global.get("JSONV"));
const luaMonstres = luaR.monsters, luaRessources = luaR.resources, luaPois = luaR.pois;
const luaErreurs = luaV.errors, luaWarnings = luaV.warnings;

let reussis = 0, echecs = 0, champs = 0;
const egal = (a, b, n) => { champs++; const okv = (typeof a === "number" && typeof b === "number") ? Math.abs(a - b) < 1e-6 : a === b; if (okv) reussis++; else { echecs++; console.log(`  ECHEC ${n}  TS=${JSON.stringify(a)} Lua=${JSON.stringify(b)}`); } };

// Comptes + validation.
egal(tsR.monsters.length, luaMonstres.length, "nb monstres");
egal(tsR.resources.length, luaRessources.length, "nb ressources");
egal(tsR.pois.length, luaPois.length, "nb pois");
egal(tsV.ok, luaV.ok, "validation ok");
egal(tsV.errors.length, luaV.errors.length, "nb erreurs validation");
egal(tsV.warnings.length, luaV.warnings.length, "nb warnings");

// Chaque monstre : position + folder + niveau + meute + biome.
for (let i = 0; i < tsR.monsters.length; i++) {
  const t = tsR.monsters[i], l = luaMonstres[i];
  egal(t.x, l.x, `m${i}.x`); egal(t.z, l.z, `m${i}.z`);
  egal(t.folder, l.folder, `m${i}.folder`); egal(t.level, l.level, `m${i}.level`); egal(t.packSize, l.packSize, `m${i}.packSize`); egal(t.biome, l.biome, `m${i}.biome`);
}
// Chaque ressource : profession + biome. Chaque poi : label + biome.
for (let i = 0; i < tsR.resources.length; i++) { const t = tsR.resources[i], l = luaRessources[i]; egal(t.profession, l.profession, `r${i}.prof`); egal(t.biome, l.biome, `r${i}.biome`); }
for (let i = 0; i < tsR.pois.length; i++) { const t = tsR.pois[i], l = luaPois[i]; egal(t.label, l.label, `p${i}.label`); egal(t.biome, l.biome, `p${i}.biome`); }

console.log(`parité TS/Lua mapgen : ${reussis}/${champs} champs`);
lua.global.close();
if (echecs > 0) process.exitCode = 1;