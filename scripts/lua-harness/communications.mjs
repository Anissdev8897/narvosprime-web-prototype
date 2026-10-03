import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// communications.mjs — exécute les tests de Logic/TexteChat.lua, Logic/Radio.lua
// et Logic/Telephone.lua, avec le VRAI catalogue d'objets.
//
//   node scripts/lua-harness/communications.mjs
//
// ⚠ Un harnais qui ne trouve pas sa cible doit ÉCHOUER, pas rendre vert.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const CIBLES = ["Logic/TexteChat.lua", "Logic/Radio.lua", "Logic/Telephone.lua", "Catalogs/Items.lua"];
let manquante = false;
for (const c of CIBLES) {
  const f = `${BASE}/${c}`;
  if (!fs.existsSync(f)) { console.error(`CIBLE ABSENTE : ${c}`); manquante = true; }
  else if (fs.readFileSync(f, "utf8").trim().length === 0) { console.error(`CIBLE VIDE : ${c}`); manquante = true; }
}
if (manquante) process.exit(1);

const lire = (c) => fs.readFileSync(`${BASE}/${c}`, "utf8");
const tests = fs.readFileSync(new URL("./communications-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

// Les modules lisent `Narvos.TexteChat` s'il existe, sinon le requièrent : on
// injecte donc la table AVANT de charger Radio et Telephone, comme Shared/Index.lua.
const script = `
Narvos = {}
TexteChat = (function()
${lire("Logic/TexteChat.lua")}
end)()
Narvos.TexteChat = TexteChat
Radio = (function()
${lire("Logic/Radio.lua")}
end)()
Telephone = (function()
${lire("Logic/Telephone.lua")}
end)()
local Items = (function()
${lire("Catalogs/Items.lua")}
end)()
VRAIS_ITEMS = Items.ITEM_DB

${tests}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  const reussis = lua.global.get("REUSSIS");
  if (process.exitCode !== 1 && (!reussis || reussis < 1)) {
    console.error("AUCUNE ASSERTION EXECUTEE — le harnais ne prouve rien.");
    process.exitCode = 1;
  }
  lua.global.close();
}