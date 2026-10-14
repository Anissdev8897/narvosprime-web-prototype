import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// combat.mjs — exécute les tests de Shared/Logic/Combat.lua.
//
//   node scripts/lua-harness/combat.mjs
//
// `Combat` ne lit que deux catalogues et ne touche à aucune entité nanos : pas
// de `Character`, pas de `Timer`, pas d'horloge. C'est ce qui le rend exécutable
// ici, dans une VM Lua 5.4 nue, sans le moindre mannequin.
//
// Les catalogues sont chargés RÉELS, jamais simulés. Une fausse table de classes
// ferait passer la suite pendant que le vrai catalogue a changé de forme — or
// c'est précisément ce que ces tests cherchent.
//
// `Logic/Animations.lua` est chargé lui aussi : c'est lui qui sait décomposer un
// nom d'animation en action, et c'est contre les 3 200 noms RÉELS du pack cuit
// que l'on vérifie que les actions de la chaîne existent encore.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const classes = lire("Catalogs/Classes.lua");
const items = lire("Catalogs/Items.lua");
const animNoms = lire("Catalogs/Animations.lua");
const animations = lire("Logic/Animations.lua");
const combat = lire("Logic/Combat.lua");
const tests = fs.readFileSync(new URL("./combat-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

// `Narvos` est posé AVANT `Combat` : le module lit `Narvos.Classes` et
// `Narvos.Items` au chargement et retombe sinon sur `Package.Require`, qui
// n'existe pas ici. C'est le même ordre que dans Shared/Index.lua.
const script = `
Narvos = {}
Narvos.Classes  = (function()
${classes}
end)()
Narvos.Items    = (function()
${items}
end)()
Narvos.AnimNoms = (function()
${animNoms}
end)()

Anims = (function()
${animations}
end)()

local Combat = (function()
${combat}
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