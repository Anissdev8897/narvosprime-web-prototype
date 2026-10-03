-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Emotes.lua — jouer les animations contextuelles, et gérer leurs touches.
--
-- Câblage : Package.Require("Server/Emotes.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua (il lit la session pour connaître le compte du joueur).
--
-- ── CE QUI REND LE SYSTÈME MODULAIRE ──────────────────────────────────────────
-- Ce fichier ne connaît AUCUNE animation par son nom. Il ne sait que :
--   · demander au catalogue si un identifiant existe (`Emotes.Trouver`)
--   · jouer l'asset que le catalogue lui rend
--   · lire et écrire des couples (touche, identifiant)
--
-- Ajouter un pack d'animations demain ne demande donc AUCUNE modification ici :
-- on régénère `Catalogs/Emotes.lua` et les nouvelles entrées apparaissent seules
-- dans le menu, assignables comme les autres.
--
-- ── LE MÊME SYSTÈME POUR TOUS LES MODÈLES ─────────────────────────────────────
-- Aucune dépendance à un modèle. Toutes les animations du catalogue sont sur
-- SKEL_Mannequin (vérifié : verdict IDENTIQUE, 68 os), et tous nos personnages
-- aussi — c'est la contrainte que nanos impose de toute façon. Une animation
-- jouée sur un corps modulaire habillé fonctionne donc exactement comme sur le
-- mannequin nu : les pièces attachées suivent le squelette.
-- ═══════════════════════════════════════════════════════════════════════════════

local Emotes = {}

local Catalogue = Narvos.Emotes
local Raccourcis = Narvos.Raccourcis
local Session = Narvos.SessionServeur

--- Durée de fondu, en secondes. Assez court pour répondre, assez long pour ne
--- pas claquer d'une pose à l'autre.
local FONDU = 0.22

--- Emote en cours par joueur, pour savoir quoi arrêter.
local en_cours = {}

--- Joueurs dont l'emote en cours BOUCLE. Seules celles-là peuvent rester figées
--- sur un personnage qui marche : une emote simple se termine seule.
local en_boucle_par_joueur = {}

--- Vitesse horizontale (cm/s) au-delà de laquelle une emote en boucle s'arrête.
--- Retour de jeu du 2026-09-13 : une pose en boucle (garde, danse, assis) restait
--- jouée en FullBody pendant la marche — le corps glissait, figé dans la pose.
--- 80 cm/s : au-dessus d'un pas sur place, sous la marche lente (~150).
Emotes.SEUIL_MARCHE_CM_S = 80
Emotes.SURVEILLANCE_MS = 250

-- ── Jouer ─────────────────────────────────────────────────────────────────────

--- Joue une animation sur le personnage d'un joueur.
---
---@param player table
---@param id string      identifiant du catalogue
---@param boucler boolean|nil  forcer la boucle (défaut : ce que dit le catalogue)
---@return boolean, string|nil
function Emotes.Jouer(player, id, boucler)
    local anim = Catalogue.Trouver(id)
    if (not anim) then return false, "Animation inconnue" end

    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    -- `stop_all_montages = true` : c'est ce qui remplace l'emote précédente au
    -- lieu de l'empiler. nanos n'expose pas de `StopAnimation`, et deux montages
    -- full-body simultanés donnent une pose incohérente.
    local en_boucle = boucler
    if (en_boucle == nil) then en_boucle = anim.boucle end

    character:PlayAnimation(
        anim.asset,
        AnimationSlotType.FullBody,
        en_boucle and true or false,
        FONDU, FONDU,
        1.0,
        true)

    en_cours[player] = id
    en_boucle_par_joueur[player] = en_boucle and true or nil
    return true, nil
end

--- Arrête l'emote en cours en rendant la main à la locomotion.
---
--- nanos n'a pas de `StopAnimation` : on rejoue donc l'animation courante avec
--- une durée nulle et `stop_all_montages`, ce qui purge le slot. C'est le seul
--- moyen documenté, et il vaut mieux le dire ici que le redécouvrir.
---@param player table
function Emotes.Arreter(player)
    local character = player:GetControlledCharacter()
    if (not character) then
        en_cours[player] = nil
        return
    end

    local id = en_cours[player]
    local anim = id and Catalogue.Trouver(id)
    if (anim) then
        -- `StopAnimation` existe (BasePawn.json, autorité both ; Server/Menottes.lua
        -- s'en sert) : l'en-tête ci-dessus date d'avant. Le rejeu à durée nulle
        -- reste en REPLI si l'appel échoue — il faisait repartir la pose une
        -- trame avant de la fondre.
        local arrete = pcall(function() character:StopAnimation(anim.asset) end)
        if (not arrete) then
            character:PlayAnimation(anim.asset, AnimationSlotType.FullBody, false, 0, FONDU, 1.0, true)
        end
    end
    en_cours[player] = nil
    en_boucle_par_joueur[player] = nil
end

--- Arrête les emotes en boucle des joueurs qui se déplacent, et le dit à leur
--- client (dont la bascule de touche garde sinon l'emote pour « en cours »).
local function SurveillerDeplacements()
    for player in pairs(en_boucle_par_joueur) do
        local ok, character = pcall(function() return player:GetControlledCharacter() end)
        if (ok and character and character:IsValid()) then
            local ok_v, v = pcall(function() return character:GetVelocity() end)
            if (ok_v and v) then
                local horizontale = math.sqrt(v.X * v.X + v.Y * v.Y)
                if (horizontale > Emotes.SEUIL_MARCHE_CM_S) then
                    Emotes.Arreter(player)
                    pcall(Events.CallRemote, "Narvos:EmoteArretee", player, Reliability.Reliable)
                end
            end
        else
            en_boucle_par_joueur[player] = nil
        end
    end
end
Timer.SetInterval(SurveillerDeplacements, Emotes.SURVEILLANCE_MS)

--- Le joueur joue-t-il une emote ?
function Emotes.EnCours(player)
    return en_cours[player]
end

-- ── Envoi de l'état au client ─────────────────────────────────────────────────

--- Pousse le catalogue ET les raccourcis du joueur vers son menu.
--- Les deux partent ensemble : le menu doit pouvoir afficher la touche à côté de
--- chaque animation dès le premier rendu, sans second aller-retour.
---@param player table
function Emotes.Envoyer(player)
    local s = Session and Session.De(player)
    local compte = s and s.compte and s.compte.id or nil

    -- ⚠ LES TOUCHES RÉSERVÉES SE CALCULENT, elles ne s'écrivent plus.
    -- La liste figée qui vivait ici (`B`, `I`, `F3`, `F10`) est devenue FAUSSE le
    -- jour où ces touches sont devenues reconfigurables : un joueur ayant déplacé
    -- son inventaire sur `J` voyait toujours `I` barrée dans le menu, et `J`
    -- présentée comme libre — précisément l'inverse de la vérité.
    local reservees = { "W", "A", "S", "D" }
    for _, assignee in pairs(Narvos.Commandes.ParCompte(compte)) do
        if (assignee ~= "") then reservees[#reservees + 1] = assignee end
    end

    Events.CallRemote("Narvos:Emotes", player, Reliability.Reliable, {
        categories = Catalogue.Options(),
        raccourcis = Raccourcis.ParCompte(compte),
        touches_reservees = reservees,
        max = Raccourcis.MAX,
    })
end

-- ── Réception ─────────────────────────────────────────────────────────────────

--- Le joueur est-il en état d'agir ? Un joueur encore à l'écran de sélection n'a
--- pas de corps, et un client modifié pourrait quand même envoyer l'événement.
local function EnJeu(player)
    return Session and Session.EnJeu(player)
end

Events.SubscribeRemote("Narvos:JouerEmote", function(player, id, boucler)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "emote")) then return end
    if (not EnJeu(player)) then return end

    local ok, raison = Emotes.Jouer(player, id, boucler)
    if (not ok) then
        Events.CallRemote("Narvos:EmoteErreur", player, Reliability.Reliable, raison)
    end
end)

Events.SubscribeRemote("Narvos:ArreterEmote", function(player)
    if (not EnJeu(player)) then return end
    Emotes.Arreter(player)
end)

Events.SubscribeRemote("Narvos:DefinirRaccourci", function(player, touche, id)
    if (not EnJeu(player)) then return end

    -- ⚠ Le compte vient de la SESSION, jamais du client. Sinon un joueur
    -- écrirait dans les raccourcis d'un autre.
    local s = Session.De(player)
    if (not s or not s.compte) then return end

    local ok, raison = Raccourcis.Definir(s.compte.id, touche, id)
    if (not ok) then
        Events.CallRemote("Narvos:EmoteErreur", player, Reliability.Reliable, raison)
        return
    end
    Emotes.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:RetirerRaccourci", function(player, touche)
    if (not EnJeu(player)) then return end

    local s = Session.De(player)
    if (not s or not s.compte) then return end

    Raccourcis.Retirer(s.compte.id, touche)
    Emotes.Envoyer(player)
end)

--- Le menu réclame son contenu à l'ouverture. On ne l'envoie pas d'office au
--- spawn : le catalogue fait plusieurs dizaines de kilo-octets, et la plupart des
--- joueurs n'ouvriront jamais ce menu.
Events.SubscribeRemote("Narvos:DemanderEmotes", function(player)
    if (not EnJeu(player)) then return end
    Emotes.Envoyer(player)
end)

--- Purge à la déconnexion : sans ça la table retiendrait le joueur.
Player.Subscribe("Destroy", function(player)
    en_cours[player] = nil
    en_boucle_par_joueur[player] = nil
end)

return Emotes