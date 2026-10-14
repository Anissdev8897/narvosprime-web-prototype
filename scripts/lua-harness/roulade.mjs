import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// roulade.mjs — exécute les tests de Shared/Logic/Roulade.lua.
//
//   node scripts/lua-harness/roulade.mjs
//
// Module PUR chargé tel quel. Le catalogue RÉEL est injecté pour prouver que le
// clip M_Neutral_Jump_F_Land_Roll_Lfoot est bien cuit. Server/Roulade.lua
// dépend du moteur : on n'en vérifie que la SYNTAXE.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";
const SRC_ROULADE = `${BASE}/narvos/Shared/Logic/Roulade.lua`;
const SRC_ANIMATIONS = `${BASE}/narvos/Shared/Logic/Animations.lua`;
const SRC_SERVER = `${BASE}/narvos-map-proto/Server/Roulade.lua`;
const SRC_CATALOGUE = `${BASE}/narvos/Shared/Catalogs/Animations.lua`;

const lua = await new LuaFactory().createEngine();

// ── Extraire les noms réels cuits (côté Node) ──────────────────────────────────
const catalogue = fs.readFileSync(SRC_CATALOGUE, "utf8");
const nomsRoll = [...catalogue.matchAll(/"M_Neutral_Jump_F_Land_Roll_[A-Za-z0-9_]+"/g)]
  .map((m) => m[0].replaceAll('"', ""));
if (nomsRoll.length === 0) {
  console.error("ERREUR: aucun nom M_Neutral_Jump_F_Land_Roll dans le catalogue");
  process.exit(1);
}
const nomsLua = "{ " + nomsRoll.map((n) => `"${n}"`).join(", ") + " }";

const script = `
local Animations = (function()
${fs.readFileSync(SRC_ANIMATIONS, "utf8")}
end)()

local Roulade = (function()
${fs.readFileSync(SRC_ROULADE, "utf8")}
end)()

-- Le catalogue réel, réduit aux entrées de roulade.
NOMS_ROULADE = ${nomsLua}

${fs.readFileSync(new URL("./roulade-tests.lua", import.meta.url), "utf8")}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
}

// ── Syntaxe seule de Server/Roulade.lua (moteur absent) ───────────────────────
try {
  const src = fs.readFileSync(SRC_SERVER, "utf8");
  const check = `local f, e = load(${JSON.stringify(src)})\nprint(e or "Server/Roulade.lua: syntaxe OK")`;
  await lua.doString(check);
} catch (e) {
  console.error("SYNTAXE Server/Roulade.lua:", e.message);
  process.exitCode = 1;
}

lua.global.close();