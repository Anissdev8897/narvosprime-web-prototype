-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Zaaps.lua — L'EXÉCUTANT des Zaaps : déclencheurs, activation, édition.
--
-- Câblage : `Narvos.ZaapsServeur = Package.Require("Server/Zaaps.lua")` depuis
-- Server/Index.lua, APRÈS Teleports (coordonnées) et Export (écriture), puis
-- `Configurer({…})` et `Charger()`.
--
-- ── DÉCISION D4 DE HANIBES (2026-09-15) ───────────────────────────────────────
-- « Ajoute un prop appelé Zaap. Lorsqu'un joueur active un Zaap, celui-ci devient
-- son nouveau point de réapparition. En cas de mort, le joueur pourra donc
-- réapparaître au dernier Zaap activé. »
--
-- ── LE PARTAGE ────────────────────────────────────────────────────────────────
--   · `Shared/Logic/Zaaps.lua` (`Narvos.Zaaps`) — les RÈGLES, pures ;
--   · `Shared/Catalogs/Zaaps.lua` (`Narvos.ZaapsCatalogue`) — les Zaaps posés,
--     écrits par le jeu (ici, via Export.Catalogue) ;
--   · CE FICHIER — déclencheurs, activation, persistance, édition ;
--   · `Client/Zaaps.lua` — le socle, le cristal et la lumière (entités CLIENT :
--     la décoration n'a pas à traverser le réseau, et chaque joueur voit SON Zaap
--     actif briller autrement).
--
-- ── QUI FAIT QUOI ─────────────────────────────────────────────────────────────
-- ACTIVER : tout joueur vivant, dans le cercle, touche d'interaction. Le serveur
-- REVÉRIFIE la distance : `proche` vient d'un déclencheur, mais un client ne
-- décide jamais où il se trouve. Le choix est écrit en base AVANT d'être annoncé.
-- ÉDITER : `peut_gerer` seulement. Garde FERMÉE par défaut.
--
-- Témoins au journal : « [ZAAP] n zaap(s) pose(s) », « [ZAAP] <joueur> active <id> ».
-- ═══════════════════════════════════════════════════════════════════════════════

local ZaapsServeur = {}

local Logique = Narvos.Zaaps

-- ── État — DÉCLARÉ EN TÊTE (les gestionnaires plus bas le lisent) ─────────────
local liste = {}      -- les Zaaps, source de vérité à l'exécution
local triggers = {}   -- id -> Trigger
local proche = {}     -- player -> id du Zaap dont il est dans le cercle
local dernier = {}    -- player -> Server.GetTime() de la dernière activation

--- Délai entre deux activations d'un même joueur : une touche tenue ne doit pas
--- réécrire la base dix fois par seconde.
ZaapsServeur.DELAI_MS = 1500
--- Marge de la revérification de distance, comme les points de téléportation.
ZaapsServeur.MARGE_CM = 100.0

local deps = {
    joueur_de = function(_) return nil end,
    peut_gerer = function(_) return false end,
    ecrire = function(_, _) return nil end,
    charger_monde = function(_) end,
    --- Le personnage EN JEU du joueur (table de session : `zaap`, `id`…), ou nil.
    perso_de = function(_) return nil end,
    --- Écrit le Zaap retenu en base. Rend (ok, raison).
    enregistrer = function(_, _) return false, "sauvegarde non branchee" end,
}

function ZaapsServeur.Configurer(d)
    if (type(d) ~= "table") then return false end
    for k, v in pairs(d) do deps[k] = v end
    return true
end

-- ── Coordonnées : celles des points de téléportation (Server/Teleports.lua) ───

local function VersMonde(p)
    return Narvos.TeleportsServeur.VersMonde(p)
end

local function VersLocal(v)
    return Narvos.TeleportsServeur.VersLocal(v)
end

local function Maintenant()
    return Server.GetTime()
end

-- ── Ce que voit un joueur ────────────────────────────────────────────────────

--- L'identifiant du Zaap actif de ce joueur, s'il existe ENCORE. Un Zaap supprimé
--- depuis se lit comme « aucun » : retour à la cité (Logic/Reapparition.lua).
local function ActifDe(player)
    local perso = deps.perso_de(player)
    local id = perso and perso.zaap or nil
    if (id and Logique.Trouver(liste, id)) then return id end
    return nil
end

local function Annoncer(player, id)
    local p = Logique.Trouver(liste, id)
    if (not p) then return end
    Events.CallRemote("Narvos:Zaap:Proche", player, Reliability.Reliable, {
        id = p.id, nom = p.nom, actif = (ActifDe(player) == p.id),
    })
end

--- La liste pour le dessin côté client : positions MONDE, rien d'autre.
local function PointsMonde()
    local points = {}
    for _, p in ipairs(liste) do
        local w = VersMonde(p)
        points[#points + 1] = { id = p.id, nom = p.nom, x = w.X, y = w.Y, z = w.Z, yaw = p.yaw, rayon = p.rayon }
    end
    return points
end

--- Envoie la liste ET le Zaap actif à un joueur (`actif = ""` : aucun).
function ZaapsServeur.Envoyer(player)
    Events.CallRemote("Narvos:Zaap:Liste", player, Reliability.Reliable, {
        points = PointsMonde(),
        actif = ActifDe(player) or "",
    })
end

--- Après une édition : la liste à tous. `actif` absent = inchangé chez chacun.
local function Diffuser()
    Events.BroadcastRemote("Narvos:Zaap:Liste", Reliability.Reliable, { points = PointsMonde() })
end

-- ── Déclencheurs ─────────────────────────────────────────────────────────────

local function Retirer(id)
    local t = triggers[id]
    if (t and t:IsValid()) then t:Destroy() end
    triggers[id] = nil
end

local function Poser(p)
    Retirer(p.id)
    -- 7e argument = overlap_only_classes : seuls les personnages nous intéressent.
    local trigger = Trigger(VersMonde(p), Rotator(), Vector(p.rayon), TriggerType.Sphere,
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
        Events.CallRemote("Narvos:Zaap:Proche", player, Reliability.Reliable, false)
    end)
    triggers[id] = trigger
end

local function Rebatir()
    for id in pairs(triggers) do Retirer(id) end
    for _, p in ipairs(liste) do Poser(p) end
end

local function Sauver()
    local chemin = deps.ecrire("Zaaps.lua", Logique.Catalogue(liste))
    if (not chemin) then Console.Warn("[ZAAP] ecriture du catalogue REFUSEE") end
    return chemin
end

function ZaapsServeur.Charger()
    local refus
    liste, refus = Logique.Charger(Narvos.ZaapsCatalogue)
    for _, r in ipairs(refus) do Console.Warn("[ZAAP] " .. r) end
    Rebatir()
    Console.Log(("[ZAAP] %d zaap(s) pose(s)"):format(#liste))
end

--- Copie de la liste (commande /zaap, harnais).
function ZaapsServeur.Liste()
    return Narvos.Teleports.Copier(liste)
end

-- ── Activer ──────────────────────────────────────────────────────────────────

--- Un joueur active le Zaap où il se tient.
--- Rend (true, nom, nouveau) — `nouveau = false` s'il l'était déjà —, ou
--- (false, raison NOMMÉE).
function ZaapsServeur.Activer(player, id)
    if (type(id) ~= "string" or proche[player] ~= id) then return false, "Aucun Zaap ici" end
    local p = Logique.Trouver(liste, id)
    if (not p) then return false, "Ce Zaap n'existe plus" end
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return false, "Aucun personnage" end
    if (character:IsDead()) then return false, "Impossible une fois mort" end

    local c, o = VersMonde(p), character:GetLocation()
    local dx, dy, dz = o.X - c.X, o.Y - c.Y, o.Z - c.Z
    local marge = p.rayon * 1.5 + ZaapsServeur.MARGE_CM
    if ((dx * dx + dy * dy + dz * dz) > marge * marge) then return false, "Trop loin du Zaap" end

    local perso = deps.perso_de(player)
    if (not perso) then return false, "Aucun personnage en jeu" end
    if (perso.zaap == id) then
        Annoncer(player, id)
        return true, p.nom, false
    end

    local maintenant = Maintenant()
    if (dernier[player] and (maintenant - dernier[player]) < ZaapsServeur.DELAI_MS) then
        return false, "Un instant..."
    end
    dernier[player] = maintenant

    -- La base D'ABORD : un Zaap annoncé mais non écrit serait perdu à la
    -- reconnexion, et le joueur reviendrait à sa cité sans comprendre pourquoi.
    local ecrit, raison = deps.enregistrer(player, id)
    if (not ecrit) then
        Console.Warn(("[ZAAP] %s : %s non enregistre (%s)"):format(
            tostring(player:GetName()), id, tostring(raison)))
        return false, "Zaap non enregistre : " .. tostring(raison)
    end
    perso.zaap = id

    Events.CallRemote("Narvos:Zaap:Actif", player, Reliability.Reliable, {
        id = p.id, nom = p.nom, x = c.X, y = c.Y, z = c.Z,
    })
    Annoncer(player, id)
    Console.Log(("[ZAAP] %s active %s (%s)"):format(tostring(player:GetName()), p.id, p.monde))
    return true, p.nom, true
end

--- Où revient ce joueur s'il meurt maintenant : son Zaap actif, résolu en position
--- MONDE — { position, monde, nom, yaw } —, ou nil (aucun, ou supprimé depuis).
function ZaapsServeur.ArriveePour(player)
    local id = ActifDe(player)
    if (not id) then return nil end
    local arrivee = Logique.Arrivee(liste, id)
    if (not arrivee) then return nil end
    local p = Logique.Trouver(liste, id)
    return { position = VersMonde(arrivee), monde = arrivee.monde, nom = p.nom, yaw = arrivee.yaw }
end

-- ── Éditer (garde : peut_gerer) ──────────────────────────────────────────────

local function IciDe(player)
    local character = player:GetControlledCharacter()
    if (not character) then return nil, "Aucun personnage" end
    local loc = VersLocal(character:GetLocation())
    if (not loc) then return nil, "Position hors de tout monde connu" end
    loc.yaw = character:GetRotation().Yaw
    return loc
end

--- Applique une liste neuve : déclencheurs, écriture, diffusion.
local function Adopter(neuve, message)
    liste = neuve
    Rebatir()
    local chemin = Sauver()
    Diffuser()
    return true, message .. (chemin and "" or " (NON enregistre : ecriture refusee)")
end

local OPERATIONS = {}

--- Un Zaap là où se tient l'administrateur, tourné comme lui : on arrivera
--- devant, dans le sens où il regardait.
OPERATIONS.Creer = function(player, nom)
    local ici, raison = IciDe(player)
    if (not ici) then return false, raison end
    local neuve, id = Logique.Creer(liste, {
        nom = nom, monde = ici.monde, x = ici.x, y = ici.y, z = ici.z, yaw = ici.yaw,
    })
    if (not neuve) then return false, id end
    return Adopter(neuve, "Zaap cree : " .. id)
end

OPERATIONS.Renommer = function(_, id, nom)
    local neuve, raison = Logique.Renommer(liste, id, nom)
    if (not neuve) then return false, raison end
    return Adopter(neuve, "Zaap renomme")
end

OPERATIONS.DeplacerIci = function(player, id)
    local ici, raison = IciDe(player)
    if (not ici) then return false, raison end
    local neuve, r = Logique.Deplacer(liste, id, ici)
    if (not neuve) then return false, r end
    return Adopter(neuve, "Zaap deplace ici")
end

--- Supprimer ne touche pas la base : un personnage qui retenait ce Zaap revient à
--- sa cité (`ActifDe` ne le trouve plus), et retrouvera son choix si un Zaap du
--- même identifiant est recréé.
OPERATIONS.Supprimer = function(_, id)
    local neuve, r = Logique.Supprimer(liste, id)
    if (not neuve) then return false, r end
    for joueur, zid in pairs(proche) do
        if (zid == id) then
            proche[joueur] = nil
            Events.CallRemote("Narvos:Zaap:Proche", joueur, Reliability.Reliable, false)
        end
    end
    return Adopter(neuve, "Zaap supprime")
end

--- L'administrateur se rend là où l'on réapparaît devant ce Zaap.
OPERATIONS.Aller = function(player, id)
    local arrivee = Logique.Arrivee(liste, id)
    if (not arrivee) then return false, "zaap inconnu : " .. tostring(id) end
    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end
    local ici = VersLocal(character:GetLocation())
    if (not ici or ici.monde ~= arrivee.monde) then deps.charger_monde(arrivee.monde) end
    character:SetLocation(VersMonde(arrivee))
    character:SetRotation(Rotator(0, arrivee.yaw or 0, 0))
    return true, "Vous etes devant : " .. Logique.Libelle(Logique.Trouver(liste, id).nom)
end

--- Exécute une opération d'édition, garde comprise. L'opération est un NOM de la
--- table OPERATIONS, jamais une fonction choisie par l'appelant.
function ZaapsServeur.Editer(player, operation, ...)
    local op = OPERATIONS[operation]
    if (not op) then return false, "operation inconnue" end
    if (not deps.peut_gerer(player)) then return false, "Reserve aux administrateurs" end
    return op(player, ...)
end

-- ── Réseau ───────────────────────────────────────────────────────────────────

Events.SubscribeRemote("Narvos:Zaap:Activer", function(player, id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "interaction")) then return end
    local ok, resultat, nouveau = ZaapsServeur.Activer(player, id)
    if (not ok) then
        Events.CallRemote("Narvos:Zaap:Refus", player, Reliability.Reliable, tostring(resultat))
    elseif (nouveau) then
        Chat.SendMessage(player, "<cyan>" .. Logique.Libelle(resultat) .. "</> active — vous reapparaitrez ici")
    else
        Chat.SendMessage(player, "<grey>" .. Logique.Libelle(resultat) .. " est deja votre point de reapparition</>")
    end
end)

-- Le client la réclame au chargement de ses scripts ; le serveur la renvoie à la
-- possession d'un corps (le personnage, donc son Zaap, n'est connu qu'alors).
Events.SubscribeRemote("Narvos:Zaap:Demander", function(player)
    ZaapsServeur.Envoyer(player)
end)

Player.Subscribe("Possess", function(player, _pawn)
    ZaapsServeur.Envoyer(player)
end)

Player.Subscribe("Destroy", function(player)
    proche[player] = nil
    dernier[player] = nil
end)

return ZaapsServeur