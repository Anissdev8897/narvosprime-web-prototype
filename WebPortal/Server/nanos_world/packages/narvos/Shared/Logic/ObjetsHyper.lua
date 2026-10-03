-- ══════════════════════════════════════════════════════════════════════════════
-- Logic/ObjetsHyper.lua — verser les donnees de Hyper Inventory V2 dans NOS
-- catalogues d'objets et de recettes.
--
-- Câblage : Narvos.ObjetsHyperLogique = Package.Require("Logic/ObjetsHyper.lua")
--           puis Narvos.ObjetsHyperLogique.Integrer() dans Shared/Index.lua,
--           APRES Items, Recettes et Catalogs/ObjetsHyper.lua.
--
-- ── POURQUOI UN MODULE, ET PAS UNE EDITION DES CATALOGUES ─────────────────────
-- `Items.lua` et `Recettes.lua` sont GENERES depuis le prototype web ; y ecrire
-- 210 objets serait efface au prochain `--apply`. `ObjetsHyper.lua` est genere
-- depuis le pack. Ce module les RELIE au chargement, comme
-- `Logic/ArmesInventaire.lua` relie les armes au sac : on itere, on ne recopie
-- pas.
--
-- ── LES DEUX REGLES QUI COMPTENT ──────────────────────────────────────────────
-- 1. JAMAIS D'ECRASEMENT. Un objet ou une recette deja present dans nos
--    catalogues l'emporte : ce qui a ete regle a la main pour NARVOS ne doit pas
--    etre remplace par la valeur d'un pack.
-- 2. UNE RECETTE N'ENTRE QUE SI TOUT CE QU'ELLE NOMME EXISTE. Une recette dont un
--    ingredient manque au catalogue apparaitrait au joueur et resterait a jamais
--    infaisable — une promesse que le jeu ne tient pas.
-- ══════════════════════════════════════════════════════════════════════════════

local ObjetsHyperLogique = {}

-- ── ADAPTER LES CHAMPS D'UN PACK (2026-09-19) ─────────────────────────────────
-- Les catalogues exportés des packs parlent `poids`/`prix`/`categories`, notre
-- inventaire lit `weight`/`value`/`category`/`stats`/`useEffect`. Sans
-- adaptation, un objet du pack pèse 0 et se vend 0 — un sac sans encombrement,
-- une économie trouée, des potions inertes que la roue refuse. On complète,
-- JAMAIS on n'écrase : un champ déjà posé (à la main pour NARVOS, ou par un
-- pack intégré plus tôt) garde sa valeur.

--- Icône d'inventaire par type, quand le pack n'en fournit pas.
local ICONE_PAR_TYPE = {
    weapon = "⚔️", armor = "🛡️", accessory = "💍", ammo = "🎯",
    consumable = "🧪", material = "🧱", tool = "🔧", quest = "📜", vehicle = "🚗",
}

--- Onglet NARVOS par type (`InventaireVue.ONGLET_PAR_CATEGORIE`).
local CATEGORIE_PAR_TYPE = {
    weapon = "equipment", armor = "equipment", accessory = "equipment",
    consumable = "consumable", ammo = "ammo", material = "material",
    tool = "equipment", quest = "quest", vehicle = "equipment",
}

---@param entree table  entrée d'un pack (ObjetsHyper.OBJETS, ObjetsIsp.OBJETS)
---@return table  COPIE complétée — jamais la table d'origine (règle 1).
function ObjetsHyperLogique.Adapter(entree)
    local def = {}
    for k, v in pairs(entree) do def[k] = v end

    -- Champs du pack -> champs que l'inventaire lit.
    if (def.weight == nil and type(def.poids) == "number") then def.weight = def.poids end
    if (def.value == nil and type(def.prix) == "number") then def.value = def.prix end
    if (def.category == nil and def.type ~= nil) then def.category = CATEGORIE_PAR_TYPE[def.type] end
    if (def.icon == nil and def.type ~= nil) then def.icon = ICONE_PAR_TYPE[def.type] end

    -- Stats : une arme sans dégâts frappe à la valeur de base du combat
    -- (`Combat.BASE_INCONNUE.attackPower = 10`). Le pack ne fournit que le
    -- prix : c'est le proxy de puissance interne — même idée que le générateur
    -- de loot procédural, qui déduit la force du niveau et de la rareté.
    if (type(def.stats) ~= "table") then def.stats = {} end
    local prix = tonumber(def.value) or tonumber(def.prix) or 0
    if (def.type == "weapon" and (def.stats.attackPower or 0) <= 0) then
        def.stats.attackPower = math.max(3, math.floor(prix / 45))
        def.stats.critique = math.floor(prix / 500)
    elseif ((def.type == "armor" or def.type == "helmet" or def.type == "boots")
        and (def.stats.defense or 0) <= 0) then
        def.stats.defense = math.max(2, math.floor(prix / 50))
    end

    -- Consommable sans effet : la roue le refuse (« n'a aucun effet
    -- d'utilisation ») — une potion du pack serait inerte. On déduit l'effet
    -- du libellé (schéma `useEffect` NARVOS : { heal/mana, description }).
    if (def.type == "consumable" and def.useEffect == nil) then
        local nom = string.lower(def.label or "")
        local effet = {}
        if (nom:match("health") or nom:match("soin") or nom:match("herb")
            or nom:match("antidote") or nom:match("med") or nom:match("bandage")
            or nom:match("painkiller") or nom:match("potion") and not nom:match("mana") and not nom:match("energy")) then
            effet.heal = math.max(2, math.floor(prix * 0.6))
        elseif (nom:match("mana") or nom:match("magic") or nom:match("energy")) then
            effet.mana = math.max(2, math.floor(prix * 0.6))
        else
            -- Nourriture et divers : petit regain — mieux qu'un objet inerte.
            effet.heal = math.max(1, math.floor(prix * 0.2))
        end
        if (effet.heal) then effet.description = "Restaure " .. effet.heal .. " PV" end
        if (effet.mana) then effet.description = "Restaure " .. effet.mana .. " Mana" end
        def.useEffect = effet
    end

    return def
end

--- Ajoute les objets du pack a un catalogue d'objets. Rend (ajoutes, deja).
--- Chaque entrée AJOUTÉE passe par `Adapter` : l'original du pack n'est jamais
--- référencé tel quel, donc jamais muté.
---@param items table   Items.ITEM_DB
---@param objets table  ObjetsHyper.OBJETS
---@return number, number
function ObjetsHyperLogique.IntegrerObjets(items, objets)
    if (type(items) ~= "table" or type(objets) ~= "table") then return 0, 0 end
    local ajoutes, deja = 0, 0
    -- Tri des cles : l'ordre d'integration doit etre le meme a chaque demarrage,
    -- sinon deux serveurs ne declareraient pas les objets dans le meme ordre.
    local ids = {}
    for id in pairs(objets) do ids[#ids + 1] = id end
    table.sort(ids)
    for _, id in ipairs(ids) do
        if (items[id] ~= nil) then
            deja = deja + 1
        else
            items[id] = ObjetsHyperLogique.Adapter(objets[id])
            ajoutes = ajoutes + 1
        end
    end
    return ajoutes, deja
end

--- Une recette est-elle entierement realisable avec ce catalogue d'objets ?
---@param recette table
---@param items table
---@return boolean, string|nil
function ObjetsHyperLogique.RecetteComplete(recette, items)
    if (type(recette) ~= "table" or type(items) ~= "table") then return false, "entree invalide" end
    local sortie = recette.sortie and recette.sortie.item_id
    if (not sortie or items[sortie] == nil) then
        return false, "objet produit absent : " .. tostring(sortie)
    end
    for _, e in ipairs(recette.entrees or {}) do
        if (items[e.item_id] == nil) then
            return false, "ingredient absent : " .. tostring(e.item_id)
        end
    end
    if (#(recette.entrees or {}) == 0) then return false, "recette sans ingredient" end
    return true, nil
end

--- Ajoute les recettes du pack. Rend (ajoutees, deja, refusees).
---
--- ⚠ `ORDRE` EST ETENDU, PAS SEULEMENT `RECETTES`. `Craft.Sequence()` rend
--- `Recettes.ORDRE` a l'interface : une recette presente dans la table mais pas
--- dans l'ordre existerait cote serveur et n'apparaitrait JAMAIS a l'ecran.
---@param recettes table  Recettes (le module : .RECETTES et .ORDRE)
---@param hyper table     ObjetsHyper (le module : .RECETTES et .ORDRE_RECETTES)
---@param items table     Items.ITEM_DB, deja complete des objets du pack
---@return number, number, number
function ObjetsHyperLogique.IntegrerRecettes(recettes, hyper, items)
    if (type(recettes) ~= "table" or type(recettes.RECETTES) ~= "table") then return 0, 0, 0 end
    if (type(hyper) ~= "table" or type(hyper.RECETTES) ~= "table") then return 0, 0, 0 end
    recettes.ORDRE = recettes.ORDRE or {}

    local ajoutees, deja, refusees = 0, 0, 0
    for _, id in ipairs(hyper.ORDRE_RECETTES or {}) do
        local r = hyper.RECETTES[id]
        if (recettes.RECETTES[id] ~= nil) then
            deja = deja + 1
        elseif (r and ObjetsHyperLogique.RecetteComplete(r, items)) then
            -- ⚠ RECETTE SANS STATION (2026-09-19) : 21 recettes du pack sont
            -- craftables « à la main » (bandage, planche, lance…). Notre craft
            -- exige une station pour exécuter — `Craft.PeutFabriquer` tolère
            -- `station == nil` et laisserait donc cuire un bandage à la forge.
            -- On les assigne à l'ÉTABLI (workbench), la station à tout faire.
            -- Copie profonde : le catalogue du pack n'est jamais muté.
            if (r.station == nil) then
                local copie = { id = r.id, label = r.label, palier = r.palier,
                    duree_ms = r.duree_ms, station = "workbench" }
                copie.entrees = {}
                for i, e in ipairs(r.entrees or {}) do
                    copie.entrees[i] = { item_id = e.item_id, quantite = e.quantite }
                end
                copie.sortie = { item_id = r.sortie.item_id, quantite = r.sortie.quantite }
                r = copie
            end
            recettes.RECETTES[id] = r
            recettes.ORDRE[#recettes.ORDRE + 1] = id
            ajoutees = ajoutees + 1
        else
            refusees = refusees + 1
        end
    end
    return ajoutees, deja, refusees
end

--- Verse UN pack de donnees au format d'ObjetsHyper (OBJETS, RECETTES,
--- ORDRE_RECETTES). Rend un bilan pour le journal.
---
--- ⚠ UNE SEULE REGLE POUR TOUS LES PACKS. InventorySystemPro (2026-09-13) passe
--- par ici, pas par une copie de ce module : deux integrations divergeraient a la
--- premiere retouche — sans ecrasement ici, avec ecrasement la-bas.
---@param pack table|nil  le module genere (Catalogs/ObjetsHyper.lua, Catalogs/ObjetsIsp.lua)
---@return table
function ObjetsHyperLogique.IntegrerPack(pack)
    local N = Narvos
    if (not (N and N.Items and N.Recettes) or type(pack) ~= "table") then
        return { erreur = "catalogues absents" }
    end
    local oa, od = ObjetsHyperLogique.IntegrerObjets(N.Items.ITEM_DB, pack.OBJETS)
    local ra, rd, rr = ObjetsHyperLogique.IntegrerRecettes(N.Recettes, pack, N.Items.ITEM_DB)
    return { objets = oa, objets_deja = od, recettes = ra, recettes_deja = rd, recettes_refusees = rr }
end

--- Hyper Inventory V2. Rend un bilan pour le journal.
---@return table
function ObjetsHyperLogique.Integrer()
    return ObjetsHyperLogique.IntegrerPack(Narvos and Narvos.ObjetsHyper)
end

return ObjetsHyperLogique
