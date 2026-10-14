import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// ia.mjs — exécute les tests de Shared/Logic/Ia.lua.
//
//   node scripts/lua-harness/ia.mjs
//
// `Ia` ne lit AUCUN catalogue et n'appelle aucune API nanos : il reçoit un état,
// une description du monde et un instant, et rend une intention. C'est ce qui le
// rend testable ici sans mannequin, sans map et sans horloge.
//
// Les deux catalogues chargés ci-dessous ne servent PAS au module : ils servent
// aux tests. `Ia.PROFIL_PAR_ROLE` prétend couvrir tous les rôles du jeu — la
// seule façon de le vérifier est de croiser avec les catalogues RÉELS, ceux que
// `Server/Spawner.lua` manipule. Une fausse table de rôles ferait passer la
// suite pendant qu'un monstre du vrai catalogue tomberait sur le profil passif.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const spawnables = lire("Catalogs/Spawnables.lua");
const npc = lire("Catalogs/Npc.lua");
const ia = lire("Logic/Ia.lua");
const tests = fs.readFileSync(new URL("./ia-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

// ⚠ AUCUN BACKTICK dans le texte Lua ci-dessous. Un seul terminerait ce template
// literal et casserait le script — arrivé quatre fois sur ce projet, avec un
// symptôme trompeur (le harnais ne tourne pas, on croit le test vert).
const script = `
-- Vector de nanos, reduit a ce que ce module en lit : trois champs MAJUSCULES.
-- Les tests s'en servent pour prouver que Point accepte ce que donne le moteur.
function Vector(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end

Narvos = {}
Narvos.Spawnables = (function()
${spawnables}
end)()
Narvos.Npc = (function()
${npc}
end)()

local Ia = (function()
${ia}
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