-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Communications.lua — l'EXÉCUTANT du talkie-walkie et du smartphone.
--
-- Câblage : Narvos.CommunicationsServeur = Package.Require("Server/Communications.lua")
--           puis .Configurer{ grille = …, est_admin = …, nom = … } depuis
--           Server/Index.lua, qui enregistre aussi la commande de chat `/radio`.
--
-- La DÉCISION vit dans `narvos/Shared/Logic/Radio.lua`, `Telephone.lua` et
-- `TexteChat.lua` (54 assertions). Ce fichier relève les faits — qui porte quel
-- objet, sur quel canal, dans quelle dimension — et parle à nanos : chat,
-- événements distants, panneau WebUI.
--
-- ── L'API, LUE ET NON DEVINÉE ─────────────────────────────────────────────────
-- `Chat.SendMessage(player, texte)` (serveur, balises `<cyan>…</>`),
-- `Player.GetAll()`, `player:GetID()`, `player:GetName()`, `player:GetDimension()`,
-- `Character:AddStaticMeshAttached(id, mesh, socket)` / `RemoveStaticMeshAttached`
-- [both], `Timer.SetTimeout(fn, ms)` — relevés dans `libraries/api-main/api-main`.
--
-- ⚠ NON PROUVÉ : le socket `hand_l` et l'échelle des deux GLB en main (jamais
-- vus) ; les meshes ne sont cuits qu'au lot 3.
--
-- ⚠ JAMAIS VU EN JEU.
-- ═══════════════════════════════════════════════════════════════════════════════

local CommunicationsServeur = {}

-- ── État par joueur et injections — DÉCLARÉS EN TÊTE ─────────────────────────
local canaux = {}   -- [player] = canal radio
local boites = {}   -- [player] = boîte du téléphone (Logic/Telephone)
local dernier_envoi = {}   -- [player] = horloge (s) du dernier message radio ou téléphone
--- Joueurs dont le téléphone est en main : player -> { character, jeton }.
--- ⚠ Le JETON invalide un minuteur d'un geste précédent (ouvrir, fermer,
--- rouvrir vite : le « tenir » du premier ne doit pas repartir après le rangement).
local telephones_en_main = {}
local grille_de = nil
local est_admin = nil
local nom_de = nil

--- Branche l'exécutant sur l'inventaire, les droits et le nom des personnages.
---@param options table { grille = fn(player), est_admin = fn(player), nom = fn(player) }
function CommunicationsServeur.Configurer(options)
    if (type(options) ~= "table") then return end
    if (type(options.grille) == "function") then grille_de = options.grille end
    if (type(options.est_admin) == "function") then est_admin = options.est_admin end
    if (type(options.nom) == "function") then nom_de = options.nom end
end

--- Le joueur porte-t-il cet objet ? Les administrateurs en sont dispensés, comme
--- pour les menottes : aucun marchand ne vend encore ces objets (décision
--- d'économie), et un système que personne ne peut essayer ne se vérifie pas.
local function Porte(player, objet)
    if (est_admin and est_admin(player)) then return true end
    local grille = grille_de and grille_de(player)
    if (not grille) then return false end
    return Narvos.Inventory.CountItem(grille, objet) > 0
end

local function Nom(player)
    local n = nom_de and nom_de(player)
    if (type(n) == "string" and n ~= "") then return n end
    local ok, pseudo = pcall(function() return player:GetName() end)
    return ok and tostring(pseudo) or "?"
end

local function Dimension(player)
    local ok, d = pcall(function() return player:GetDimension() end)
    return ok and d or 1
end

local function Menotte(player, capacite)
    return Narvos.MenottesServeur ~= nil and Narvos.MenottesServeur.Refuse(player, capacite)
end

--- Intervalle minimal entre deux messages d'un même joueur, radio et téléphone
--- confondus : un script client qui en enverrait cent par seconde remplirait le
--- chat de tous les porteurs et la boîte (plafonnée) de sa cible.
CommunicationsServeur.INTERVALLE_S = 1.0

--- Le joueur peut-il émettre maintenant ? Si oui, note l'instant.
local function Cadence(player)
    local t = os.clock()
    local avant = dernier_envoi[player]
    if (avant and (t - avant) < CommunicationsServeur.INTERVALLE_S) then return false end
    dernier_envoi[player] = t
    return true
end

--- Durée pendant laquelle l'objet reste visible en main après un geste.
CommunicationsServeur.GESTE_MS = 2500
--- Main GAUCHE : la droite tient l'arme (Server/Combat.lua, Menottes.lua).
CommunicationsServeur.SOCKET = "hand_l"

--- Le geste : l'objet en main quelques secondes (talkie qu'on porte à la bouche,
--- téléphone qu'on consulte). Le mesh vient de `Catalogs/ObjetsDivers.lua`, choisi
--- par CHEMIN ; tant qu'il n'est pas cuit, pas de geste — la fonction, elle, marche.
---@param player table
---@param objet string  identifiant d'objet (Radio.OBJET, Telephone.OBJET)
local function EnMain(player, objet)
    local mesh = Narvos.ObjetsDivers and Narvos.ObjetsDivers.Mesh(objet)
    if (not mesh) then return end
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return end
    local attache = "narvos_en_main_" .. objet
    pcall(function() character:RemoveStaticMeshAttached(attache) end)
    if (not pcall(function() character:AddStaticMeshAttached(attache, mesh, CommunicationsServeur.SOCKET) end)) then
        return
    end
    Timer.SetTimeout(function()
        if (character:IsValid()) then
            pcall(function() character:RemoveStaticMeshAttached(attache) end)
        end
    end, CommunicationsServeur.GESTE_MS)
end

-- ══════════════════════════════════════════════════════════════════════════════
-- RADIO — `/radio`, `/radio canal <n>`, `/radio <message>`
-- ══════════════════════════════════════════════════════════════════════════════

--- Le canal courant d'un joueur (défaut si jamais réglé).
---@param player table
---@return integer
function CommunicationsServeur.Canal(player)
    return canaux[player] or Narvos.Radio.CANAL_DEFAUT
end

--- La commande de chat `/radio`. Rend (ok, message pour l'émetteur).
---@param player table
---@param argument string
---@return boolean, string|nil
function CommunicationsServeur.Radio(player, argument)
    local Radio = Narvos.Radio
    if (Menotte(player, "interaction")) then return false, nil end
    if (not Porte(player, Radio.OBJET)) then
        return false, "il faut un talkie-walkie dans le sac"
    end

    local texte = tostring(argument or "")
    if (texte:match("^%s*$")) then
        return true, ("radio sur le canal %d — /radio <message> · /radio canal <%d-%d>")
            :format(CommunicationsServeur.Canal(player), Radio.CANAL_MIN, Radio.CANAL_MAX)
    end

    local reglage = texte:match("^%s*canal%s+(%S+)%s*$")
    if (reglage) then
        local canal, raison = Radio.Canal(reglage)
        if (not canal) then return false, raison end
        canaux[player] = canal
        return true, ("radio reglee sur le canal %d"):format(canal)
    end

    local propre, raison_texte = Narvos.TexteChat.Nettoyer(texte, Radio.LONGUEUR_MAX)
    if (not propre) then return false, raison_texte end
    if (not Cadence(player)) then return false, "radio : un message par seconde" end

    -- Les faits, relevés UNE fois : qui porte un talkie, sur quel canal, où.
    local auditeurs, par_id, emetteur = {}, {}, nil
    for _, p in ipairs(Player.GetAll()) do
        local id = tostring(p:GetID())
        local fiche = {
            id = id,
            a_radio = Porte(p, Radio.OBJET),
            canal = CommunicationsServeur.Canal(p),
            dimension = Dimension(p),
        }
        auditeurs[#auditeurs + 1] = fiche
        par_id[id] = p
        if (p == player) then emetteur = fiche end
    end

    local destinataires, raison = Radio.Destinataires(auditeurs, emetteur)
    if (not destinataires) then return false, raison end

    local ligne = Radio.Ligne(Nom(player), CommunicationsServeur.Canal(player), propre)
    for _, id in ipairs(destinataires) do
        local p = par_id[id]
        if (p) then pcall(function() Chat.SendMessage(p, ligne) end) end
    end
    EnMain(player, Radio.OBJET)
    return true, nil
end

-- ══════════════════════════════════════════════════════════════════════════════
-- TÉLÉPHONE — panneau WebUI `telephone`
-- ══════════════════════════════════════════════════════════════════════════════

local function Boite(player)
    local b = boites[player]
    if (not b) then
        b = Narvos.Telephone.NouvelleBoite()
        boites[player] = b
    end
    return b
end

--- L'état complet du téléphone, poussé au client.
local function Etat(player, message)
    local Telephone = Narvos.Telephone
    local joueurs = {}
    for _, p in ipairs(Player.GetAll()) do
        joueurs[#joueurs + 1] = {
            id = tostring(p:GetID()),
            nom = Nom(p),
            a_telephone = Porte(p, Telephone.OBJET),
        }
    end
    local b = Boite(player)
    return {
        applications = Telephone.APPLICATIONS,
        contacts = Telephone.Contacts(joueurs, tostring(player:GetID())),
        messages = b.messages,
        non_lus = Telephone.NonLus(b),
        radio = Porte(player, Narvos.Radio.OBJET) and CommunicationsServeur.Canal(player) or false,
        -- La borne voyage AVEC l'état : le compteur de la page et le refus du
        -- serveur lisent la même constante.
        longueur_max = Telephone.LONGUEUR_MAX,
        message = message or "",
    }
end

-- ── Le geste du téléphone (demande B8, 2026-09-13) ─────────────────────────────
--
-- Le personnage SORT son téléphone quand le panneau s'ouvre, le TIENT tant qu'il
-- est ouvert, le RANGE à la fermeture. Seules animations « téléphone » du pack
-- cuit : WW100IdleAnimPack, ASSISES — jouées en UpperBody, seul le haut du corps
-- les prend (bras, tête penchée vers l'écran) et les jambes gardent la marche.
-- Durées LUES dans les AnimSequence source : sortir 3 000 ms, ranger 4 167 ms.
CommunicationsServeur.GESTE_TELEPHONE = {
    sortir = "AS_Sit_Normal01_To_Phone01_Anim", sortir_ms = 3000,
    tenir = "AS_Sit_Phone01_Loop01_Anim",
    ranger = "AS_Sit_Phone01_To_Normal01_Anim", ranger_ms = 4167,
    -- Un geste de 3 s pour sortir un téléphone traîne : joué une fois et demie
    -- plus vite, il reste lisible.
    vitesse = 1.5,
}


local function AnimCuite(nom)
    local noms = Narvos.AnimNoms and Narvos.AnimNoms.NOMS
    if (type(noms) ~= "table") then return false end
    for _, n in ipairs(noms) do if (n == nom) then return true end end
    return false
end

local function SortirTelephone(player)
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return end
    local g = CommunicationsServeur.GESTE_TELEPHONE
    local mesh = Narvos.ObjetsDivers and Narvos.ObjetsDivers.Mesh(Narvos.Telephone.OBJET)
    local attache = "narvos_en_main_" .. Narvos.Telephone.OBJET
    if (mesh) then
        pcall(function() character:RemoveStaticMeshAttached(attache) end)
        pcall(function() character:AddStaticMeshAttached(attache, mesh, CommunicationsServeur.SOCKET) end)
    end
    local jeton = {}
    telephones_en_main[player] = { character = character, jeton = jeton }
    if (AnimCuite(g.sortir)) then
        pcall(function()
            character:PlayAnimation("narvos::" .. g.sortir, AnimationSlotType.UpperBody, false, 0.2, 0.2, g.vitesse, false)
        end)
    end
    if (AnimCuite(g.tenir)) then
        Timer.SetTimeout(function()
            local etat = telephones_en_main[player]
            if (not etat or etat.jeton ~= jeton or not character:IsValid()) then return end
            pcall(function()
                character:PlayAnimation("narvos::" .. g.tenir, AnimationSlotType.UpperBody, true, 0.25, 0.25, 1.0, false)
            end)
        end, math.floor(g.sortir_ms / g.vitesse) - 250)
    end
end

--- Range le téléphone : animation inverse, puis l'objet quitte la main.
---@param player table
function CommunicationsServeur.Ranger(player)
    local etat = telephones_en_main[player]
    telephones_en_main[player] = nil
    if (not etat or not etat.character or not etat.character:IsValid()) then return end
    local character = etat.character
    local g = CommunicationsServeur.GESTE_TELEPHONE
    pcall(function() character:StopAnimation("narvos::" .. g.tenir) end)
    if (AnimCuite(g.ranger)) then
        pcall(function()
            character:PlayAnimation("narvos::" .. g.ranger, AnimationSlotType.UpperBody, false, 0.2, 0.3, g.vitesse, false)
        end)
    end
    -- L'objet disparaît quand la main redescend (vers les deux tiers du geste).
    Timer.SetTimeout(function()
        if (telephones_en_main[player] ~= nil or not character:IsValid()) then return end
        pcall(function() character:RemoveStaticMeshAttached("narvos_en_main_" .. Narvos.Telephone.OBJET) end)
    end, math.floor(g.ranger_ms / g.vitesse * 0.65))
end

--- Ouvre le téléphone : refuse sans smartphone, sinon pousse l'état.
---@param player table
function CommunicationsServeur.Ouvrir(player)
    if (Menotte(player, "interaction")) then return end
    if (not Porte(player, Narvos.Telephone.OBJET)) then
        pcall(function() Chat.SendMessage(player, "<grey>il faut un smartphone dans le sac</>") end)
        return
    end
    local etat = Etat(player)
    etat.ouvrir = true
    Events.CallRemote("Narvos:Telephone", player, Reliability.Reliable, etat)
    SortirTelephone(player)
end

--- Envoie un message privé. Le destinataire est désigné par l'IDENTIFIANT de
--- joueur que les contacts ont donné — jamais par un nom tapé, qui peut être
--- homonyme ou usurpé.
---@param player table
---@param dest_id any
---@param texte any
function CommunicationsServeur.Envoyer(player, dest_id, texte)
    local Telephone = Narvos.Telephone
    if (Menotte(player, "interaction")) then return end

    local destinataire = nil
    for _, p in ipairs(Player.GetAll()) do
        if (tostring(p:GetID()) == tostring(dest_id)) then destinataire = p break end
    end

    local fiche_dest = destinataire and {
        id = tostring(destinataire:GetID()),
        nom = Nom(destinataire),
        a_telephone = Porte(destinataire, Telephone.OBJET),
        en_ligne = true,
    } or nil
    local ok, raison = Telephone.PeutEnvoyer({
        id = tostring(player:GetID()),
        nom = Nom(player),
        a_telephone = Porte(player, Telephone.OBJET),
    }, fiche_dest)

    local propre, raison_texte = nil, nil
    if (ok) then
        propre, raison_texte = Narvos.TexteChat.Nettoyer(texte, Telephone.LONGUEUR_MAX)
        if (not propre) then ok, raison = false, raison_texte end
    end
    if (ok and not Cadence(player)) then ok, raison = false, "un message par seconde" end
    if (not ok) then
        Events.CallRemote("Narvos:Telephone", player, Reliability.Reliable, Etat(player, "Refus : " .. tostring(raison)))
        return
    end

    boites[destinataire] = Telephone.Deposer(Boite(destinataire), {
        de = Nom(player), texte = propre, quand = os.time(),
    })
    Events.CallRemote("Narvos:Telephone:Recu", destinataire, Reliability.Reliable,
        Nom(player), Telephone.NonLus(boites[destinataire]))
    Events.CallRemote("Narvos:Telephone", player, Reliability.Reliable,
        Etat(player, "Envoyé à " .. Nom(destinataire)))
    -- Téléphone déjà en main (panneau ouvert) : pas de second geste, qui le
    -- retirerait de la main au bout de GESTE_MS.
    if (not telephones_en_main[player]) then EnMain(player, Telephone.OBJET) end
end

--- Marque la boîte lue et repousse l'état.
---@param player table
function CommunicationsServeur.Lire(player)
    if (not Porte(player, Narvos.Telephone.OBJET)) then return end
    boites[player] = Narvos.Telephone.MarquerLus(Boite(player))
    Events.CallRemote("Narvos:Telephone", player, Reliability.Reliable, Etat(player))
end

Events.SubscribeRemote("Narvos:Telephone:Ouvrir", function(player)
    CommunicationsServeur.Ouvrir(player)
end)
Events.SubscribeRemote("Narvos:Telephone:Envoyer", function(player, dest_id, texte)
    CommunicationsServeur.Envoyer(player, dest_id, texte)
end)
Events.SubscribeRemote("Narvos:Telephone:Lire", function(player)
    CommunicationsServeur.Lire(player)
end)
-- Le panneau se ferme (Échap, barre d accueil, autre menu) : le personnage range
-- son téléphone. Sans cet événement il le garderait en main indéfiniment.
Events.SubscribeRemote("Narvos:Telephone:Fermer", function(player)
    CommunicationsServeur.Ranger(player)
end)

-- L'état est de SESSION : il part avec son joueur.
Player.Subscribe("Destroy", function(player)
    telephones_en_main[player] = nil
    canaux[player] = nil
    boites[player] = nil
    dernier_envoi[player] = nil
end)

return CommunicationsServeur