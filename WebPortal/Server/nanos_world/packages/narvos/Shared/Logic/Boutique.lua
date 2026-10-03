-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Boutique.lua — achat et vente chez un marchand.
--
-- Câblage : Narvos.Boutique = Package.Require("Logic/Boutique.lua") dans
-- Shared/Index.lua, APRÈS Narvos.Inventory (capturé au chargement, avec repli).
--
-- ── PUR ET PROUVABLE ─────────────────────────────────────────────────────────
-- Aucun appel API nanos. La bourse (crédits) et le sac (grille) ENTRENT EN
-- PARAMÈTRE ; le module rend le couple NEUF (grille, solde) ou nil + raison.
-- C'est l'exécutant serveur (narvos-map-proto/Server/Index.lua) qui relit la
-- session, persiste, et annonce — comme pour Craft et Recolte.
--
-- ── RÈGLE : IMMUABLE, ET D'ABORD RIEN NE BOUGE ────────────────────────────────
-- `Inventory.AddItemToGrid` rend une NOUVELLE grille ; la bourse n'est jamais
-- débitée avant que la livraison soit certaine. Un achat refusé (solde
-- insuffisant, sac plein, objet inconnu) laisse les DEUX entrées intactes —
-- c'est ce que prouve scripts/lua-harness/boutique-tests.lua.
--
-- ── CE QUE LE CATALOGUE NE DONNE PAS ──────────────────────────────────────────
-- `Catalogs/Merchants.lua` porte `stock` (identifiants) et `buyFactor`
-- (proportion du prix que le marchand VERSE au joueur qui revend). Il ne porte
-- aucun prix de vente : le prix payé par le joueur est le `value` de l'objet,
-- lu dans `Catalogs/Items.lua`. Une entrée de stock qui ne résout pas dans
-- ITEM_DB est ÉCARTÉE et comptée, jamais devinée — mesuré le 2026-09-08 : 74
-- références de stock sont mortes (`cat_*`, `key_*`, quelques isolées), elles
-- attendent que le catalogue d'objets les connaisse.
--
-- ── LES « part: » NE PASSENT PAS PAR ICI ──────────────────────────────────────
-- Les entrées `part:…` du stock (mer_equipement, 231 références) désignent des
-- pièces de tenue modulaire : elles se vendent par `Vestiaire.Acheter`, qui
-- écrit la garde-robe, pas le sac. Les mélanger livrerait une pièce d'armure
-- dans la grille d'inventaire, où elle ne sert à rien.
-- ═══════════════════════════════════════════════════════════════════════════════

local Boutique = {}

local function requis(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require(fichier)
end
local Inventory = requis("Inventory", "Logic/Inventory.lua")

-- ── Prix ──────────────────────────────────────────────────────────────────────

--- Prix payé par le joueur pour UNE unité. Le catalogue n'a pas de prix de
--- vente propre : `value` fait foi. Un objet sans `value` ne se vend pas.
---@param def table|nil
---@return integer|nil
function Boutique.PrixVente(def)
    local v = def and tonumber(def.value) or nil
    if (not v or v <= 0) then return nil end
    return math.max(1, math.floor(v))
end

--- Ce que le marchand VERSE au joueur qui revend une unité.
--- `buyFactor` absent ou hors ]0, 1] est refusé : racheter à 0 % est du vol,
--- racheter à plus de 100 % est une fontaine à crédits.
---@param marchand table
---@param def table|nil
---@return integer|nil
function Boutique.PrixRachat(marchand, def)
    local v = def and tonumber(def.value) or nil
    local f = marchand and tonumber(marchand.buyFactor) or nil
    if (not v or v <= 0 or not f or f <= 0 or f > 1) then return nil end
    return math.max(1, math.floor(v * f))
end

--- L'entrée de stock est-elle vendable ICI ? Rend la définition ou nil + raison.
---@param item_id any
---@return table|nil def, string|nil raison
local function ResoudreStock(item_id)
    if (type(item_id) ~= "string" or item_id == "") then return nil, "reference vide" end
    if (item_id:sub(1, 5) == "part:") then return nil, "piece de tenue : voir le tailleur" end
    local def = Inventory.GetItemDef(item_id)
    if (not def) then return nil, "objet inconnu du catalogue" end
    if (not Boutique.PrixVente(def)) then return nil, "objet sans valeur" end
    return def, nil
end

--- Le stock d'un marchand, résolu contre le catalogue d'objets.
--- Rend la liste des entrées vendables { id, def, prix } et le nombre d'entrées
--- écartées. Un marchand dont TOUT le stock est écarté rend une liste vide :
--- c'est une information de jeu, pas une erreur.
---@param marchand table|nil
---@return table liste, integer ecartes
function Boutique.Stock(marchand)
    local liste, ecartes = {}, 0
    if (type(marchand) ~= "table" or type(marchand.stock) ~= "table") then
        return liste, ecartes
    end
    for _, item_id in ipairs(marchand.stock) do
        local def = ResoudreStock(item_id)
        if (def) then
            liste[#liste + 1] = { id = item_id, def = def, prix = Boutique.PrixVente(def) }
        else
            ecartes = ecartes + 1
        end
    end
    return liste, ecartes
end

--- Vrai si le stock ne contient QUE des pièces de tenue.
---
--- ── POURQUOI UN PRÉDICAT DE FORME, ET PAS UN IDENTIFIANT EN DUR ──────────────
--- Vasska (`mer_equipement`) est aujourd'hui le seul équipementier. Écrire son
--- id ici marcherait, et cesserait de marcher au deuxième — sans rien dire.
--- La règle du dépôt : filtrer sur la FORME du défaut, pas sur le LIEU du
--- premier incident.
---
--- ── CE QUE ÇA RÉPARE ─────────────────────────────────────────────────────────
--- Le stock de Vasska est GÉNÉRÉ depuis `npc/merchants.ts` par
--- `modularGearIds()`, qui lit le catalogue modulaire du runtime WEB
--- (`part:m_jacket_a`…). Le catalogue nanos, lui, nomme ses pièces
--- `aviator_chest_f`, `body_chest_m` : ce sont deux systèmes différents, et les
--- 231 entrées ne résolvent nulle part. Mesuré le 2026-09-09 :
--- **0 article vendable, 231 écartés.** La boutique s'ouvrait vide, sans erreur
--- ni log — ça se lit comme un marchand qu'on a oublié de remplir.
---
--- On ne réécrit pas le TS : il sert le runtime web, qui a ses propres pièces.
--- On reconnaît l'équipementier à son stock et on l'envoie au TAILLEUR, qui lit
--- `Modular.PIECES` — le catalogue que nanos sait réellement afficher, filtré
--- par la morphologie du joueur. Une pièce ajoutée au catalogue est en vente le
--- jour même, sans toucher à ce fichier.
---@param marchand table
---@return boolean
function Boutique.EstEquipementier(marchand)
    if (type(marchand) ~= "table" or type(marchand.stock) ~= "table") then return false end
    if (#marchand.stock == 0) then return false end
    for _, item_id in ipairs(marchand.stock) do
        if (type(item_id) ~= "string" or item_id:sub(1, 5) ~= "part:") then return false end
    end
    return true
end

--- L'objet fait-il partie du stock du marchand ?
---@param marchand table
---@param item_id any
---@return boolean
local function EnStock(marchand, item_id)
    for _, s in ipairs(marchand.stock or {}) do
        if (s == item_id) then return true end
    end
    return false
end

-- ── Achat ─────────────────────────────────────────────────────────────────────

--- Achète `quantite` × `item_id` chez `marchand`.
---
--- Ordre des refus : la forme de l'appel, le marchand, l'objet, le solde, la
--- place. LE SOLDE EST VÉRIFIÉ AVANT LA GRILLE et l'objet livré avant tout
--- débit : soit tout se passe, soit rien ne se passe.
---@param marchand table|nil   entrée de Merchants.MERCHANTS
---@param grille table|nil     grille de Narvos.Inventory
---@param credits any          solde actuel
---@param item_id any
---@param quantite any         défaut 1
---@return table|nil grille_neuve, integer|string solde_ou_raison
function Boutique.Acheter(marchand, grille, credits, item_id, quantite)
    if (type(marchand) ~= "table") then return nil, "marchand inconnu" end
    if (type(grille) ~= "table") then return nil, "pas de sac" end

    local q = math.floor(tonumber(quantite) or 1)
    if (q < 1) then return nil, "quantite invalide" end

    if (not EnStock(marchand, item_id)) then
        return nil, "pas en vente ici"
    end
    local def, raison = ResoudreStock(item_id)
    if (not def) then return nil, raison end

    local total = Boutique.PrixVente(def) * q
    local solde = tonumber(credits) or 0
    if (solde < total) then
        return nil, ("credits insuffisants (%d / %d)"):format(math.floor(solde), total)
    end

    -- La livraison d'abord : si la grille ne peut pas prendre l'objet, le
    -- joueur garde son solde. L'inverse lui prendrait ses crédits sans rien
    -- lui remettre.
    local nouvelle = Inventory.AddItemToGrid(grille, def, q)
    if (not nouvelle) then return nil, "sac plein" end

    return nouvelle, math.floor(solde) - total
end

-- ── Vente (rachat par le marchand) ────────────────────────────────────────────

--- Vend `quantite` × `item_id` au `marchand`. Contrairement à l'achat, n'importe
--- quel objet ayant une valeur est repris — le `buyFactor` du marchand décide
--- du taux, pas son stock (Drog : « je rachète tout aussi »).
---@param marchand table|nil
---@param grille table|nil
---@param credits any
---@param item_id any
---@param quantite any  défaut 1
---@return table|nil grille_neuve, integer|string solde_ou_raison
function Boutique.Vendre(marchand, grille, credits, item_id, quantite)
    if (type(marchand) ~= "table") then return nil, "marchand inconnu" end
    if (type(grille) ~= "table") then return nil, "pas de sac" end

    local q = math.floor(tonumber(quantite) or 1)
    if (q < 1) then return nil, "quantite invalide" end

    if (type(item_id) ~= "string" or item_id:sub(1, 5) == "part:") then
        return nil, "le marchand ne reprend pas ca"
    end
    local def = Inventory.GetItemDef(item_id)
    local unite = Boutique.PrixRachat(marchand, def)
    if (not unite) then return nil, "sans valeur de rachat" end

    -- Tout ou rien : on compte AVANT de retirer. Un retrait partiel laisserait
    -- croire à une vente complète.
    if (Inventory.CountItem(grille, item_id) < q) then
        return nil, "quantite insuffisante dans le sac"
    end

    local courante = grille
    local retires = 0
    while (retires < q) do
        -- On retire pile par pile : RemoveItemFromGrid vise une instance par
        -- son uid, pas un type d'objet.
        local cible = nil
        for _, inst in ipairs(courante.instances or {}) do
            if (inst.itemId == item_id) then cible = inst break end
        end
        if (not cible) then return nil, "sac incoherent" end
        local lot = math.min(q - retires, cible.quantity or 1)
        local suivante = Inventory.RemoveItemFromGrid(courante, cible.uid, lot)
        courante = suivante
        retires = retires + lot
    end

    return courante, math.floor(tonumber(credits) or 0) + unite * q
end

return Boutique
