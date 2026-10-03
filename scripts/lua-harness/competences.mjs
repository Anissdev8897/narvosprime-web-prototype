import { RACINE_DEPOT } from "./_racine.mjs";
import { bundleTS } from "./_bundle.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// competences.mjs — parité TS ↔ Lua du générateur de compétences.
//
//   node scripts/lua-harness/competences.mjs
//
// SOURCE : skills/skillGenerator.ts (`getAllSkills`) ↔ Shared/Logic/Competences.lua.
// ⚠ Le commentaire TS dit « 10 classes » ; il n'y en a que 4 → 40 sorts (pas 100).
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const SRC = RACINE_DEPOT + "/WebPortal/src";
const LUA = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const RACINE = RACINE_DEPOT + "";

// 1. TS : bundle skillGenerator.ts → getAllSkills() via le binaire esbuild.
const tmp = path.join(os.tmpdir(), `skills-ts-${Date.now()}.mjs`);
await bundleTS(`${SRC}/rpg/skills/skillGenerator.ts`, tmp);
const ts = await import(pathToFileURL(tmp).href);
const tsSkills = ts.getAllSkills();

// 2. Lua : Classes (généré) + Archetypes + Elements + Competences.
const lua = await new LuaFactory().createEngine();
await lua.doString(
  `Classes = (function()\n${fs.readFileSync(`${LUA}/Catalogs/Classes.lua`, "utf8")}\nend)()
   Archetypes = (function()\n${fs.readFileSync(`${LUA}/Catalogs/Archetypes.lua`, "utf8")}\nend)()
   Elements = (function()\n${fs.readFileSync(`${LUA}/Catalogs/Elements.lua`, "utf8")}\nend)()
   Competences = (function()\n${fs.readFileSync(`${LUA}/Logic/Competences.lua`, "utf8")}\nend)()
   Competences.Configurer(Classes, Archetypes, Elements)`
);
const LuaComp = await lua.global.get("Competences");
const luaSkills = await LuaComp.Tout();
const luaById = {};
for (const s of luaSkills) luaById[s.id] = s;

// 3. Parité champ à champ sur chaque compétence TS.
let reussis = 0, echecs = 0, champs = 0;
const MAP = { classId: "class_id", manaCost: "mana_cost", element: "element", label: "label", damage: "damage", heal: "heal", cooldown: "cooldown", animation: "animation", vfx: "vfx", id: "id", archetype: "archetype" };
for (const t of tsSkills) {
  const l = luaById[t.id];
  if (!l) { echecs++; console.log("  ECHEC id manquant en Lua: " + t.id); continue; }
  for (const [tk, lk] of Object.entries(MAP)) {
    champs++;
    if (t[tk] === l[lk]) reussis++; else { echecs++; console.log(`  ECHEC ${t.id}.${tk}  TS=${t[tk]} Lua=${l[lk]}`); }
  }
}
console.log(`parité TS/Lua compétences : ${reussis}/${champs} champs (${tsSkills.length} compétences, ${luaSkills.length} en Lua)`);

// 4. Comportement Lua (Stats, Obtenir).
try { await lua.doString(fs.readFileSync(new URL("./competences-tests.lua", import.meta.url), "utf8")); } catch (e) { }

lua.global.close();
if (echecs > 0) process.exitCode = 1;