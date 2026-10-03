import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// digicode.mjs — exécute les tests de Logic/Digicode.lua avec le VRAI Crypto
// (SHA-256, comparaison à temps constant) et le VRAI catalogue d'objets.
//
//   node scripts/lua-harness/digicode.mjs
//
// ⚠ Un harnais qui ne trouve pas sa cible doit ÉCHOUER, pas rendre vert.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";

const CIBLES = ["Logic/Digicode.lua", "Logic/Crypto.lua", "Catalogs/Items.lua"];
let manquante = false;
for (const c of CIBLES) {
  const f = `${BASE}/${c}`;
  if (!fs.existsSync(f)) { console.error(`CIBLE ABSENTE : ${c}`); manquante = true; }
  else if (fs.readFileSync(f, "utf8").trim().length === 0) { console.error(`CIBLE VIDE : ${c}`); manquante = true; }
}
if (manquante) process.exit(1);

const lire = (c) => fs.readFileSync(`${BASE}/${c}`, "utf8");
const tests = fs.readFileSync(new URL("./digicode-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
Crypto = (function()
${lire("Logic/Crypto.lua")}
end)()
Digicode = (function()
${lire("Logic/Digicode.lua")}
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