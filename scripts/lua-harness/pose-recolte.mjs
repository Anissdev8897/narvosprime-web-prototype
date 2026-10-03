// ══════════════════════════════════════════════════════════════════════════════
// pose-recolte.mjs — les gisements et les ateliers sont-ils POSABLES à la main ?
//
//   node scripts/lua-harness/pose-recolte.mjs
//
// ── CE QU'IL PROUVE (2026-09-19, demande « les faire spawn dans le menu de
//    props et pouvoir les placer nous-mêmes ») ────────────────────────────────
// `Shared/Logic/PoseRecolte.lua` est chargé avec les catalogues RÉELS
// (`Catalogs/Gisements.lua`, `Catalogs/Ateliers.lua`), et le pack CUIT
// (`Assets.toml`) est lu sur disque :
//   1. les dix entités posables existent, avec des identifiants uniques ;
//   2. chaque mesh déclaré EXISTE dans le pack cuit — un nom recopié de mémoire
//      poserait un prop invisible, sans erreur ;
//   3. un gisement sans mesh cuit garde le CUBE de repli et le DIT (`cuit=false`) ;
//   4. une pose produit un PLAN complet (clé d'instance unique, déclencheur,
//      ligne de persistance) ou un REFUS motivé — jamais une pose à moitié ;
//   5. la persistance fait un aller-retour stable.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import { LuaFactory } from "wasmoon";

const RACINE = "E:/narvosprime-web-prototype/";
const NARVOS = RACINE + "WebPortal/Server/nanos_world/packages/narvos/Shared/";
const lire = (p) => fs.readFileSync(p, "utf8");

const gisements = lire(NARVOS + "Catalogs/Gisements.lua");
const ateliers = lire(NARVOS + "Catalogs/Ateliers.lua");
const module_ = lire(NARVOS + "Logic/PoseRecolte.lua");
const toml = lire(RACINE + "WebPortal/Server/Assets/narvos/Assets.toml");

// ── Lecture du pack cuit (mêmes règles que pnj-anims.mjs) ─────────────────────
const sections = {};
let courante = null;
for (const ligne of toml.split("\n")) {
  const s = ligne.match(/^\s*\[assets\.(\w+)\]/);
  if (s) { courante = s[1]; sections[courante] = sections[courante] || new Set(); continue; }
  const e = ligne.match(/^\s*([A-Za-z0-9_\-]+)\s*=/);
  if (e && courante) sections[courante].add(e[1]);
}
const contient = (section, cle) => (sections[section] || new Set()).has(cle);

// ── Vérifications côté Node (pack cuit) ───────────────────────────────────────
let okNode = 0, koNode = 0;
const echecsNode = [];
const ok = (c, nom) => { if (c) okNode++; else { koNode++; echecsNode.push(nom); } };

const meshesGisement = [...gisements.matchAll(/mesh = "(narvos::[^"]+)"/g)].map((m) => m[1].replace("narvos::", ""));
ok(meshesGisement.length >= 4, `4 meshes de gisement declares ou plus (obtenu ${meshesGisement.length})`);
for (const cle of meshesGisement) {
  ok(contient("static_meshes", cle), `pack cuit : gisement ${cle} declare dans [assets.static_meshes]`);
}

const meshesStation = [...ateliers.matchAll(/mesh = "(narvos::[^"]+)"/g)].map((m) => m[1].replace("narvos::", ""));
ok(meshesStation.length >= 4, `4 meshes de station declares ou plus (obtenu ${meshesStation.length})`);
for (const cle of meshesStation) {
  ok(contient("static_meshes", cle), `pack cuit : station ${cle} declaree dans [assets.static_meshes]`);
}
const squelettes = [...ateliers.matchAll(/squelettique = "(narvos::[^"]+)"/g)].map((m) => m[1].replace("narvos::", ""));
for (const cle of squelettes) {
  ok(contient("skeletal_meshes", cle), `pack cuit : mesh squelettique ${cle} declare`);
}
const anims = [...ateliers.matchAll(/animation = "(narvos::[^"]+)"/g)].map((m) => m[1].replace("narvos::", ""));
for (const cle of anims) {
  ok(contient("animations", cle), `pack cuit : animation ${cle} declaree`);
}

// ── Vérifications côté Lua (module pur) ───────────────────────────────────────
// ⚠ Lua n'a pas de littéral `[...]` : une liste JS doit être convertie en `{...}`.
const echapLua = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
const messagesLua = "{" + echecsNode.map(echapLua).join(", ") + "}";

const lua = await new LuaFactory().createEngine();
const script = `
local reussis, echecs = ${okNode}, ${koNode}
local messages = ${messagesLua}
local function ok(c, nom) if c then reussis = reussis + 1 else echecs = echecs + 1; messages[#messages + 1] = nom end end
local function egal(a, b, nom) ok(a == b, nom .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end
local function section(n) print("[" .. n .. "]") end

local Gisements = (function() ${gisements} end)()
local Ateliers  = (function() ${ateliers} end)()
local Pose      = (function() ${module_} end)()

section("catalogue des entites posables")
local entrees = Pose.Integrer(Gisements, Ateliers)
egal(#entrees, 11, "6 gisements + 4 ateliers + etabli d'assemblage = 11 entrees")
egal(#Pose.ENTREES, 11, "Integrer REMPLIT PoseRecolte.ENTREES (champ declare DANS le module)")
ok(Pose.ENTREES[1] ~= nil and Pose.ENTREES[1].id == entrees[1].id, "ENTREES porte la meme liste que le retour")
local vus = {}
for _, e in ipairs(entrees) do
    ok(not vus[e.id], "identifiant unique : " .. tostring(e.id))
    vus[e.id] = true
    ok(type(e.mesh) == "string" and e.mesh ~= "", "mesh non vide : " .. tostring(e.id))
    ok(e.rayon_trigger_m == 2.5, "declencheur 2,5 m : " .. tostring(e.id))
end
ok(Pose.Trouver(entrees, "gisement:filon_metal_rare") ~= nil, "trouve par identifiant")
ok(Pose.Trouver(entrees, "gisement:inexistant") == nil, "identifiant inconnu -> nil")

local cubes, cuits = 0, 0
for _, e in ipairs(entrees) do
    if (e.cuit) then cuits = cuits + 1 else cubes = cubes + 1 end
end
egal(cuits, 9, "9 entites adossees a un mesh cuit (dont l'etabli d'assemblage)")
egal(cubes, 2, "2 gisements sans mesh cuit (cube de repli, et c'est DIT)")

section("cle d'instance")
local cles = { "gisement:filon_metal_rare#1", "gisement:station:x#1" }
egal(Pose.RangSuivant({}, "gisement:filon_metal_rare"), 1, "premiere pose -> rang 1")
egal(Pose.RangSuivant(cles, "gisement:filon_metal_rare"), 2, "deuxieme pose -> rang 2")
local apres_retrait = { "gisement:filon_metal_rare#1", "gisement:filon_metal_rare#3" }
egal(Pose.RangSuivant(apres_retrait, "gisement:filon_metal_rare"), 4, "un retrait ne réutilise pas la cle liberee")
egal(Pose.CompteDe(apres_retrait, "gisement:filon_metal_rare"), 2, "compte par entree")

section("plan de pose")
local pos = { X = 180000, Y = -42000, Z = 151834 }
local plan, raison = Pose.PlanDePose(entrees, {}, "gisement:filon_metal_rare", pos, 90)
ok(plan ~= nil, "pose acceptee (" .. tostring(raison) .. ")")
egal(plan and plan.cle, "gisement:filon_metal_rare#1", "cle d'instance du plan")
egal(plan and plan.kind, "gisement", "type du plan")
egal(plan and plan.mesh, "narvos::SM_Ore_Iron", "mesh du plan")
egal(plan and plan.trigger and plan.trigger.rayon_m, 2.5, "declencheur du plan")
egal(plan and plan.persistance and plan.persistance.yaw, 90, "orientation retenue")

local refus = { Pose.PlanDePose(entrees, {}, "gisement:inexistant", pos, 0) }
egal(select(1, Pose.PlanDePose(entrees, {}, "gisement:inexistant", pos, 0)), nil, "entree inconnue refusee")
egal(select(2, Pose.PlanDePose(entrees, {}, "gisement:inexistant", pos, 0)), "Entrée inconnue", "raison du refus")
egal(select(1, Pose.PlanDePose(entrees, {}, "gisement:filon_metal_rare", { X = 1, Z = 2 }, 0)), nil, "position sans Y refusee")
egal(select(1, Pose.PlanDePose(entrees, {}, "gisement:filon_metal_rare", "loin", 0)), nil, "position non-table refusee")

local pleines = {}
for i = 1, Pose.PLAFOND_PAR_ENTREE do pleines[i] = "gisement:filon_metal_rare#" .. i end
egal(select(1, Pose.PlanDePose(entrees, pleines, "gisement:filon_metal_rare", pos, 0)), nil, "plafond par entree respecte")
ok((select(2, Pose.PlanDePose(entrees, pleines, "gisement:filon_metal_rare", pos, 0)) or ""):find("Plafond") ~= nil, "raison du plafond explicite")

section("immuabilite")
local avant = #pleines
Pose.PlanDePose(entrees, pleines, "gisement:filon_metal_rare", pos, 0)
egal(#pleines, avant, "PlanDePose ne mute pas la liste des cles")

section("persistance")
local l1 = Pose.LigneDe(plan)
ok(l1 ~= nil and #l1 == 6, "ligne de persistance a 6 scalaires")
local texte = Pose.Serialiser({ l1, Pose.LigneDe(Pose.PlanDePose(entrees, {}, "station:forge", { X = 181000, Y = -42000, Z = 151834 }, 180)) })
local relu = Pose.DepuisPersistance(texte)
egal(#relu, 2, "relu = 2 lignes")
egal(relu[1].id, "gisement:filon_metal_rare", "ordre stable (tri par cle)")
local texte2 = Pose.Serialiser({ Pose.LigneDe(plan), Pose.LigneDe(Pose.PlanDePose(entrees, {}, "station:forge", { X = 181000, Y = -42000, Z = 151834 }, 180)) })
egal(texte, texte2, "deux serialisations du meme etat sont identiques")
local relu2 = Pose.DepuisPersistance(texte)
egal(math.floor(relu2[1].position.Z + 0.5), 151834, "Z conserve au centieme")

print("")
print(("%d assertion(s) reussie(s), %d echec(s)"):format(reussis, echecs))
if (#messages > 0) then
    for _, m in ipairs(messages) do print("  ECHEC  " .. m) end
    error("harnais en echec", 0)
end
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}