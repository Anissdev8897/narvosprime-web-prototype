-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/MetaCustom.lua — MONTRER l'apparence du Meta Customization System.
--
-- Câblage : `Package.Require("Client/MetaCustom.lua")` depuis Client/Index.lua.
--
-- ── LE MÉCANISME ──────────────────────────────────────────────────────────────
-- Le serveur pose sur le Blueprint MetaHuman une valeur SYNCHRONISÉE,
-- `narvos_mcs` : l'apparence NORMALISÉE (Server/MetaHumainBP.Apparence). Chaque
-- client en déduit la liste d'appels (`Narvos.MetaCustomLogic.Operations`) et les
-- joue sur SON exemplaire du Blueprint (`CallBlueprintEvent`, autorité both).
--
-- Pourquoi pas le serveur : le rendu est local à chaque client, et un appel
-- serveur n'atteindrait pas un joueur qui arrive APRÈS. La valeur, elle, arrive
-- avec l'entité.
--
-- ── N'ENVOYER QUE CE QUI CHANGE ───────────────────────────────────────────────
-- Un curseur tiré à l'écran de création renvoie l'apparence entière à chaque
-- pas. Rejouer ~80 appels (dont des chargements d'assets) à chaque pas saccade.
-- On garde la dernière liste jouée par Blueprint et on ne rejoue que les appels
-- dont le contenu diffère — SAUF si la peau ou le visage change : poser un
-- matériau efface les instances dynamiques (teinte, tatouage, yeux), tout
-- repart alors.
--
-- ⚠ Les fonctions `Narvos*` n'existent dans BP_NarvosMH_M/F qu'une fois ajoutées
-- dans l'éditeur (scripts/adk-mcs-fonctions.mjs) puis cuites. Avant, un appel à
-- un nom absent ne lève rien : le MetaHuman garde son apparence de base.
-- ═══════════════════════════════════════════════════════════════════════════════

local MetaCustomClient = {}

local CLE = "narvos_mcs"
local DELAI_APPARITION_MS = 400
local DELAI_CHANGEMENT_MS = 60

-- État : Blueprint -> { cle_op = true }, DÉCLARÉ EN TÊTE.
local derniers = {}
local en_attente = {}

-- ── 1ʳᵉ PERSONNE : LA TÊTE DU JOUEUR LOCAL (2026-09-14) ───────────────────────
-- En vue FPS, la caméra nanos se place à la tête du PORTEUR (mannequin nanos,
-- invisible). Le MetaHuman attaché, lui, garde sa tête : la caméra serait DANS
-- le visage, cheveux et cils en travers de l'écran. Pour le joueur local
-- seulement (`CallBlueprintEvent` joué côté client ne touche que SON rendu), le
-- visage et les grooms sont vidés — le corps, les bras et les mains restent.
-- Revenir dans une autre vue rejoue toute l'apparence.
local fps_actif = false
local COMPOSANTS_TETE = { "Hair", "Eyebrows", "Eyelashes", "Fuzz", "Beard", "Mustache" }

local function Logique()
    return Narvos and Narvos.MetaCustomLogic or nil
end

--- Une clé stable pour comparer deux appels.
local function Cle(op)
    local morceaux = {}
    for i, v in ipairs(op) do
        if (type(v) == "number") then morceaux[i] = string.format("%.4f", v)
        else morceaux[i] = tostring(v) end
    end
    return table.concat(morceaux, "\31")
end

local function ReinitialiseTout(op)
    return op[1] == "NarvosMateriau" or (op[1] == "NarvosMaillage" and op[2] == "Face")
end

--- Un appel qui (re)pose quelque chose sur la TÊTE : visage ou groom.
local function EstTete(op)
    return (op[1] == "NarvosMaillage" and op[2] == "Face") or op[1] == "NarvosGroom"
end

--- Le Blueprint MetaHuman attaché au personnage du joueur local, ou nil.
--- Le serveur le nomme par la valeur synchronisée `narvos_blueprint`.
local function BlueprintDuLocal()
    local player = Client.GetLocalPlayer()
    local character = player and player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return nil end
    local ok, attaches = pcall(function() return character:GetAttachedEntities() end)
    if (not ok or type(attaches) ~= "table") then return nil end
    for _, e in ipairs(attaches) do
        local ok_v, chemin = pcall(function() return e:GetValue("narvos_blueprint") end)
        if (ok_v and type(chemin) == "string" and chemin ~= "") then return e end
    end
    return nil
end

--- Joue l'apparence d'un Blueprint. Rend le nombre d'appels envoyés.
---@param bp table
---@return integer
function MetaCustomClient.Appliquer(bp)
    local L = Logique()
    if (not L or not bp or not bp:IsValid()) then return 0 end
    local ok_val, apparence = pcall(function() return bp:GetValue(CLE) end)
    if (not ok_val or type(apparence) ~= "table") then return 0 end

    local ops = L.Operations(apparence)
    local avant = derniers[bp] or {}
    local cles = {}
    local tout = next(avant) == nil
    for _, op in ipairs(ops) do
        local c = Cle(op)
        cles[#cles + 1] = c
        if (not avant[c] and ReinitialiseTout(op)) then tout = true end
    end

    -- En 1ʳᵉ personne, la tête du joueur local n'est PAS reposée, et ces appels
    -- ne sont pas notés comme joués : la sortie de la vue les rejouera.
    local sans_tete = fps_actif and bp == BlueprintDuLocal()

    local nouveaux = {}
    local envoyes = 0
    for i, op in ipairs(ops) do
        local c = cles[i]
        if (sans_tete and EstTete(op)) then goto suivant end
        if (tout or not avant[c]) then
            local ok, erreur = pcall(function() bp:CallBlueprintEvent(table.unpack(op)) end)
            if (ok) then
                nouveaux[c] = true
                envoyes = envoyes + 1
            else
                -- Un appel refuse doit rester rejouable a la prochaine application.
                -- L'absence d'exception reste une preuve d'envoi, pas de rendu.
                Console.Error("[MCS] Appel " .. tostring(op[1]) .. "/" .. tostring(op[2])
                    .. " refuse : " .. tostring(erreur))
            end
        else
            nouveaux[c] = true
        end
        ::suivant::
    end
    derniers[bp] = nouveaux
    return envoyes
end

--- Bascule la tête du MetaHuman local pour la vue 1ʳᵉ personne.
---@param actif boolean
---@return boolean  true si un Blueprint a été trouvé
function MetaCustomClient.PremierePersonne(actif)
    actif = actif == true
    local change = actif ~= fps_actif
    fps_actif = actif
    local bp = BlueprintDuLocal()
    if (not bp or not change) then return bp ~= nil end
    if (actif) then
        pcall(function() bp:CallBlueprintEvent("NarvosMaillage", "Face", "") end)
        for _, comp in ipairs(COMPOSANTS_TETE) do
            pcall(function() bp:CallBlueprintEvent("NarvosGroom", comp, "", "") end)
        end
    else
        -- Tout rejouer : le visage revient, et avec lui ses matériaux (teinte,
        -- tatouage, yeux), qu'un simple re-maillage aurait effacés.
        derniers[bp] = nil
        MetaCustomClient.Appliquer(bp)
    end
    return true
end

Events.Subscribe("Narvos:VuePremierePersonne", function(actif)
    MetaCustomClient.PremierePersonne(actif)
end)

local function Planifier(bp, delai)
    if (en_attente[bp]) then return end
    en_attente[bp] = true
    Timer.SetTimeout(function()
        en_attente[bp] = nil
        if (bp and bp:IsValid()) then MetaCustomClient.Appliquer(bp) end
    end, delai)
end

Blueprint.Subscribe("Spawn", function(bp)
    Planifier(bp, DELAI_APPARITION_MS)
end)

Blueprint.Subscribe("ValueChange", function(bp, cle)
    if (cle == CLE) then Planifier(bp, DELAI_CHANGEMENT_MS) end
end)

Blueprint.Subscribe("Destroy", function(bp)
    derniers[bp] = nil
    en_attente[bp] = nil
end)

return MetaCustomClient
