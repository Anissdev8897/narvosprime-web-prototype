-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Dash.lua — exécute l'esquive directionnelle.
--
-- Câblage : Package.Require("Server/Dash.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua (pour EnJeu) et à côté de Server/Frappes.lua.
--
-- ── LA SÉPARATION ─────────────────────────────────────────────────────────────
-- `Shared/Logic/Dash.lua` DÉCIDE (direction, clip, constantes). Ce fichier
-- EXÉCUTE : gardes, animation IP, impulsion. Même découpage que Frappes —
-- un seul modèle de « geste déclenché à distance », pas deux.
--
-- ── L'IMPULSION ───────────────────────────────────────────────────────────────
-- L'animation est EN PLACE (IP) : c'est le code qui déplace. `AddImpulse` avec
-- `bVelocityChange = true` pose la VITESSE directement — la locomotion native
-- (LOCOMOTION = nil, volontairement conservée) décélère ensuite naturellement.
-- Aucun SetLocation : pas de téléportation, pas de traversée de mur par script.
-- ═══════════════════════════════════════════════════════════════════════════════

local DashServeur = {}

local Dash = Narvos.Dash
local Animations = Narvos.Animations
local Session = Narvos.SessionServeur

-- ── État ──────────────────────────────────────────────────────────────────────

--- Dernière esquive par joueur, en ms (horloge réelle `Server.GetTime`).
local derniers = {}

--- Horloge réelle, comme Frappes : le compteur de minuterie dérive.
local function horloge_ms() return Server.GetTime() end

--- Ensembles groupés des animations cuites. Construits paresseusement : au
--- chargement de CE module, `Narvos.AnimSets` n'est pas encore posé (il l'est
--- plus bas dans Server/Index.lua).
local ensembles = nil
local function Ensembles()
    if (not ensembles) then
        ensembles = Narvos.AnimSets
            or Animations.Grouper((Narvos.AnimNoms and Narvos.AnimNoms.NOMS) or {})
    end
    return ensembles
end

-- ── Gardes (mêmes règles que Frappes) ─────────────────────────────────────────

local EnJeu, Vivant

EnJeu = function(player)
    return Session and Session.EnJeu(player)
end

Vivant = function(entite)
    if (not entite) then return false end
    local ok, valide = pcall(function() return entite:IsValid() end)
    if (not ok or not valide) then return false end
    local ok2, mort = pcall(function() return entite:IsDead() end)
    return not (ok2 and mort)
end

-- ── Exécution ─────────────────────────────────────────────────────────────────

--- Le joueur esquive.
---@param player table
---@return boolean, string|nil
function DashServeur.Esquiver(player)
    local character = player:GetControlledCharacter()
    if (not Vivant(character)) then return false, "Aucun personnage" end

    -- Au volant, l'esquive n'a pas de sens : les boutons appartiennent à la
    -- conduite.
    local ok_v, vehicule = pcall(function() return character:GetVehicle() end)
    if (ok_v and vehicule) then return false, "Au volant" end

    -- Recharge.
    local maintenant = horloge_ms()
    local dernier = derniers[player]
    if (dernier and (maintenant - dernier) < Dash.COOLDOWN_MS) then
        return false, "Recharge"
    end

    -- ── Direction d'intention ──────────────────────────────────────────────
    -- On suit la VITESSE actuelle : le joueur esquive là où il se déplace.
    -- Immobile, retraite défensive en arrière (opposé du regard).
    local vers
    local ok_vel, vel = pcall(function() return character:GetVelocity() end)
    local vx = (ok_vel and vel) and (vel.X or 0) or 0
    local vy = (ok_vel and vel) and (vel.Y or 0) or 0
    local vitesse = math.sqrt(vx * vx + vy * vy)
    if (vitesse > Dash.SEUIL_VITESSE) then
        vers = { x = vx / vitesse, y = vy / vitesse }
    else
        local ok_r, regard = pcall(function() return character:GetControlRotation() end)
        local lacet = (ok_r and regard) and regard.Yaw or character:GetRotation().Yaw
        local rad = math.rad(lacet + 180)
        vers = { x = math.cos(rad), y = math.sin(rad) }
    end
    local direction = Dash.DirectionDepuis(vers) or "arriere"
    local base = Dash.CLIPS[direction]

    -- ── Geste ──────────────────────────────────────────────────────────────
    local clip = Animations.Choisir(Ensembles(), base, "IP")
    if (clip) then
        -- Une emote en boucle garderait la pose par-dessus l'esquive.
        local Emotes = Narvos.EmotesServeur
        if (Emotes and Emotes.EnCours and Emotes.EnCours(player)) then
            pcall(function() Emotes.Arreter(player) end)
        end
        pcall(function()
            character:PlayAnimation(Animations.Asset(clip), AnimationSlotType.FullBody,
                false, Dash.FONDU_ENTREE, Dash.FONDU_SORTIE, 1.0, false)
        end)
    end

    -- ── Impulsion ──────────────────────────────────────────────────────────
    pcall(function()
        character:AddImpulse(Vector(vers.x * Dash.FORCE, vers.y * Dash.FORCE, 0), true)
    end)

    derniers[player] = maintenant
    return true, nil
end

-- ── Branchements ──────────────────────────────────────────────────────────────

Events.SubscribeRemote("Narvos:Esquiver", function(player)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "esquive")) then return end
    if (not EnJeu(player)) then return end
    DashServeur.Esquiver(player)
end)

Player.Subscribe("Destroy", function(player)
    derniers[player] = nil
end)

-- ── Contrôle au chargement ────────────────────────────────────────────────────

do
    local manquants = Dash.Verifier(Ensembles())
    if (#manquants > 0) then
        Console.Warn(("Dash : %d direction(s) sans animation cuite : %s")
            :format(#manquants, table.concat(manquants, ", ")))
    else
        Console.Log("[DASH] esquive prete : 4 directions (animations cuites trouvees)")
    end
end

return DashServeur