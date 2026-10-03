-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Menottes.lua — l'EXÉCUTANT des menottes.
--
-- Câblage : Narvos.MenottesServeur = Package.Require("Server/Menottes.lua")
--           puis Narvos.MenottesServeur.Configurer{ grille = …, est_admin = … }
--           depuis Server/Index.lua.
--
-- ── CE QUI EXISTAIT, ET CE QUI MANQUAIT ───────────────────────────────────────
-- `narvos/Shared/Logic/Menottes.lua` porte la DÉCISION depuis septembre : qui peut
-- menotter qui, ce qu'un menotté perd, l'évasion — 110 assertions. Mesuré le
-- 2026-09-13 : AUCUN fichier du serveur ne l'appelait. Un système prouvé que rien
-- n'exécute : « asset présent ≠ système branché », dans sa forme exacte.
--
-- Ce fichier-ci ne DÉCIDE rien. Il relève les faits (qui est devant qui, à quelle
-- distance, porte-t-il l'objet), les passe au module, et traduit la réponse en
-- gestes moteur : animation d'entrave, menottes au poignet, capacités coupées,
-- son, messages.
--
-- ── L'API, LUE ET NON DEVINÉE ─────────────────────────────────────────────────
-- `libraries/api-main/api-main/Classes/Character.json` et `BasePawn.json` :
--   SetCanAim / SetCanPunch / SetCanPickupPickables / SetCanGrabProps /
--   SetCanUsePickables / SetCanDrop            server
--   LeaveVehicle, Drop                          server
--   PlayAnimation(path, slot, loop, …)          both   StopAnimation(path) both
--   AddStaticMeshAttached(id, mesh, socket)     both   RemoveStaticMeshAttached(id)
--   événement AttemptEnterVehicle -> false l'empêche (server)
-- `Sound` est d'autorité CLIENT (`Classes/Sound.json`) : le serveur diffuse un
-- événement dans un rayon, le client joue le son.
--
-- ── ⚠ CE QUI N'EST PAS PROUVÉ ─────────────────────────────────────────────────
--   · les trois assets du pack (SM_Handcuff, AS_Handcuffed, Wav_Handcuff_Sound)
--     entrent au cook du 2026-09-13 ; le vérificateur dit s'ils sont déclarés ;
--   · le socket `hand_r` (os du Mannequin UE4) : la position des menottes au
--     poignet n'a jamais été vue ;
--   · la touche Q par défaut : libre dans NOTRE catalogue de commandes, aucune
--     preuve qu'aucune liaison native de nanos ne l'occupe.
-- RIEN n'a tourné en jeu.
-- ═══════════════════════════════════════════════════════════════════════════════

local MenottesServeur = {}

-- ── État et injections — DÉCLARÉS EN TÊTE ─────────────────────────────────────
-- Une table lue avant sa déclaration vaut nil pour toujours, et c'est muet.
local entraves = {}          -- [character] = { animation = cle, mesh = bool }
local grille_de = nil        -- (player) -> grille | nil
local est_admin = nil        -- (player) -> boolean

-- ── Les assets du pack Multiplayer_Handcuff_System ───────────────────────────
-- Le module de décision ne nomme JAMAIS un asset (« ce fichier ne la nommera
-- jamais ») : c'est ici qu'ils vivent, et le contrôle « Citations Lua » du
-- vérificateur prouve qu'ils sont dans Assets.toml.
MenottesServeur.ASSETS = {
    mesh = "narvos::SM_Handcuff",
    animation = "narvos::AS_Handcuffed",
    geste = "narvos::AS_Interaction",
    son = "narvos::Wav_Handcuff_Sound",
}

MenottesServeur.ATTACHE = "narvos_menottes"
MenottesServeur.SOCKET = "hand_r"
--- L'objet de sac que `exige_menottes` demande (Items.ITEM_DB).
MenottesServeur.OBJET = "menottes"
--- Rayon d'écoute du cliquetis, en centimètres.
MenottesServeur.RAYON_SON_CM = 2500.0

--- Les capacités perdues que le MOTEUR sait couper lui-même. Les autres
--- (inventaire, roue, conduite, sort, emote, interaction) sont refusées par nos
--- gestionnaires, via `Refuse`.
local COUPES_MOTEUR = {
    "SetCanAim", "SetCanPunch", "SetCanPickupPickables",
    "SetCanGrabProps", "SetCanUsePickables", "SetCanDrop",
}

--- Branche l'exécutant sur l'inventaire et les droits du serveur.
---@param options table  { grille = function(player), est_admin = function(player) }
function MenottesServeur.Configurer(options)
    if (type(options) ~= "table") then return end
    if (type(options.grille) == "function") then grille_de = options.grille end
    if (type(options.est_admin) == "function") then est_admin = options.est_admin end
end

-- ── Faits ─────────────────────────────────────────────────────────────────────

--- L'identifiant de session d'un joueur, tel que le module le manipule.
---@param player table|nil
---@return string|nil
local function IdDe(player)
    if (not player) then return nil end
    local ok, id = pcall(function() return player:GetID() end)
    return ok and id and ("joueur:" .. tostring(id)) or nil
end

--- Le joueur porte-t-il l'objet menottes ?
---
--- ⚠ LES ADMINISTRATEURS EN SONT DISPENSÉS. Aucun marchand ne vend encore les
--- menottes (décision d'économie laissée à Hanibes) : sans cette dispense, le
--- système serait branché et inutilisable par tous. Qui peut menotter est une
--- RÈGLE DE SERVEUR (Logic/Menottes.lua) — celle-ci est dite, pas cachée.
---@param player table
---@return boolean
local function PorteMenottes(player)
    if (est_admin and est_admin(player)) then return true end
    local grille = grille_de and grille_de(player)
    if (not grille) then return false end
    return Narvos.Inventory.CountItem(grille, MenottesServeur.OBJET) > 0
end

--- Le joueur contrôlant un personnage, ou nil.
local function JoueurDe(character)
    for _, p in ipairs(Player.GetAll()) do
        if (p:GetControlledCharacter() == character) then return p end
    end
    return nil
end

--- Le personnage de joueur le plus proche, dans la même dimension.
--- Distance EN TROIS DIMENSIONS : on ne menotte pas quelqu'un à l'étage du dessus.
---@param player table
---@param character table
---@return table|nil cible_joueur, table|nil cible_personnage, number|nil distance
local function CibleProche(player, character)
    local ici = character:GetLocation()
    local dimension = player:GetDimension()
    local meilleur, perso, d_min = nil, nil, nil
    for _, autre in ipairs(Player.GetAll()) do
        if (autre ~= player and autre:GetDimension() == dimension) then
            local c = autre:GetControlledCharacter()
            if (c and c:IsValid()) then
                local p = c:GetLocation()
                local dx, dy, dz = p.X - ici.X, p.Y - ici.Y, p.Z - ici.Z
                local d = math.sqrt(dx * dx + dy * dy + dz * dz)
                if (d_min == nil or d < d_min) then
                    meilleur, perso, d_min = autre, c, d
                end
            end
        end
    end
    return meilleur, perso, d_min
end

-- ── Gestes ────────────────────────────────────────────────────────────────────

--- Le cliquetis, chez les joueurs à portée d'oreille.
local function Cliquetis(character)
    pcall(function()
        local p = character:GetLocation()
        Events.BroadcastRemoteInRadiusDimension("Narvos:Menottes:Son", p,
            MenottesServeur.RAYON_SON_CM, character:GetDimension(),
            Reliability.Unreliable, MenottesServeur.ASSETS.son, p.X, p.Y, p.Z)
    end)
end

--- Entrave un personnage : capacités coupées, arme lâchée, véhicule quitté,
--- animation en boucle, menottes au poignet.
---@param character table
---@param cle_animation string  chaîne vide = pas d'animation (Logic/Menottes)
local function Entraver(character, cle_animation)
    -- ⚠ L'ORDRE COMPTE : vider les mains AVANT de couper les capacités.
    -- `SetCanDrop(false)` posé d'abord pourrait refuser le `Drop()` qui suit, et
    -- le menotté garderait son arme en main, simplement incapable de viser.
    -- Le véhicule d'abord : un conducteur menotté garderait le volant.
    pcall(function() if (character:GetVehicle()) then character:LeaveVehicle() end end)
    -- L'arme ensuite. Une arme équipée DEPUIS LE SAC est détruite au lâcher
    -- (Server/Ramassage.lua, gestionnaire de Drop) : rien ne se duplique.
    local player = JoueurDe(character)
    if (player and Narvos.CombatServeur) then pcall(function() Narvos.CombatServeur.Ranger(player) end) end
    pcall(function() if (character:GetPicked()) then character:Drop() end end)
    for _, methode in ipairs(COUPES_MOTEUR) do
        pcall(function() character[methode](character, false) end)
    end

    local etat = { animation = nil, mesh = false }
    if (cle_animation ~= "") then
        local ok = pcall(function()
            character:PlayAnimation(cle_animation, AnimationSlotType.UpperBody, true, 0.2, 0.2, 1.0, false)
        end)
        if (ok) then etat.animation = cle_animation end
    end
    etat.mesh = pcall(function()
        character:AddStaticMeshAttached(MenottesServeur.ATTACHE, MenottesServeur.ASSETS.mesh,
            MenottesServeur.SOCKET)
    end)
    entraves[character] = etat
end

--- Rend au personnage tout ce qu'`Entraver` lui a pris.
---@param character table
local function Delivrer(character)
    local etat = entraves[character]
    entraves[character] = nil
    if (not character or not character:IsValid()) then return end
    for _, methode in ipairs(COUPES_MOTEUR) do
        pcall(function() character[methode](character, true) end)
    end
    -- ⚠ Le poing NATIF ne revient pas avec les autres : il est coupé pour tous
    -- depuis le 2026-09-13 (Builder.POINGS_NATIFS, mains nues dans
    -- Server/Frappes.lua). Le rendre à `true` ferait partir deux coups par clic.
    local Builder = Narvos.CharacterBuilder
    if (Builder and Builder.POINGS_NATIFS ~= nil) then
        pcall(function() character:SetCanPunch(Builder.POINGS_NATIFS) end)
    end
    if (etat and etat.animation) then
        pcall(function() character:StopAnimation(etat.animation) end)
    end
    if (etat == nil or etat.mesh) then
        pcall(function() character:RemoveStaticMeshAttached(MenottesServeur.ATTACHE) end)
    end
end

-- ── Point d'entrée : la touche ────────────────────────────────────────────────

--- Ce que fait la touche d'arrestation. Rend (ok, message) ; le message part
--- dans le chat de l'agent.
---@param player table
---@return boolean, string
function MenottesServeur.Agir(player)
    local Menottes = Narvos.Menottes
    local character = player and player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return false, "aucun personnage" end

    local agent_id = IdDe(player)
    local cible_joueur, cible, distance = CibleProche(player, character)
    local cible_id = IdDe(cible_joueur)
    local maintenant = os.time()

    local action = Menottes.ActionPour(agent_id, cible_id)

    if (action == "evasion") then
        -- « Le serveur tire, le client reçoit » : le dé est lancé ici, jamais
        -- par le client, et jamais par le module.
        local ok, raison = Menottes.TenterEvasion(agent_id, maintenant, math.random())
        if (not ok) then return false, raison end
        Delivrer(character)
        Cliquetis(character)
        return true, "vous vous etes libere des menottes"
    end

    if (action == "aucune") then return false, "personne a portee" end

    if (action == "liberer") then
        -- ⚠ `Liberer` ne mesure pas la distance (sa signature n'en porte pas) : sans
        -- ce garde, le joueur le plus proche — fût-il à l'autre bout de la carte —
        -- serait libéré par une touche pressée n'importe où.
        if (not distance or distance > Menottes.Configuration().portee_max) then
            return false, "cible trop loin"
        end
        local ok, raison = Menottes.Liberer(agent_id, cible_id, maintenant)
        if (not ok) then return false, raison end
        Delivrer(cible)
        Cliquetis(cible)
        pcall(function() Chat.SendMessage(cible_joueur, "<cyan>on vous a libere</>") end)
        return true, "vous avez libere la cible"
    end

    local ok, raison = Menottes.Menotter({
        agent_id = agent_id,
        cible_id = cible_id,
        distance = distance,
        a_menottes = PorteMenottes(player),
        grade = nil,
    }, maintenant)
    if (not ok) then return false, raison end

    Entraver(cible, Menottes.CleAnimation(cible_id))
    -- Le geste de l'agent : l'animation d'interaction du pack, une fois.
    pcall(function()
        character:PlayAnimation(MenottesServeur.ASSETS.geste, AnimationSlotType.UpperBody, false)
    end)
    Cliquetis(cible)
    pcall(function()
        Chat.SendMessage(cible_joueur, "<red>vous etes menotte</> — la touche « Menotter » tente une evasion")
    end)
    return true, "cible menottee"
end

--- Ce personnage porte-t-il les entraves (animation, menottes au poignet) ?
--- Lu par les systèmes qui jouent une animation sur n'importe quel personnage —
--- une réaction de coup le « libérerait » à l'écran.
---@param character any
---@return boolean
function MenottesServeur.EstEntrave(character)
    return character ~= nil and entraves[character] ~= nil
end

--- Le joueur a-t-il perdu cette capacité ? Si oui, le lui DIT et rend true :
--- le gestionnaire appelant s'arrête là.
---
---   if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "roue")) then return end
---@param player table
---@param capacite string  une entrée de Logic/Menottes.CAPACITES
---@return boolean refuse
function MenottesServeur.Refuse(player, capacite)
    local id = IdDe(player)
    if (not id or not Narvos.Menottes.EstMenotte(id)) then return false end
    local drapeaux = Narvos.Menottes.Drapeaux(id)
    if (drapeaux[capacite] ~= false) then return false end
    pcall(function() Chat.SendMessage(player, "<grey>vos mains sont menottees</>") end)
    return true
end

-- ── Cycle de vie ──────────────────────────────────────────────────────────────

-- Un menotté ne monte dans aucun véhicule — le moteur le propose, on refuse.
Character.Subscribe("AttemptEnterVehicle", function(character)
    local player = JoueurDe(character)
    local id = IdDe(player)
    if (id and Narvos.Menottes.EstMenotte(id)) then return false end
end)

-- La mort délie : le personnage suivant ne doit pas hériter des entraves.
Character.Subscribe("Death", function(character)
    local player = JoueurDe(character)
    local id = IdDe(player)
    if (id and Narvos.Menottes.EstMenotte(id)) then
        Narvos.Menottes.Purger(id)
    end
    if (entraves[character]) then Delivrer(character) end
end)

-- L'état est de SESSION : il part avec son joueur.
Player.Subscribe("Destroy", function(player)
    local id = IdDe(player)
    if (id) then Narvos.Menottes.Purger(id) end
    local character = player:GetControlledCharacter()
    if (character and entraves[character]) then entraves[character] = nil end
end)

return MenottesServeur