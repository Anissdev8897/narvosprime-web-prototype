-- Butin persistant des PNJ hostiles.
--
-- Les anciennes recompenses procedurales de Logic/Loot.lua fabriquent un id
-- nouveau a chaque tirage. Or le sac persistant ne sauvegarde que `itemId` : au
-- redemarrage, cet id n'existe plus dans ITEM_DB et l'objet devient illisible.
-- Ce module ne tire donc que de VRAIES definitions du catalogue d'objets.

local Butin = {}

Butin.RARETES = { "normal", "common", "rare", "epic", "legendary" }
Butin.RARETES_TITRES = {
    normal = "Normal", common = "Commun", rare = "Rare",
    epic = "Epique", legendary = "Legendaire",
}

-- Probabilites modulaires. Les deux premiers paliers restent majoritaires.
Butin.POIDS_RARETE = {
    normal = 48, common = 32, rare = 13, epic = 5, legendary = 2,
}
Butin.POIDS_FAMILLE = { ressource = 55, equipement = 35, consommable = 10 }
Butin.CHANCE = 0.70

local ALIASES = {
    normal = "normal",
    common = "common", commun = "common", uncommon = "common",
    rare = "rare",
    epic = "epic", epique = "epic",
    legendary = "legendary", legendaire = "legendary", mythic = "legendary",
}

local RANG = { normal = 1, common = 2, rare = 3, epic = 4, legendary = 5 }
local pools = {}
local bilan = { total = 0 }

local function Famille(def)
    local t = tostring(def.type or "")
    if (t == "consumable") then return "consommable" end
    if (def.equipSlot ~= nil or def.category == "equipment"
        or t == "weapon" or t == "armor" or t == "helmet"
        or t == "boots" or t == "gloves" or t == "accessory") then
        return "equipement"
    end
    if (t == "material" or t == "resource" or t == "ammo") then
        return "ressource"
    end
    return nil
end

local function EstNormal(def, rarete)
    if (rarete ~= "common") then return false end
    local t = tostring(def.type or "")
    local niveau = tonumber(def.level) or 1
    local valeur = tonumber(def.value) or 0
    -- Les materiaux et munitions ordinaires constituent le palier Normal. Les
    -- consommables/equipements restent Communs, sauf objet de depart sans valeur.
    if (t == "material" or t == "resource" or t == "ammo") then
        return niveau <= 1 and valeur <= 30
    end
    return niveau <= 1 and valeur <= 0
end

local function TirerPondere(poids, ordre, rng)
    local total = 0
    for _, id in ipairs(ordre) do total = total + (tonumber(poids[id]) or 0) end
    if (total <= 0) then return ordre[1] end
    local r = rng() * total
    for _, id in ipairs(ordre) do
        r = r - (tonumber(poids[id]) or 0)
        if (r < 0) then return id end
    end
    return ordre[#ordre]
end

--- Construit les pools depuis le catalogue final (apres Hyper/ISP/armes).
--- Normalise aussi les anciens alias afin que l'inventaire n'affiche que les
--- cinq raretes produit : Normal, Commun, Rare, Epique, Legendaire.
function Butin.Configurer(items)
    pools, bilan = {}, { total = 0 }
    for _, r in ipairs(Butin.RARETES) do
        pools[r] = { tous = {}, ressource = {}, equipement = {}, consommable = {} }
        bilan[r] = 0
    end
    if (type(items) ~= "table") then return bilan end

    local ids = {}
    for id in pairs(items) do ids[#ids + 1] = id end
    table.sort(ids)
    for _, id in ipairs(ids) do
        local def = items[id]
        if (type(def) == "table") then
            local famille = Famille(def)
            local rarete = ALIASES[tostring(def.rarity or "common"):lower()] or "common"
            if (EstNormal(def, rarete)) then rarete = "normal" end
            -- Le catalogue est la source de verite de l'interface et du sac.
            def.rarity = rarete
            if (famille) then
                local entree = { id = id, def = def, niveau = tonumber(def.level) or 1 }
                pools[rarete].tous[#pools[rarete].tous + 1] = entree
                pools[rarete][famille][#pools[rarete][famille] + 1] = entree
                bilan[rarete] = bilan[rarete] + 1
                bilan.total = bilan.total + 1
            end
        end
    end
    return bilan
end

local function Candidats(rarete, famille, niveau)
    local rang = RANG[rarete] or 1
    while rang >= 1 do
        local r = Butin.RARETES[rang]
        local source = pools[r] and pools[r][famille] or nil
        if (not source or #source == 0) then source = pools[r] and pools[r].tous or nil end
        if (source and #source > 0) then
            local autorises = {}
            local plafond = math.max(1, math.floor(tonumber(niveau) or 1)) + 5
            for _, e in ipairs(source) do
                if (e.niveau <= plafond) then autorises[#autorises + 1] = e end
            end
            if (#autorises > 0) then return autorises, r end
        end
        rang = rang - 1
    end
    return {}, "normal"
end

--- Tire 0 ou plusieurs definitions persistantes de ITEM_DB.
function Butin.Tirer(niveau, quantite, rng)
    rng = rng or math.random
    quantite = math.max(0, math.floor(tonumber(quantite) or 1))
    local resultat = {}
    local familles = { "ressource", "equipement", "consommable" }
    for _ = 1, quantite do
        if (rng() < Butin.CHANCE) then
            local rarete = TirerPondere(Butin.POIDS_RARETE, Butin.RARETES, rng)
            local famille = TirerPondere(Butin.POIDS_FAMILLE, familles, rng)
            local liste, retenue = Candidats(rarete, famille, niveau)
            if (#liste > 0) then
                local index = math.floor(rng() * #liste) + 1
                local e = liste[math.min(index, #liste)]
                resultat[#resultat + 1] = {
                    id = e.id, def = e.def, quantite = 1,
                    rarete = retenue, famille = famille,
                }
            end
        end
    end
    return resultat
end

return Butin
