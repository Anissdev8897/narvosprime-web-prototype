// ══════════════════════════════════════════════════════════════════════════════
// morphs.mjs — exécute les tests de Shared/Catalogs/Morphs.lua.
//
//   node scripts/lua-harness/morphs.mjs
//
// Morphs.lua est un catalogue GÉNÉRÉ (scripts/narvos-morphs-to-lua.mjs) et sans
// dépendance : ni Package.Require, ni catalogue tiers. Le harnais se réduit donc
// à le charger et à lui appliquer les assertions.
//
// Ce qu'il vérifie sont les INVARIANTS, pas le contenu. Le contenu change à
// chaque régénération du GLB ; ce qui ne doit jamais changer, c'est qu'un
// curseur ait une zone déclarée, deux morphs distincts, et que la résolution
// éteigne l'extrémité opposée.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const morphs = fs.readFileSync(`${BASE}/Catalogs/Morphs.lua`, "utf8");
const tests = fs.readFileSync(new URL("./morphs-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local Morphs = (function()
${morphs}
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