-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Teleports.lua — L'EXÉCUTANT des points de téléportation.
--
-- Câblage : `Narvos.TeleportsServeur = Package.Require("Server/Teleports.lua")`
-- depuis Server/Index.lua, APRÈS Export, puis `Configurer({…})` et `Charger()`.
--
-- ── LE PARTAGE ────────────────────────────────────────────────────────────────
--   · `Shared/Logic/Teleports.lua` (`Narvos.Teleports`) — les RÈGLES, pures ;
--   · `Shared/Catalogs/Teleports.lua` (`Narvos.TeleportsCatalogue`) — les points,
--     écrits par le jeu (ici, via Export.Catalogue) ET par l'éditeur Unreal
--     (scripts/adk-menu-narvos.py) ;
--   · CE FICHIER — repères, déclencheurs, passage, édition, écriture.
--
-- ── QUI FAIT QUOI ─────────────────────────────────────────────────────────────
-- PASSER : tout joueur, en entrant dans le cercle puis en validant (invite HUD).
-- Le serveur REVÉRIFIE la distance : `proche` vient d'un événement de
-- déclencheur, mais un client ne décide jamais où il se trouve.
-- ÉDITER : `peut_gerer` seulement (commandes_dev OU administrateur, Index.lua).
-- Garde FERMÉE par défaut : sans injection, personne n'édite, et le message le dit.
--
-- ⚠ DEUX ÉCRIVAINS, UN FICHIER. Le jeu réécrit le catalogue à chaque édition ;
-- l'éditeur Unreal aussi. Le serveur ne relit le fichier qu'au démarrage : éditer
-- dans Unreal pendant qu'il tourne, puis éditer en jeu, ÉCRASERAIT le travail de
-- l'éditeur. Règle : serveur arrêté pendant l'édition Unreal (ou `package reload`).
-- ═══════════════════════════════════════════════════════════════════════════════

local TeleportsServeur = {}

local Logique = Narvos.Teleports
local Mondes = Narvos.Mondes

-- ── État — DÉCLARÉ EN TÊTE (piège de la portée, rencontré cinq fois) ──────────
local liste = {}          -- les points, source de vérité à l'exécution
local entites = {}        -- id -> { trigger, repere }
local proche = {}         -- player -> id du point dont il est dans le cercle
local dernier = {}        -- player -> horloge du dernier passage (ms)
local horloge_ms = 0
Timer.SetInterval(function() horloge_ms = horloge_ms + 100 end, 100)

--- Délai entre deux passages d'un même joueur : une touche tenue ne doit pas
--- faire rebondir entre deux portes.
TeleportsServeur.DELAI_MS = 1500
--- Portée d'édition depuis l'administrateur (cm), comme le gizmo des props.
TeleportsServeur.PORTEE_EDITION = 5000.0
TeleportsServeur.LONGUEUR_MAX = 64

local deps = {
    joueur_de = function(_) return nil end,
    peut_gerer = function(_) return false end,
    ecrire = function(_, _) return nil end,
    charger_monde = function(_) end,
}

function TeleportsServeur.Configurer(d)
    if (type(d) ~= "table") then return false end
    for k, v in pairs(d) do deps[k] = v end
    return true
end

-- ── Coordonnées : LOCALES dans le catalogue, MONDE dans le jeu ───────────────

local function Decalage(monde_id)
    return (Mondes and Mondes.DECALAGES and Mondes.DECALAGES[monde_id]) or Vector(0, 0, 0)
end

local function VersMonde(p)
    local d = Decalage(p.monde)
    return Vector(p.x + d.X, p.y + d.Y, p.z + d.Z)
end

local function VersLocal(v)
    local m = Mondes and Mondes.ParPosition(v) or nil
    if (not m) then return nil end
    local d = Decalage(m.id)
    return { monde = m.id, x = v.X - d.X, y = v.Y - d.Y, z = v.Z - d.Z }
end

-- Exportées pour Server/Zaaps.lua : même convention de coordonnées (locales au
-- monde dans le catalogue, monde dans le jeu). Une seconde copie divergerait.
TeleportsServeur.VersMonde = VersMonde
TeleportsServeur.VersLocal = VersLocal

-- ── Repères et déclencheurs ──────────────────────────────────────────────────

local function Retirer(id)
    local e = entites[id]
    if (e) then
        for _, x in pairs(e) do
            if (x and x:IsValid()) then x:Destroy() end
        end
    end
    entites[id] = nil
end

--- Ce que l'invite du joueur affiche : le nom, et s'il mène quelque part.
local function Annoncer(player, id)
    local p = Logique.Trouver(liste, id)
    if (not p) then return end
    local dest = Logique.Destination(liste, id)
    local vers = p.vers and Logique.Trouver(liste, p.vers) or nil
    Events.CallRemote("Narvos:TP:Proche", player, Reliability.Reliable, {
        id = p.id, nom = p.nom, pret = (dest ~= nil),
        vers = vers and vers.nom or nil,
    })
end

local function Poser(p)
    Retirer(p.id)
    local centre = VersMonde(p)
    -- Le repère : un disque au sol, du diamètre du cercle. Sans lui, le point est
    -- un déclencheur invisible — la « fausse affordance » que le level design
    -- proscrit. SM_Cylinder mesure 100 cm : échelle = diamètre / 100.
    local ok, repere = pcall(function()
        local r = StaticMesh(Vector(centre.X, centre.Y, centre.Z + 2.0), Rotator(),
            "nanos-world::SM_Cylinder", CollisionType.NoCollision)
        r:SetScale(Vector(p.rayon / 50.0, p.rayon / 50.0, 0.02))
        return r
    end)
    if (not ok) then
        Console.Warn("[TP] repere refuse pour " .. p.id .. " : " .. tostring(repere))
        repere = nil
    end

    -- 7e argument = overlap_only_classes : seuls les personnages nous intéressent
    -- (leçon des pads : sans liste blanche, le moteur teste chaque entité mobile).
    local trigger = Trigger(centre, Rotator(), Vector(p.rayon), TriggerType.Sphere,
        false, nil, { "Character" })
    local id = p.id
    trigger:Subscribe("BeginOverlap", function(_, acteur)
        local player = deps.joueur_de(acteur)
        if (not player) then return end
        proche[player] = id
        Annoncer(player, id)
    end)
    trigger:Subscribe("EndOverlap", function(_, acteur)
        local player = deps.joueur_de(acteur)
        if (not player or proche[player] ~= id) then return end
        proche[player] = nil
        Events.CallRemote("Narvos:TP:Proche", player, Reliability.Reliable, false)
    end)
    entites[id] = { trigger = trigger, repere = repere }
end

local function Rebatir()
    for id in pairs(entites) do Retirer(id) end
    for _, p in ipairs(liste) do Poser(p) end
end

--- Écrit le catalogue. Rend le chemin, ou nil (et le journal le dit).
local function Sauver()
    local chemin = deps.ecrire("Teleports.lua", Logique.Catalogue(liste))
    if (not chemin) then Console.Warn("[TP] ecriture du catalogue REFUSEE") end
    return chemin
end

-- ── Chargement ───────────────────────────────────────────────────────────────

function TeleportsServeur.Charger()
    local refus
    liste, refus = Logique.Charger(Narvos.TeleportsCatalogue)
    for _, r in ipairs(refus) do Console.Warn("[TP] " .. r) end
    Rebatir()
    Console.Log(("[TP] %d point(s) de teleportation poses"):format(#liste))
end

-- ── Passer ───────────────────────────────────────────────────────────────────

--- Un joueur valide l'invite. Rend (true, nom) ou (false, raison NOMMÉE).
function TeleportsServeur.Utiliser(player, id)
    if (type(id) ~= "string" or proche[player] ~= id) then
        return false, "Aucun point de passage ici"
    end
    local p = Logique.Trouver(liste, id)
    if (not p) then return false, "Ce point n'existe plus" end
    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    local c, o = VersMonde(p), character:GetLocation()
    local dx, dy, dz = o.X - c.X, o.Y - c.Y, o.Z - c.Z
    local marge = p.rayon * 1.5 + 100.0
    if ((dx * dx + dy * dy + dz * dz) > marge * marge) then
        return false, "Trop loin du point"
    end
    if (dernier[player] and (horloge_ms - dernier[player]) < TeleportsServeur.DELAI_MS) then
        return false, "Un instant..."
    end

    local dest, raison = Logique.Destination(liste, id)
    if (not dest) then return false, raison end
    local ici = VersLocal(o)
    if (not ici or ici.monde ~= dest.monde) then deps.charger_monde(dest.monde) end

    dernier[player] = horloge_ms
    proche[player] = nil
    character:SetLocation(VersMonde(dest))
    character:SetRotation(Rotator(0, dest.yaw or 0, 0))
    Console.Log(("[TP] %s : %s -> %s"):format(tostring(player:GetName()), p.id,
        tostring(p.vers or (dest.monde .. " (position)"))))
    return true, p.nom
end

-- ── Éditer (garde : peut_gerer) ──────────────────────────────────────────────

local function Chaine(v)
    if (type(v) ~= "string" or #v == 0 or #v > TeleportsServeur.LONGUEUR_MAX) then return nil end
    return v
end

local function IciDe(player)
    local character = player:GetControlledCharacter()
    if (not character) then return nil, "Aucun personnage" end
    local loc = VersLocal(character:GetLocation())
    if (not loc) then return nil, "Position hors de tout monde connu" end
    loc.yaw = character:GetRotation().Yaw
    return loc
end

--- Applique une liste neuve : repères, écriture, journal.
local function Adopter(neuve, message)
    liste = neuve
    Rebatir()
    local chemin = Sauver()
    return true, message .. (chemin and "" or " (NON enregistre : ecriture refusee)")
end

local OPERATIONS = {}

OPERATIONS.Creer = function(player, nom)
    local ici, raison = IciDe(player)
    if (not ici) then return false, raison end
    local neuve, id = Logique.Creer(liste, {
        nom = nom, monde = ici.monde, x = ici.x, y = ici.y, z = ici.z, yaw = ici.yaw,
    })
    if (not neuve) then return false, id end
    return Adopter(neuve, "Point cree : " .. id)
end

OPERATIONS.Renommer = function(_, id, nom)
    local neuve, raison = Logique.Renommer(liste, Chaine(id), nom)
    if (not neuve) then return false, raison end
    return Adopter(neuve, "Point renomme")
end

--- Déplace le point là où se tient l'administrateur (le plus simple, et le
--- plus sûr : pas de coordonnée tapée à la main).
OPERATIONS.DeplacerIci = function(player, id)
    local ici, raison = IciDe(player)
    if (not ici) then return false, raison end
    local neuve, r = Logique.Deplacer(liste, Chaine(id), ici)
    if (not neuve) then return false, r end
    return Adopter(neuve, "Point deplace ici")
end

--- Déplacement au GIZMO : transform MONDE visée, bornée à la portée d'édition
--- depuis l'administrateur (même règle que Server/Props.lua).
OPERATIONS.Deplacer = function(player, id, x, y, z, yaw)
    x, y, z = tonumber(x), tonumber(y), tonumber(z)
    if (not x or not y or not z or x ~= x or y ~= y or z ~= z) then return false, "Position invalide" end
    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end
    local o = character:GetLocation()
    local dx, dy, dz = x - o.X, y - o.Y, z - o.Z
    if ((dx * dx + dy * dy + dz * dz) > TeleportsServeur.PORTEE_EDITION ^ 2) then
        return false, "Trop loin de vous"
    end
    local loc = VersLocal(Vector(x, y, z))
    if (not loc) then return false, "Position hors de tout monde connu" end
    loc.yaw = tonumber(yaw) or 0
    local neuve, r = Logique.Deplacer(liste, Chaine(id), loc)
    if (not neuve) then return false, r end
    return Adopter(neuve, "Point deplace")
end

OPERATIONS.DestinationIci = function(player, id)
    local ici, raison = IciDe(player)
    if (not ici) then return false, raison end
    local neuve, r = Logique.DefinirDestination(liste, Chaine(id), ici)
    if (not neuve) then return false, r end
    return Adopter(neuve, "Destination = votre position")
end

OPERATIONS.DestinationVers = function(_, id, autre)
    local neuve, r = Logique.DefinirDestination(liste, Chaine(id), { vers = Chaine(autre) })
    if (not neuve) then return false, r end
    return Adopter(neuve, "Destination = " .. tostring(autre))
end

OPERATIONS.Lier = function(_, id)
    local neuve, retour = Logique.Lier(liste, Chaine(id))
    if (not neuve) then return false, retour end
    return Adopter(neuve, "Retour cree : " .. tostring(retour))
end

OPERATIONS.Supprimer = function(player, id)
    local neuve, r = Logique.Supprimer(liste, Chaine(id))
    if (not neuve) then return false, r end
    for joueur, pid in pairs(proche) do
        if (pid == id) then
            proche[joueur] = nil
            Events.CallRemote("Narvos:TP:Proche", joueur, Reliability.Reliable, false)
        end
    end
    return Adopter(neuve, "Point supprime")
end

--- Aller voir un point (l'administrateur s'y rend, devant lui).
OPERATIONS.Aller = function(player, id)
    local p = Logique.Trouver(liste, Chaine(id))
    if (not p) then return false, "point inconnu" end
    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end
    local a = math.rad(p.yaw or 0)
    local d = p.rayon + Logique.RECUL_ARRIVEE
    local ici = VersLocal(character:GetLocation())
    if (not ici or ici.monde ~= p.monde) then deps.charger_monde(p.monde) end
    character:SetLocation(VersMonde({ monde = p.monde, x = p.x + math.cos(a) * d,
        y = p.y + math.sin(a) * d, z = p.z }))
    return true, "Vous etes au point " .. p.nom
end

--- Exécute une opération d'édition, garde comprise.
function TeleportsServeur.Editer(player, operation, ...)
    local op = OPERATIONS[operation]
    if (not op) then return false, "operation inconnue" end
    if (not deps.peut_gerer(player)) then return false, "Reserve aux administrateurs" end
    return op(player, ...)
end

-- ── L'écran d'édition (WebUI) ────────────────────────────────────────────────

--- La liste pour le panneau d'édition, avec positions MONDE et LOCALES.
function TeleportsServeur.EnvoyerListe(player, ouvrir, message)
    local points = {}
    if (deps.peut_gerer(player)) then
        for _, p in ipairs(liste) do
            local w = VersMonde(p)
            local vers = p.vers and Logique.Trouver(liste, p.vers) or nil
            points[#points + 1] = {
                id = p.id, nom = p.nom, monde = p.monde, rayon = p.rayon, yaw = p.yaw,
                x = p.x, y = p.y, z = p.z, wx = w.X, wy = w.Y, wz = w.Z,
                vers = p.vers, vers_nom = vers and vers.nom or nil,
                dest = p.dest and { monde = p.dest.monde, x = p.dest.x, y = p.dest.y, z = p.dest.z } or nil,
            }
        end
    end
    Events.CallRemote("Narvos:TP:Liste", player, Reliability.Reliable, {
        ouvrir = (ouvrir == true),
        edition = deps.peut_gerer(player),
        points = points,
        message = message,
    })
end

Events.SubscribeRemote("Narvos:TP:Utiliser", function(player, id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "interaction")) then return end
    local ok, raison = TeleportsServeur.Utiliser(player, id)
    if (not ok) then
        Events.CallRemote("Narvos:TP:Refus", player, Reliability.Reliable, tostring(raison))
    end
end)

Events.SubscribeRemote("Narvos:TP:Demander", function(player)
    TeleportsServeur.EnvoyerListe(player, false, nil)
end)

-- Une seule porte d'entrée pour l'édition : l'opération est un NOM de la table
-- OPERATIONS, jamais une fonction choisie par le client.
Events.SubscribeRemote("Narvos:TP:Editer", function(player, operation, a, b, c, d, e)
    if (type(operation) ~= "string") then return end
    local ok, message = TeleportsServeur.Editer(player, operation, a, b, c, d, e)
    TeleportsServeur.EnvoyerListe(player, false, (ok and "" or "Refus : ") .. tostring(message))
end)

Player.Subscribe("Destroy", function(player)
    proche[player] = nil
    dernier[player] = nil
end)

return TeleportsServeur