// ══════════════════════════════════════════════════════════════════════════════
// modular.mjs — exécute les tests de Shared/Catalogs/Modular.lua.
//
//   node scripts/lua-harness/modular.mjs
//
// Modular.lua est un catalogue GÉNÉRÉ (scripts/narvos-modular-to-lua.mjs) et
// sans dépendance : ni Package.Require, ni catalogue tiers. Le harnais se réduit
// donc à le charger et à lui appliquer les assertions — c'est le plus simple des
// runners du dossier, et c'est normal.
//
// Ce qu'il vérifie vraiment : les INVARIANTS du catalogue, pas son contenu.
// Le contenu change à chaque régénération ; ce qui ne doit jamais changer, c'est
// qu'une pièce ait un asset préfixé, un slot connu, un genre, et que la tenue
// par défaut passe sa propre validation.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const modular = fs.readFileSync(`${BASE}/Catalogs/Modular.lua`, "utf8");
const tests = fs.readFileSync(new URL("./modular-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local Modular = (function()
${modular}
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