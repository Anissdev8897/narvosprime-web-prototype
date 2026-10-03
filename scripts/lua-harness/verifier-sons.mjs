import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// narvos-verifier-sons.mjs — vérifie que chaque nom de son de Sons.lua existe
// réellement dans le pack cuit (Server/Assets/narvos/Assets.toml [assets.sounds]).
//
//   node scripts/narvos-verifier-sons.mjs
//
// Une référence morte ne se voit qu'à L'ÉCRAN (silence), et trop tard. Ce script
// la rattrape AVANT. Les événements (aoe, announce, killStreak) sont des .mp3
// chargés par le client Web Audio — ABSENTS du pack → signalés comme à cuire.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const TOML = RACINE_DEPOT + "/WebPortal/Server/Assets/narvos/Assets.toml";
const sonsLua = fs.readFileSync(`${BASE}/Catalogs/Sons.lua`, "utf8");

// 1. Sons.lua → Sons (wasmoon)
const lua = await new LuaFactory().createEngine();
await lua.doString(`Sons = (function()\n${sonsLua}\nend)()`);
const Sons = await lua.global.get("Sons");

// 2. Noms de son portés (uniquement ceux qui pointent un FICHIER : événements).
const noms = new Set();
const push = (s) => { if (s) noms.add(s.replace(/\.mp3$/, "").replace(/\.wav$/, "")); };
push(Sons.BOSS_ALERTE);
push(Sons.DONJON_ENTREE);
for (const [k, v] of Object.entries(Sons.ZONES || {})) { push(v.entree); push(v.niveau); }
for (const [k, v] of Object.entries(Sons.SERIES || {})) { push(v.son); }

// 3. Assets.toml [assets.sounds] : les clés = noms de sons disponibles.
const toml = fs.readFileSync(TOML, "utf8");
const clefs = new Set();
const mSection = /\[assets\.sounds\][\s\S]*?(?=\n\s*\[|\s*$)/.exec(toml);
if (mSection) {
  for (const ligne of mSection[0].split("\n")) {
    const mm = /^\s*([A-Za-z0-9_]+)\s*=/.exec(ligne);
    if (mm) clefs.add(mm[1]);
  }
}

// 4. Compare.
let mort = 0;
console.log(`[sons] ${noms.size} nom(s) d'événement, ${clefs.size} son(s) dans le pack`);
for (const nom of noms) {
  if (clefs.has(nom)) { console.log(`  ✓ ${nom}`); }
  else { console.log(`  ✗ ${nom} (MORT — à cuire dans Assets.toml)`); mort++; }
}
if (mort > 0) { console.error(`\n${mort} référence(s) morte(s) : sons d'événement NON cuits (verrouillables)`); }
else console.log("\nTous les sons existent dans le pack.");
lua.global.close();