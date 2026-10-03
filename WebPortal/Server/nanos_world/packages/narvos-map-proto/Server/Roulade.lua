-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Roulade.lua — roulade de réception après une chute.
--
-- Câblage : Package.Require("Server/Roulade.lua") depuis Server/Index.lua,
-- APRÈS Server/Traversee.lua (mêmes gardes ; l'événement d'atterrissage est
-- partagé avec Client/Pas.lua — les deux restent indépendants).
--
-- ── L'ÉVÉNEMENT ────────────────────────────────────────────────────────────────
-- `FallingModeChange` (perso, ancien, nouveau) : le toucher du sol est le
-- passage vers `FallingMode.None` — même contrat que Client/Pas.lua:164-174,
-- qui joue le bruit de chute. La roulade ne sort que d'une VRAIE chute
-- (ancien == High) : un saut normal ne fait pas rouler.
--
-- ── PAS DE MOUVEMENT ───────────────────────────────────────────────────────────
-- Contrairement au dash (impulsion) et à la traversée (courbe), la roulade ne
-- déplace RIEN : c'est le moteur qui pose le personnage, l'animation est pure
-- gestuelle. PlayAnimation seul — aucun SetLocation ici.
-- ═══════════════════════════════════════════════════════════════════════════════

local RouladeServeur = {}

local Roulade = Narvos.Roulade
local Animations = Narvos.Animations

--- Dernière roulade par personnage (ms, horloge réelle).
local derniers = {}

local function horloge_ms() return Server.GetTime() end

--- Le personnage roule à la réception d'une chute.
---@param character table
---@return boolean
function RouladeServeur.Rouler(character)
    if (not character) then return false end

    local ok_v, valide = pcall(function() return character:IsValid() end)
    if (not ok_v or not valide) then return false end

    local ok_m, mort = pcall(function() return character:IsDead() end)
    if (ok_m and mort) then return false end

    local ok_veh, vehicule = pcall(function() return character:GetVehicle() end)
    if (ok_veh and vehicule) then return false end

    local maintenant = horloge_ms()
    local dernier = derniers[character]
    if (dernier and (maintenant - dernier) < Roulade.COOLDOWN_MS) then return false end

    -- Ensembles groupés (paresseux : Narvos.AnimSets posé plus bas dans Index).
    local ensembles = Narvos.AnimSets
    if (not ensembles) then
        ensembles = Animations.Grouper((Narvos.AnimNoms and Narvos.AnimNoms.NOMS) or {})
    end
    local parMode = ensembles and ensembles[Roulade.CLIP]
    local clip = parMode and (parMode["-"] and parMode["-"][1]) or nil
    if (not clip) then return false end

    pcall(function()
        character:PlayAnimation(Animations.Asset(clip), AnimationSlotType.FullBody,
            false, Roulade.FONDU_ENTREE, Roulade.FONDU_SORTIE, 1.0, false)
    end)

    derniers[character] = maintenant
    return true
end

-- ── Branchement ────────────────────────────────────────────────────────────────

Character.Subscribe("FallingModeChange", function(character, ancien, nouveau)
    if (nouveau == FallingMode.None and ancien == FallingMode.High) then
        RouladeServeur.Rouler(character)
    end
end)

Character.Subscribe("Destroy", function(character)
    derniers[character] = nil
end)

-- ── Contrôle au chargement ────────────────────────────────────────────────────

do
    local ensembles = Narvos.AnimSets
        or Animations.Grouper((Narvos.AnimNoms and Narvos.AnimNoms.NOMS) or {})
    if (Roulade.Verifier(ensembles)) then
        Console.Log("[ROULADE] reception en roulade prete (clip cuit trouve)")
    else
        Console.Warn("Roulade : clip " .. Roulade.CLIP .. " absent des animations cuites")
    end
end

return RouladeServeur