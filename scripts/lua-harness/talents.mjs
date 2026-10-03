// ══════════════════════════════════════════════════════════════════════════════
// talents.mjs — parité TS ↔ Lua de l'agrégation de talents (talentEffects).
//
//   node scripts/lua-harness/talents.mjs
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

// 1. TS : bundle talentEffects.ts (importe talentCatalog) → aggregateTalents/….
const tmp = path.join(os.tmpdir(), `talents-ts-${Date.now()}.mjs`);
execFileSync("node", [ESBUILD, `${RACINE}/WebPortal/src/rpg/talents/talentEffects.ts`, "--bundle", "--format=esm", "--platform=node", `--outfile=${tmp}`]);
const ts = await import(pathToFileURL(tmp).href);

// 2. Lua : Talents (catalogue généré + logique).
const lua = await new LuaFactory().createEngine();
await lua.doString(
  `CatTalents = (function()\n${fs.readFileSync(`${LUA}/Catalogs/Talents.lua`, "utf8")}\nend)()
   Talents = (function()\n${fs.readFileSync(`${LUA}/Logic/Talents.lua`, "utf8")}\nend)()
   Talents.Configurer(CatTalents)`
);
const LuaT = await lua.global.get("Talents");
const luaToObj = (tbl) => { const o = {}; for (const k of Object.keys(tbl)) o[k] = tbl[k]; return o; };
const luaToArr = (tbl) => { const a = []; for (const v of tbl) a.push(v); return a; };

let reussis = 0, echecs = 0, champs = 0;
const egal = (a, b, n) => { champs++; const okv = (typeof a === "number" && typeof b === "number") ? Math.abs(a - b) < 1e-9 : a === b; if (okv) reussis++; else { echecs++; console.log(`  ECHEC ${n}  TS=${JSON.stringify(a)} Lua=${JSON.stringify(b)}`); } };

// 3. Agrégation : bonus pour quelques investissements (tables construites EN LUA).
for (const inp of [{ dmg_sharp: 2, sur_vitality: 1 }, { dmg_sharp: 1, dmg_precise: 2, mana_regen: 3 }, {}]) {
  const tsB = ts.aggregateTalents(inp);
  // Construit la table équivalente en Lua + lit le bonus en JSON (robuste).
  const entries = Object.entries(inp).map(([k, v]) => `${k}=${v}`).join(", ");
  const KEYS = ["damageMult", "critFlat", "maxHpMult", "defenseFlat", "maxManaMult", "manaCostMult", "manaRegenMult", "moveSpeedMult"];
  await lua.doString(`INPT = {${entries}}; BON = Talents.Agreger(INPT);
    local function encz(v) if type(v)=="number" then return tostring(v) else return "null" end end
    JSONB = "[" .. encz(BON.damageMult) .. "," .. encz(BON.critFlat) .. "," .. encz(BON.maxHpMult) .. "," .. encz(BON.defenseFlat) .. "," .. encz(BON.maxManaMult) .. "," .. encz(BON.manaCostMult) .. "," .. encz(BON.manaRegenMult) .. "," .. encz(BON.moveSpeedMult) .. "]"`);
  const luaVals = JSON.parse(await lua.global.get("JSONB"));
  for (let i = 0; i < KEYS.length; i++) {
    egal(tsB[KEYS[i]], luaVals[i], `Agreger[${KEYS[i]}] ${JSON.stringify(inp)}`);
  }
}

// 4. Économie de points.
egal(ts.talentPointsEarned(10), LuaT.PointsGagnes(10), "points gagnés L10");
egal(ts.talentPointsEarned(12), LuaT.PointsGagnes(12), "points gagnés L12");
// ⚠ NE JAMAIS PASSER UN OBJET JS A UNE FONCTION LUA VIA WASMOON.
// `LuaT.PointsDepenses({ ... })` faisait planter le processus ENTIER :
//   TypeError: Cannot read properties of null (reading 'then')
//     at PromiseTypeExtension.pushValue (wasmoon/dist/index.js:916)
// Mesuré : l'objet n'a rien a voir avec son contenu — `{}` plante autant que
// `{ dmg_sharp = 2 }`, et la MEME fonction appelee depuis du Lua pur rend 3.
// C'est le push JS -> Lua d'une table qui casse dans cette version de wasmoon ;
// les nombres passent (`PointsGagnes(10)` = 2).
//
// L'etape 3 ci-dessus contourne deja le probleme — « tables construites EN
// LUA » — et cette ligne ne l'avait pas suivie. Le plantage n'etait pas un test
// rouge : c'etait une exception non rattrapee, donc le harnais n'affichait
// AUCUN bilan et passait pour muet. Il l'a ete jusqu'a ce qu'on lance toute la
// batterie le 2026-09-09.
await lua.doString(`DEP = Talents.PointsDepenses({ dmg_sharp = 2, unknown = 1 })`);
egal(ts.talentPointsSpent({ dmg_sharp: 2, unknown: 1 }), await lua.global.get("DEP"),
  "points dépensés");

// 5. Comportement Lua (investir/rembourser/reset, self-reporté).
// ⚠ CE `catch` ETAIT VIDE. `talents-tests.lua` leve quand un de ses tests
// tombe (c'est ainsi que les autres harnais signalent l'echec) ; l'avaler sans
// un mot faisait imprimer le bilan de parite et sortir en 0. Un harnais qui
// rattrape et se tait est pire qu'absent : il rassure. On rattrape encore —
// pour que la parite deja mesurée s'affiche — mais on DIT, et on compte.
try {
  await lua.doString(fs.readFileSync(new URL("./talents-tests.lua", import.meta.url), "utf8"));
} catch (e) {
  echecs++;
  console.log(`  ECHEC talents-tests.lua : ${e.message}`);
}

console.log(`parité TS/Lua talents : ${reussis}/${champs} champs`);
lua.global.close();
if (echecs > 0) process.exitCode = 1;