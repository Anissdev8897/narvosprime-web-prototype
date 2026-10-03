-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/EditionPnj.lua — `/editionpnj` : repères radar et diagnostic des PNJ.
--
-- Câblage : Package.Require("Server/EditionPnj.lua") depuis Server/Index.lua,
-- APRÈS Session. Index.lua lui injecte la garde d'administration
-- (`UtiliserGarde`) et appelle `PointsEntites` depuis le radar.
--
-- ── CE QU'IL FAIT (demandes B5 et B6 du 2026-09-13) ───────────────────────────
--   · B5 : le radar montre les PNJ vivants, les animaux, les ressources et les
--     véhicules ; couleur, taille et visibilité se règlent par sorte, par rôle ou
--     par PNJ, SANS toucher un Blueprint. Réglages persistés
--     (`Package.SetPersistentData`, clé `radar_styles`), valables pour tous.
--   · B6 : pour chaque PNJ du catalogue, le diagnostic TEXTURE lu dans le pack
--     CUIT par le générateur (`texture`, `texture_raison`, `translucide` dans
--     Catalogs/Spawnables.lua) : OK, ou ERREUR avec la raison.
--
-- ⚠ LA DÉCISION EST DANS Logic/Radar.lua (Classer, Style, NormaliserStyle) :
-- ce fichier lit les entités, garde, persiste, envoie.
-- ═══════════════════════════════════════════════════════════════════════════════

local EditionPnj = {}

local Radar = Narvos.Radar
local Spawnables = Narvos.Spawnables
local Session = Narvos.SessionServeur

--- Clé du fichier `.data/PersistentData.toml` du package.
EditionPnj.CLE_PERSISTANCE = "radar_styles"

--- Au-delà, une entité n'est pas lue pour le radar (cm) : le radar affiche 600 m,
--- et lire tout le monde à chaque rafraîchissement serait du travail perdu.
EditionPnj.PORTEE_LECTURE_CM = 60000.0

-- ── État ──────────────────────────────────────────────────────────────────────
-- ⚠ DÉCLARÉ EN TÊTE (piège du `local` posé après son premier lecteur).

--- { sortes = { sorte = style }, roles = { role = style }, ids = { "sorte:id" = style } }
local reglages = { sortes = {}, roles = {}, ids = {} }

--- Garde d'édition, FERMÉE par défaut : non branchée, elle refuse tout.
local garde = function() return false, "Garde d'administration non branchee" end

-- ── Persistance ───────────────────────────────────────────────────────────────

--- Relit les réglages persistés, en ne gardant que ce que la validation accepte :
--- un fichier édité à la main ne doit pas pouvoir casser le radar.
local function Charger()
    local ok, donnees = pcall(function() return Package.GetPersistentData() end)
    local brut = ok and type(donnees) == "table" and donnees[EditionPnj.CLE_PERSISTANCE] or nil
    if (type(brut) ~= "table") then return 0 end
    local n = 0
    for _, portee in ipairs({ "sortes", "roles", "ids" }) do
        for cle, style in pairs(type(brut[portee]) == "table" and brut[portee] or {}) do
            local propre = Radar.NormaliserStyle(style)
            if (propre and type(cle) == "string") then
                reglages[portee][cle] = propre
                n = n + 1
            end
        end
    end
    return n
end

local function Persister()
    local ok, erreur = pcall(function()
        Package.SetPersistentData(EditionPnj.CLE_PERSISTANCE, reglages)
    end)
    if (not ok) then Console.Error("[EDITIONPNJ] persistance impossible : " .. tostring(erreur)) end
    return ok
end

-- ── Lecture des entités ───────────────────────────────────────────────────────

local function Valeur(entite, cle)
    local ok, v = pcall(function() return entite:GetValue(cle, nil) end)
    return ok and v or nil
end

local function Vivant(e)
    local ok, valide = pcall(function() return e:IsValid() end)
    if (not ok or not valide) then return false end
    local ok2, mort = pcall(function() return e:IsDead() end)
    return not (ok2 and mort)
end

--- Les repères des entités vivantes proches d'un personnage, déjà stylés.
---@param character table   le personnage du joueur (sa dimension, sa position)
---@param M number          centimètres par mètre (Index.lua)
---@return table            liste de { x, z, label, teinte, taille, sorte }
function EditionPnj.PointsEntites(character, M)
    local points = {}
    if (not character or not character:IsValid()) then return points end
    local ici = character:GetLocation()
    local ok_dim, dimension = pcall(function() return character:GetDimension() end)
    local portee2 = EditionPnj.PORTEE_LECTURE_CM * EditionPnj.PORTEE_LECTURE_CM
    local trouver = Spawnables and Spawnables.Trouver or nil

    local function lire(classe, avec_vie)
        if (not classe) then return end
        local ok, liste = pcall(function() return classe.GetAll() end)
        if (not ok or type(liste) ~= "table") then return end
        for _, e in pairs(liste) do
            local garder = e ~= character and (not avec_vie or Vivant(e))
            if (garder) then
                -- Un joueur n'est pas un repère : son personnage est contrôlé.
                local okj, joueur = pcall(function() return e:GetPlayer() end)
                if (okj and joueur) then garder = false end
            end
            if (garder and ok_dim) then
                local okd, d = pcall(function() return e:GetDimension() end)
                if (okd and d ~= dimension) then garder = false end
            end
            if (garder) then
                local p = e:GetLocation()
                local dx, dy = p.X - ici.X, p.Y - ici.Y
                if (dx * dx + dy * dy <= portee2) then
                    local info = Radar.Classer({
                        pnj = Valeur(e, "narvos_pnj"),
                        marchand = Valeur(e, "narvos_marchand"),
                        vehicule = Valeur(e, "narvos_vehicule"),
                    }, trouver)
                    if (info) then
                        local style = Radar.Style(info, reglages)
                        if (style.visible) then
                            points[#points + 1] = {
                                x = p.X / M, z = p.Y / M,
                                label = info.label or info.id,
                                teinte = style.teinte,
                                taille = style.taille,
                                sorte = info.sorte,
                            }
                        end
                    end
                end
            end
        end
    end

    lire(Character, true)
    lire(CharacterSimple, true)
    lire(VehicleWheeled, false)
    return points
end

--- Style d'un repère qui n'est pas une entité (gisement, portail).
---@param sorte string
---@param id string|nil
---@return table
function EditionPnj.StylePour(sorte, id)
    return Radar.Style({ sorte = sorte, id = id }, reglages)
end

-- ── État du panneau ───────────────────────────────────────────────────────────

local function Libelle(id, entree)
    return (entree and entree.label) or id
end

--- Tout ce que le panneau affiche.
---@param player table
---@param ouvrir boolean|nil
function EditionPnj.Envoyer(player, ouvrir, message)
    local permis = garde(player)
    local entrees = {}
    local erreurs, translucides = 0, 0
    for _, e in ipairs((Spawnables and Spawnables.ENTREES) or {}) do
        local info = { sorte = "pnj", id = e.id, role = e.role }
        local style = Radar.Style(info, reglages)
        if (e.texture == "erreur") then erreurs = erreurs + 1 end
        if (e.translucide) then translucides = translucides + 1 end
        entrees[#entrees + 1] = {
            id = e.id, label = Libelle(e.id, e), role = e.role, famille = e.famille,
            texture = e.texture or "inconnue",
            texture_raison = e.texture_raison or "",
            translucide = e.translucide == true,
            style = style,
            perso = reglages.ids[Radar.CleEntree("pnj", e.id)] ~= nil,
        }
    end
    local animaux = {}
    local Cat = Narvos.AnimauxCatalogue
    for _, a in ipairs((Cat and Cat.ESPECES) or {}) do
        animaux[#animaux + 1] = {
            id = a.id, label = a.label or a.id,
            style = Radar.Style({ sorte = "animal", id = a.id }, reglages),
            perso = reglages.ids[Radar.CleEntree("animal", a.id)] ~= nil,
        }
    end
    local sortes = {}
    for _, s in ipairs(Radar.SORTES) do
        sortes[#sortes + 1] = {
            id = s, label = Radar.LIBELLES_SORTES[s],
            style = Radar.Style({ sorte = s }, reglages),
            perso = reglages.sortes[s] ~= nil,
        }
    end
    local roles = {}
    for _, r in ipairs((Spawnables and Spawnables.ROLES) or {}) do
        roles[#roles + 1] = {
            id = r.id, label = r.label,
            style = Radar.Style({ sorte = "pnj", role = r.id }, reglages),
            perso = reglages.roles[r.id] ~= nil,
        }
    end
    Events.CallRemote("Narvos:EditionPnj:Etat", player, Reliability.Reliable, {
        ouvrir = ouvrir == true,
        edition = permis == true,
        message = message or "",
        entrees = entrees,
        animaux = animaux,
        sortes = sortes,
        roles = roles,
        bilan = { total = #entrees, erreurs = erreurs, translucides = translucides },
        taille_min = Radar.TAILLE_MIN,
        taille_max = Radar.TAILLE_MAX,
    })
end

-- ── Édition ───────────────────────────────────────────────────────────────────

local PORTEES = { sorte = "sortes", role = "roles", pnj = "ids", animal = "ids" }

--- Clé de stockage d'un réglage, ou nil si la cible n'existe pas.
local function Cle(portee, cle)
    if (type(cle) ~= "string" or cle == "" or #cle > 96) then return nil end
    if (portee == "sorte") then return Radar.STYLE_SORTE[cle] and cle or nil end
    if (portee == "role") then return Radar.TEINTE_ROLE[cle] and cle or nil end
    if (portee == "pnj") then return (Spawnables and Spawnables.Trouver(cle)) and Radar.CleEntree("pnj", cle) or nil end
    if (portee == "animal") then return Radar.CleEntree("animal", cle) end
    return nil
end

function EditionPnj.Definir(player, portee, cle, style)
    local permis, raison = garde(player)
    if (not permis) then return EditionPnj.Envoyer(player, false, "Refus : " .. tostring(raison)) end
    local table_cible = PORTEES[portee]
    local k = Cle(portee, cle)
    if (not table_cible or not k) then return EditionPnj.Envoyer(player, false, "Refus : cible inconnue") end
    local propre, pourquoi = Radar.NormaliserStyle(style)
    if (not propre) then return EditionPnj.Envoyer(player, false, "Refus : " .. tostring(pourquoi)) end
    reglages[table_cible][k] = propre
    Persister()
    EditionPnj.Envoyer(player, false, "Reglage enregistre")
end

function EditionPnj.Reinitialiser(player, portee, cle)
    local permis, raison = garde(player)
    if (not permis) then return EditionPnj.Envoyer(player, false, "Refus : " .. tostring(raison)) end
    local table_cible = PORTEES[portee]
    local k = Cle(portee, cle)
    if (not table_cible or not k) then return EditionPnj.Envoyer(player, false, "Refus : cible inconnue") end
    reglages[table_cible][k] = nil
    Persister()
    EditionPnj.Envoyer(player, false, "Reglage retire")
end

--- Branche la règle d'administration (Index.lua : GardeGestion).
---@param fn function  player -> permis, raison
function EditionPnj.UtiliserGarde(fn)
    if (type(fn) == "function") then garde = fn end
end

-- ── Branchements ──────────────────────────────────────────────────────────────

local function EnJeu(player)
    return Session and Session.EnJeu(player)
end

Events.SubscribeRemote("Narvos:EditionPnj:Demander", function(player)
    if (not EnJeu(player)) then return end
    EditionPnj.Envoyer(player, false)
end)

-- Le pont WebUI ne porte pas de table imbriquée fiable : la teinte arrive en
-- trois nombres, remise en table ICI.
Events.SubscribeRemote("Narvos:EditionPnj:Definir", function(player, portee, cle, r, g, b, taille, visible)
    if (not EnJeu(player)) then return end
    local style = {}
    if (tonumber(r) and tonumber(g) and tonumber(b)) then style.teinte = { tonumber(r), tonumber(g), tonumber(b) } end
    if (tonumber(taille)) then style.taille = tonumber(taille) end
    if (type(visible) == "boolean") then style.visible = visible end
    EditionPnj.Definir(player, portee, cle, style)
end)

Events.SubscribeRemote("Narvos:EditionPnj:Reinitialiser", function(player, portee, cle)
    if (not EnJeu(player)) then return end
    EditionPnj.Reinitialiser(player, portee, cle)
end)

do
    local n = Charger()
    Console.Log(("[EDITIONPNJ] %d reglage(s) de radar relu(s)"):format(n))
end

return EditionPnj