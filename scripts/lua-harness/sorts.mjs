// ══════════════════════════════════════════════════════════════════════════════
// sorts.mjs — exécute les tests de Shared/Logic/Sorts.lua.
//
//   node scripts/lua-harness/sorts.mjs
//
// `Sorts` lit trois catalogues et rien d'autre : ni base, ni entité nanos, ni
// horloge. C'est ce qui le rend testable ici sans le moindre mannequin.
//
// Les trois catalogues sont chargés RÉELS, pas simulés. Une fausse table de
// sorts ferait passer la suite alors que le vrai catalogue référence un effet
// disparu — or c'est précisément ce que ces tests cherchent.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const spells = lire("Catalogs/Spells.lua");
const classes = lire("Catalogs/Classes.lua");
const vfx = lire("Catalogs/Vfx.lua");
const sortsVfx = lire("Catalogs/SortsVfx.lua");
const sorts = lire("Logic/Sorts.lua");
const anims = lire("Catalogs/Animations.lua");
const tests = fs.readFileSync(new URL("./sorts-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
Narvos = {}
Narvos.Spells  = (function()
${spells}
end)()
Narvos.Classes = (function()
${classes}
end)()
Narvos.Vfx     = (function()
${vfx}
end)()
Narvos.SortsVfx = (function()
${sortsVfx}
end)()
-- Le catalogue des animations CUITES. Il sert a une seule chose ici, et elle
-- compte : verifier qu un geste de sort existe. \`PlayAnimation\` sur un asset
-- absent echoue en SILENCE — le sort partirait sans geste, sans une erreur.
Narvos.Animations = (function()
${anims}
end)()

local Sorts = (function()
${sorts}
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