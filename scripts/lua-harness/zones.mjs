// ══════════════════════════════════════════════════════════════════════════════
// zones.mjs — exécute les tests de Logic/Zones.lua et surveille le catalogue.
//
//   node scripts/lua-harness/zones.mjs
//
// `Logic/Zones.lua` est PUR : il reçoit une liste de zones et un contexte, il
// rend une décision. Il n'y a donc rien à stubber pour le tester — c'est
// délibéré : la question « ce joueur peut-il éditer ici » doit se prouver sans
// serveur, sinon on ne la prouve jamais.
//
// ── POURQUOI `Mondes` EST CHARGÉ ICI AUSSI ────────────────────────────────────
// `Catalogs/Zones.lua` RECOPIE le point d'arrivée de la Forge pour rester sans
// dépendance. Ce dépôt a payé quatre fois « une liste de clés recopiée diverge
// toujours de sa source ». On charge donc les deux catalogues et on compare : la
// copie est assumée, mais surveillée. `Vector` est stubbé parce que `Mondes` en
// construit — on n'en fait rien d'autre que lire ses trois champs.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const zones = fs.readFileSync(`${BASE}/Logic/Zones.lua`, "utf8");
const catalogue = fs.readFileSync(`${BASE}/Catalogs/Zones.lua`, "utf8");
const mondes = fs.readFileSync(`${BASE}/Catalogs/Mondes.lua`, "utf8");
const tests = fs.readFileSync(new URL("./zones-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
-- Structures de nanos, réduites à ce que ces catalogues en font : les porter.
function Vector(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
function Color(r, g, b, a) return { R = r or 0, G = g or 0, B = b or 0, A = a or 1 } end

local Zones = (function()
${zones}
end)()

local ZonesCatalogue = (function()
${catalogue}
end)()

local Mondes = (function()
${mondes}
end)()

${tests}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}