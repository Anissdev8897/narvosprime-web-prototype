-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Traversee.lua — exécute l'escalade (vault / mantle / grimper).
--
-- Câblage : Package.Require("Server/Traversee.lua") depuis Server/Index.lua,
-- APRÈS Server/Dash.lua (même modèle : gardes, animation IP, mouvement piloté).
--
-- ── QUI MESURE, QUI DÉCIDE ─────────────────────────────────────────────────────
--
-- `Trace` est une API CLIENT de nanos (l'exemple officiel est Client/Index.lua).
-- La MESURE de l'obstacle (face, sommet, profondeur) se fait donc dans
-- Client/Traversee.lua, qui envoie quatre chiffres. ICI, on DÉCIDE
-- (classification par hauteur, clip, allure) et on EXÉCUTE (animation IP +
-- courbe + gravité). Partage nanos habituel : le client voit, le serveur tranche.
--
-- ── VALIDATION DES CHIFFRES REÇUS ──────────────────────────────────────────────
--
-- On ne fait pas confiance au client : les quatre nombres sont bornés par
-- rapport à la position réelle du personnage. Le déplacement reste piloté
-- serveur, avec les constantes de Shared/Logic/Traversee.lua.
--
-- ── MOUVEMENT ──────────────────────────────────────────────────────────────────
--
-- Animation EN PLACE + interpolation du bassin (départ → atterrissage) avec un
-- arc au-dessus du bord, gravité coupée pendant le geste (SetGravityEnabled,
-- docs gravity-gun). Vault : retombée au sol derrière l'obstacle (profondeur
-- mesurée par le client). Mantle/grimper : pose sur le sommet.
--
-- ═══════════════════════════════════════════════════════════════════════════════
--
local TraverseeServeur = {}

local Traversee = Narvos.Traversee
local Animations = Narvos.Animations
local Session = Narvos.SessionServeur

-- ── État ──────────────────────────────────────────────────────────────────────
--
local en_cours = {}   -- player -> { interval, fin_ms }
local derniers = {}   -- player -> ms (recharge)

local function horloge_ms() return Server.GetTime() end

local clips
local function Clips()
    if (not clips) then
        clips = Traversee.Preparer((Narvos.AnimNoms and Narvos.AnimNoms.NOMS) or {})
    end
    return clips
end

-- ── Gardes ─────────────────────────────────────────────────────────────────────
--
local function Vivant(entite)
    if (not entite) then return false end
    local ok, valide = pcall(function() return entite:IsValid() end)
    if (not ok or not valide) then return false end
    local ok2, mort = pcall(function() return entite:IsDead() end)
    return not (ok2 and mort)
end

local function EnJeu(player)
    return Session and Session.EnJeu(player)
end

-- ── Validation des Mesures ────────────────────────────────────────────────────
--
local function Nombre(v, min, max)
    return type(v) == "number" and v >= min and v <= max
end

local function MesuresValides(payload, position)
    if (type(payload) ~= "table") then return false end
    -- Sommet doit être au-dessus du joueur mais pas trop haut
    if (not Nombre(payload.sommet, position.Z - 100, position.Z + 500)) then return false end
    -- Profondeur doit être raisonnable
    if (not Nombre(payload.profondeur, 0, 400)) then return false end
    
    local dx = payload.px - position.X
    local dy = payload.py - position.Y
    local distance = math.sqrt(dx * dx + dy * dy)
    -- La vérification d'angle (mur DEVANT) se fait dans Escalader, qui connaît
    -- le cap du personnage : ici, on ne juge que la distance.
    if (not Nombre(distance, 2, Traversee.PORTEE + 100)) then
        return false, "Mur trop loin"
    end
    return true
end

-- ── Exécution ─────────────────────────────────────────────────────────────────
--
--- Le joueur tente une traversée sur la base des mesures de son client.
---@param player table
---@param payload table  { px, py, sommet, profondeur }
---@return boolean, string|nil
function TraverseeServeur.Escalader(player, payload)
    local character = player:GetControlledCharacter()
    if (not Vivant(character)) then return false, "Aucun personnage" end
    if (en_cours[player]) then return false, "Traversee en cours" end

    local ok_v, vehicule = pcall(function() return character:GetVehicle() end)
    if (ok_v and vehicule) then return false, "Au volant" end

    local maintenant = horloge_ms()
    local dernier = derniers[player]
    if (dernier and (maintenant - dernier) < Traversee.COOLDOWN_MS) then
        return false, "Recharge"
    end

    local position = character:GetLocation()

    -- Direction du personnage, calculée AVANT la validation : le mur doit être
    -- DEVANT lui (produit scalaire avec son cap), pas seulement « proche ».
    local rotation = character:GetRotation()
    local avant = { x = math.cos(math.rad(rotation.Yaw)), y = math.sin(math.rad(rotation.Yaw)) }

    -- DEBUG LOG : mesures brutes reçues du client. Gardé : un payload nil ou
    -- mal formé ne doit pas casser le callback d'événement.
    if (type(payload) == "table") then
        Console.Log("[TRAVERSEE_DEBUG] %s : px=%.1f py=%.1f sommet=%.1f profondeur=%.1f",
            tostring(player and player:GetName()),
            payload.px or 0, payload.py or 0, payload.sommet or 0, payload.profondeur or 0)
    else
        Console.Log("[TRAVERSEE_DEBUG] %s : payload non-table (%s)",
            tostring(player and player:GetName()), tostring(type(payload)))
    end

    local ok_mesures, raison_mesures = MesuresValides(payload, position)
    if (not ok_mesures) then
        return false, raison_mesures or "Mesures invalides"
    end

    -- Le mur doit être devant le personnage : cos(angle) >= 0.4 (~ ±66°).
    -- Sinon, la trajectoire calculée partirait dans le vide sur le côté.
    local dxmur = payload.px - position.X
    local dymur = payload.py - position.Y
    local distmur = math.sqrt(dxmur * dxmur + dymur * dymur)
    if (distmur < 1) then return false, "Mur colle au personnage" end
    if (((dxmur * avant.x + dymur * avant.y) / distmur) < 0.4) then
        return false, "Mur pas devant"
    end

    local pieds_z = position.Z - 90
    local hauteur = payload.sommet - pieds_z
    local typ = Traversee.Classer(hauteur)
    if (not typ) then return false, "Rien a franchir" end

    -- ── Énergie ─────────────────────────────────────────────────────────────
    local EnergieServeur = Narvos.EnergieServeur
    local cout = Narvos.Energie.COUTS[typ] or 15
    if (EnergieServeur and not EnergieServeur.Peut(player, typ)) then
        return false, "Energie insuffisante"
    end

    -- ── Direction et allure ─────────────────────────────────────────────────
    -- (`avant` calculé plus haut, réutilisé pour l'atterrissage.)

    local ok_vit, vel = pcall(function() return character:GetVelocity() end)
    local vx = (ok_vit and vel) and (vel.X or 0) or 0
    local vy = (ok_vit and vel) and (vel.Y or 0) or 0
    local allure = Traversee.Allure(math.sqrt(vx * vx + vy * vy))
    local clip = Traversee.Clip(Clips(), typ, allure)
    if (not clip) then return false, "Pas d'animation" end
    local duree = Traversee.DUREES[typ] or 1000

    local Emotes = Narvos.EmotesServeur
    if (Emotes and Emotes.EnCours and Emotes.EnCours(player)) then
        pcall(function() Emotes.Arreter(player) end)
    end

    -- L'erreur d'animation doit SE VOIR : si le clip ne joue pas, le log le dit
    local ok_anim, err_anim = pcall(function()
        character:PlayAnimation(Animations.Asset(clip), AnimationSlotType.FullBody, false, 0.08, 0.25, 1.0, false)
    end)
    if (not ok_anim) then
        Console.Warn("[TRAVERSEE] PlayAnimation a echoue (%s) : %s", clip, tostring(err_anim))
    end
    Console.Log("[TRAVERSEE] %s : clip %s (duree %d ms, energie restante apres purge)", typ, clip, duree)

    -- ── Atterrissage ────────────────────────────────────────────────────────
    local depart = character:GetLocation()
    local arrivee
    if (typ == "vault") then
        -- Vault : retombée AU SOL derrière l'obstacle, à la hauteur de départ
        -- (pieds_z + 90 = position.Z). Surtout PAS sur le sommet : on passerait
        -- par-dessus et on retomberait dans le vide.
        local distance_horiz = payload.profondeur + Traversee.MARGE_ATTERRISSAGE + 40
        arrivee = Vector(
            payload.px + avant.x * distance_horiz,
            payload.py + avant.y * distance_horiz,
            pieds_z + 90)
    else
        -- Mantle / Grimper : pose sur le sommet (centre de capsule à +90) + marge 5.
        arrivee = Vector(
            payload.px + avant.x * 40,
            payload.py + avant.y * 40,
            payload.sommet + 95)
    end

    local t0 = horloge_ms()
    local purge_par_tick = cout * (Narvos.Energie.PAS_PURGE_MS / duree)

    pcall(function() character:SetGravityEnabled(false) end)

    en_cours[player] = { fin_ms = t0 + duree }
    en_cours[player].interval = Timer.SetInterval(function()
        local t = horloge_ms() - t0
        local f = math.min(t / duree, 1)

        -- Purge d'énergie : si la réserve se vide en cours d'escalade, on RETOMBE
        if (EnergieServeur and not EnergieServeur.Purger(player, purge_par_tick)) then
            local etat = en_cours[player]
            if (etat and etat.interval) then
                pcall(function() Timer.ClearInterval(etat.interval) end)
            end
            en_cours[player] = nil
            pcall(function() character:SetGravityEnabled(true) end)
            derniers[player] = horloge_ms()
            Console.Log("[TRAVERSEE] energie epuisee pendant l'escalade : retombee")
            return
        end

        local hauteur_arc = (payload.sommet + Traversee.ARC) - depart.Z
        if (hauteur_arc < 0) then hauteur_arc = 0 end
        local z = depart.Z + (arrivee.Z - depart.Z) * f + hauteur_arc * math.sin(math.pi * f)
        local x = depart.X + (arrivee.X - depart.X) * f
        local y = depart.Y + (arrivee.Y - depart.Y) * f
        pcall(function() character:SetLocation(Vector(x, y, z)) end)

        if (f >= 1) then
            local etat = en_cours[player]
            if (etat and etat.interval) then
                pcall(function() Timer.ClearInterval(etat.interval) end)
            end
            en_cours[player] = nil
            pcall(function() character:SetGravityEnabled(true) end)
            derniers[player] = horloge_ms()
        end
    end, 33)

    return true, nil
end

-- ── Branchements ──────────────────────────────────────────────────────────────
local derniers_refus = {}
local function JournalRefus(player, raison)
    local maintenant = horloge_ms()
    local precedent = derniers_refus[player]
    if (precedent and (maintenant - precedent) < 2000) then return end
    derniers_refus[player] = maintenant
    Console.Log("[TRAVERSEE] refus (%s) : %s", tostring(player and player:GetName()), raison)
end

Events.SubscribeRemote("Narvos:Escalader", function(player, payload)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "traversee")) then return end
    if (not EnJeu(player)) then return end
    local ok, raison = TraverseeServeur.Escalader(player, payload)
    if (not ok) then JournalRefus(player, raison or "inconnu") end
end)

Player.Subscribe("Destroy", function(player)
    local etat = en_cours[player]
    if (etat and etat.interval) then
        pcall(function() Timer.ClearInterval(etat.interval) end)
    end
    en_cours[player] = nil
    derniers[player] = nil
    derniers_refus[player] = nil
end)

-- ── Contrôle au chargement ────────────────────────────────────────────────────
do
    local manquants = Traversee.Verifier(Clips())
    if (#manquants > 0) then
        Console.Warn("[Traversee : %d type(s) sans animation cuite : %s]", #manquants, table.concat(manquants, ", "))
    else
        Console.Log("[TRAVERSEE] escalade prete : vault, mantle, grimper (animations cuites trouvees)")
    end
end

return TraverseeServeur