-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Gizmo.lua — déplacer, tourner et redimensionner un prop déjà posé.
--
-- Câblage : `local Gizmos = Package.Require("Client/Gizmo.lua")` depuis
-- Client/Index.lua, puis `ACTIONS.gizmo_* = Gizmos.<action>`.
--
-- ── POURQUOI CE FICHIER EST CÔTÉ CLIENT, ET LE DÉPLACEMENT CÔTÉ SERVEUR ───────
-- `Gizmo` est d'autorité **client** dans nanos (API : `Activate`, `Deactivate`,
-- `SetTransformMode`, `SetAlignSpace`, `SetSnapSettings`, événement `Transform`,
-- tous marqués Client). Il n'existe donc que chez le joueur qui le manipule, et
-- son événement `Transform` ne quitte pas sa machine.
--
-- `Actor:SetLocation`, lui, est d'autorité. Le client envoie donc la transform
-- visée, `Server/Props.lua` la valide (propriété du prop, portée, bornes
-- d'échelle) puis l'applique — et c'est la réplication qui la montre aux autres.
--
-- ── NEUF NOMBRES, PAS UNE TABLE ───────────────────────────────────────────────
-- Une table traverserait `CallRemote` entre deux Lua. On envoie quand même neuf
-- scalaires : ils ne peuvent pas être à moitié décodés, et le serveur les borne
-- un par un. C'est la même prudence que sur le pont WebUI, où une structure se
-- perd en silence.
--
-- ── LA CADENCE ────────────────────────────────────────────────────────────────
-- `Transform` se déclenche à chaque frame pendant qu'on tire la poignée : 60
-- messages par seconde et par joueur. On n'envoie qu'au rythme de `PERIODE_MS`,
-- ET une dernière fois au relâchement — sans ce dernier envoi, la position
-- retenue serait celle de l'avant-dernier tick, décalée de ce que le joueur a
-- fait dans les 120 dernières millisecondes.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosGizmoClient
local Gizmos = {}

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ TOUT DÉCLARÉ EN TÊTE. Les gestionnaires plus bas s'appellent entre eux ; un
-- `local` posé après son lecteur se résoudrait en GLOBAL nil, sans erreur au
-- chargement. Ce piège a été rencontré cinq fois sur ce projet.

--- Props du joueur, poussés par le serveur : { { id, x, y, z, pitch, … } }.
local liste = {}

--- Index courant dans `liste`. 0 = aucun.
local index = 0

--- L'objet `Gizmo`, créé une seule fois et réutilisé.
local gizmo = nil

--- Le gizmo est-il actif sur un prop ?
local actif = false

--- Modes, dans l'ordre du cycle.
local MODES = {
    { id = 0, label = "Deplacer" },      -- GizmoTransformMode.Translation
    { id = 1, label = "Tourner" },       -- GizmoTransformMode.Rotation
    { id = 2, label = "Redimensionner" },-- GizmoTransformMode.Scale
}
local mode = 1

--- Période minimale entre deux envois au serveur, en millisecondes.
Gizmos.PERIODE_MS = 120

--- Pas d'aimantation. Construire à main levée donne des objets qui ne
--- s'alignent sur rien ; 10 cm, 15° et 0,25 sont assez fins pour ne pas gêner et
--- assez francs pour que deux murs se touchent vraiment.
Gizmos.PAS_POSITION = 10.0
Gizmos.PAS_ROTATION = 15.0
Gizmos.PAS_ECHELLE = 0.25

local horloge_ms = 0
Timer.SetInterval(function() horloge_ms = horloge_ms + 20 end, 20)

local dernier_envoi = 0
local dernier_etat = nil     -- { x, y, z, pitch, yaw, roll, sx, sy, sz }

-- Déclarations avancées : ces fonctions s'appellent mutuellement.
local Selection, Envoyer, Poser, Retirer, Annoncer

-- ── Le prop sélectionné ───────────────────────────────────────────────────────

Selection = function()
    if (index < 1 or index > #liste) then return nil end
    return liste[index]
end

Annoncer = function(texte)
    -- Le HUD porte déjà un bandeau de messages ; on passe par lui plutôt que
    -- d'inventer une seconde voie d'affichage.
    Events.Call("NarvosGizmo:Message", texte)
end

-- ── Envoi au serveur ──────────────────────────────────────────────────────────

Envoyer = function(force)
    local prop = Selection()
    if (not prop or not dernier_etat) then return end

    if (not force and (horloge_ms - dernier_envoi) < Gizmos.PERIODE_MS) then return end
    dernier_envoi = horloge_ms

    local e = dernier_etat
    -- ⚠ `Reliability.Reliable` est le 2ᵉ argument OBLIGATOIRE client -> serveur.
    -- L'omettre ne lève rien : le premier argument utile est pris pour la
    -- fiabilité, la charge utile se perd, et le serveur ne voit jamais l'appel.
    Events.CallRemote("Narvos:GizmoBouger", Reliability.Reliable, prop.id,
        e.x, e.y, e.z, e.pitch, e.yaw, e.roll, e.sx, e.sy, e.sz)

    -- On tient la copie locale à jour : sans ça, rouvrir le gizmo sur ce prop le
    -- replacerait où il était à la dernière liste reçue.
    prop.x, prop.y, prop.z = e.x, e.y, e.z
    prop.pitch, prop.yaw, prop.roll = e.pitch, e.yaw, e.roll
    prop.sx, prop.sy, prop.sz = e.sx, e.sy, e.sz
end

-- ── Poser et retirer le gizmo ─────────────────────────────────────────────────

Poser = function()
    local prop = Selection()
    if (not prop) then
        Annoncer("Aucun objet a manipuler")
        return
    end

    if (not gizmo) then
        gizmo = Gizmo()
        gizmo:SetAlignSpace(1)                     -- GizmoAlignSpace.World
        gizmo:SetSnapSettings(Gizmos.PAS_POSITION, Gizmos.PAS_ROTATION, Gizmos.PAS_ECHELLE)
        gizmo:Subscribe("Transform", function(_, location, rotation, scale)
            dernier_etat = {
                x = location.X, y = location.Y, z = location.Z,
                pitch = rotation.Pitch, yaw = rotation.Yaw, roll = rotation.Roll,
                sx = scale.X, sy = scale.Y, sz = scale.Z,
            }
            Envoyer(false)
        end)
    end

    gizmo:SetTransformMode(MODES[mode].id, false)
    gizmo:Activate(Vector(prop.x, prop.y, prop.z),
                   Rotator(prop.pitch, prop.yaw, prop.roll),
                   Vector(prop.sx, prop.sy, prop.sz))
    actif = true
    dernier_etat = nil
    Annoncer(("Objet %d/%d — %s"):format(index, #liste, MODES[mode].label))
end

Retirer = function()
    if (not gizmo or not actif) then return end
    -- ⚠ UN DERNIER ENVOI, FORCÉ. La cadence retient le dernier mouvement pendant
    -- 120 ms au plus ; relâcher sans vider ce tampon perdrait la fin du geste.
    Envoyer(true)
    gizmo:Deactivate()
    actif = false
    dernier_etat = nil
end

-- ── Actions, appelées par le répartiteur de commandes ─────────────────────────

--- Prendre ou lâcher l'objet courant.
function Gizmos.Prise()
    if (actif) then
        Retirer()
        Annoncer("Objet lache")
        return
    end
    -- La liste peut être périmée : un prop posé depuis le dernier appel n'y est
    -- pas, et un prop détruit y est encore. On la redemande à chaque prise.
    Events.CallRemote("Narvos:DemanderPropsListe", Reliability.Reliable)
end

--- Objet précédent.
function Gizmos.Precedent()
    if (#liste == 0) then Annoncer("Aucun objet pose") return end
    index = ((index - 2) % #liste) + 1
    if (actif) then Retirer() end
    Poser()
end

--- Objet suivant.
function Gizmos.Suivant()
    if (#liste == 0) then Annoncer("Aucun objet pose") return end
    index = (index % #liste) + 1
    if (actif) then Retirer() end
    Poser()
end

-- ── LA SOURIS ─────────────────────────────────────────────────────────────────
--
-- Le gizmo se manipulait jusqu'ici au clavier seul (J/K/L/M). Il sait pourtant
-- recevoir un pointeur : `PressPointer` / `ReleasePointer` sont dans son API, et
-- `IsInteracting` dit si une poignée est en train d'être tirée.
--
-- ⚠ CES TROIS-LÀ NE S'UTILISENT QUE SI LA SOURIS EST LIBRE. Tant que
-- `Input.SetMouseEnabled(false)` (le mode jeu normal), le curseur est capturé
-- par la caméra et aucun clic n'atteint une poignée. C'est `Client/Edition.lua`
-- qui décide de libérer la souris ; ce fichier ne fait que traduire les clics.

--- Le joueur presse ou relâche sur une poignée.
--- `presse = true` au MouseDown, `false` au MouseUp.
---@param presse boolean
function Gizmos.Pointeur(presse)
    if (not gizmo or not actif) then return end
    if (presse) then
        gizmo:PressPointer()
        return
    end
    gizmo:ReleasePointer()
    -- ⚠ ENVOI FORCÉ AU RELÂCHEMENT, pour la même raison que dans `Retirer` : la
    -- cadence retient le dernier mouvement jusqu'à 120 ms, et lâcher la poignée
    -- sans vider ce tampon perdrait la fin du geste — l'objet se reposerait où
    -- il était deux ticks plus tôt.
    Envoyer(true)
end

--- Une poignée est-elle en train d'être tirée ?
--- Sert à `Client/Edition.lua` : on ne change ni de prop, ni de mode, ni de mode
--- d'édition pendant un geste — ça reposerait l'objet à sa position de liste et
--- annulerait ce que le joueur est en train de faire.
---@return boolean
function Gizmos.EnManipulation()
    if (not gizmo or not actif) then return false end
    local ok, resultat = pcall(function() return gizmo:IsInteracting() end)
    return (ok and resultat == true)
end

--- Le gizmo est-il posé sur un objet ?
---@return boolean
function Gizmos.Actif()
    return actif
end

--- Mode suivant : déplacer -> tourner -> redimensionner.
function Gizmos.Mode()
    mode = (mode % #MODES) + 1
    if (not actif) then
        Annoncer("Mode : " .. MODES[mode].label)
        return
    end
    -- `SetTransformMode` sur un gizmo actif suffit : le réactiver le
    -- replacerait sur la position de la liste, en annulant le geste en cours.
    gizmo:SetTransformMode(MODES[mode].id, false)
    Annoncer("Mode : " .. MODES[mode].label)
end

-- ── Réception ─────────────────────────────────────────────────────────────────

Events.SubscribeRemote("Narvos:PropsListe", function(props)
    liste = (type(props) == "table") and props or {}
    if (#liste == 0) then
        index = 0
        if (actif) then Retirer() end
        Annoncer("Aucun objet pose")
        return
    end
    -- On prend le DERNIER posé : c'est celui que le joueur vient de voir
    -- apparaître, et donc celui qu'il veut ajuster neuf fois sur dix.
    if (index < 1 or index > #liste) then index = #liste end
    Poser()
end)

--- Le serveur a détruit un prop : la liste change, l'index peut sortir.
Events.SubscribeRemote("Narvos:PropPose", function()
    if (actif) then
        Events.CallRemote("Narvos:DemanderPropsListe", Reliability.Reliable)
    end
end)

return Gizmos
