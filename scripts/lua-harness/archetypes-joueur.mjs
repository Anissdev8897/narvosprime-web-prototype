import { RACINE_DEPOT } from "./_racine.mjs";
import { bundleTS } from "./_bundle.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// archetypes-joueur.mjs — parité TS ↔ Lua du catalogue d'archétypes joueur.
//
//   node scripts/lua-harness/archetypes-joueur.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const RACINE = RACINE_DEPOT + "";
const LUA = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

// 1. TS : bundle archetypeCatalog.ts → ARCHETYPES/ARCHETYPE_IDS/getArchetype.
const tmp = path.join(os.tmpdir(), `arch-ts-${Date.now()}.mjs`);
await bundleTS(`${RACINE}/WebPortal/src/rpg/archetypes/archetypeCatalog.ts`, tmp);
const ts = await import(pathToFileURL(tmp).href);
const tsIds = ts.ARCHETYPE_IDS;

// 2. Lua : ArchetypesJoueur (data + sérialisation JSON).
const lua = await new LuaFactory().createEngine();
await lua.doString(`AJ = (function()\n${fs.readFileSync(`${LUA}/Catalogs/ArchetypesJoueur.lua`, "utf8")}\nend)()`);
await lua.doString(`
local function esc(s) if type(s) ~= "string" then return "null" end return string.format("%q", s) end
local function num(v) if type(v) ~= "number" then return "0" end return tostring(v) end
local function encSpell(sp) return '{"id":'..esc(sp.id)..',"label":'..esc(sp.label)..',"effect":'..esc(sp.effect)..',"isUltimate":'..tostring(sp.isUltimate)..',"pctPlayerHp":'..num(sp.pctPlayerHp)..',"baseCooldown":'..num(sp.baseCooldown)..',"duration":'..num(sp.duration)..',"radius":'..num(sp.radius)..'}' end
local function encArch(a)
  local sp = {}
  for i = 1, #a.spells do sp[i] = encSpell(a.spells[i]) end
  return '{"id":'..esc(a.id)..',"label":'..esc(a.label)..',"weaponType":'..esc(a.weaponType)..',"color":'..esc(a.color)..',"spells":['..table.concat(sp,",")..']}'
end
local function encAll()
  local parts = {}
  for _, id in ipairs(AJ.IDS) do parts[#parts+1] = encArch(AJ.Obtenir(id)) end
  return "[" .. table.concat(parts, ",") .. "]"
end
JSONA = encAll()`);
const luaArch = JSON.parse(await lua.global.get("JSONA"));

let reussis = 0, echecs = 0, champs = 0;
const egal = (a, b, n) => { champs++; if (JSON.stringify(a) === JSON.stringify(b)) reussis++; else { echecs++; console.log(`  ECHEC ${n}  TS=${JSON.stringify(a)} Lua=${JSON.stringify(b)}`); } };

// Même nombre d'archétypes + même structure (label/weaponType/color + sorts).
egal(tsIds.length, luaArch.length, "nb archétypes");
for (let i = 0; i < Math.min(tsIds.length, luaArch.length); i++) {
  const ta = ts.getArchetype(tsIds[i]), la = luaArch[i];
  egal([ta.label, ta.weaponType, ta.color], [la.label, la.weaponType, la.color], `archétype ${tsIds[i]} (label/weapon/color)`);
  egal(ta.spells.length, la.spells.length, `archétype ${tsIds[i]} nb sorts`);
  for (let s = 0; s < Math.min(ta.spells.length, la.spells.length); s++) {
    const t = ta.spells[s], l = la.spells[s];
    egal([t.id, t.label, t.effect, t.isUltimate, t.pctPlayerHp ?? 0, t.baseCooldown, t.duration ?? 0, t.radius ?? 0],
         [l.id, l.label, l.effect, l.isUltimate, Number(l.pctPlayerHp), l.baseCooldown, Number(l.duration), Number(l.radius)],
         `${tsIds[i]}.${t.id}`);
  }
}

console.log(`parité TS/Lua archetypes-joueur : ${reussis}/${champs} champs`);
lua.global.close();
if (echecs > 0) process.exitCode = 1;