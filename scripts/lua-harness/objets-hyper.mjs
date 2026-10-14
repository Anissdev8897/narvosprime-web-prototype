import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// objets-hyper.mjs — l'integration des donnees de Hyper Inventory V2, prouvee sur
// les VRAIS catalogues.
//
//   node scripts/lua-harness/objets-hyper.mjs
//
// ── CE QU'IL PROUVE ──────────────────────────────────────────────────────────
// `Logic/ObjetsHyper.lua` verse 210 objets et 104 recettes dans `Items.ITEM_DB`
// et `Recettes.RECETTES`. Trois defauts y seraient invisibles en jeu :
//
//   · une recette dont un ingredient manque — elle s'afficherait, et resterait
//     infaisable a jamais ;
//   · une recette ajoutee a RECETTES mais pas a ORDRE — elle existerait cote
//     serveur et n'apparaitrait JAMAIS a l'ecran (`Craft.Sequence` lit ORDRE) ;
//   · une entree NARVOS ecrasee par la valeur du pack.
//
// On charge donc les catalogues reels, et `Logic/Craft.lua` lui-meme, pour que
// chaque recette integree soit passee par le chemin qu'emprunte le serveur.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const LUA = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const lire = (f) => fs.readFileSync(`${LUA}/${f}`, "utf8");

const lua = await new LuaFactory().createEngine();

// ⚠ UN SEUL PASSAGE LUA : wasmoon corrompt son `_ENV` apres quelques centaines
// de `doString` (mesure sur metiers.mjs le meme jour).
const brut = await lua.doString(`
Narvos = {}
Narvos.Items = (function()
${lire("Catalogs/Items.lua")}
end)()
Narvos.Recettes = (function()
${lire("Catalogs/Recettes.lua")}
end)()
Narvos.ObjetsHyper = (function()
${lire("Catalogs/ObjetsHyper.lua")}
end)()
local OHL = (function()
${lire("Logic/ObjetsHyper.lua")}
end)()

local function q(s) return string.format("%q", tostring(s)) end
local parts = {}
local function mettre(k, v) parts[#parts + 1] = q(k) .. ":" .. v end

-- Instantane AVANT : ce qui existait, et une valeur temoin de chaque objet NARVOS.
local avant_items, temoins = 0, {}
for id, def in pairs(Narvos.Items.ITEM_DB) do avant_items = avant_items + 1; temoins[id] = def end
local avant_recettes = 0
for _ in pairs(Narvos.Recettes.RECETTES) do avant_recettes = avant_recettes + 1 end
local avant_ordre = #(Narvos.Recettes.ORDRE or {})

local b = OHL.Integrer()
mettre("bilan_erreur", q(b.erreur or ""))
mettre("objets", tostring(b.objets or -1))
mettre("recettes", tostring(b.recettes or -1))
mettre("refusees", tostring(b.recettes_refusees or -1))

local n_hyper_obj = 0
for _ in pairs(Narvos.ObjetsHyper.OBJETS) do n_hyper_obj = n_hyper_obj + 1 end
mettre("n_hyper_obj", tostring(n_hyper_obj))
mettre("n_hyper_rec", tostring(#Narvos.ObjetsHyper.ORDRE_RECETTES))

-- Aucun objet NARVOS ecrase.
local ecrases = 0
for id, def in pairs(temoins) do if Narvos.Items.ITEM_DB[id] ~= def then ecrases = ecrases + 1 end end
mettre("ecrases", tostring(ecrases))

-- Chaque recette ajoutee est dans ORDRE, et ORDRE n'a pas de doublon.
local dans_ordre, doublons = {}, 0
for _, id in ipairs(Narvos.Recettes.ORDRE) do
  if dans_ordre[id] then doublons = doublons + 1 end
  dans_ordre[id] = true
end
local hors_ordre = {}
for id in pairs(Narvos.Recettes.RECETTES) do
  if not dans_ordre[id] then hors_ordre[#hors_ordre + 1] = q(id) end
end
mettre("hors_ordre", "[" .. table.concat(hors_ordre, ",") .. "]")
mettre("doublons_ordre", tostring(doublons))
mettre("ordre_etendu", tostring(#Narvos.Recettes.ORDRE - avant_ordre))

-- Chaque recette Hyper integree est ENTIERE (sortie + ingredients au catalogue).
local incompletes = {}
for _, id in ipairs(Narvos.ObjetsHyper.ORDRE_RECETTES) do
  local r = Narvos.Recettes.RECETTES[id]
  if r then
    local ok, raison = OHL.RecetteComplete(r, Narvos.Items.ITEM_DB)
    if not ok then incompletes[#incompletes + 1] = q(id .. " : " .. tostring(raison)) end
  end
end
mettre("incompletes", "[" .. table.concat(incompletes, ",") .. "]")

-- Les stations visees sont celles posees en jeu (ou nil = a la main).
local STATIONS = { forge = true, workbench = true, alchemy = true, refinery = true }
local stations_inconnues = {}
for _, id in ipairs(Narvos.ObjetsHyper.ORDRE_RECETTES) do
  local r = Narvos.ObjetsHyper.RECETTES[id]
  if r.station ~= nil and not STATIONS[r.station] then
    stations_inconnues[#stations_inconnues + 1] = q(id .. " -> " .. tostring(r.station))
  end
end
mettre("stations_inconnues", "[" .. table.concat(stations_inconnues, ",") .. "]")

-- Idempotence : un second passage n'ajoute rien.
local b2 = OHL.Integrer()
mettre("second_objets", tostring(b2.objets or -1))
mettre("second_recettes", tostring(b2.recettes or -1))

-- Un objet Hyper porte ce qu'il faut pour la grille.
local malformes = {}
for id, o in pairs(Narvos.ObjetsHyper.OBJETS) do
  if not (type(o.gridW) == "number" and type(o.gridH) == "number" and o.gridW >= 1 and o.gridH >= 1
          and type(o.maxStack) == "number" and o.maxStack >= 1 and type(o.label) == "string") then
    malformes[#malformes + 1] = q(id)
  end
end
mettre("malformes", "[" .. table.concat(malformes, ",") .. "]")

-- Une recette dont un ingredient manque est REFUSEE (injection controlee).
local faux = { RECETTES = { r_test = { id = "r_test", sortie = { item_id = "hyper_stone", quantite = 1 },
  entrees = { { item_id = "objet_qui_n_existe_pas", quantite = 1 } }, station = "forge" } },
  ORDRE_RECETTES = { "r_test" } }
local cible = { RECETTES = {}, ORDRE = {} }
local ra, rd, rr = OHL.IntegrerRecettes(cible, faux, Narvos.Items.ITEM_DB)
mettre("injection_refusee", tostring(ra == 0 and rr == 1 and cible.RECETTES.r_test == nil))

return "{" .. table.concat(parts, ",") .. "}"
`);
lua.global.close();

const L = JSON.parse(brut);
let reussis = 0, echecs = 0;
const egal = (o, a, n) => { if (JSON.stringify(o) === JSON.stringify(a)) reussis++; else { echecs++; console.log(`  ECHEC  ${n}  obtenu=${JSON.stringify(o)}  attendu=${JSON.stringify(a)}`); } };
const vrai = (c, n) => { if (c) reussis++; else { echecs++; console.log(`  ECHEC  ${n}`); } };

console.log("[integration]");
egal(L.bilan_erreur, "", "l'integration trouve ses catalogues");
vrai(L.n_hyper_obj > 0, "le catalogue Hyper n'est pas vide");
egal(L.objets, L.n_hyper_obj, "tous les objets Hyper entrent (aucune collision d'identifiant)");
egal(L.refusees, 0, "aucune recette Hyper refusee : tous leurs ingredients existent");
egal(L.recettes, L.n_hyper_rec, "toutes les recettes Hyper entrent");

console.log("[ce qui ne doit pas casser]");
egal(L.ecrases, 0, "aucun objet NARVOS n'est ecrase");
egal(L.hors_ordre, [], "toute recette est dans ORDRE — sinon elle n'apparait jamais a l'ecran");
egal(L.doublons_ordre, 0, "ORDRE n'a aucun doublon");
egal(L.ordre_etendu, L.recettes, "ORDRE s'etend exactement du nombre de recettes ajoutees");
egal(L.incompletes, [], "chaque recette integree est entiere");
egal(L.stations_inconnues, [], "toute station visee est posee en jeu");
egal(L.malformes, [], "chaque objet a une taille de grille et une pile valides");

console.log("[garde-fous]");
egal(L.second_objets, 0, "un second passage n'ajoute aucun objet");
egal(L.second_recettes, 0, "un second passage n'ajoute aucune recette");
vrai(L.injection_refusee, "une recette a l'ingredient inconnu est refusee");

console.log("");
console.log(`${reussis} reussis, ${echecs} echec(s)`);
if (echecs > 0) process.exitCode = 1;