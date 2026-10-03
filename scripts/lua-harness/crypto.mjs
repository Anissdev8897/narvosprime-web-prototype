import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// crypto.mjs — exécute les vecteurs de test de Shared/Logic/Crypto.lua.
//
//   node scripts/lua-harness/crypto.mjs
//
// Crypto.lua n'a AUCUNE dépendance (ni Package.Require, ni catalogue) : il
// n'utilise que la bibliothèque standard de Lua 5.4 — `string.pack/unpack` et
// les opérateurs binaires. Le harnais se réduit donc à le charger.
//
// wasmoon EST Lua 5.4, ce qui est exactement ce qu'exécute nanos : les entiers
// 64 bits et `& | ~ << >>` s'y comportent à l'identique. Un test vert ici vaut
// donc pour le moteur — ce qui n'irait pas de soi avec un interpréteur 5.1.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const crypto = fs.readFileSync(`${BASE}/Logic/Crypto.lua`, "utf8");
const tests = fs.readFileSync(new URL("./crypto-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local Crypto = (function()
${crypto}
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