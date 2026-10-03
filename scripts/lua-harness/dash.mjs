import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// dash.mjs — exécute les tests de Shared/Logic/Dash.lua.
//
//   node scripts/lua-harness/dash.mjs
//
// Dash est PUR (ni Package, ni Character, ni horloge) : il se charge tel quel.
// En PLUS du module, on extrait du CATALOGUE RÉEL les noms ACB_Dash_* cuits et
// on les injecte : le test prouve l'intégration complète (catalogue → Grouper →
// Dash.CLIPS → Verifier → Choisir), pas seulement la logique isolée.
// Server/Dash.lua, lui, dépend du moteur : on n'en vérifie que la SYNTAXE.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";
const SRC_ANIMATIONS = `${BASE}/narvos/Shared/Logic/Animations.lua`;
const SRC_DASH = `${BASE}/narvos/Shared/Logic/Dash.lua`;
const SRC_SERVER_DASH = `${BASE}/narvos-map-proto/Server/Dash.lua`;
const SRC_CATALOGUE = `${BASE}/narvos/Shared/Catalogs/Animations.lua`;

const lua = await new LuaFactory().createEngine();

// ── Extraire les noms réels cuits (côté Node, pas de lib io en wasmoon) ───────
const catalogue = fs.readFileSync(SRC_CATALOGUE, "utf8");
const nomsDash = [...catalogue.matchAll(/"ACB_Dash_[A-Za-z0-9_]+"/g)].map((m) => m[0].replaceAll('"', ""));
if (nomsDash.length !== 16) {
  console.error(`ERREUR: attendu 16 noms ACB_Dash dans le catalogue, obtenu ${nomsDash.length}`);
  process.exit(1);
}
// Table littérale Lua (noms réels : sans guillemets ni backslash, inline sûr).
const nomsLua = "{ " + nomsDash.map((n) => `"${n}"`).join(", ") + " }";

const script = `
local Animations = (function()
${fs.readFileSync(SRC_ANIMATIONS, "utf8")}
end)()

local Dash = (function()
${fs.readFileSync(SRC_DASH, "utf8")}
end)()

-- Le catalogue réel, réduit à ses entrées d'esquive.
NOMS_DASH = ${nomsLua}

${fs.readFileSync(new URL("./dash-tests.lua", import.meta.url), "utf8")}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
}

// ── Syntaxe seule de Server/Dash.lua (moteur absent) ──────────────────────────
try {
  const src = fs.readFileSync(SRC_SERVER_DASH, "utf8");
  const json = JSON.stringify(src);
  const check = `local f, e = load(${json})\nprint(e or "Server/Dash.lua: syntaxe OK")`;
  await lua.doString(check);
} catch (e) {
  console.error("SYNTAXE Server/Dash.lua:", e.message);
  process.exitCode = 1;
}

lua.global.close();