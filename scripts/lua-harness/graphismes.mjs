import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// graphismes.mjs — exécute les tests de Shared/Logic/Graphismes.lua.
//
//   node scripts/lua-harness/graphismes.mjs
//
// ── POURQUOI CE HARNAIS EXISTE ────────────────────────────────────────────────
// Un réglage graphique faux ne lève jamais. `PostProcess.SetBloom(nil, nil)` ne
// plante pas — l'écran change, ou ne change pas, et rien n'est écrit nulle part.
// Le joueur baisse la qualité, ne gagne aucune image par seconde, et personne
// n'a de trace à lire. Ces assertions sont le seul filet.
//
// Deux défauts précis sont visés, tous deux déjà payés sur ce dépôt :
//
//   1. Une valeur nil qui traverse. `Normaliser` doit rendre un niveau MEME sur
//      une entrée absurde — c'est la leçon de `COULEURS_DEFAUT`, où une valeur
//      morte a fini par prendre la place du choix du joueur.
//   2. Une liste de libellés recopiée côté JavaScript. `PourInterface` construit
//      la liste en Lua pour qu'il n'y ait qu'UNE source : `Roster.EncoderCouleurs`
//      itérait une copie écrite en dur et rendait une chaîne vide, sans signal.
//
// AUCUNE API nanos n'est stubbée ici, et c'est volontaire : `Graphismes.lua` ne
// doit toucher ni `PostProcess`, ni `Sky`, ni `Client`. Si un appel s'y glissait,
// ce harnais planterait sur un global nil — exactement le signal recherché.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const graphismes = fs.readFileSync(`${BASE}/Logic/Graphismes.lua`, "utf8");
const tests = fs.readFileSync(new URL("./graphismes-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
local Graphismes = (function()
${graphismes}
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