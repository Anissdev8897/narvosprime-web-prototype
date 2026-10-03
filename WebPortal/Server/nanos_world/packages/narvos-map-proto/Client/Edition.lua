-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Edition.lua — le MODE édition : la souris est au joueur, pas à la caméra.
--
-- Câblage : `local Edition = Package.Require("Client/Edition.lua")` depuis
-- Client/Index.lua, puis `ACTIONS.edition_bascule = Edition.Basculer`.
--
-- ── LE PROBLÈME QU'IL RÈGLE ───────────────────────────────────────────────────
-- En jeu normal, `Input.SetMouseEnabled(false)` : le curseur est capturé par la
-- caméra, qui tourne avec chaque mouvement. Aucun clic n'atteint alors une
-- poignée du gizmo — c'est pourquoi il ne se manipulait qu'au clavier (J/K/L/M),
-- ce qui rend le placement précis pénible.
--
-- Ici on inverse : en mode édition la souris est LIBRE. Le curseur sélectionne
-- et tire les poignées ; la caméra ne bouge plus toute seule.
--
-- ── ET POUR REGARDER AUTOUR ? LE BOUTON DROIT ─────────────────────────────────
-- Une souris libre veut dire une caméra figée, ce qui empêche de voir où l'on
-- pose. On rend donc la souris à la caméra TANT QUE le bouton droit est enfoncé,
-- et on la relibère au relâchement. C'est l'idiome de tous les éditeurs 3D, et
-- il ne coûte aucune touche supplémentaire.
--
-- ⚠ Le bouton droit ne doit PAS reprendre la souris pendant qu'une poignée est
-- tirée : le geste en cours serait coupé net, l'objet resterait à mi-chemin.
-- `Gizmos.EnManipulation()` répond exactement à ça.
--
-- ── LA SORTIE SAUVEGARDE ──────────────────────────────────────────────────────
-- F3 à nouveau (ou la croix du panneau) quitte le mode ET demande l'export. Sans
-- ça, poser du décor resterait une démonstration : `Server/Export.lua` existe
-- depuis longtemps mais il fallait penser à le déclencher, et personne n'y
-- pense. Un travail qu'on peut perdre en fermant le jeu n'est pas un travail.
--
-- ── CE QUI N'EST PAS ICI, ET POURQUOI ─────────────────────────────────────────
-- Aucune règle de permission. Le client ne décide de RIEN : il envoie une
-- intention, `Server/Props.lua` la valide contre `Logic/Zones.lua`. Un mode
-- édition qui s'ouvrirait ou se fermerait selon les droits donnerait au client
-- une opinion sur ses propres permissions — la première chose qu'un tricheur
-- modifie. Le mode s'ouvre pour tout le monde ; ce sont les actions qui sont
-- refusées, avec leur raison.
-- ═══════════════════════════════════════════════════════════════════════════════

local Gizmos = Package.Require("Client/Gizmo.lua")

---@class NarvosEditionClient
local Edition = {}

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ TOUT DÉCLARÉ EN TÊTE. Un `local` posé après son lecteur se résout en GLOBAL
-- nil, sans erreur au chargement — piège rencontré cinq fois sur ce projet.

--- Sommes-nous en mode édition ?
local ouvert = false

--- Le bouton droit est-il enfoncé (caméra temporairement reprise) ?
local camera_tenue = false

--- Boutons, tels que `MouseDown` les nomme.
local BOUTON_GAUCHE = "LeftMouseButton"
local BOUTON_DROIT = "RightMouseButton"

local Annoncer

Annoncer = function(texte)
    -- Le HUD porte déjà un bandeau de messages : on passe par lui plutôt que
    -- d'inventer une seconde voie d'affichage.
    Events.Call("NarvosGizmo:Message", texte)
end

--- Rendre la souris au joueur (curseur libre) ou à la caméra.
local function Souris(libre)
    Input.SetMouseEnabled(libre and true or false)
end

-- ── Entrée et sortie ──────────────────────────────────────────────────────────

--- Entrer en mode édition.
function Edition.Ouvrir()
    if (ouvert) then return end
    ouvert = true
    camera_tenue = false
    Souris(true)
    Events.Call("NarvosEdition:Etat", true)
    Annoncer("Mode edition — clic gauche : manipuler · clic droit : regarder · F3 : quitter")

    -- Prendre l'objet courant tout de suite : entrer en édition sans rien de
    -- sélectionné oblige à un aller-retour au clavier avant le premier geste.
    if (not Gizmos.Actif()) then Gizmos.Prise() end
end

--- Quitter le mode édition, et SAUVEGARDER.
function Edition.Fermer()
    if (not ouvert) then return end

    -- ⚠ On ne sort pas au milieu d'un geste : relâcher d'abord, sinon le dernier
    -- mouvement reste dans le tampon de cadence et l'objet se repose deux ticks
    -- en arrière.
    if (Gizmos.EnManipulation()) then Gizmos.Pointeur(false) end

    ouvert = false
    camera_tenue = false
    Souris(false)
    Events.Call("NarvosEdition:Etat", false)

    -- La sauvegarde. `Server/Export.lua` fige en catalogue ce qui a été posé ;
    -- c'est le serveur qui décide s'il y a quelque chose à écrire.
    Events.CallRemote("Narvos:ExporterProps", Reliability.Reliable)
    Annoncer("Mode edition ferme — placements sauvegardes")
end

--- F3 : entrer ou sortir.
function Edition.Basculer()
    -- ⚠ Ne pas basculer pendant qu'une poignée est tirée : le joueur perdrait
    -- son geste sur une touche pressée par réflexe.
    if (ouvert and Gizmos.EnManipulation()) then
        Annoncer("Relachez l objet avant de quitter")
        return
    end
    if (ouvert) then Edition.Fermer() else Edition.Ouvrir() end
end

--- La croix du panneau appelle ceci. Même chemin que F3 : une seule sortie,
--- donc une seule sauvegarde, donc pas de « selon comment on ferme ».
function Edition.FermerDepuisUI()
    Edition.Fermer()
end

--- L'état, pour les autres modules (le HUD, la caméra).
---@return boolean
function Edition.Ouverte()
    return ouvert
end

-- ── La souris ─────────────────────────────────────────────────────────────────

Input.Subscribe("MouseDown", function(bouton)
    if (not ouvert) then return end

    if (bouton == BOUTON_GAUCHE) then
        Gizmos.Pointeur(true)
        return
    end

    if (bouton == BOUTON_DROIT) then
        -- Pas pendant un geste : ça le couperait net.
        if (Gizmos.EnManipulation()) then return end
        camera_tenue = true
        Souris(false)
    end
end)

Input.Subscribe("MouseUp", function(bouton)
    if (not ouvert) then return end

    if (bouton == BOUTON_GAUCHE) then
        Gizmos.Pointeur(false)
        return
    end

    if (bouton == BOUTON_DROIT and camera_tenue) then
        camera_tenue = false
        Souris(true)
    end
end)

-- ⚠ FILET DE SÉCURITÉ. Si la fenêtre perd le focus alors que le bouton droit est
-- tenu, le `MouseUp` n'arrive jamais : le joueur revient dans le jeu avec une
-- caméra accrochée au curseur et aucun moyen de la lâcher. Le même défaut avait
-- été rencontré sur l'orbite de l'aperçu de création.
Input.Subscribe("WindowFocusChange", function(a_le_focus)
    if (a_le_focus) then return end
    if (Gizmos.EnManipulation()) then Gizmos.Pointeur(false) end
    if (ouvert and camera_tenue) then
        camera_tenue = false
        Souris(true)
    end
end)

return Edition
