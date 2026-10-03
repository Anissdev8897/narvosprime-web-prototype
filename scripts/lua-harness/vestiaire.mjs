// ══════════════════════════════════════════════════════════════════════════════
// vestiaire.mjs — exécute les tests de Shared/Logic/Vestiaire.lua.
//
//   node scripts/lua-harness/vestiaire.mjs
//
// Vestiaire lit le catalogue par `Narvos.Modular` quand il existe, et retombe
// sur `Package.Require` sinon. On lui fournit donc un `Narvos` déjà rempli :
// c'est la voie que prend le serveur, et c'est celle qu'il faut tester.
//
// Sans ce `Narvos`, le module appellerait `Package.Require` — inexistant hors du
// moteur — et l'erreur porterait sur le harnais plutôt que sur le module.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const modular = fs.readFileSync(`${BASE}/Catalogs/Modular.lua`, "utf8");
const vestiaire = fs.readFileSync(`${BASE}/Logic/Vestiaire.lua`, "utf8");
const tests = fs.readFileSync(new URL("./vestiaire-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local Modular = (function()
${modular}
end)()

-- Le module résout son catalogue par cette table globale. La poser AVANT de
-- charger Vestiaire est indispensable : sa fonction \`catalogue()\` est
-- paresseuse, mais rien ne garantit que le premier appel vienne après.
Narvos = { Modular = Modular }

local Vestiaire = (function()
${vestiaire}
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