// ══════════════════════════════════════════════════════════════════════════════
// droits.mjs — exécute les tests de Logic/Droits.lua.
//
//   node scripts/lua-harness/droits.mjs
//
// `Droits` est PUR : il reçoit la config et un identifiant, il rend une
// décision. Rien à bouchonner — c'est voulu : la question « qui peut éditer la
// map générale » doit se prouver sans serveur, sinon on ne la prouve jamais.
//
// ⚠ Les identifiants Steam restent des LITTÉRAUX Lua dans les tests : ils ne
// traversent jamais la frontière JS, où un nombre de 17 chiffres perdrait ses
// derniers chiffres — le piège même que ce module défend.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const droits = fs.readFileSync(`${BASE}/Logic/Droits.lua`, "utf8");
const tests = fs.readFileSync(new URL("./droits-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local Droits = (function()
${droits}
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