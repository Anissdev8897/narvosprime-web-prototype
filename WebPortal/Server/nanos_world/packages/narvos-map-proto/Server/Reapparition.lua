-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Reapparition.lua — relève un JOUEUR mort : à son dernier ZAAP activé,
-- sinon à l'arrivée de sa CITÉ.
--
-- Câblage : `Narvos.ReapparitionServeur = Package.Require("Server/Reapparition.lua")`
-- depuis Server/Index.lua. Règles : Logic/Reapparition.lua (`Narvos.Reapparition`).
--
-- Quatre portes, UN chemin (`ReapparitionServeur.Revive`) :
--   · AUTOMATIQUE             — DELAI_AUTO_MS après la mort (D4, 2026-09-15) ;
--   · `/revive`               — le joueur mort revient tout de suite (après DELAI_MIN_MS) ;
--   · `/revive <joueur>`      — un administrateur relève quelqu'un d'autre ;
--   · bouton RÉAPPARAÎTRE     — panneau du HUD (`Narvos:Mort` / `Narvos:Revive`).
--
-- ── POURQUOI ──────────────────────────────────────────────────────────────────
-- Aucun code ne relevait un joueur mort avant le 2026-09-15 (voir l'en-tête des
-- règles). La cité vient de `perso.cite` (colonne `personnages.cite`, écrite au
-- choix du départ) ; le Zaap de `perso.zaap` (Server/Zaaps.lua). Décision D4 de
-- Hanibes : réapparition automatique, dernier Zaap d'abord, `/revive` conservé.
-- Les PNJ ne sont pas concernés : `GetPlayer()` vide.
--
-- Témoins au journal : « [REAPPARITION] <joueur> mort (retour : <lieu>) » puis
-- « [REAPPARITION] <joueur> releve (<source>) a <lieu> ».
-- ═══════════════════════════════════════════════════════════════════════════════

local ReapparitionServeur = {}

-- ── État (déclaré en tête : les gestionnaires plus bas le lisent) ──────────────
local morts = {}   -- character -> horodatage de la mort (ms, Server.GetTime)

local function Regles()
    return Narvos.Reapparition
end

local function JoueurDe(character)
    local ok, player = pcall(function() return character:GetPlayer() end)
    if (ok and player and player:IsValid()) then return player end
    return nil
end

local function CiteDe(player)
    local session = Narvos.SessionServeur and Narvos.SessionServeur.De(player)
    local perso = session and session.perso
    return perso and perso.cite or nil
end

local function LibelleMonde(monde_id)
    local monde = monde_id and Narvos.Mondes.Trouver(monde_id)
    return (monde and monde.label) or tostring(monde_id or "?")
end

--- Où ce personnage reviendra-t-il ?
--- Rend (arrivée, id du monde, source, lieu lisible, lacet ou nil).
local function PointPour(character, player)
    local depart = Narvos.Depart
    local zaaps = Narvos.ZaapsServeur
    local zaap = (player and zaaps) and zaaps.ArriveePour(player) or nil
    local point, monde_id, source = Regles().Point(Narvos.Mondes, {
        zaap = zaap,
        cite = player and CiteDe(player) or nil,
        recevable = depart and depart.Valide or nil,
        position = character:GetLocation(),
        defaut = (depart and depart.DEFAUT) or "capitale",
    })
    if (source == "zaap") then
        return point, monde_id, source, Narvos.Zaaps.Libelle(zaap.nom), zaap.yaw
    end
    return point, monde_id, source, LibelleMonde(monde_id), nil
end

--- Rend le mana prévu par les règles, par la porte du module des sorts.
local function RendreMana(player)
    local sorts = Narvos.SortsServeur
    if (not sorts or type(sorts.Etat) ~= "function") then return end
    local etat = sorts.Etat(player)
    if (not etat) then return end
    etat.mana = Regles().Mana(etat.mana_max)
    sorts.Envoyer(player)
end

--- Relève `cible` (un joueur) à son Zaap ou à sa cité.
---@param demandeur table|nil  joueur qui demande (lui-même, un administrateur) ; nil = automatique
---@param cible table          joueur à relever
---@return boolean, string      réussi, message pour le demandeur
function ReapparitionServeur.Revive(demandeur, cible)
    local character = cible and cible:IsValid() and cible:GetControlledCharacter()
    if (not character or not character:IsValid()) then return false, "Aucun personnage a relever" end
    if (not character:IsDead()) then
        return false, (demandeur == cible) and "Vous n'etes pas mort" or (cible:GetName() .. " n'est pas mort")
    end
    -- Le délai minimal ne s'impose qu'à soi-même : un administrateur relève tout de
    -- suite, et l'automatique a par construction attendu plus longtemps.
    if (demandeur == cible) then
        local permis, restant = Regles().PeutRevenir(morts[character], Server.GetTime())
        if (not permis) then
            return false, ("Encore %.1f s avant de pouvoir reapparaitre"):format(restant / 1000)
        end
    end

    local point, monde_id, source, lieu, lacet_zaap = PointPour(character, cible)
    if (not point) then
        Console.Warn("[REAPPARITION] aucun point d'arrivee pour " .. tostring(cible:GetName()))
        return false, "Aucun point de reapparition"
    end
    -- Un Zaap dans un autre monde : ses portails doivent exister à l'arrivée.
    if (source == "zaap" and Narvos.VoyageServeur) then Narvos.VoyageServeur.Charger(monde_id) end

    local lacet = lacet_zaap
    if (lacet == nil) then
        lacet = 0
        pcall(function() lacet = character:GetRotation().Yaw end)
    end
    character:Respawn(point, Rotator(0, lacet, 0))
    character:SetHealth(Regles().Vie(character:GetMaxHealth()))
    morts[character] = nil

    RendreMana(cible)
    Events.CallRemote("Narvos:Mort", cible, Reliability.Reliable, false)
    Chat.SendMessage(cible, "<cyan>De retour</> : " .. lieu)
    Console.Log(("[REAPPARITION] %s releve (%s%s) a %s"):format(cible:GetName(), tostring(source),
        demandeur == nil and ", automatique" or "", lieu))
    return true, "Releve : " .. lieu
end

--- La réapparition AUTOMATIQUE d'un corps précis. Le minuteur est lié au corps
--- (`Timer.Bind`) : détruit, il ne se déclenche jamais. L'horodatage comparé
--- écarte le cas d'un joueur relevé puis remort avant l'échéance du premier.
local function ProgrammerAutomatique(character, mort_le)
    local minuteur = Timer.SetTimeout(function()
        if (not character:IsValid() or morts[character] ~= mort_le or not character:IsDead()) then return end
        local player = JoueurDe(character)
        if (not player) then return end
        local ok, message = ReapparitionServeur.Revive(nil, player)
        if (not ok) then Console.Warn("[REAPPARITION] automatique refusee : " .. tostring(message)) end
    end, Regles().DELAI_AUTO_MS)
    pcall(function() Timer.Bind(minuteur, character) end)
end

Character.Subscribe("Death", function(character)
    local player = JoueurDe(character)
    if (not player) then return end
    local mort_le = Server.GetTime()
    morts[character] = mort_le
    local _, _, _, lieu = PointPour(character, player)
    Chat.SendMessage(player, "<red>Vous etes mort</> — retour automatique ("
        .. lieu .. "), ou <cyan>/revive</> tout de suite")
    Events.CallRemote("Narvos:Mort", player, Reliability.Reliable, {
        lieu = lieu,
        delai_ms = Regles().DELAI_MIN_MS,
        auto_ms = Regles().DELAI_AUTO_MS,
    })
    ProgrammerAutomatique(character, mort_le)
    Console.Log(("[REAPPARITION] %s mort (retour : %s)"):format(player:GetName(), lieu))
end)

--- Le bouton RÉAPPARAÎTRE du HUD : même chemin que `/revive`.
Events.SubscribeRemote("Narvos:Revive", function(player)
    local ok, message = ReapparitionServeur.Revive(player, player)
    if (not ok) then Chat.SendMessage(player, "<grey>" .. tostring(message) .. "</>") end
end)

--- Un corps détruit (déconnexion, changement de personnage) n'est plus à relever.
Character.Subscribe("Destroy", function(character)
    morts[character] = nil
end)

return ReapparitionServeur