-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Craft.lua — la transformation : matières → objets.
--
-- ── PUR ET PROUVABLE ──────────────────────────────────────────────────────────
-- Aucun appel à l'API nanos. `Logic/Inventory.lua` est consommé DEPUIS le module
-- (injecté par le harnais), jamais modifié. `Catalogs/Recettes.lua` et
-- `Catalogs/Items.lua` : lus, jamais édités.
--
-- ── ⚠ LE PIÈGE DES UID ───────────────────────────────────────────────────────
-- `Inventory.RemoveItemFromGrid(grid, uid, quantité)` prend un UID, pas un
-- `item_id`. `CountItem(grid, "metal_rare")` dit qu'il y en a 12, mais ces 12
-- peuvent être répartis sur trois piles de uids différents. Consommer « 3 » veut
-- dire : localiser les piles dans l'ordre, les décrémenter une à une, s'arrêter
-- au compte. Une implémentation qui appelle Remove avec un item_id échoue EN
-- SILENCE : rien n'est retiré et la fabrication réussirait quand même. C'est
-- exactement ce que `Craft.Consommer` traite : on planifie les (uid, prise)
-- d'abord (lecture seule), puis on applique les retraits.
--
-- ── DÉCISIONS DE CONCEPTION (voir rapport du lot 4) ───────────────────────────
--   1. LA PLACE, AVANT LA CONSOMMATION. `Craft.Fabriquer` simule d'abord
--      l'ajout de la sortie sur la grille d'origine (`Inventory.AddItemToGrid`,
--      immuable) : s'il échoue, on rend `nil, "pas de place…"` SANS avoir rien
--      consommé. Une recette qui mange les entrées puis ne peut pas poser la
--      sortie détruirait du bien de joueur.
--   2. L'ATOMICITÉ PAR CONSTRUCTION. `Fabriquer` est UNE fonction qui rend UN
--      état final ou `nil` ; la grille intermédiaire n'est jamais rendue ni
--      écrite. `Consommer`/`Produire` restent exposés pour les cas simples mais
--      `Fabriquer` est le chemin officiel : une seule décision, un seul retour.
-- ═══════════════════════════════════════════════════════════════════════════════

local Craft = {}

local function requis(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require(fichier)
end
local Inventory = requis("Inventory", "Logic/Inventory.lua")
local Items = requis("Items", "Catalogs/Items.lua")
local Recettes = requis("Recettes", "Catalogs/Recettes.lua")

--- Recette par identifiant. nil si inconnue.
---@param id string
---@return table|nil recette
function Craft.Recette(id)
    if (id == nil) then return nil end
    return Recettes.RECETTES[id]
end

--- Liste ORDONNÉE des identifiants de recette (affichage).
---@return table
function Craft.Sequence()
    return Recettes.ORDRE
end

--- Peut-on fabriquer cette recette ?
--- RETOURS : ok, manquants, raison.
---   `manquants` est le livrable réel : la liste EXACTE
---   `{ item_id, requis, possede, manque }` pour chaque entrée insuffisante,
---   dans l'ordre des entrées de la recette. Liste vide = tout est là.
---   `raison` porte le bloquant non-entrée (station absente, palier, recette
---   invalide) quand il en existe un.
---@param recette table
---@param grille table NarvosGridState
---@param station string|nil
---@param niveau number
---@return boolean ok
---@return table manquants
---@return string|nil raison
function Craft.PeutFabriquer(recette, grille, station, niveau)
    if (recette == nil) then return false, {}, "recette inconnue" end
    if (grille == nil) then return false, {}, "grille invalide" end

    if (recette.station ~= nil and station ~= recette.station) then
        return false, {}, "station requise : " .. tostring(recette.station)
    end
    if ((niveau or 0) < recette.palier) then
        return false, {}, "palier de compétence " .. tostring(recette.palier) .. " requis"
    end

    local manquants = {}
    for _, entree in ipairs(recette.entrees) do
        if (type(entree.item_id) ~= "string" or type(entree.quantite) ~= "number"
            or entree.quantite < 1) then
            return false, {}, "entrée malformée dans la recette"
        end
        local possede = Inventory.CountItem(grille, entree.item_id)
        local manque = entree.quantite - possede
        if (manque > 0) then
            manquants[#manquants + 1] = {
                item_id = entree.item_id,
                requis = entree.quantite,
                possede = possede,
                manque = manque,
            }
        end
    end

    if (#manquants > 0) then return false, manquants, nil end
    return true, {}, nil
end

--- Consomme les entrées d'une recette dans la grille.
--- Retire EXACTEMENT la quantité demandée, pile par pile, dans l'ordre des
--- instances (stable). REND UNE NOUVELLE GRILLE ou `nil` ; jamais de mutation.
---@param grille table NarvosGridState
---@param recette table
---@return table|nil grille
---@return string|nil raison
function Craft.Consommer(grille, recette)
    if (grille == nil or recette == nil or type(recette.entrees) ~= "table") then
        return nil, "recette invalide"
    end

    -- PHASE 1 — SNAPSHOT, lecture seule de la grille : aucun retrait tant que
    -- tout n'est pas prouvé possible. Une entrée en trop = échec net, état intact.
    local plan = {}
    for _, entree in ipairs(recette.entrees) do
        local def = Inventory.GetItemDef(entree.item_id)
        if (def == nil) then return nil, "entrée inconnue : " .. tostring(entree.item_id) end

        local restant = entree.quantite
        for _, inst in ipairs(grille.instances) do
            if (restant > 0 and inst.itemId == entree.item_id) then
                local prise = math.min(restant, inst.quantity)
                plan[#plan + 1] = { uid = inst.uid, prise = prise }
                restant = restant - prise
            end
        end
        if (restant > 0) then
            return nil, "quantité insuffisante de " .. tostring(entree.item_id)
        end
    end

    -- PHASE 2 — APPLICATION : chaque retrait rend une grille NOUVELLE (immuable).
    local courante = grille
    for _, operation in ipairs(plan) do
        local suivante, retiree = Inventory.RemoveItemFromGrid(courante, operation.uid, operation.prise)
        if (retiree == nil) then
            -- uid introuvable : ne peut pas arriver depuis le snapshot, mais un
            -- garde vaut mieux qu'une grille corrompue retournée en silence.
            return nil, "instance introuvable : " .. tostring(operation.uid)
        end
        courante = suivante
    end

    return courante
end

--- Pose la sortie d'une recette dans la grille. REND UNE NOUVELLE GRILLE.
---@param grille table NarvosGridState
---@param recette table
---@return table|nil grille
---@return string|nil raison
function Craft.Produire(grille, recette)
    if (grille == nil or recette == nil or recette.sortie == nil) then
        return nil, "recette invalide"
    end
    local def = Inventory.GetItemDef(recette.sortie.item_id)
    if (def == nil) then return nil, "item de sortie inconnu : " .. tostring(recette.sortie.item_id) end
    local sortie = Inventory.AddItemToGrid(grille, def, recette.sortie.quantite)
    if (sortie == nil) then
        return nil, "pas de place pour " .. tostring(recette.sortie.item_id)
    end
    return sortie
end

--- Fabrique : UNE fonction, UNE grille finale ou `nil` (atomique).
---
--- ORDRE VÉRIFIÉ :
---   1. PeutFabriquer — entrées, station, palier ; échec → rien ne bouge.
---   2. SIMULATION de la place — AddItemToGrid sur la grille d'ORIGINE (immuable,
---      le retour est jeté) ; échec → « pas de place », RIEN n'a été consommé.
---   3. Consommer — les entrées disparaissent pile par pile (cf. piège des uid).
---   4. Produire — la sortie est posée sur la grille libérée.
--- L'état intermédiaire (grille de l'étape 3) n'est jamais rendu : si l'étape 4
--- échouait, on rend nil et l'appelant garde SA grille — la perte est impossible.
---@param grille table NarvosGridState
---@param recette table
---@param station string|nil
---@param niveau number
---@return table|nil grille
---@return string|nil raison
function Craft.Fabriquer(grille, recette, station, niveau)
    local ok, manquants, raison = Craft.PeutFabriquer(recette, grille, station, niveau)
    if (not ok) then
        if (raison == nil and #manquants > 0) then
            raison = "il manque " .. #manquants .. " entrée(s)"
        end
        return nil, raison
    end

    local def = Inventory.GetItemDef(recette.sortie.item_id)
    if (def == nil) then return nil, "item de sortie inconnu : " .. tostring(recette.sortie.item_id) end

    -- 2. place d'abord : la simulation sur la grille originale ne mute rien.
    local essai = Inventory.AddItemToGrid(grille, def, recette.sortie.quantite)
    if (essai == nil) then
        return nil, "pas de place pour " .. tostring(recette.sortie.item_id)
    end

    -- 3. consommation (nouvelle grille), 4. production sur la grille libérée.
    local apres_consommation, raison_conso = Craft.Consommer(grille, recette)
    if (apres_consommation == nil) then
        return nil, raison_conso or "consommation impossible"
    end

    local finale = Inventory.AddItemToGrid(apres_consommation, def, recette.sortie.quantite)
    if (finale == nil) then
        -- Ne peut pas arriver (la grille finale est moins occupée que l'essai),
        -- mais si c'était le cas : échec net, jamais de perte.
        return nil, "pas de place pour " .. tostring(recette.sortie.item_id)
    end

    return finale, nil
end

--- Vérifie la cohérence du catalogue de recettes contre `items` (le RÉEL).
--- Rend la liste des problèmes : sortie/entrée inconnue, quantités invalides,
--- entrées en double. Liste vide = cohérent. Ne lève jamais.
---@param items table|nil
---@return table problemes
function Craft.Verifier(items)
    local problemes = {}
    for i, id in ipairs(Recettes.ORDRE) do
        local recette = Recettes.RECETTES[id]
        if (recette == nil) then
            problemes[#problemes + 1] = id .. ": entrée absente de RECETTES"
        else
            if (recette.sortie == nil or type(recette.sortie.item_id) ~= "string"
                or type(recette.sortie.quantite) ~= "number" or recette.sortie.quantite < 1) then
                problemes[#problemes + 1] = id .. ": sortie invalide"
            elseif (items == nil or items[recette.sortie.item_id] == nil) then
                problemes[#problemes + 1] = id .. ": sortie inconnue " .. tostring(recette.sortie.item_id)
            end
            if (type(recette.entrees) ~= "table" or #recette.entrees == 0) then
                problemes[#problemes + 1] = id .. ": aucune entrée"
            else
                local vus = {}
                for _, entree in ipairs(recette.entrees) do
                    if (type(entree.item_id) ~= "string" or type(entree.quantite) ~= "number"
                        or entree.quantite < 1) then
                        problemes[#problemes + 1] = id .. ": entrée malformée"
                    elseif (vus[entree.item_id]) then
                        problemes[#problemes + 1] = id .. ": entrée dupliquée " .. tostring(entree.item_id)
                    else
                        vus[entree.item_id] = true
                        if (items == nil or items[entree.item_id] == nil) then
                            problemes[#problemes + 1] = id .. ": entrée inconnue " .. tostring(entree.item_id)
                        end
                    end
                end
            end
            if (type(recette.palier) ~= "number" or recette.palier < 1) then
                problemes[#problemes + 1] = id .. ": palier invalide"
            end
            if (type(recette.duree_ms) ~= "number" or recette.duree_ms <= 0) then
                problemes[#problemes + 1] = id .. ": duree_ms invalide"
            end
        end
    end
    return problemes
end

return Craft
