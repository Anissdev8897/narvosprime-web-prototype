// ══════════════════════════════════════════════════════════════════════════════
// frappes.mjs — exécute les tests de Shared/Logic/Frappes.lua.
//
//   node scripts/lua-harness/frappes.mjs
//
// `Frappes` est pur : ni entité, ni horloge. Le catalogue d'animations est
// chargé RÉEL (Catalogs/Animations.lua, généré depuis Assets.toml) : c'est
// contre les noms du pack CUIT qu'on vérifie que chaque coup a un geste. Une
// fausse liste passerait au vert le jour où un réimport renomme les clips.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const animNoms = lire("Catalogs/Animations.lua");
const frappes = lire("Logic/Frappes.lua");
const tests = fs.readFileSync(new URL("./frappes-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
AnimNoms = (function()
${animNoms}
end)()

local Frappes = (function()
${frappes}
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