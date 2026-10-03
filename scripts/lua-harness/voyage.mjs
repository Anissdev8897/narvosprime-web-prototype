// ══════════════════════════════════════════════════════════════════════════════
// voyage.mjs — exécute les tests de Catalogs/Mondes.lua et Logic/Voyage.lua.
//
//   node scripts/lua-harness/voyage.mjs
//
// `Voyage` résout ses catalogues de map par leur NOM, dans le global `Narvos`,
// et au moment de l'appel. C'est ce qui rend ces tests possibles : on monte et
// on démonte des mondes entre deux assertions, sans le moindre mesh.
//
// `Vector` est stubbé — les positions ne sont jamais calculées ici, seulement
// transportées. Un vrai Vector demanderait le moteur pour vérifier qu'un champ
// n'est pas nil.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const mondes = fs.readFileSync(`${BASE}/Catalogs/Mondes.lua`, "utf8");
const voyage = fs.readFileSync(`${BASE}/Logic/Voyage.lua`, "utf8");
const tests = fs.readFileSync(new URL("./voyage-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
-- Structures de nanos, reduites a ce que ces fichiers en font : les transporter.
function Vector(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
function Color(r, g, b, a) return { R = r or 0, G = g or 0, B = b or 0, A = a or 1 } end

Narvos = {}

local Mondes = (function()
${mondes}
end)()
Narvos.Mondes = Mondes

local Voyage = (function()
${voyage}
end)()
Narvos.Voyage = Voyage

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