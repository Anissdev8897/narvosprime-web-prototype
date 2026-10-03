import { RACINE_DEPOT } from "./_racine.mjs";
import { bundleTS } from "./_bundle.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// reputation.mjs — parité TS ↔ Lua pour la réputation (currentTier, tiers,
// merchantDiscount) + comportement (gain/lose/set, tierOf).
//
//   node scripts/lua-harness/reputation.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const SRC = RACINE_DEPOT + "/WebPortal/src/rpg/reputation";
const LUA = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const RACINE = RACINE_DEPOT + "";

// 1. TS : bundle reputationStore + reputationCatalog (noms exportés) via le binaire esbuild.
// L'entrée est ÉCRITE ICI (2026-09-19) : elle pointait sur un artefact orphelin de %TEMP%
// dont les imports D:/ ont cassé après la migration vers E: — un harnais doit être
// auto-suffisant, ne jamais supposer un fichier temporaire présent.
const tmp = path.join(os.tmpdir(), `rep-ts-${Date.now()}.mjs`);
const entry = path.join(os.tmpdir(), "_rep_entry.ts");
fs.writeFileSync(entry, `export * from "${SRC}/reputationStore";\nexport * from "${SRC}/reputationCatalog";\n`);
await bundleTS(entry, tmp);
const ts = await import(pathToFileURL(tmp).href);

// 2. Lua : Reputation + Reputations.
const lua = await new LuaFactory().createEngine();
await lua.doString(
  `Reputations = (function()\n${fs.readFileSync(`${LUA}/Catalogs/Reputations.lua`, "utf8")}\nend)()
   Reputation = (function()\n${fs.readFileSync(`${LUA}/Logic/Reputation.lua`, "utf8")}\nend)()
   Reputation.Configurer(Reputations)`
);
const Reputation = await lua.global.get("Reputation");

// 3. Parité currentTier : valeurs de réputation significatives.
let reussis = 0, echecs = 0, cas = 0;
const echecF = (n, ...rest) => { echecs++; console.log("  ECHEC " + n, ...rest); };
const represent = [-Infinity, -100000, -5000, -3000, -2999, -1, 0, 1, 2999, 3000, 8999, 9000, 20999, 21000, 41999, 42000, 99999, Infinity];
for (const rep of represent) {
  const t = ts.currentTier(rep);        // TS
  const l = Reputation.Tier(rep);         // Lua
  cas++;
  if (t === l) reussis++; else echecF(`currentTier(${rep})`, `TS=${t} Lua=${l}`);
}

// 4. Parité merchantDiscount sur les 7 tiers.
for (const id of ["hostile", "unfriendly", "neutral", "friendly", "honored", "revered", "exalted"]) {
  const t = ts.merchantDiscount(id);
  const l = Reputation.ReductionMarchand(id);
  cas++;
  if (t === l) reussis++; else echecF(`merchantDiscount(${id})`, `TS=${t} Lua=${l}`);
}

console.log(`parité TS/Lua réputation : ${reussis}/${cas} cas`);
await lua.doString(fs.readFileSync(new URL("./reputation-tests.lua", import.meta.url), "utf8"));
lua.global.close();
if (echecs > 0) process.exitCode = 1;