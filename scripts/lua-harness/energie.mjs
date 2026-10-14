import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// energie.mjs — exécute les tests de Shared/Logic/Energie.lua.
//
//   node scripts/lua-harness/energie.mjs
//
// Le module est PUR (temps en paramètre, pas d'horloge globale) : chargé tel
// quel. Server/Energie.lua dépend du moteur : on n'en vérifie que la SYNTAXE.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";
const SRC_ENERGIE = `${BASE}/narvos/Shared/Logic/Energie.lua`;
const SRC_SERVER = `${BASE}/narvos-map-proto/Server/Energie.lua`;

const lua = await new LuaFactory().createEngine();

const script = `
local Energie = (function()
${fs.readFileSync(SRC_ENERGIE, "utf8")}
end)()

${fs.readFileSync(new URL("./energie-tests.lua", import.meta.url), "utf8")}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
}

// ── Syntaxe seule de Server/Energie.lua (moteur absent) ───────────────────────
try {
  const src = fs.readFileSync(SRC_SERVER, "utf8");
  const check = `local f, e = load(${JSON.stringify(src)})\nprint(e or "Server/Energie.lua: syntaxe OK")`;
  await lua.doString(check);
} catch (e) {
  console.error("SYNTAXE Server/Energie.lua:", e.message);
  process.exitCode = 1;
}

lua.global.close();