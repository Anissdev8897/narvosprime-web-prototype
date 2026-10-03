-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/MetaHumain.lua — la TENUE MetaHuman : quelles pièces, quelles règles.
--
-- Câblage (Shared/Index.lua), APRÈS son catalogue :
--   Narvos.MetaHumainCatalogue = Package.Require("Catalogs/MetaHumain.lua")
--   Narvos.MetaHumain = Package.Require("Logic/MetaHumain.lua")
--   Narvos.MetaHumain.Configurer(Narvos.MetaHumainCatalogue)
-- ⚠ DEUX modules, deux noms, comme `Animaux`/`AnimauxCatalogue` : les confondre
-- donnerait un `nil` silencieux.
--
-- ── POURQUOI UN PONT, ET PAS AddSkeletalMeshAttached ──────────────────────────
-- Les pièces du Meta Customization System sont skinnées sur le squelette
-- MetaHuman (342 os). Le Character nanos n'anime que SKEL_Mannequin, et 40 à
-- 67 % du poids d'un vêtement tombe sur des os que le Mannequin n'a pas (mesuré
-- le 2026-09-10) : en leader pose, le torse se brise. Chaque pièce est donc un
-- Blueprint dont le composant racine COPIE la pose du Character par un retarget
-- vivant (ABP_NanosVersMetaHuman + RTG_NanosVersMetaHuman, fabriqués par
-- scripts/adk-pont-metahuman.py). Server/MetaHumain.lua les pose et les attache.
--
-- Ce module ne touche à AUCUNE entité : il décide, l'exécutant applique. Chaque
-- fonction rend une tenue NEUVE — deux joueurs ne partagent jamais une table.
-- Une tenue est une table « slot -> identifiant de pièce ».
-- ═══════════════════════════════════════════════════════════════════════════════

local MetaHumain = {}

local Catalogue = nil

--- Injecte le catalogue GÉNÉRÉ. Sans lui, tout refuse en le disant.
---@param catalogue table  Catalogs/MetaHumain.lua
---@return boolean
function MetaHumain.Configurer(catalogue)
    if (type(catalogue) ~= "table" or type(catalogue.PIECES) ~= "table"
        or type(catalogue.SLOTS) ~= "table" or type(catalogue.SLOT_CORPS) ~= "string") then
        return false
    end
    Catalogue = catalogue
    return true
end

--- Une pièce par son identifiant, ou nil.
---@param id string
---@return table|nil
function MetaHumain.Piece(id)
    if (not Catalogue or type(id) ~= "string") then return nil end
    return Catalogue.PIECES[id]
end

local function Copier(tenue)
    local neuve = {}
    if (type(tenue) == "table") then
        for slot, id in pairs(tenue) do neuve[slot] = id end
    end
    return neuve
end

--- Le premier corps CUIT d'un genre, dans l'ordre des identifiants (stable).
local function CorpsParDefaut(genre)
    local ids = {}
    for id, p in pairs(Catalogue.PIECES) do
        if (p.slot == Catalogue.SLOT_CORPS and p.genre == genre and p.cuit) then
            ids[#ids + 1] = id
        end
    end
    table.sort(ids)
    return ids[1]
end

--- Équipe une pièce. Rend (tenue neuve) ou (nil, raison NOMMÉE).
---
--- Règles, dans l'ordre :
---   · pièce inconnue ou non cuite : refus nommé. Un Blueprint sur une référence
---     morte ne lève rien dans nanos — il n'apparaîtrait simplement pas ;
---   · un CORPS remplace le corps et retire les vêtements de l'autre genre ;
---   · un vêtement exige un corps : sans corps, on pose le premier corps cuit de
---     son genre ; sur un corps de l'autre genre, refus ;
---   · la pièce retire les slots qu'elle REMPLACE (catalogue) : une tenue
---     complète occupe haut et bas, un haut retire la tenue complète.
---@param tenue table|nil
---@param id string
---@return table|nil, string|nil
function MetaHumain.Equiper(tenue, id)
    if (not Catalogue) then return nil, "catalogue MetaHuman absent" end
    local p = MetaHumain.Piece(id)
    if (not p) then return nil, "piece MetaHuman inconnue : " .. tostring(id) end
    if (not p.cuit) then return nil, "piece MetaHuman non cuite : " .. id end

    local SLOT_CORPS = Catalogue.SLOT_CORPS
    local neuve = Copier(tenue)

    if (p.slot == SLOT_CORPS) then
        local portees = Copier(neuve)
        neuve[SLOT_CORPS] = id
        for slot, pid in pairs(portees) do
            local autre = MetaHumain.Piece(pid)
            if (slot ~= SLOT_CORPS and autre and autre.genre ~= "*" and autre.genre ~= p.genre) then
                neuve[slot] = nil
            end
        end
        return neuve
    end

    local corps = MetaHumain.Piece(neuve[SLOT_CORPS])
    if (not corps) then
        local defaut = CorpsParDefaut(p.genre)
        if (not defaut) then
            return nil, "aucun corps MetaHuman cuit pour le genre " .. tostring(p.genre)
        end
        neuve[SLOT_CORPS] = defaut
    elseif (p.genre ~= "*" and corps.genre ~= p.genre) then
        return nil, tostring(p.label) .. " : piece " .. tostring(p.genre)
            .. " sur un corps " .. tostring(corps.genre)
    end

    for _, slot in ipairs((Catalogue.REMPLACE or {})[p.slot] or {}) do neuve[slot] = nil end
    neuve[p.slot] = id
    return neuve
end

--- Retire un slot. Retirer le CORPS retire tout : un vêtement sans corps
--- flotterait autour d'un porteur invisible.
---@param tenue table|nil
---@param slot string
---@return table
function MetaHumain.Retirer(tenue, slot)
    if (not Catalogue or slot == Catalogue.SLOT_CORPS) then return {} end
    local neuve = Copier(tenue)
    neuve[slot] = nil
    return neuve
end

--- La tenue en LISTE, dans l'ordre des slots du catalogue : l'exécutant la
--- parcourt telle quelle, et `pairs` n'a pas d'ordre garanti.
---@param tenue table|nil
---@return table[]  { slot, id, piece }
function MetaHumain.Liste(tenue)
    local sortie = {}
    if (not Catalogue or type(tenue) ~= "table") then return sortie end
    for _, slot in ipairs(Catalogue.SLOTS) do
        local id = tenue[slot]
        local p = MetaHumain.Piece(id)
        if (p) then sortie[#sortie + 1] = { slot = slot, id = id, piece = p } end
    end
    return sortie
end

--- Ce qui change entre deux tenues : les slots à retirer, puis à poser. Un slot
--- dont la pièce change figure dans les DEUX — l'exécutant détruit, puis pose.
---@return string[], string[]
function MetaHumain.Differences(ancienne, neuve)
    local retirer, poser = {}, {}
    if (not Catalogue) then return retirer, poser end
    ancienne, neuve = ancienne or {}, neuve or {}
    for _, slot in ipairs(Catalogue.SLOTS) do
        if (ancienne[slot] ~= neuve[slot]) then
            if (ancienne[slot] ~= nil) then retirer[#retirer + 1] = slot end
            if (neuve[slot] ~= nil) then poser[#poser + 1] = slot end
        end
    end
    return retirer, poser
end

--- Les choix d'un genre (nil = tous), par slot, pour l'interface. Liste
--- ordonnée ; chaque pièce dit si elle est cuite, pour que l'écran l'EXPLIQUE
--- au lieu de la cacher.
---@param genre string|nil
---@return table[]  { slot, label, pieces = { { id, label, cuit } } }
function MetaHumain.Choix(genre)
    local sortie = {}
    if (not Catalogue) then return sortie end
    local libelles = Catalogue.LIBELLES_SLOTS or {}
    for _, slot in ipairs(Catalogue.SLOTS) do
        local ids = {}
        for id, p in pairs(Catalogue.PIECES) do
            if (p.slot == slot and (genre == nil or p.genre == genre or p.genre == "*")) then
                ids[#ids + 1] = id
            end
        end
        table.sort(ids)
        local pieces = {}
        for i, id in ipairs(ids) do
            local p = Catalogue.PIECES[id]
            pieces[i] = { id = id, label = p.label, cuit = (p.cuit == true) }
        end
        sortie[#sortie + 1] = { slot = slot, label = libelles[slot] or slot, pieces = pieces }
    end
    return sortie
end

--- Codec pour la base : « slot=id;slot=id », slots dans l'ordre du catalogue.
---@param tenue table|nil
---@return string
function MetaHumain.Encoder(tenue)
    local morceaux = {}
    for _, e in ipairs(MetaHumain.Liste(tenue)) do
        morceaux[#morceaux + 1] = e.slot .. "=" .. e.id
    end
    return table.concat(morceaux, ";")
end

--- Décode en ÉCARTANT ce que le catalogue ne connaît plus (pièce retirée du
--- pack) ou qui n'est pas à sa place : une référence morte ne doit jamais
--- repartir vers l'exécutant.
---@param chaine string|nil
---@return table
function MetaHumain.Decoder(chaine)
    local tenue = {}
    if (type(chaine) ~= "string") then return tenue end
    for slot, id in chaine:gmatch("([%w_]+)=([%w_]+)") do
        local p = MetaHumain.Piece(id)
        if (p and p.slot == slot) then tenue[slot] = id end
    end
    return tenue
end

return MetaHumain
