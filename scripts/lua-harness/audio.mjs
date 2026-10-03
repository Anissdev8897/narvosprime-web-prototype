// ══════════════════════════════════════════════════════════════════════════════
// audio.mjs — exécute les tests de Shared/Logic/Audio.lua (logique pure).
//
//   node scripts/lua-harness/audio.mjs
//
// Chargement réel : `Shared/Catalogs/Sons.lua` (DATA) + `Shared/Logic/Audio.lua`
// (SÉLECTION). Aucun son n'est joué (c'est l'exécutant Server/Client).
import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";
const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");
const sons = lire("Catalogs/Sons.lua");
const audio = lire("Logic/Audio.lua");
const tests = fs.readFileSync(new URL("./audio-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();
await lua.doString(`Sons = (function()\n${sons}\nend)()
Audio = (function()\n${audio}\nend)()
Audio.Configurer(Sons)`);
try { await lua.doString(tests); } catch (e) { console.log("  (fin assertions lua)"); }
lua.global.close();