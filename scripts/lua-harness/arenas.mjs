// ══════════════════════════════════════════════════════════════════════════════
// arenas.mjs — parité TS ↔ Lua des configurations d'arènes (arenaConfig).
//
//   node scripts/lua-harness/arenas.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const RACINE = "E:/narvosprime-web-prototype";
const ESBUILD = `${RACINE}/WebPortal/node_modules/esbuild/bin/esbuild`;
const LUA = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

const tmp = path.join(os.tmpdir(), `arenas-ts-${Date.now()}.mjs`);
execFileSync("node", [ESBUILD, `${RACINE}/WebPortal/src/rpg/arenas/arenaConfig.ts`, "--bundle", "--format=esm", "--platform=node", `--outfile=${tmp}`]);
const ts = await import(pathToFileURL(tmp).href);
const tsC = ts.ARENA_CONFIGS;

const lua = await new LuaFactory().createEngine();
await lua.doString(`AR = (function()\n${fs.readFileSync(`${LUA}/Catalogs/Arenes.lua`, "utf8")}\nend)()`);
await lua.doString(`local function enc(v)
  local t = type(v)
  if t == "number" or t == "boolean" then return tostring(v) end
  if t == "string" then return string.format("%q", v) end
  if t == "table" then
    local n = 0; for _ in pairs(v) do n = n + 1 end
    if n == 0 then return "[]" end
    local arr = true; for i = 1, n do if v[i] == nil then arr = false; break end end
    if arr and n > 0 then local p={}; for i=1,n do p[i]=enc(v[i]) end return "["..table.concat(p,",").."]" end
    local p = {}; for k, val in pairs(v) do local kk = type(k)=="string" and string.format("%q", k) or tostring(k) p[#p+1] = kk .. ":" .. enc(val) end
    return "{" .. table.concat(p,",") .. "}"
  end
  return "null"
end
JSONA = enc(AR.CONFIGS)`);
const luaC = JSON.parse(await lua.global.get("JSONA"));

let reussis = 0, echecs = 0, champs = 0;
const egal = (a, b, n) => { champs++; if (JSON.stringify(a) === JSON.stringify(b)) reussis++; else { echecs++; console.log(`  ECHEC ${n}  TS=${JSON.stringify(a)} Lua=${JSON.stringify(b)}`); } };

egal(tsC.length, luaC.length, "nb arènes");
for (let i = 0; i < Math.min(tsC.length, luaC.length); i++) {
  const t = tsC[i], l = luaC[i];
  egal([t.mapId, t.name, t.arenaType, t.faction, t.chunkCount], [l.mapId, l.name, l.arenaType, l.faction, l.chunkCount], `arène ${i} méta`);
  egal(t.covers.length, l.covers.length, `arène ${i} nb covers`);
  egal(t.triggers.length, l.triggers.length, `arène ${i} nb triggers`);
  egal(t.waves.length, l.waves.length, `arène ${i} nb vagues`);
  egal(t.routes.length, l.routes.length, `arène ${i} nb routes`);
  egal(t.recommendedNpcs.length, l.recommendedNpcs.length, `arène ${i} nb npcs`);
  // Échantillon : 1er cover + 1re vague + 1er npc (position/kind/folder).
  if (t.covers.length) egal([t.covers[0].pos, t.covers[0].kind, t.covers[0].label], [l.covers[0].pos, l.covers[0].kind, l.covers[0].label], `arène ${i} cover[0]`);
  if (t.waves.length) egal(t.waves[0].label, l.waves[0].label, `arène ${i} vague[0] label`);
  if (t.recommendedNpcs.length) egal([t.recommendedNpcs[0].folder, t.recommendedNpcs[0].pos, t.recommendedNpcs[0].level], [l.recommendedNpcs[0].folder, l.recommendedNpcs[0].pos, l.recommendedNpcs[0].level], `arène ${i} npc[0]`);
}

console.log(`parité TS/Lua arenas : ${reussis}/${champs} champs`);
lua.global.close();
if (echecs > 0) process.exitCode = 1;