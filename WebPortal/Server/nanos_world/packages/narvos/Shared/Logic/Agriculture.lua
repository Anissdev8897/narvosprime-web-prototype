-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Agriculture.lua — le cycle complet : parcelle → graine → croissance →
-- récolte, avec pourrissement, qualité et repousse.
--
-- Câblage : Narvos.Agriculture = Package.Require("Logic/Agriculture.lua") dans
-- Shared/Index.lua.
--
-- ── SOURCE DE LA SPÉCIFICATION ────────────────────────────────────────────────
-- Hyper Inventory V2 (pack déjà chez nous, `mixte_epoques`) : BP_Farming_Master,
-- BP_BigFarmingPlot, et surtout `FarmingSystem/Datamodel/Struct_Plant.uasset`,
-- dont les valeurs par défaut sont lisibles sur disque (mesuré le 2026-09-10) :
--   · croissance : Start_Scale 0.1 → End_Scale 1.0, Growth_Time_to_Mature,
--     stades par « requiredgrowthpercentage », mesh par stade ;
--   · récolte : Amounttospawn (4 par défaut), outil exigé ou non ;
--   · qualité : bronze 60 % / argent 35 % / or 5 %, facteurs ×1.00 / ×1.25 / ×1.50 ;
--   · besoins : eau (croissance EN PAUSE si non rempli), oxygène, UV, engrais ;
--   · pourrissement : Decay after maturity + Time before Decayed ;
--   · repousse : Regrow_time après récolte.
-- ⚠ La table du pack (DT_Farmables, 2 310 octets) est VIDE : aucune durée, aucun
-- rendement n'est mesuré par espèce. Les durées ci-dessous sont des choix de JEU
-- NARVOS, pas des valeurs du pack — elles sont dans la DONNÉE, pas dans la
-- logique, précisément pour être retouchées sans risque.
--
-- ── AUCUN STADE DE CROISSANCE N'EXISTE EN MESH ────────────────────────────────
-- Établi par les audits LOT1/LOT2 : aucun pack n'a de graine→pousse→mature.
-- ⚠ QUESTION OUVERTE, tranchée par le patron À L'IMPORT (une bbox à lire) :
-- `SM_Prop_Hydroponic_Plant_01/02/03` sont-ils 3 ESPÈCES ou 3 TAILLES ?
-- La donnée accepte les DEUX mappings sans changer la logique (MeshPour) :
--   · 3 tailles  → `Agriculture.MESHES_PAR_STADE` (mapping partagé stade → clé) ;
--   · 3 espèces  → `mesh_espece` sur chaque graine (une clé fixe par espèce,
--                  la taille venant de `Echelle`).
-- Aujourd'hui AUCUN asset n'est nommé : toutes les clés sont vides, ce qui veut
-- dire « pas de visuel, pas de crash » — jamais une référence morte silencieuse.
--
-- ── TEMPS ET TIRAGES ──────────────────────────────────────────────────────────
-- Ce module ne connaît ni l'horloge ni les dés : `maintenant` entre en paramètre
-- (le timer serveur appellera TickParcelle), et le TIRAGE de qualité aussi —
-- « le serveur tire, le client reçoit ».
--
-- ── PERSISTANCE ───────────────────────────────────────────────────────────────
-- Par joueur et par parcelle, en base — même discipline que Roue/Roster :
-- `UtiliserBase`, SQL par la connexion de Comptes (table `parcelles`, créée dans
-- Comptes.Ouvrir), et le `WHERE proprietaire_id` n'est jamais décoratif : sans
-- lui, un client récolterait le champ d'un autre.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosAgriculture
local Agriculture = {}

local db = nil

-- ── Stades ────────────────────────────────────────────────────────────────────
-- L'ORDRE EST LA PROGRESSION : graine → pousse → mature → pourri. « pourri »
-- n'est atteint que si l'espèce pourrit (voir GRAINES).
Agriculture.STADES = { "graine", "pousse", "mature", "pourri" }

-- ── Qualité — les valeurs de la SPÉCIFICATION (Struct_Plant, mesurées) ───────
-- Les chances sont lues de HAUT en BAS : un tirage sous la chance d'or est
-- d'or, sous or+argent est d'argent, sinon bronze. La somme vaut 1 ; si elle
-- devenait inférieure, le reste tomberait en bronze — jamais dans le vide.
Agriculture.QUALITES = {
    ["or"]     = { chance = 0.05, facteur = 1.50 },
    ["argent"] = { chance = 0.35, facteur = 1.25 },
    ["bronze"] = { chance = 0.60, facteur = 1.00 },
}

-- ── Configuration serveur ─────────────────────────────────────────────────────
local config = {
    -- Combien de temps un arrosage tient, en secondes. Passé ce délai, la
    -- parcelle n'est plus arrosée et sa croissance se met EN PAUSE (la spec :
    -- « If requirement not met, pause growing rate »).
    duree_arrosage = 300.0,
}

local CLES_CONFIG = { "duree_arrosage" }

---@param options table
---@return boolean, string|nil
function Agriculture.Configurer(options)
    if (type(options) ~= "table") then return false, "options attendues" end
    for k, v in pairs(options) do
        local connue = false
        for _, c in ipairs(CLES_CONFIG) do
            if (c == k) then connue = true break end
        end
        if (not connue) then return false, "option inconnue : " .. tostring(k) end
        if (k == "duree_arrosage" and (tonumber(v) == nil or tonumber(v) <= 0)) then
            return false, "duree_arrosage positive attendue"
        end
        config[k] = v
    end
    return true, nil
end

-- ── Le mapping visuel partagé — l'issue « 3 TAILLES » ────────────────────────
-- Vide aujourd'hui, et c'est voulu : aucun asset n'est cuit. Si le patron
-- tranche « tailles » à l'import, ce tableau reçoit { graine = clé, pousse =
-- clé, mature = clé } UNE fois, et toutes les espèces en héritent.
Agriculture.MESHES_PAR_STADE = {}

-- ── Les huit espèces — la DONNÉE, pas la logique ─────────────────────────────
--
-- Les espèces sont mesurées dans le pack (DT_Items d'Hyper Inventory V2) :
-- les 4 baies/aloe ont un mesh de GRAINE dédié (SM_Seeds_Aloe_Vera,
-- SM_Seeds_Blackberry, SM_Seeds_Blueberry, SM_Seeds_Redberry), les 4 cultures
-- ont leur mesh de produit (SM_tomato_Cluster, SM_potato_Cluster, SM_Cabbage,
-- SM_Corn_OpenLeaf). Les identifiants `graine_item` / `produit_item` sont des
-- identifiants de JEU (futurs objets d'inventaire), pas des assets.
--
-- Champs d'une espèce :
--   duree_graine / duree_pousse — secondes de croissance EFFECTIVE (arrosée) ;
--       la maturité vaut leur somme.
--   pourrit        — secondes entre maturité et pourrissement, ou `false`
--                    (jamais). ⚠ PAS nil : un champ à nil DISPARAIT d'une
--                    table Lua, et « jamais » deviendrait indistinguable
--                    d'« oublié ».
--   rendement      — items de base à la récolte (4 = défaut de la spec).
--   repousse       — la plante survit-elle à la récolte ? (spec Regrow_time)
--   temps_repousse — secondes de croissance à refaire après une récolte.
--   besoin_eau     — croissance en pause sans arrosage (spec : vrai).
--   meshes_par_stade / mesh_espece — vides ; voir l'en-tête pour les deux issues.
Agriculture.GRAINES = {
    tomate = {
        id = "tomate", nom = "Tomate",
        graine_item = "graine_tomate", produit_item = "tomate",
        duree_graine = 90, duree_pousse = 180, pourrit = 240,
        rendement = 4, repousse = true, temps_repousse = 90,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
    pomme_de_terre = {
        id = "pomme_de_terre", nom = "Pomme de terre",
        graine_item = "graine_pomme_de_terre", produit_item = "pomme_de_terre",
        duree_graine = 120, duree_pousse = 240, pourrit = 300,
        rendement = 5, repousse = false, temps_repousse = 0,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
    chou = {
        id = "chou", nom = "Chou",
        graine_item = "graine_chou", produit_item = "chou",
        duree_graine = 120, duree_pousse = 300, pourrit = 300,
        rendement = 2, repousse = false, temps_repousse = 0,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
    mais = {
        id = "mais", nom = "Maïs",
        graine_item = "graine_mais", produit_item = "mais",
        duree_graine = 150, duree_pousse = 300, pourrit = 360,
        rendement = 3, repousse = false, temps_repousse = 0,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
    aloe_vera = {
        id = "aloe_vera", nom = "Aloé vera",
        graine_item = "graine_aloe_vera", produit_item = "aloe_vera",
        duree_graine = 100, duree_pousse = 200, pourrit = false,
        rendement = 2, repousse = true, temps_repousse = 120,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
    mure = {
        id = "mure", nom = "Mûre",
        graine_item = "graine_mure", produit_item = "mure",
        duree_graine = 60, duree_pousse = 120, pourrit = 180,
        rendement = 4, repousse = true, temps_repousse = 90,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
    myrtille = {
        id = "myrtille", nom = "Myrtille",
        graine_item = "graine_myrtille", produit_item = "myrtille",
        duree_graine = 60, duree_pousse = 120, pourrit = 180,
        rendement = 4, repousse = true, temps_repousse = 90,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
    baie_rouge = {
        id = "baie_rouge", nom = "Baie rouge",
        graine_item = "graine_baie_rouge", produit_item = "baie_rouge",
        duree_graine = 60, duree_pousse = 120, pourrit = 180,
        rendement = 4, repousse = true, temps_repousse = 90,
        besoin_eau = true,
        meshes_par_stade = {}, mesh_espece = "",
    },
}

-- Ordre figé pour toute itération (pairs n'en garantit aucun) — construit à
-- partir de GRAINES, jamais recopié.
Agriculture.GRAINES_ORDER = {}
for id in pairs(Agriculture.GRAINES) do
    Agriculture.GRAINES_ORDER[#Agriculture.GRAINES_ORDER + 1] = id
end
table.sort(Agriculture.GRAINES_ORDER)

-- ── Base ──────────────────────────────────────────────────────────────────────

--- Injecte la base. Appelé par Server/Index.lua après Comptes.Ouvrir,
--- sur la MÊME connexion — voir Comptes.Base().
---@param instance any
function Agriculture.UtiliserBase(instance)
    db = instance
end

function Agriculture.Prete()
    return db ~= nil
end

-- ── Données : lectures et garde-fous ──────────────────────────────────────────

--- La définition d'une graine, ou nil.
---@param graine_id any
---@return table|nil
function Agriculture.Graine(graine_id)
    if (type(graine_id) ~= "string") then return nil end
    return Agriculture.GRAINES[graine_id]
end

--- Secondes de croissance effective pour atteindre la maturité.
---@param def table
---@return number
function Agriculture.TempsMaturite(def)
    return def.duree_graine + def.duree_pousse
end

--- Vérifie la cohérence de CHAQUE espèce. Les harnais l'appellent : une donnée
--- fausse doit tomber au test, pas en jeu.
--- Rend true, ou false + la raison nommant l'espèce et le champ.
---@return boolean, string|nil
function Agriculture.VerifierDonnees()
    if (#Agriculture.GRAINES_ORDER ~= 8) then
        return false, "la mission annonce 8 espèces, la table en porte "
            .. #Agriculture.GRAINES_ORDER
    end
    for _, id in ipairs(Agriculture.GRAINES_ORDER) do
        local def = Agriculture.GRAINES[id]
        if (type(def.duree_graine) ~= "number" or def.duree_graine <= 0) then
            return false, id .. " : duree_graine positive attendue"
        end
        if (type(def.duree_pousse) ~= "number" or def.duree_pousse <= 0) then
            return false, id .. " : duree_pousse positive attendue"
        end
        if (def.pourrit ~= false and (type(def.pourrit) ~= "number" or def.pourrit <= 0)) then
            return false, id .. " : pourrit doit etre false ou un nombre positif"
        end
        if (type(def.rendement) ~= "number" or def.rendement < 1) then
            return false, id .. " : rendement >= 1 attendu"
        end
        if (def.repousse and def.temps_repousse > def.duree_pousse) then
            -- Sinon la récolte ferait reculer la plante AVANT le stade pousse,
            -- ce que « repousse » ne veut pas dire.
            return false, id .. " : temps_repousse depasse duree_pousse"
        end
        if (type(def.graine_item) ~= "string" or def.graine_item == ""
            or type(def.produit_item) ~= "string" or def.produit_item == "") then
            return false, id .. " : identifiants d'objets requis"
        end
    end
    -- Les chances de qualité ne doivent pas dépasser 1 : au-delà, une part du
    -- tirage ne désignerait rien.
    local total = 0
    for _, q in pairs(Agriculture.QUALITES) do total = total + q.chance end
    if (total > 1) then return false, "les chances de qualité dépassent 1" end
    return true, nil
end

-- ── Cycle de vie — PUR : un enregistrement de parcelle entre, un neuf sort ────
--
-- Un enregistrement : { proprietaire, parcelle_id, graine_id, plantee_le,
-- croissance, arrose_le, vu_le }. `croissance` sont des secondes de croissance
-- EFFECTIVE : elles ne s'accumulent que pendant que la parcelle est arrosée
-- (ou que l'espèce n'a pas besoin d'eau). `vu_le` est l'instant du dernier Tick.

--- La parcelle est-elle arrosée à cet instant ? Une espèce sans besoin d'eau
--- est toujours considérée arrosée.
---@param parcelle table
---@param maintenant any
---@return boolean
function Agriculture.Arrosee(parcelle, maintenant)
    local def = Agriculture.Graine(parcelle.graine_id)
    if (not def) then return false end
    if (def.besoin_eau == false) then return true end
    local t = tonumber(maintenant)
    if (not t or parcelle.arrose_le == nil) then return false end
    return (t - parcelle.arrose_le) <= config.duree_arrosage
end

--- Plafond de croissance : maturité + pourrissement quand l'espèce pourrit,
--- maturité sinon — au-delà, accumuler ne sert à rien.
local function plafond(def)
    local maturite = Agriculture.TempsMaturite(def)
    if (def.pourrit == false) then return maturite end
    return maturite + def.pourrit
end

--- Le stade d'une parcelle, déduit de sa croissance accumulée.
---@param parcelle table
---@return string stade, number proportion   proportion ∈ [0, 1] DANS le stade
function Agriculture.Stade(parcelle)
    local def = Agriculture.Graine(parcelle and parcelle.graine_id)
    if (not def) then return "graine", 0 end

    local c = tonumber(parcelle.croissance) or 0
    local maturite = Agriculture.TempsMaturite(def)

    if (c < def.duree_graine) then
        return "graine", c / def.duree_graine
    end
    if (c < maturite) then
        return "pousse", (c - def.duree_graine) / def.duree_pousse
    end
    if (def.pourrit ~= false) then
        local avant_pourri = c - maturite
        if (avant_pourri >= def.pourrit) then return "pourri", 1 end
        return "mature", math.min(1, avant_pourri / def.pourrit)
    end
    return "mature", 0   -- ne pourrit pas : mature, stable
end

--- Un pas de temps. Rend une parcelle NEUVE (l'originale reste intacte —
--- discipline d'Inventory : l'appelant décide du basculement) et vrai si le
--- stade a changé — c'est le signal pour que le serveur mette à jour le
--- visuel et persiste.
---
--- Le temps qui RECULE (maintenant < vu_le : horloge ajustée, sauvegarde
--- trafiquée) est ignoré, pas accumulé — une croissance négative offrirait des
--- récoltes contre du temps volé.
---@param parcelle table
---@param maintenant any
---@return table|nil parcelle_neuve, boolean changement_de_stade
function Agriculture.Tick(parcelle, maintenant)
    if (type(parcelle) ~= "table") then return nil, false end
    local def = Agriculture.Graine(parcelle.graine_id)
    if (not def) then return nil, false end
    local t = tonumber(maintenant)
    if (not t) then return nil, false end

    local stade_avant = Agriculture.Stade(parcelle)
    local ecoule = math.max(0, t - (tonumber(parcelle.vu_le) or t))

    local croissance = tonumber(parcelle.croissance) or 0
    if (ecoule > 0 and Agriculture.Arrosee(parcelle, t)) then
        croissance = math.min(plafond(def), croissance + ecoule)
    end

    local neuve = {
        proprietaire = parcelle.proprietaire,
        parcelle_id = parcelle.parcelle_id,
        graine_id = parcelle.graine_id,
        plantee_le = parcelle.plantee_le,
        croissance = croissance,
        arrose_le = parcelle.arrose_le,
        vu_le = t,
    }
    local stade_apres = Agriculture.Stade(neuve)
    return neuve, (stade_apres ~= stade_avant)
end

--- L'échelle d'affichage : interpolation continue de la spec (Start_Scale →
--- End_Scale sur toute la croissance). Mature et pourri sont à taille pleine.
---@param parcelle table
---@return number
function Agriculture.Echelle(parcelle)
    local ECHELLE_MIN, ECHELLE_MAX = 0.1, 1.0   -- Start_Scale / End_Scale, mesurés
    local def = Agriculture.Graine(parcelle and parcelle.graine_id)
    if (not def) then return ECHELLE_MIN end
    local maturite = Agriculture.TempsMaturite(def)
    local fraction = math.min(1, (tonumber(parcelle.croissance) or 0) / maturite)
    return ECHELLE_MIN + (ECHELLE_MAX - ECHELLE_MIN) * fraction
end

--- La clé de mesh à afficher pour un stade — LES DEUX ISSUES de la question
--  ouverte, sans changer la logique :
--    1. `def.meshes_par_stade[stade]`  — mapping propre à l'espèce ;
--    2. `def.mesh_espece`              — issue « 3 espèces » : un visuel par
--       espèce, la taille venant de `Echelle` ;
--    3. `Agriculture.MESHES_PAR_STADE[stade]` — issue « 3 tailles » : mapping
--       partagé par toutes les espèces ;
--    4. "" — RIEN à afficher, et pas de crash. Tant que le cook n'a pas eu
--    lieu, c'est la seule réponse honnête : jamais une référence morte.
---@param def table|nil
---@param stade string
---@return string
function Agriculture.MeshPour(def, stade)
    if (type(def) ~= "table") then return "" end
    if (type(def.meshes_par_stade) == "table") then
        local cle = def.meshes_par_stade[stade]
        if (type(cle) == "string" and cle ~= "") then return cle end
    end
    if (type(def.mesh_espece) == "string" and def.mesh_espece ~= "") then
        return def.mesh_espece
    end
    local partage = Agriculture.MESHES_PAR_STADE[stade]
    if (type(partage) == "string" and partage ~= "") then return partage end
    return ""
end

--- La qualité d'une récolte, d'un tirage ∈ [0, 1) FOURNI par l'appelant.
--- Lu de haut en bas : or, puis argent, puis bronze. Un tirage absent n'est
--- pas un bronze — c'est un dé non lancé : nil.
---@param tirage any
---@return string|nil
function Agriculture.TirageQualite(tirage)
    local de = tonumber(tirage)
    if (not de or de < 0 or de >= 1) then return nil end
    if (de < Agriculture.QUALITES["or"].chance) then return "or" end
    if (de < Agriculture.QUALITES["or"].chance + Agriculture.QUALITES["argent"].chance) then
        return "argent"
    end
    return "bronze"
end

--- Le rendement d'une récolte : rendement de base × facteur de qualité,
--- tronqué — une récolte est un nombre entier d'objets.
---@param def table
---@param qualite string
---@return integer
function Agriculture.Rendement(def, qualite)
    local q = Agriculture.QUALITES[qualite]
    if (not q) then return def.rendement end
    return math.max(1, math.floor(def.rendement * q.facteur))
end

-- ── Persistance : une parcelle appartient à UN personnage ─────────────────────

--- Lecture d'une ligne de base → enregistrement de parcelle.
local function depuisLigne(l)
    if (type(l) ~= "table") then return nil end
    return {
        proprietaire = l.proprietaire_id,
        parcelle_id = l.parcelle_id,
        graine_id = l.graine_id,
        plantee_le = tonumber(l.plantee_le) or 0,
        croissance = tonumber(l.croissance) or 0,
        arrose_le = tonumber(l.arrose_le),   -- NULL en base → nil : jamais arrosée
        vu_le = tonumber(l.vu_le) or 0,
    }
end

--- La parcelle d'un personnage. Le `WHERE proprietaire_id` n'est pas
--- décoratif : `parcelle_id` vient du client, et sans lui un joueur lirait —
--- puis récolterait — le champ d'un autre.
---@param proprietaire any
---@param parcelle_id any
---@return table|nil
function Agriculture.Parcelle(proprietaire, parcelle_id)
    if (not db or type(proprietaire) ~= "string" or type(parcelle_id) ~= "string") then
        return nil
    end
    local lignes = db:Select(
        "SELECT * FROM parcelles WHERE proprietaire_id = :0 AND parcelle_id = :1",
        proprietaire, parcelle_id)
    return depuisLigne(lignes and lignes[1])
end

--- Toutes les parcelles d'un personnage.
---@param proprietaire any
---@return table[]
function Agriculture.ParcellesDu(proprietaire)
    local sortie = {}
    if (not db or type(proprietaire) ~= "string") then return sortie end
    local lignes = db:Select(
        "SELECT * FROM parcelles WHERE proprietaire_id = :0 ORDER BY parcelle_id ASC",
        proprietaire)
    for _, l in ipairs(lignes or {}) do
        sortie[#sortie + 1] = depuisLigne(l)
    end
    return sortie
end

--- Plante une graine sur une parcelle libre. La parcelle démarre NON arrosée
--- (arrose_le NULL) : la croissance ne part qu'au premier arrosage — la spec
--- exige l'eau pour croître.
---@param proprietaire any
---@param parcelle_id any
---@param graine_id any
---@param maintenant any
---@return boolean, string|nil
function Agriculture.Planter(proprietaire, parcelle_id, graine_id, maintenant)
    if (not db) then return false, "Base indisponible" end
    if (type(proprietaire) ~= "string" or proprietaire == "") then
        return false, "Proprietaire inconnu"
    end
    if (type(parcelle_id) ~= "string" or parcelle_id == "") then
        return false, "Parcelle inconnue"
    end
    if (not Agriculture.Graine(graine_id)) then return false, "Graine inconnue" end
    local t = tonumber(maintenant)
    if (not t) then return false, "Instant inconnu" end

    if (Agriculture.Parcelle(proprietaire, parcelle_id)) then
        return false, "Parcelle occupee"
    end

    local touchees = db:Execute(
        "INSERT INTO parcelles (proprietaire_id, parcelle_id, graine_id, plantee_le, croissance, arrose_le, vu_le) "
        .. "VALUES (:0, :1, :2, :3, :4, NULL, :5)",
        proprietaire, parcelle_id, graine_id, t, 0, t)
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Enregistrement impossible"
    end
    return true, nil
end

--- Arrose une parcelle : le compteur d'eau repart pour `duree_arrosage`.
---@return boolean, string|nil
function Agriculture.Arroser(proprietaire, parcelle_id, maintenant)
    if (not db) then return false, "Base indisponible" end
    local t = tonumber(maintenant)
    if (not t) then return false, "Instant inconnu" end

    local touchees = db:Execute(
        "UPDATE parcelles SET arrose_le = :0 WHERE proprietaire_id = :1 AND parcelle_id = :2",
        t, proprietaire, parcelle_id)
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Parcelle introuvable"
    end
    return true, nil
end

--- Un pas de temps PERSISTÉ : lit la parcelle, la fait avancer, réécrit
--- croissance et vu_le. Appelé par le timer serveur — c'est lui qui porte la
--- cadence, ce module ne la connaît pas.
---@return table|nil parcelle, boolean changement_de_stade
function Agriculture.TickParcelle(proprietaire, parcelle_id, maintenant)
    local parcelle = Agriculture.Parcelle(proprietaire, parcelle_id)
    if (not parcelle) then return nil, false end

    local neuve, change = Agriculture.Tick(parcelle, maintenant)
    if (not neuve) then return nil, false end

    db:Execute(
        "UPDATE parcelles SET croissance = :0, vu_le = :1 WHERE proprietaire_id = :2 AND parcelle_id = :3",
        neuve.croissance, neuve.vu_le, proprietaire, parcelle_id)
    return neuve, change
end

--- Récolte. Rend le PLAN — quoi, combien, quelle qualité — et c'est
--- l'exécutant qui crédite le sac (Inventory) : soit tout se passe, soit rien
--- ne se passe.
---
--- La récolte fait d'abord avancer le temps jusqu'à `maintenant` : une plante
--- mûrie pendant que le timer dormait est mûre, une plante pourrie est
--- pourrie. Seul le stade MATURE se récolte ; le pourri s'arrache (Arracher).
--- Si l'espère repousse, la plante reste et recule de `temps_repousse` de
--- croissance ; sinon la parcelle est libérée.
---@param proprietaire any
---@param parcelle_id any
---@param maintenant any
---@param tirage any   ∈ [0, 1), fourni par le serveur
---@return table|nil plan { produit, quantite, qualite, repousse }, string|nil raison
function Agriculture.Recolter(proprietaire, parcelle_id, maintenant, tirage)
    if (not db) then return nil, "Base indisponible" end
    local t = tonumber(maintenant)
    if (not t) then return nil, "Instant inconnu" end

    local parcelle = Agriculture.TickParcelle(proprietaire, parcelle_id, t)
    if (not parcelle) then return nil, "Parcelle introuvable" end
    local def = Agriculture.Graine(parcelle.graine_id)
    if (not def) then return nil, "Espece disparue de la table" end

    local stade = Agriculture.Stade(parcelle)
    if (stade == "pourri") then return nil, "Pourri : a arracher, pas a recolter" end
    if (stade ~= "mature") then return nil, "Pas encore mur" end

    local qualite = Agriculture.TirageQualite(tirage)
    if (not qualite) then return nil, "tirage absent ou hors bornes" end
    local quantite = Agriculture.Rendement(def, qualite)

    if (def.repousse) then
        local maturite = Agriculture.TempsMaturite(def)
        db:Execute(
            "UPDATE parcelles SET croissance = :0, vu_le = :1 WHERE proprietaire_id = :2 AND parcelle_id = :3",
            math.max(0, maturite - def.temps_repousse), t, proprietaire, parcelle_id)
    else
        db:Execute(
            "DELETE FROM parcelles WHERE proprietaire_id = :0 AND parcelle_id = :1",
            proprietaire, parcelle_id)
    end

    return {
        produit = def.produit_item,
        quantite = quantite,
        qualite = qualite,
        repousse = def.repousse,
    }, nil
end

--- Arrache la plantation et libère la parcelle — c'est le sort du pourri
--- (la spec : « when decayed, plant must be manually removed »), et le droit
--- du propriétaire de faire place nette à tout moment.
---@return boolean, string|nil
function Agriculture.Arracher(proprietaire, parcelle_id)
    if (not db) then return false, "Base indisponible" end
    local touchees = db:Execute(
        "DELETE FROM parcelles WHERE proprietaire_id = :0 AND parcelle_id = :1",
        proprietaire, parcelle_id)
    if ((tonumber(touchees) or 0) < 1) then
        return false, "Parcelle introuvable"
    end
    return true, nil
end

--- Ce que l'interface affiche : chaque parcelle avec stade, proportion,
--- échelle, clé de mesh (vide tant que rien n'est cuit) et état d'arrosage.
---@param proprietaire any
---@param maintenant any
---@return table
function Agriculture.Vue(proprietaire, maintenant)
    local sortie = {}
    for _, p in ipairs(Agriculture.ParcellesDu(proprietaire)) do
        local def = Agriculture.Graine(p.graine_id)
        local stade, proportion = Agriculture.Stade(p)
        sortie[#sortie + 1] = {
            parcelle_id = p.parcelle_id,
            graine_id = p.graine_id,
            nom = def and def.nom or p.graine_id,
            stade = stade,
            proportion = proportion,
            echelle = Agriculture.Echelle(p),
            mesh = Agriculture.MeshPour(def, stade),
            arrosee = Agriculture.Arrosee(p, maintenant),
        }
    end
    return sortie
end

return Agriculture
