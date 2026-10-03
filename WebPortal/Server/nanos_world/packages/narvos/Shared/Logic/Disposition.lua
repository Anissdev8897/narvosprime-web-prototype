-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Disposition.lua — disposition du HUD et boussole (demande B1).
-- Câblage : Narvos.Disposition = Package.Require("Logic/Disposition.lua")
--
-- Demande du 2026-09-13 : « déplacer librement chaque élément du HUD, dont la
-- carte ; position gardée à la sortie du menu et à la relance ; bouton
-- disposition par défaut ; boussole N, NE, E, SE, S, SO, O, NO ».
--
-- ⚠ PUR : positions en FRACTIONS de l'écran (0..1, centre de l'élément), cap en
-- degrés. Le client (Client/Index.lua) lit la caméra et persiste
-- (`Package.SetPersistentData`, côté CLIENT : la disposition est celle de CET
-- écran, pas du compte) ; la page (interface.js) dessine et fait glisser.
--
-- ⚠ LA CARTE DÉPLAÇABLE EST LA MINI-CARTE DU HUD (canvas WebUI). Le widget natif
-- de la minimap Ako n'est pas positionnable depuis Lua : `SetSlotCanvasLayout`
-- « ne marche que si le widget est enfant d'un Canvas Panel » (Widget.json), et
-- `AddToViewport` n'en fait pas un.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosDisposition
local Disposition = {}

--- Zones déplaçables, dans l'ordre du panneau. ⚠ SÉQUENCE. Défauts = le HUD
--- d'avant la demande (coins et bords du canvas), en centre d'élément.
Disposition.ZONES = {
    { id = "vitalite", libelle = "Vie et armure",     x = 0.13, y = 0.88 },
    { id = "sorts",    libelle = "Pouvoirs",          x = 0.50, y = 0.92 },
    { id = "messages", libelle = "Messages",          x = 0.50, y = 0.10 },
    { id = "arme",     libelle = "Arme et munitions", x = 0.88, y = 0.90 },
    { id = "boussole", libelle = "Boussole",          x = 0.50, y = 0.035 },
    { id = "carte",    libelle = "Mini-carte",        x = 0.90, y = 0.20 },
}

--- Options affichées, avec leur défaut.
Disposition.OPTIONS = {
    { id = "boussole", libelle = "Afficher la boussole",  defaut = true },
    { id = "carte",    libelle = "Afficher la mini-carte", defaut = false },
}

--- Marge : un élément ne se pose pas collé au bord, où il serait coupé.
Disposition.MARGE = 0.01

local par_zone, par_option = {}, {}
for _, z in ipairs(Disposition.ZONES) do par_zone[z.id] = z end
for _, o in ipairs(Disposition.OPTIONS) do par_option[o.id] = o end

local function borne(v, mini, maxi)
    if (v < mini) then return mini end
    if (v > maxi) then return maxi end
    return v
end

--- Disposition par défaut : { zones = { id = { x, y } }, options = { id = bool } }.
---@return table
function Disposition.Defaut()
    local d = { zones = {}, options = {} }
    for _, z in ipairs(Disposition.ZONES) do d.zones[z.id] = { x = z.x, y = z.y } end
    for _, o in ipairs(Disposition.OPTIONS) do d.options[o.id] = o.defaut end
    return d
end

--- Une disposition lue (fichier, page) rendue sûre : zones inconnues écartées,
--- positions bornées, options booléennes, tout manque comblé par le défaut.
---@param brute any
---@return table
function Disposition.Normaliser(brute)
    local d = Disposition.Defaut()
    if (type(brute) ~= "table") then return d end
    local zones = type(brute.zones) == "table" and brute.zones or {}
    for id, pos in pairs(zones) do
        if (par_zone[id] and type(pos) == "table") then
            local x, y = tonumber(pos.x), tonumber(pos.y)
            if (x and y and x == x and y == y) then
                d.zones[id] = {
                    x = borne(x, Disposition.MARGE, 1 - Disposition.MARGE),
                    y = borne(y, Disposition.MARGE, 1 - Disposition.MARGE),
                }
            end
        end
    end
    local options = type(brute.options) == "table" and brute.options or {}
    for id, v in pairs(options) do
        if (par_option[id] and type(v) == "boolean") then d.options[id] = v end
    end
    return d
end

--- Déplace une zone. Rend la NOUVELLE disposition (l'ancienne n'est pas mutée),
--- ou nil + raison.
---@return table|nil, string|nil
function Disposition.Placer(disposition, zone, x, y)
    if (not par_zone[zone]) then return nil, "Zone inconnue" end
    local nx, ny = tonumber(x), tonumber(y)
    if (not nx or not ny or nx ~= nx or ny ~= ny) then return nil, "Position invalide" end
    local copie = Disposition.Normaliser(disposition)
    copie.zones[zone] = {
        x = borne(nx, Disposition.MARGE, 1 - Disposition.MARGE),
        y = borne(ny, Disposition.MARGE, 1 - Disposition.MARGE),
    }
    return copie, nil
end

--- Change une option. Même contrat que `Placer`.
---@return table|nil, string|nil
function Disposition.Regler(disposition, option, valeur)
    if (not par_option[option]) then return nil, "Option inconnue" end
    if (type(valeur) ~= "boolean") then return nil, "Valeur invalide" end
    local copie = Disposition.Normaliser(disposition)
    copie.options[option] = valeur
    return copie, nil
end

-- ── Boussole ──────────────────────────────────────────────────────────────────

--- Les huit directions, à 45° d'écart, en partant du nord. ⚠ SÉQUENCE : l'index
--- se CALCULE depuis le cap.
Disposition.CARDINAUX = { "N", "NE", "E", "SE", "S", "SO", "O", "NO" }

--- Cap (0 = nord, 90 = est) depuis le lacet de la caméra Unreal.
---
--- ⚠ LA CONVENTION EST CELLE DU RADAR, pas une autre : le radar du HUD dessine le
--- nord EN HAUT, c'est-à-dire vers -Y d'Unreal, et l'est à DROITE, vers +X
--- (ateliers.js, DessinerRadarDans). Lacet 0 (regard vers +X) = est = 90 ;
--- lacet -90 (regard vers -Y) = nord = 0. Deux conventions différentes entre la
--- boussole et le radar enverraient le joueur à l'opposé.
---@param lacet any  degrés
---@return number|nil  cap dans [0, 360)
function Disposition.Cap(lacet)
    local l = tonumber(lacet)
    if (not l or l ~= l) then return nil end
    local cap = (l + 90) % 360
    if (cap < 0) then cap = cap + 360 end
    return cap
end

--- La direction la plus proche d'un cap : "N", "NE", …, "NO".
---@param cap any
---@return string|nil
function Disposition.Cardinal(cap)
    local c = tonumber(cap)
    if (not c or c ~= c) then return nil end
    c = c % 360
    local index = math.floor((c + 22.5) / 45) % 8
    return Disposition.CARDINAUX[index + 1]
end

return Disposition
