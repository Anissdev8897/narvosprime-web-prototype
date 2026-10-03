// ══════════════════════════════════════════════════════════════════════════════
// ciel.mjs — exécute les tests de Shared/Logic/Ciel.lua.
//
//   node scripts/lua-harness/ciel.mjs
//
// ── POURQUOI CE HARNAIS EXISTE ────────────────────────────────────────────────
// `Ciel.lua` porte deux listes de noms — les modes de ciel et les météos — qui
// doivent correspondre EXACTEMENT à celles du client nanos. Elles ont été
// relevées dans la table d'énumérations de `NanosWorld-Win64-Shipping.exe`,
// pas devinées.
//
// Un nom faux ne lève jamais en jeu : `SkyMode.Spce` vaut nil, `SetSkyMode(nil)`
// ne fait rien, et le ciel reste celui du monde précédent. Le joueur voit un
// ciel bleu depuis l'orbite et rien ne le signale nulle part. Ces tests sont
// donc le seul filet.
//
// `Sky` n'est PAS stubbé ici, et c'est volontaire : `Shared/Logic/Ciel.lua` ne
// doit jamais y toucher. Si un appel à `Sky` s'y glissait, ce harnais planterait
// sur un global nil — exactement le signal qu'on veut.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const mondes = fs.readFileSync(`${BASE}/Catalogs/Mondes.lua`, "utf8");
const ciel = fs.readFileSync(`${BASE}/Logic/Ciel.lua`, "utf8");
const tests = fs.readFileSync(new URL("./ciel-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
-- Structures de nanos, reduites a ce que Mondes.lua en fait : les transporter.
function Vector(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
function Color(r, g, b, a) return { R = r or 0, G = g or 0, B = b or 0, A = a or 1 } end

Narvos = {}

local Mondes = (function()
${mondes}
end)()
Narvos.Mondes = Mondes

local Ciel = (function()
${ciel}
end)()
Narvos.Ciel = Ciel

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