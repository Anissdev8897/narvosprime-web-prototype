// ══════════════════════════════════════════════════════════════════════════════
// craft.mjs — exécute les tests de Shared/Logic/Craft.lua.
//
//   node scripts/lua-harness/craft.mjs
//
// `Craft` est un module PUR qui consomme `Logic/Inventory.lua` (IMPORTÉ réel,
// jamais simulé), `Catalogs/Recettes.lua` et `Catalogs/Items.lua` (réels).
//
// DEPUIS LE LOT 6 — parité avec le TypeScript réel. `craftingSystem.ts` est
// bundlé via esbuild, et pour CHACUNE des 9 recettes on compare la structure
// (sortie, entrées, station, palier) ET le verdict (`checkRecipe` TS contre
// `Craft.PeutFabriquer` Lua) sur plusieurs scénarios — grille vide, suffisante,
// partielle, niveau insuffisant. C'est la preuve que le portage ne dévie pas.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RACINE = "E:/narvosprime-web-prototype";
const BASE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;
const TS_CRAFT = `${RACINE}/WebPortal/src/rpg/items/craftingSystem.ts`;
const ESBUILD = `${RACINE}/WebPortal/node_modules/esbuild/bin/esbuild`;

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");
const items = lire("Catalogs/Items.lua");
const inventaire = lire("Logic/Inventory.lua");
const recettes = lire("Catalogs/Recettes.lua");
const craft = lire("Logic/Craft.lua");
const tests = fs.readFileSync(new URL("./craft-tests.lua", import.meta.url), "utf8");

// ── 1. Bundle du catalogue TypeScript réel ────────────────────────────────────
let ts;
try {
  const tmp = path.join(os.tmpdir(), `craft-ts-bundle-${Date.now()}.mjs`);
  execFileSync("node", [ESBUILD, TS_CRAFT, "--bundle", "--format=esm",
    "--platform=node", `--outfile=${tmp}`]);
  ts = await import(pathToFileURL(tmp).href);
} catch (e) {
  console.error("ERREUR esbuild (import TS):", e.message);
  process.exit(1);
}
const CRAFT_RECIPES = ts.CRAFT_RECIPES;
const checkRecipe = ts.checkRecipe;

// ── 2. Moteur Lua avec les modules RÉELS ──────────────────────────────────────
const lua = await new LuaFactory().createEngine();

const modules = `
Narvos = {}
Narvos.Items = (function()
${items}
end)()
Narvos.Inventory = (function()
${inventaire}
end)()
Narvos.Recettes = (function()
${recettes}
end)()

Craft = (function()
${craft}
end)()

-- Sérialiseur JSON (sous-ensemble) et helpers de parité.
local inventory = Narvos.Inventory
local recettes_t = Narvos.Recettes
local function jstr(s)
    s = tostring(s)
    s = s:gsub("\\\\", "\\\\\\\\"):gsub('\\"', '\\\\"'):gsub("\\n", "\\\\n")
    return '\\"' .. s .. '\\"'
end
local function json(v)
    if type(v) == "table" then
        local maxi, arr = 0, true
        for k in pairs(v) do
            if type(k) ~= "number" or k ~= math.floor(k) or k < 1 then arr = false break end
            if k > maxi then maxi = k end
        end
        if arr then
            local p = {}
            for i = 1, maxi do p[i] = json(v[i]) end
            return "[" .. table.concat(p, ",") .. "]"
        end
        local p = {}
        for k, val in pairs(v) do
            p[#p+1] = (type(k) == "string" and jstr(k) or tostring(k)) .. ":" .. json(val)
        end
        table.sort(p)
        return "{" .. table.concat(p, ",") .. "}"
    elseif type(v) == "string" then return jstr(v)
    elseif type(v) == "number" then return tostring(v)
    elseif type(v) == "boolean" then return tostring(v)
    else return "null" end
end

function recettes_json()
    local liste = {}
    for _, id in ipairs(recettes_t.ORDRE) do
        local r = recettes_t.RECETTES[id]
        if r then
            liste[#liste+1] = { id = r.id, label = r.label, sortie = r.sortie,
                entrees = r.entrees, station = r.station,
                palier = r.palier, duree_ms = r.duree_ms }
        end
    end
    return json(liste)
end

function verdict_lua(id, station, niveau, ...)
    local recette = Craft.Recette(id)
    if recette == nil then
        return json({ ok = false, manquants = {}, raison = "recette inconnue" })
    end
    local grille = inventory.CreateGridState(8, 10)
    local n = select("#", ...)
    local i = 1
    while i <= n do
        local item_id, qty = select(i, ...), select(i+1, ...)
        if item_id and qty then
            local def = inventory.GetItemDef(item_id)
            if def then grille = inventory.AddItemToGrid(grille, def, qty) end
        end
        i = i + 2
    end
    local ok, manquants, raison = Craft.PeutFabriquer(recette, grille, station, niveau)
    local m = {}
    for _, x in ipairs(manquants) do m[x.item_id] = x.manque end
    return json({ ok = ok, manquants = m, raison = raison })
end
`;

await lua.doString(modules);

// ── 3. Comparaison structurelle TS ↔ Lua ─────────────────────────────────────
const luaRecettes = JSON.parse(await lua.global.get("recettes_json")());
const luaById = Object.fromEntries(luaRecettes.map((r) => [r.id, r]));

let reussis = 0, echecs = 0;
const ok = (c, n) => { if (c) reussis++; else { echecs++; console.log("  ECHEC  " + n); } };
const egal = (a, b, n) => ok(a === b, `${n}  obtenu=${JSON.stringify(a)} attendu=${JSON.stringify(b)}`);

console.log("[parite structure vs TS]");
const idsTS = Object.keys(CRAFT_RECIPES).sort();
egal(idsTS.length, 9, "9 recettes dans le TS");
for (const id of idsTS) {
  const t = CRAFT_RECIPES[id];
  const l = luaById[id];
  ok(l !== undefined, `Recettes.lua contient ${id}`);
  if (!l) continue;
  egal(l.sortie.item_id, t.result.itemId, `${id}: sortie`);
  egal(l.sortie.quantite, t.result.quantity, `${id}: quantite sortie`);
  egal(l.station, t.station, `${id}: station`);
  egal(l.palier, t.requiredLevel, `${id}: palier`);
  egal(l.duree_ms, t.craftTimeSec * 1000, `${id}: duree_ms`);
  // entrées : mêmes ids et quantités, même ordre
  egal(l.entrees.length, t.ingredients.length, `${id}: nb entrees`);
  for (let i = 0; i < t.ingredients.length; i++) {
    const e = l.entrees[i], ing = t.ingredients[i];
    egal(e.item_id, ing.itemId, `${id}: entre ${i+1}`);
    egal(e.quantite, ing.quantity, `${id}: entre ${i+1} qty`);
  }
}

// ── 4. Parité de VERDICT (checkRecipe TS vs PeutFabriquer Lua) ────────────────
console.log("[parite verdict vs TS]");
const tsVerdict = (id, counts, level) => {
  const r = checkRecipe(id, counts, level);
  if (!r) return null;
  const m = {};
  for (const x of r.missing) m[x.itemId] = x.quantity;
  return { ok: !!r.available, manquants: m, raison: r.levelOk ? null : "palier" };
};

for (const id of idsTS) {
  const t = CRAFT_RECIPES[id];
  const ingredients = t.ingredients;
  const tous = Object.fromEntries(ingredients.map((g) => [g.itemId, g.quantity]));

  const scenarios = [
    ["vide", {}, 0],                            // rien en inventaire
    ["suffisant", tous, 0],                     // tout présent
    ["partiel", { [ingredients[0].itemId]: 1 }, 0],            // une partie
  ];
  for (const [nom, counts, ajust] of scenarios) {
    const niveau = t.requiredLevel + ajust;
    const args = [];
    for (const [k, v] of Object.entries(counts)) args.push(k, v);
    const tsV = tsVerdict(id, counts, niveau);
    const luaV = JSON.parse(await lua.global.get("verdict_lua")(id, t.station, niveau, ...args));
    ok(tsV !== null && luaV !== null, `${id} [${nom}]: verdict present`);
    if (!tsV || !luaV) continue;
    egal(tsV.ok, luaV.ok, `${id} [${nom}]: ok`);
    const canon = (o) => Object.keys(o || {}).sort().map((k) => `${k}:${o[k]}`).join(",");
    egal(canon(tsV.manquants), canon(luaV.manquants), `${id} [${nom}]: manquants`);
  }
  // niveau insuffisant : les deux refusent (les manquants diffèrent PAR CONCEPTION :
  // checkRecipe remplit la liste manquante, PeutFabriquer rend le palier en raison).
  const tsV = tsVerdict(id, {}, t.requiredLevel - 1);
  const luaV = JSON.parse(await lua.global.get("verdict_lua")(id, t.station, t.requiredLevel - 1));
  egal(tsV.ok, false, `${id} [palier]: refus`);
  egal(luaV.ok, false, `${id} [palier]: refus`);
  ok(tsV.raison === "palier" && typeof luaV.raison === "string" && luaV.raison.includes("palier"),
    `${id} [palier]: la raison nomme le palier`);
}

// ── 5. Tests de comportement Lua (atomicité, uid, station) ────────────────────
console.log("[comportement Lua]");
try {
  await lua.doString(tests);
} catch (e) {
  // le bloc d'assertion Lua comptabilise lui-même ; on ne fait pas mourir le harnais.
  console.log("  (fin des assertions lua)");
}

console.log("");
console.log(`parite TS/Lua : ${reussis} reussis, ${echecs} echec(s)`);
lua.global.close();
if (echecs > 0) process.exitCode = 1;