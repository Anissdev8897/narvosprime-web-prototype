import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// apparence.mjs — exécute les tests de Shared/Logic/Apparence.lua.
//
//   node scripts/lua-harness/apparence.mjs
//
// ── POURQUOI CE HARNAIS CHARGE AUTANT DE MODULES ──────────────────────────────
// Apparence.lua est pur et n'a aucune dépendance. Mais les tests, eux, vérifient
// des choses qui ne se voient qu'EN CONFRONTANT deux catalogues :
//
//   Modular  — les slots visés par une cible existent-ils vraiment ? Un slot mal
//              orthographié ne lève rien, la teinte n'est simplement jamais posée
//   Morphs   — aucun des 138 identifiants MakeHuman ne commence par le préfixe
//   Macros   — aucune des 6 macros non plus
//   Roster   — la palette survit-elle à l'aller-retour en base ? C'est là que la
//              même panne est apparue DEUX fois (une liste de cibles recopiée au
//              lieu du catalogue, chaîne vide en base, sans le moindre signal)
//
// Vérifier ces invariants contre une copie écrite dans le test ne prouverait
// rien : ils tiennent ou cassent en fonction des VRAIS catalogues.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const apparence = lire("Logic/Apparence.lua");
const modular = lire("Catalogs/Modular.lua");
const morphs = lire("Catalogs/Morphs.lua");
const macros = lire("Logic/Macros.lua");
const creation = lire("Logic/CharacterCreation.lua");
const vestiaire = lire("Logic/Vestiaire.lua");
const classes = lire("Catalogs/Classes.lua");
const roster = lire("Logic/Roster.lua");

const tests = fs.readFileSync(new URL("./apparence-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

// L'ordre est celui de Shared/Index.lua. Roster capture Creation et Modular au
// chargement et résout Vestiaire et Apparence à l'appel : poser les cinq avant
// lui reproduit exactement ce que fait le moteur, et évite le repli sur
// Package.Require, absent hors nanos.
const script = `
Narvos = {}
Narvos.Apparence = (function()
${apparence}
end)()
Narvos.Modular = (function()
${modular}
end)()
Narvos.Morphs = (function()
${morphs}
end)()
Narvos.Macros = (function()
${macros}
end)()
Narvos.Classes = (function()
${classes}
end)()
Narvos.Creation = (function()
${creation}
end)()
Narvos.Vestiaire = (function()
${vestiaire}
end)()
Narvos.Roster = (function()
${roster}
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