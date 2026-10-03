import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// anims.mjs — exécute les tests de Shared/Logic/Animations.lua.
//
//   node scripts/lua-harness/anims.mjs
//
// Le module est PUR : ni Package, ni Character, ni horloge. Il se charge donc
// tel quel dans wasmoon, sans le moindre bouchon.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const SRC = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared/Logic/Animations.lua";

const lua = await new LuaFactory().createEngine();

const script = `
local Animations = (function()
${fs.readFileSync(SRC, "utf8")}
end)()

${fs.readFileSync(new URL("./anims-tests.lua", import.meta.url), "utf8")}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}