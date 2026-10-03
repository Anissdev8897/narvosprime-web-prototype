-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/InventaireVue.lua — ce que la page d'inventaire affiche, calculé
-- depuis l'état RÉEL du sac (grille + équipement). Pur, testable sans moteur.
--
-- Câblage : Narvos.InventaireVue = Package.Require("Logic/InventaireVue.lua")
--           Narvos.InventaireVue.Configurer({ inventaire = Narvos.Inventory })
--
-- ── POURQUOI (2026-09-14) ─────────────────────────────────────────────────────
-- Demande : « utilise le système d'inventaire que nous avions déjà créé »,
-- maquettes `Inventaire NARVOS.dc` et `NARVOS HUD System.dc` (onglets, emplacements
-- d'équipement, grille filtrable, fiche détaillée, actions). Le MODÈLE existait
-- depuis le 2026-09-06 (`Logic/Inventory.lua` : grille, 6 emplacements, stats
-- portées, persistance `personnages.inventaire`) mais la page n'affichait qu'une
-- liste nom/quantité, et l'équipement était sauvé VIDE à chaque écriture.
-- Ce module ne recrée rien : il traduit l'état du modèle en vue.
-- ═══════════════════════════════════════════════════════════════════════════════

local InventaireVue = {}

local Inventory = nil
local Vignettes = nil

---@param deps table { inventaire = Narvos.Inventory, vignettes = Narvos.Vignettes (facultatif) }
function InventaireVue.Configurer(deps)
    Inventory = (type(deps) == "table") and deps.inventaire or nil
    Vignettes = (type(deps) == "table") and deps.vignettes or nil
end

local function Requis()
    if (not Inventory) then
        error("InventaireVue non configure : Configurer({ inventaire = ... }) manquant", 3)
    end
    return Inventory
end

--- Les onglets de la maquette, dans son ordre. `categories` et `types` disent ce
--- qui y range un objet du catalogue ; l'arme se reconnaît AVANT tout le reste.
InventaireVue.ONGLETS = {
    { id = "equipement",   label = "ÉQUIPEMENT" },
    { id = "armes",        label = "ARMES" },
    { id = "ressources",   label = "RESSOURCES" },
    { id = "quetes",       label = "QUÊTES" },
    { id = "consommables", label = "CONSOMMABLES" },
    { id = "divers",       label = "DIVERS" },
}

local ONGLET_PAR_CATEGORIE = {
    equipment = "equipement",
    material = "ressources",
    resource = "ressources",
    consumable = "consommables",
    ammo = "consommables",
    quest = "quetes",
}

--- Onglet d'un objet. `est_arme` : l'objet correspond-il à une arme du jeu (arme
--- à feu ou de mêlée, `Roue.ARME_PAR_ITEM`) ? Une arme est une arme même si le
--- catalogue la range en « equipment ».
---@param def table|nil
---@param est_arme boolean
---@return string
function InventaireVue.Onglet(def, est_arme)
    if (type(def) ~= "table") then return "divers" end
    if (est_arme or def.type == "weapon" or def.equipSlot == "weapon" or def.equipSlot == "offhand") then
        return "armes"
    end
    return ONGLET_PAR_CATEGORIE[def.category or ""] or "divers"
end

--- Une entrée de vue pour une définition (instance du sac ou objet porté).
local function Entree(def, item_id)
    return {
        id = item_id,
        nom = def.label or item_id,
        rarete = def.rarity or "common",
        type = def.type or false,
        categorie = def.category or false,
        description = def.description or "",
        niveau = tonumber(def.level) or 1,
        poids = tonumber(def.weight) or 0,
        valeur = tonumber(def.value) or 0,
        stats = def.stats or {},
        slot = def.equipSlot or false,
        icone = def.icon or false,
        iconFile = def.iconFile or false,
        couleur = def.color or false,
        -- ── L'IMAGE 3D DE L'OBJET (2026-09-15) ───────────────────────────────
        -- « Une impression 3D en 2D pour chaque arme ou consommable » (Hanibes).
        -- `vignette` : un rendu livré par le client (assets de base, Vignettes.lua).
        -- `mesh` : le mesh réel, que la page fait rendre par le client
        -- (Client/VignettesObjets.lua) quand aucune vignette n'est livrée.
        mesh = (type(def.mesh) == "string" and def.mesh ~= "") and def.mesh or false,
        vignette = (Vignettes and Vignettes.PourMesh(def.mesh)) or false,
    }
end

--- La vue complète.
---@param etat table { grid, equipment }
---@param contexte table|nil {
---     credits,           -- solde du personnage
---     statistiques,      -- table de stats du personnage (Progression), ou nil
---     est_arme(item_id), -- l'objet est-il une arme utilisable en main ?
---     utilisable(item_id)-- l'objet se consomme-t-il (effet de soin/mana) ?
--- }
---@return table
function InventaireVue.Construire(etat, contexte)
    local Inv = Requis()
    contexte = (type(contexte) == "table") and contexte or {}
    local est_arme = (type(contexte.est_arme) == "function") and contexte.est_arme or function() return false end
    local utilisable = (type(contexte.utilisable) == "function") and contexte.utilisable or function() return false end

    local grille = (type(etat) == "table" and type(etat.grid) == "table") and etat.grid or Inv.CreateGridState()
    local equipement = (type(etat) == "table" and type(etat.equipment) == "table") and etat.equipment or {}

    local comptes = {}
    for _, o in ipairs(InventaireVue.ONGLETS) do comptes[o.id] = 0 end

    local objets, poids = {}, 0
    for _, inst in ipairs(grille.instances or {}) do
        local def = Inv.GetItemDef(inst.itemId)
        if (def) then
            local e = Entree(def, inst.itemId)
            e.uid = inst.uid
            e.quantite = tonumber(inst.quantity) or 1
            e.arme = est_arme(inst.itemId) == true
            e.onglet = InventaireVue.Onglet(def, e.arme)
            e.utilisable = utilisable(inst.itemId) == true
            e.equipable = def.equipSlot ~= nil
            objets[#objets + 1] = e
            comptes[e.onglet] = (comptes[e.onglet] or 0) + 1
            poids = poids + e.poids * e.quantite
        end
    end

    -- Emplacements : l'ORDRE du modèle (`EQUIPMENT_SLOTS_ORDERED`), jamais
    -- `pairs(equipment)` — un emplacement vide est nil, donc absent de la table.
    local emplacements = {}
    for _, s in ipairs(Inv.EQUIPMENT_SLOTS_ORDERED or {}) do
        local inst = equipement[s.slot]
        local def = inst and Inv.GetItemDef(inst.itemId) or nil
        local porte = false
        if (def) then
            porte = Entree(def, inst.itemId)
            porte.uid = inst.uid
            poids = poids + porte.poids
        end
        emplacements[#emplacements + 1] = { slot = s.slot, label = s.label, porte = porte }
    end

    local onglets = {}
    for _, o in ipairs(InventaireVue.ONGLETS) do
        onglets[#onglets + 1] = { id = o.id, label = o.label, compte = comptes[o.id] or 0 }
    end

    return {
        onglets = onglets,
        objets = objets,
        emplacements = emplacements,
        bonus_equipement = Inv.GetEquippedStats(equipement),
        statistiques = contexte.statistiques or false,
        credits = math.max(0, math.floor(tonumber(contexte.credits) or 0)),
        poids = math.floor(poids * 10 + 0.5) / 10,
        cellules = Inv.UsedCells(grille),
        max = Inv.MaxSlots(grille),
    }
end

return InventaireVue
