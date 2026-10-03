import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// traversee.mjs — exécute les tests de Shared/Logic/Traversee.lua.
//
//   node scripts/lua-harness/traversee.mjs
//
// Le module est PUR : chargé tel quel. On extrait du CATALOGUE RÉEL les noms
// M_Neutral_Traversal_* cuits et on les injecte : le test prouve l'intégration
// complète (catalogue → Preparer → Verifier → Clip), pas la logique isolée.
// Server/Traversee.lua dépend du moteur : on n'en vérifie que la SYNTAXE.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";
const SRC_TRAVERSEE = `${BASE}/narvos/Shared/Logic/Traversee.lua`;
const SRC_SERVER = `${BASE}/narvos-map-proto/Server/Traversee.lua`;
const SRC_CATALOGUE = `${BASE}/narvos/Shared/Catalogs/Animations.lua`;

const lua = await new LuaFactory().createEngine();

// ── Extraire les noms réels cuits (côté Node) ──────────────────────────────────
const catalogue = fs.readFileSync(SRC_CATALOGUE, "utf8");
const nomsTraversee = [...catalogue.matchAll(/"M_Neutral_Traversal_[A-Za-z0-9_]+"/g)]
  .map((m) => m[0].replaceAll('"', ""));
if (nomsTraversee.length < 20) {
  console.error(`ERREUR: attendu >= 20 noms M_Neutral_Traversal, obtenu ${nomsTraversee.length}`);
  process.exit(1);
}
const nomsLua = "{ " + nomsTraversee.map((n) => `"${n}"`).join(", ") + " }";

const script = `
local Traversee = (function()
${fs.readFileSync(SRC_TRAVERSEE, "utf8")}
end)()

-- Le catalogue réel, réduit à ses entrées de traversée.
NOMS_TRAVERSEE = ${nomsLua}

${fs.readFileSync(new URL("./traversee-tests.lua", import.meta.url), "utf8")}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
}

// ── Syntaxe seule de Server/Traversee.lua (moteur absent) ─────────────────────
try {
  const src = fs.readFileSync(SRC_SERVER, "utf8");
  const check = `local f, e = load(${JSON.stringify(src)})\nprint(e or "Server/Traversee.lua: syntaxe OK")`;
  await lua.doString(check);
} catch (e) {
  console.error("SYNTAXE Server/Traversee.lua:", e.message);
  process.exitCode = 1;
}

lua.global.close();