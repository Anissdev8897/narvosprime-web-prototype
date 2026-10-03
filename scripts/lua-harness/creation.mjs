// ══════════════════════════════════════════════════════════════════════════════
// creation.mjs — exécute les tests de Shared/Logic/CharacterCreation.lua.
//
//   node scripts/lua-harness/creation.mjs
//
// POURQUOI UN RUNNER À PART : run.mjs enveloppe Inventory.lua et rien d'autre.
// CharacterCreation a une dépendance différente — le catalogue Classes — et une
// contrainte propre : elle ne doit PAS appeler Package.Require. Le module lit
// `Narvos.Classes` en priorité ; on pose donc ce global avant de le charger, et
// la branche Package n'est jamais atteinte.
//
// Ce que ce harnais NE teste pas : Creation.Creer / Supprimer / Tous en mode
// moteur. Elles s'appuient sur Package.SetPersistentData, qui n'existe qu'en
// jeu. Elles sont écrites pour rendre des valeurs neutres hors moteur, et c'est
// ce comportement-là qui est vérifié ici.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const classes = fs.readFileSync(`${BASE}/Catalogs/Classes.lua`, "utf8");
const modular = fs.readFileSync(`${BASE}/Catalogs/Modular.lua`, "utf8");
const creation = fs.readFileSync(`${BASE}/Logic/CharacterCreation.lua`, "utf8");
const tests = fs.readFileSync(new URL("./creation-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
-- Le global que le module cherche en premier. Sa présence court-circuite
-- Package.Require, absent hors du moteur.
Narvos = {
  Classes = (function()
${classes}
end)(),
  -- Modular est requis depuis que la fiche porte une tenue modulaire. Sans lui
  -- ici, le module retombe sur Package.Require, absent hors moteur.
  Modular = (function()
${modular}
end)(),
}

local Creation = (function()
${creation}
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