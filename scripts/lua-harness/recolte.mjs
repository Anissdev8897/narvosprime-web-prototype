import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// recolte.mjs — exécute les tests de Shared/Logic/Recolte.lua.
//
//   node scripts/lua-harness/recolte.mjs
//
// `Recolte` est un module PUR : aucun appel à l'API nanos. Le catalogue
// `Catalogs/Gisements.lua` et `Catalogs/Items.lua` sont chargés RÉELS — une
// fausse table rendrait la suite verte pendant que le vrai catalogue a changé
// (même règle que combat.mjs).
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const gisements = lire("Catalogs/Gisements.lua");
const items = lire("Catalogs/Items.lua");
const recolte = lire("Logic/Recolte.lua");
const tests = fs.readFileSync(new URL("./recolte-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
Narvos = {}
Narvos.Gisements = (function()
${gisements}
end)()
Narvos.Items = (function()
${items}
end)()

local Recolte = (function()
${recolte}
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