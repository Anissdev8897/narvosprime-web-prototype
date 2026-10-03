// ══════════════════════════════════════════════════════════════════════════════
// disposition.mjs — exécute les tests de Shared/Logic/Disposition.lua.
//
//   node scripts/lua-harness/disposition.mjs
//
// Module pur : positions en fractions d'écran, cap en degrés. Aucune dépendance.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const module = fs.readFileSync(`${BASE}/Logic/Disposition.lua`, "utf8");
const tests = fs.readFileSync(new URL("./disposition-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

try {
  await lua.doString(`
local Disposition = (function()
${module}
end)()

${tests}
`);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}