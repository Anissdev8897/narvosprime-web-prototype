import { RACINE_DEPOT } from "./_racine.mjs";
import { bundleTS } from "./_bundle.mjs";
// arenas-gen.mjs — génère Catalogs/Arenes.lua depuis arenaConfig.ts (sérialisation).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const RACINE = RACINE_DEPOT + "";
const OUT = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Arenes.lua`;

const tmp = path.join(os.tmpdir(), `arenas-gen-${Date.now()}.mjs`);
await bundleTS(`${RACINE}/WebPortal/src/rpg/arenas/arenaConfig.ts`, tmp);
const ts = await import(pathToFileURL(tmp).href);
const configs = ts.ARENA_CONFIGS;

// Sérialiseur TS → Lua (récursif). tableaux → {…}, objets → {k=…}, scalaires.
function lua(v) {
  if (v === null || v === undefined) return "nil";
  const t = typeof v;
  if (t === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (t === "string") return JSON.stringify(v).replace(/"/g, '\\"').replace(/^null$/, "nil"); // approx
  if (t === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    if (v.length === 0) return "{}";
    return "{" + v.map(lua).join(", ") + "}";
  }
  // objet
  const parts = [];
  for (const k of Object.keys(v)) if (v[k] !== undefined) parts.push(k + " = " + lua(v[k]));
  return "{" + parts.join(", ") + "}";
}

// Échappement de chaîne Lua correct (parce que JSON double-quote + \n).
function luaStr(s) { return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "") + '"'; }
function lua2(v) {
  if (v === null || v === undefined) return "nil";
  const t = typeof v;
  if (t === "number") return String(v);
  if (t === "string") return luaStr(v);
  if (t === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.length === 0 ? "{}" : "{" + v.map(lua2).join(", ") + "}";
  const parts = [];
  for (const k of Object.keys(v)) if (v[k] !== undefined) parts.push(k + " = " + lua2(v[k]));
  return "{" + parts.join(", ") + "}";
}

function arenaLua(c) {
  const f = (s) => lua2(s);
  // Ordre stable des champs pour lisibilité.
  const covers = c.covers.map(f).join(",\n      ");
  const triggers = c.triggers.map(f).join(",\n      ");
  const waves = c.waves.map(f).join(",\n      ");
  const routes = c.routes.map(f).join(",\n      ");
  const npcs = c.recommendedNpcs.map(f).join(",\n      ");
  return `{
    mapId = ${f(c.mapId)}, name = ${f(c.name)}, description = ${f(c.description)},
    arenaType = ${f(c.arenaType)}, faction = ${f(c.faction)}, chunkCount = ${c.chunkCount},
    covers = {\n      ${covers}\n    },
    triggers = {\n      ${triggers}\n    },
    waves = {\n      ${waves}\n    },
    routes = {\n      ${routes}\n    },
    recommendedNpcs = {\n      ${npcs}\n    },
  }`;
}

let out = `-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/Arenes.lua — configurations des 3 arènes (GÉNÉRÉ, ne pas éditer).
-- SOURCE : WebPortal/src/rpg/arenas/arenaConfig.ts (ARENA_CONFIGS). Régénérer via
-- scripts/lua-harness/arenas-gen.mjs après toute évolution du catalogue.
-- ═══════════════════════════════════════════════════════════════════════════════

local Arenes = {}

Arenes.CONFIGS = {\n`;
for (const c of configs) out += "    " + arenaLua(c) + ",\n";
out += "}\n\nreturn Arenes\n";
fs.writeFileSync(OUT, out);
console.log(`Arenes.lua écrit (${configs.length} arènes, ${out.length} octets)`);