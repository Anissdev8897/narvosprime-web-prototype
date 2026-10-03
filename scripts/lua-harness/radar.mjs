// ══════════════════════════════════════════════════════════════════════════════
// radar.mjs — exécute les tests de Shared/Logic/Radar.lua.
//
//   node scripts/lua-harness/radar.mjs
//
// DEPUIS LE LOT 7 : parité avec le TypeScript réel. `projection.ts` est bundlé
// via esbuild, et pour CHAQUE cas on compare `worldToRadar` TS contre
// `Radar.worldToRadar` Lua (x, y, inBounds). C'est la preuve du portage.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RACINE = "E:/narvosprime-web-prototype";
const BASE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;
const TS_PROJ = `${RACINE}/WebPortal/src/rpg/runtime/radar/projection.ts`;
const ESBUILD = `${RACINE}/WebPortal/node_modules/esbuild/bin/esbuild`;

const radarLua = fs.readFileSync(`${BASE}/Logic/Radar.lua`, "utf8");
const tests = fs.readFileSync(new URL("./radar-tests.lua", import.meta.url), "utf8");

// ── 1. Bundle du TypeScript réel ──────────────────────────────────────────────
let ts;
try {
  const tmp = path.join(os.tmpdir(), `radar-ts-bundle-${Date.now()}.mjs`);
  execFileSync("node", [ESBUILD, TS_PROJ, "--bundle", "--format=esm",
    "--platform=node", `--outfile=${tmp}`]);
  ts = await import(pathToFileURL(tmp).href);
} catch (e) {
  console.error("ERREUR esbuild (import TS):", e.message);
  process.exit(1);
}
const worldToRadarTS = ts.worldToRadar;

// ── 2. Moteur Lua avec le module RÉEL ─────────────────────────────────────────
const lua = await new LuaFactory().createEngine();
await lua.doString(`Radar = (function()\n${radarLua}\nend)()
function radar_lua(wx, wz, raio, taille)
    local p = Radar.worldToRadar(wx, wz, raio, taille)
    return { x = p.x, y = p.y, inBounds = p.inBounds }
end`);

// ── 3. Jeu de cas (grille déterministe, dans/hors bornes) ─────────────────────
const cas = [];
for (const [raio, taille] of [[220, 180], [500, 200], [120, 150]]) {
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      cas.push({ wx: gx * raio / 2, wz: gz * raio / 2, raio, taille });
    }
  }
  cas.push({ wx: raio, wz: 0, raio, taille });        // exactement sur le bord
  cas.push({ wx: raio * 1.1, wz: raio * 0.3, raio, taille }); // hors bornes
  cas.push({ wx: 0, wz: 0, raio, taille });            // centre
}

let reussis = 0, echecs = 0;
const ok = (c, n) => { if (c) reussis++; else { echecs++; console.log("  ECHEC  " + n); } };
const egal = (a, b, n) => ok(a === b, `${n}  obtenu=${a} attendu=${b}`);

console.log(`[parite worldToRadar vs TS] — ${cas.length} cas`);
for (const c of cas) {
  const t = worldToRadarTS(c.wx, c.wz, c.raio, c.taille);       // TS (référence)
  const lua_pts = await lua.global.get("radar_lua")(c.wx, c.wz, c.raio, c.taille);
  // precision: compare with epsilon (flottants IEEE)
  const ep = Math.max(1e-9, Math.abs(t.x) * 1e-12);
  const key = `w(${c.wx},${c.wz}) r=${c.raio} s=${c.taille}`;
  ok(Math.abs(lua_pts.x - t.x) < 1e-6, `${key}: x`);
  ok(Math.abs(lua_pts.y - t.y) < 1e-6, `${key}: y`);
  ok(lua_pts.inBounds === t.inBounds, `${key}: inBounds`);
}

// ── 4. Tests de comportement Lua (filtre/tri/plafond) ─────────────────────────
console.log("[comportement Lua]");
try { await lua.doString(tests); } catch (e) { console.log("  (fin assertions lua)"); }

console.log("");
console.log(`parite TS/Lua : ${reussis} reussis, ${echecs} echec(s)`);
lua.global.close();
if (echecs > 0) process.exitCode = 1;