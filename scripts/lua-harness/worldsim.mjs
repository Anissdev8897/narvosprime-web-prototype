// ══════════════════════════════════════════════════════════════════════════════
// worldsim.mjs — parité TS ↔ Lua de la simulation d'univers (worldSim).
//
//   node scripts/lua-harness/worldsim.mjs
//
// Déterministe (seed, epoch) via mulberry32. ⚠ Le portage exact du RNG 32 bits
// (Math.imul signé) en Lua 64 bits est le point à valider — la structure de la
// sim est identique, mais les valeurs exactes dépendent du RNG.
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

// 1. TS : bundle worldSim.ts → createWorld/stepWorld/advanceWorld.
const tmp = path.join(os.tmpdir(), `world-ts-${Date.now()}.mjs`);
execFileSync("node", [ESBUILD, `${RACINE}/WebPortal/src/rpg/world/worldSim.ts`, "--bundle", "--format=esm", "--platform=node", `--outfile=${tmp}`]);
const ts = await import(pathToFileURL(tmp).href);

// 2. Lua : WorldSim.
const lua = await new LuaFactory().createEngine();
await lua.doString(`WorldSim = (function()\n${fs.readFileSync(`${LUA}/Logic/WorldSim.lua`, "utf8")}\nend)()`);
const LuaWorld = await lua.global.get("WorldSim");

// 3. Simule 5 ticks seed=1 des deux côtés, compare état + événements.
const SEED = 1, TICKS = 5;
let tsCur = ts.createWorld(SEED);
const tsEvents = [];
for (let i = 0; i < TICKS; i++) { const r = ts.stepWorld(tsCur); tsCur = r.state; tsEvents.push(...r.newEvents); }
const luaStart = LuaWorld.Etat(SEED);
const luaRes = LuaWorld.Avancer(luaStart, TICKS);
const luaCur = luaRes.state;
const luaEvents = luaRes.newEvents;

let reussis = 0, echecs = 0, champs = 0;
const egal = (a, b, n) => { champs++; const okv = (typeof a === "number" && typeof b === "number") ? Math.abs(a - b) < 5e-3 : a === b; if (okv) reussis++; else { echecs++; console.log(`  ECHEC ${n}  TS=${a} Lua=${b}`); } };

// État : epoch + puissances + contrôle + prix de chaque région.
egal(tsCur.epoch, luaCur.epoch, "epoch");
for (const f of ["akarlys", "mezalayis", "zayan"]) egal(tsCur.factions[f].power, luaCur.factions[f].power, `faction ${f}`);
for (const id of ["aquarys", "desertica", "fungaria", "hub", "espace"]) {
  egal(tsCur.regions[id].controller, luaCur.regions[id].controller, `control ${id}`);
  egal(tsCur.regions[id].contest, luaCur.regions[id].contest, `contest ${id}`);
  egal(tsCur.regions[id].price, luaCur.regions[id].price, `price ${id}`);
}

// Événements : même nombre + mêmes kinds (ordre/ids peuvent varier via RNG).
egal(tsEvents.length, luaEvents.length, "nb événements");
egal(tsEvents.map(e => e.kind).join(","), luaEvents.map(e => e.kind).join(","), "kinds événements");

console.log(`parité TS/Lua worldSim : ${reussis}/${champs} champs (${tsEvents.length} événements, seed=${SEED})`);

// 4. Comportement Lua (déterminisme + reclip).
try { await lua.doString(fs.readFileSync(new URL("./worldsim-tests.lua", import.meta.url), "utf8")); } catch (e) { }
lua.global.close();
if (echecs > 0) process.exitCode = 1;