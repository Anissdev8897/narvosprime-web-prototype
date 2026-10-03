-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Fouille.lua — le contenu d'un cadavre, décidé et testé ici.
--
-- Câblage : Narvos.Fouille = Package.Require("Logic/Fouille.lua")
--
-- ── CE QUE CE MODULE SAIT, ET RIEN D'AUTRE ────────────────────────────────────
-- Un cadavre = une liste d'entrées (définition, quantité, poids), un délai
-- d'expiration, et des règles de retrait. Il ne connaît ni les personnages, ni
-- les événements réseau, ni la grille d'inventaire : l'exécutant
-- (Server/Fouille.lua) relie ce modèle au monde — même discipline que
-- `Logic/Assemblage.lua` et `Logic/Menottes.lua`.
--
-- ── LE SAC PLEIN N'EST PAS UNE PERTE ──────────────────────────────────────────
-- `Prendre` retire de l'état ce que l'appelant confirme avoir VERSÉ. L'exécutant
-- verse d'abord dans la grille ; si la grille est pleine, il n'appelle pas
-- `Prendre` et l'entrée reste sur le cadavre. Le modèle ne perd donc jamais
-- d'objet à cause d'un sac plein — le serveur, lui, annonce « sac plein ».
--
-- ── AUTO-LOOT ─────────────────────────────────────────────────────────────────
-- `FiltrerAutoLoot` décide, POUR UNE CONFIGURATION DONNÉE, ce qui partirait
-- automatiquement : familles cochées (arme/équipement/consommable/ressource/
-- autre) et rareté minimale. La config vient de `Jouabilite` ; la règle, d'ici.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosFouille
local Fouille = {}

--- Rang d'une rareté dans l'échelle du butin. Inconnue → 0 (jamais filtrée).
local RANG_RARETE = { normal = 0, common = 1, rare = 2, epic = 3, legendary = 4 }

---@param type string|nil
---@return string  la famille d'un objet pour le filtre auto-loot.
function Fouille.FamilleDe(type)
    if (type == "weapon") then return "arme" end
    if (type == "armor" or type == "accessory" or type == "helmet" or type == "boots") then
        return "equipement"
    end
    if (type == "consumable" or type == "ammo") then return "consommable" end
    if (type == "material" or type == "resource") then return "ressource" end
    return "autre"
end

--- Ouvre un cadavre : les drops deviennent des entrées numérotées (uid stable).
---@param drops table  liste de { def = table, quantite = number }
---@param maintenant_ms number|nil
---@param duree_ms number  expiration du cadavre fouillable
---@return table etat
function Fouille.Nouveau(drops, maintenant_ms, duree_ms)
    local etat = {
        entrees = {},
        expire_ms = (tonumber(maintenant_ms) or 0) + (tonumber(duree_ms) or 120000),
        uid_suivant = 1,
    }

    for _, drop in ipairs(drops or {}) do
        local def = drop.def or {}
        local quantite = math.max(1, math.floor(tonumber(drop.quantite) or 1))
        etat.entrees[#etat.entrees + 1] = {
            uid = etat.uid_suivant,
            def = def,
            quantite = quantite,
        }
        etat.uid_suivant = etat.uid_suivant + 1
    end
    return etat
end

---@param etat table
---@param uid any
---@return table|nil  l'entrée, ou nil.
function Fouille.Entree(etat, uid)
    if (type(etat) ~= "table" or uid == nil) then return nil end
    for _, e in ipairs(etat.entrees) do
        if (e.uid == uid) then return e end
    end
    return nil
end

--- Retire une quantité d'une entrée et rend la définition + la quantité retirée.
--- Rien n'est perdu : l'appelant ne confirme la grille qu'après ce retrait.
---@param etat table
---@param uid any
---@param quantite number|nil  nil ou 0 = tout.
---@return table|nil def, number|nil quantite, string|nil raison
function Fouille.Prendre(etat, uid, quantite)
    local e = Fouille.Entree(etat, uid)
    if (not e) then return nil, nil, "Objet introuvable sur le cadavre" end

    local demande = tonumber(quantite)
    if (demande == nil or demande <= 0) then demande = e.quantite end
    demande = math.floor(demande)
    if (demande > e.quantite) then demande = e.quantite end

    e.quantite = e.quantite - demande
    if (e.quantite <= 0) then
        local sortie = {}
        for _, autre in ipairs(etat.entrees) do
            if (autre.uid ~= uid) then sortie[#sortie + 1] = autre end
        end
        etat.entrees = sortie
    end

    return e.def, demande, nil
end

--- Tout retirer : la liste complète, et le cadavre devient vide.
---@param etat table
---@return table liste  { def = table, quantite = number } dans l'ordre d'affichage.
function Fouille.ToutPrendre(etat)
    local sortie = {}
    for _, e in ipairs(etat.entrees or {}) do
        sortie[#sortie + 1] = { def = e.def, quantite = e.quantite }
    end
    etat.entrees = {}
    return sortie
end

---@param etat table
---@return number  poids total restant (kg).
function Fouille.Poids(etat)
    local total = 0
    for _, e in ipairs(etat.entrees or {}) do
        total = total + (tonumber(e.def.weight) or 0) * e.quantite
    end
    return total
end

---@param etat table
---@return boolean
function Fouille.EstVide(etat)
    return #(etat.entrees or {}) == 0
end

---@param etat table
---@param maintenant_ms number
---@return boolean
function Fouille.Expire(etat, maintenant_ms)
    return tonumber(maintenant_ms or 0) >= tonumber(etat.expire_ms or 0)
end

-- ── Auto-loot ─────────────────────────────────────────────────────────────────

---@class NarvosReglagesAutoLoot
---@field auto_loot_types table  { arme = boolean, equipement = boolean, ... }
---@field auto_loot_rarete string  rareté minimale à prendre.

--- Sépare un cadavre en « partirait automatiquement » et « resterait ».
---@param etat table
---@param reglages table|nil  nil = aucun filtre (rien ne part).
---@return table pris, table restant  deux listes { def, quantite, uid? }.
function Fouille.FiltrerAutoLoot(etat, reglages)
    local pris, restant = {}, {}
    local types = (type(reglages) == "table" and type(reglages.auto_loot_types) == "table")
        and reglages.auto_loot_types or {}
    local rarete_min = (type(reglages) == "table" and type(reglages.auto_loot_rarete) == "string")
        and reglages.auto_loot_rarete or nil

    for _, e in ipairs(etat.entrees or {}) do
        local famille = Fouille.FamilleDe(e.def.type)
        local rang = RANG_RARETE[e.def.rarity] or 0
        local rang_min = RANG_RARETE[rarete_min] or 0

        if (types[famille] == true and rang >= rang_min) then
            pris[#pris + 1] = { def = e.def, quantite = e.quantite, uid = e.uid }
        else
            restant[#restant + 1] = { def = e.def, quantite = e.quantite, uid = e.uid }
        end
    end
    return pris, restant
end

--- Applique le filtre À L'ÉTAT : les entrées prises sont retirées, l'état ne
--- garde que ce qui reste. Rend la liste prise. (Pour l'auto-loot réel.)
---@param etat table
---@param reglages table|nil
---@return table pris
function Fouille.AutoLoot(etat, reglages)
    local pris, restant = Fouille.FiltrerAutoLoot(etat, reglages)

    local sortie = {}
    for _, p in ipairs(pris) do
        sortie[#sortie + 1] = { def = p.def, quantite = p.quantite }
    end

    local restantes = {}
    for _, r in ipairs(restant) do
        restantes[#restantes + 1] = { uid = r.uid, def = r.def, quantite = r.quantite }
    end
    etat.entrees = restantes
    return sortie
end

return Fouille
