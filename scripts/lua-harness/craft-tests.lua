-- ══════════════════════════════════════════════════════════════════════════════
-- craft-tests.lua — assertions sur Shared/Logic/Craft.lua.
-- Chargé par craft.mjs, qui fournit `Craft`, `Narvos.Items` (catalogue RÉEL),
-- `Narvos.Inventory` (module RÉEL) et `Narvos.Recettes` (catalogue RÉEL).
--
-- Portage corrigé du lot 6 : les 9 recettes viennent de
-- `src/rpg/items/craftingSystem.ts` (identifiants craft_*, 4 stations). Le
-- harnais `craft.mjs` compare en plus la STRUCTURE et les VERDICTS contre le
-- TypeScript réel ; ci-dessous on vérifie la sémantique Lua (manquants exacts,
-- station, palier, atomicité).
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1 print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

local Inventory = Narvos.Inventory
local Items = Narvos.Items

-- ══════════════════════════════════════════════════════════════════════════════
-- COHÉRENCE — les 9 recettes du lot 6 contre le catalogue RÉEL
-- ══════════════════════════════════════════════════════════════════════════════

section("coherence catalogue (9 recettes, 4 stations)")

local problemes = Craft.Verifier(Narvos.Items.ITEM_DB)
for _, p in ipairs(problemes) do print("  PROBLEME  " .. p) end
egal(#problemes, 0, "chaque entree/sortie de recette existe dans le catalogue")

-- Les 9 identifiants TypeScript, dans l'ordre du catalogue.
local ids_attendus = {
    "craft_plasma_blade", "craft_cyber_armor", "craft_plasma_shield",
    "craft_void_amulet", "craft_power_ring",
    "craft_potion_soin_majeure", "craft_potion_mana_mineure",
    "craft_noyau_plasma", "craft_metal_rare",
}
egal(#Craft.Sequence(), 31, "9 TS + 4 raffinage + 18 métiers (fusion C)")
local n_ids = 0
for _, id in ipairs(ids_attendus) do
    if (Craft.Recette(id) ~= nil) then n_ids = n_ids + 1 end
end
egal(n_ids, 9, "les 9 identifiants TS CRAFT_RECIPES sont presents")

-- Les 4 stations existent (forge / workbench / alchemy / refinery).
local stations = {}
for _, id in ipairs(ids_attendus) do
    stations[Craft.Recette(id).station] = true
end
ok(stations.forge, "station forge presente")
ok(stations.workbench, "station workbench presente")
ok(stations.alchemy, "station alchemy presente")
ok(stations.refinery, "station refinery presente (elle avait disparu du portage)")

egal(Craft.Recette("introuvable"), nil, "Recette() inconnue : nil")
egal(Craft.Recette(nil), nil, "Recette(nil) : nil, sans lever")

-- ══════════════════════════════════════════════════════════════════════════════
-- PEUTFABRIQUER — la liste EXACTE des manquants (verdict = TS checkRecipe)
-- ══════════════════════════════════════════════════════════════════════════════

section("PeutFabriquer — manquants exacts")

local grille_vide = Inventory.CreateGridState(8, 10)

-- craft_plasma_blade : forge, palier 5 — metal_rare 3 + noyau_plasma 1 + cristal_energie 5.
local plasma = Craft.Recette("craft_plasma_blade")
local ok1, manq1, raison1 = Craft.PeutFabriquer(plasma, grille_vide, "forge", 5)
egal(ok1, false, "grille vide : refus")
egal(raison1, nil, "pas de raison hors manquants")
egal(#manq1, 3, "trois entrees manquantes")
egal(manq1[1].item_id, "metal_rare", "manquante 1 : metal_rare")
egal(manq1[1].manque, 3, "il en manque 3")
egal(manq1[2].item_id, "noyau_plasma", "manquante 2 : noyau_plasma")
egal(manq1[2].manque, 1, "il en manque 1")
egal(manq1[3].item_id, "cristal_energie", "manquante 3 : cristal_energie")
egal(manq1[3].manque, 5, "il en manque 5")

-- Grille partielle : 1 metal_rare -> il ne manque que 2 metal_rare + le reste.
local grille_part = Inventory.AddItemToGrid(grille_vide, Inventory.GetItemDef("metal_rare"), 1)
local ok2, manq2 = Craft.PeutFabriquer(plasma, grille_part, "forge", 5)
egal(ok2, false, "entrees partielles : refus")
egal(#manq2, 3, "toujours trois manquants")
egal(manq2[1].item_id, "metal_rare", "manquant metal_rare")
egal(manq2[1].manque, 2, "il en manque 2 (requis 3, possede 1)")
egal(manq2[1].requis, 3, "requis : 3")
egal(manq2[1].possede, 1, "possede : 1")

-- Tout présent -> accepte. (metal_rare x3 + noyau_plasma x1 + cristal_energie x5.)
local grille_ok = Inventory.CreateGridState(8, 10)
grille_ok = Inventory.AddItemToGrid(grille_ok, Inventory.GetItemDef("metal_rare"), 3)
grille_ok = Inventory.AddItemToGrid(grille_ok, Inventory.GetItemDef("noyau_plasma"), 1)
grille_ok = Inventory.AddItemToGrid(grille_ok, Inventory.GetItemDef("cristal_energie"), 5)
local ok3, manq3 = Craft.PeutFabriquer(plasma, grille_ok, "forge", 5)
egal(ok3, true, "entrees presentes : accepte")
egal(#manq3, 0, "aucun manquant")

-- ══════════════════════════════════════════════════════════════════════════════
-- STATION et PALIER
-- ══════════════════════════════════════════════════════════════════════════════

section("station et palier")

local ok4, _, raison4 = Craft.PeutFabriquer(plasma, grille_ok, "alchemy", 5)
egal(ok4, false, "mauvaise station : refus")
egal(raison4, "station requise : forge", "la raison nomme la station forge")

-- craft_noyau_plasma est une recette REFINERY : le confirmer (station requise : refinery).
local noyau = Craft.Recette("craft_noyau_plasma")
local ok5, _, raison5 = Craft.PeutFabriquer(noyau, grille_ok, nil, 5)
egal(ok5, false, "sans station : refus")
egal(raison5, "station requise : refinery", "refinery est bien la station du noyau_plasma")

-- Palier : cyber_armor requiert palier 8 ; niveau 3 -> refus.
local cyber = Craft.Recette("craft_cyber_armor")
local ok6, _, raison6 = Craft.PeutFabriquer(cyber, grille_vide, "forge", 3)
egal(ok6, false, "palier trop bas : refus")
ok(type(raison6) == "string" and raison6:find("palier", 1, true) ~= nil, "la raison nomme le palier")

-- ══════════════════════════════════════════════════════════════════════════════
-- CONSOMMER — LE TEST QUI COMPTE : 3 unites sur 3 piles
-- ══════════════════════════════════════════════════════════════════════════════

section("Consommer — le piege des uid")

local grille_3piles = {
    cols = 8, rows = 10,
    instances = {
        { itemId = "metal_rare", quantity = 1, gridX = 0, gridY = 0, gridW = 1, gridH = 1, uid = "inst_91" },
        { itemId = "metal_rare", quantity = 1, gridX = 1, gridY = 0, gridW = 1, gridH = 1, uid = "inst_92" },
        { itemId = "metal_rare", quantity = 1, gridX = 2, gridY = 0, gridW = 1, gridH = 1, uid = "inst_93" },
    },
}

local recette_conso = { entrees = { { item_id = "metal_rare", quantite = 3 } } }
local grille_apres, raison_conso = Craft.Consommer(grille_3piles, recette_conso)
egal(raison_conso, nil, "consommation de 3 sur 3 piles : pas de raison d'echec")
egal(Inventory.CountItem(grille_apres, "metal_rare"), 0, "les 3 unites ont disparu")
egal(#grille_apres.instances, 0, "tous les uids retires")
egal(Inventory.FindInstance(grille_apres, "inst_91"), nil, "inst_91 n'existe plus")
egal(Inventory.CountItem(grille_3piles, "metal_rare"), 3, "immuable : la grille d'origine garde ses 3 unites")

-- Pile partielle : 5 en une pile, retrait de 3 -> 2 restants.
local grille_pile = Inventory.AddItemToGrid(grille_vide, Inventory.GetItemDef("metal_rare"), 5)
local g2, r2 = Craft.Consommer(grille_pile, { entrees = { { item_id = "metal_rare", quantite = 3 } } })
egal(r2, nil, "retrait partiel : ok")
egal(Inventory.CountItem(g2, "metal_rare"), 2, "il en reste 2")

-- ══════════════════════════════════════════════════════════════════════════════
-- PRODUIRE / FABRIQUER — atomicité : la place est vérifiée AVANT de consommer
-- ══════════════════════════════════════════════════════════════════════════════

section("Fabriquer — atomique")

local potion_min = Craft.Recette("craft_potion_mana_mineure") -- alchemy, palier 1, cristal_energie 2 -> potion_mana_mineure

-- Succes nominal sur 8x10.
local fab = Inventory.CreateGridState(8, 10)
fab = Inventory.AddItemToGrid(fab, Inventory.GetItemDef("cristal_energie"), 3)
local finale, rf = Craft.Fabriquer(fab, potion_min, "alchemy", 1)
egal(rf, nil, "fabrication nominale : ok")
egal(Inventory.CountItem(finale, "potion_mana_mineure"), 1, "1 potion_mana_mineure produite")
egal(Inventory.CountItem(finale, "cristal_energie"), 1, "3 - 2 = 1 cristal_energie restant")

-- ⚠ GRILLE PLEINE (1x1 rempli par la matiere premiere) : la fabrication DOIT
-- echouer AVANT de consommer. 1x1 contient cristal_energie 2 (requis) mais plus
-- aucune case pour la sortie (potion 1x1).
local grille_1x1 = Inventory.CreateGridState(1, 1)
grille_1x1 = Inventory.AddItemToGrid(grille_1x1, Inventory.GetItemDef("cristal_energie"), 2)
local f_pleine, r_pleine = Craft.Fabriquer(grille_1x1, potion_min, "alchemy", 1)
egal(f_pleine, nil, "grille pleine : fabrication refusee")
egal(r_pleine, "pas de place pour potion_mana_mineure", "raison : la sortie ne rentre pas")
egal(Inventory.CountItem(grille_1x1, "cristal_energie"), 2, "RIEN N'A ETE CONSOMME — la regle qui compte")
egal(Inventory.CountItem(grille_1x1, "potion_mana_mineure"), 0, "et rien n'a ete produit")

-- ══════════════════════════════════════════════════════════════════════════════
-- Bilan
-- ══════════════════════════════════════════════════════════════════════════════

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end