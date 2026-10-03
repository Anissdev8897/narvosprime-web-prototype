-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Frappes.lua — exécute les coups à mains nues (poings, pieds).
--
-- Câblage : Package.Require("Server/Frappes.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua et Server/Combat.lua.
--
-- ── LA SÉPARATION ─────────────────────────────────────────────────────────────
-- `Shared/Logic/Frappes.lua` DÉCIDE (quel coup, quelle série, qui est dans le
-- cône). Ce fichier EXÉCUTE : animation, orientation, dégâts au bon instant.
-- Les dégâts eux-mêmes sont ceux de `Logic/Combat.lua` (`Combat.Degats`, arme
-- `Combat.POINGS`) : un seul modèle de dégâts de mêlée, pas deux.
--
-- ── POURQUOI PAS LE COUP DE POING NATIF DE NANOS ──────────────────────────────
-- Le `Punch` natif (clic gauche mains vides) joue SON animation et détecte le
-- contact par la COLLISION de la cible. Deux défauts mesurés le 2026-09-13 :
--   · aucun choix de geste, aucune main gauche, aucun coup de pied ;
--   · les PNJ Meshy ont un PhysicsAsset dégénéré (capsules de 0,5 unité d'os,
--     ≈ 0,005 cm en jeu) : un contact par collision ne les touche jamais —
--     « impossibles à tuer ».
-- Le natif est donc COUPÉ (`Builder.POINGS_NATIFS`) et remplacé ici : cône
-- devant l'attaquant, sans raycast (`Trace` est d'autorité CLIENT).
--
-- ── L'INSTANT DES DÉGÂTS ──────────────────────────────────────────────────────
-- Posés à `impact_ms` (mesuré dans le clip), cibles RELUES à cet instant : une
-- cible qui a reculé pendant l'élan est manquée, comme elle doit l'être.
-- ═══════════════════════════════════════════════════════════════════════════════

local FrappesServeur = {}

local Frappes = Narvos.Frappes
local Combat = Narvos.Combat
local Animations = Narvos.Animations
local Session = Narvos.SessionServeur

-- ── État ──────────────────────────────────────────────────────────────────────
-- ⚠ DÉCLARÉ EN TÊTE : `Player.Subscribe("Destroy")`, plus bas, s'exécute au
-- chargement et un `local` posé après lui se résoudrait en GLOBAL nil.

--- État de série par joueur (`Frappes.NouvelEtat`).
local etats = {}

--- Horloge des coups de poing, en millisecondes.
--- ⚠ TEMPS RÉEL depuis le 2026-09-19 (`Server.GetTime`) : le compteur de
--- minuterie dérive (voir l'en-tête de `Server/Combat.lua` et le harnais
--- scripts/lua-harness/combat-horloge.mjs) et figeait la série au premier coup.
local function horloge_ms() return Server.GetTime() end

--- Élargissement du cône pour ORIENTER le coup vers la cible la plus proche. Le
--- joueur vise à la caméra, son corps regarde où il marchait : sans cette aide,
--- un coup donné face à un PNJ partirait de côté.
FrappesServeur.AIDE_VISEE_DEG = 25

--- Fondus des animations de coup, en secondes.
FrappesServeur.FONDU_ENTREE = 0.08
FrappesServeur.FONDU_SORTIE = 0.20

--- Noms d'animations CUITES, calculés une fois.
local presents = Frappes.EnsembleNoms((Narvos.AnimNoms and Narvos.AnimNoms.NOMS) or {})

-- Déclarations avancées.
local EnJeu, EtatDe, Vivant, Candidats, StatsDe, Impact

EnJeu = function(player)
    return Session and Session.EnJeu(player)
end

EtatDe = function(player)
    local e = etats[player]
    if (not e) then e = Frappes.NouvelEtat(); etats[player] = e end
    return e
end

Vivant = function(entite)
    if (not entite) then return false end
    local ok, valide = pcall(function() return entite:IsValid() end)
    if (not ok or not valide) then return false end
    local ok2, mort = pcall(function() return entite:IsDead() end)
    return not (ok2 and mort)
end

--- Tous les corps frappables autour, hors l'attaquant, dans SA dimension.
--- `Character` ET `CharacterSimple` : les PNJ Meshy sont des CharacterSimple.
---@param attaquant table
---@return table  liste de { cle = entite, x, y, z }
Candidats = function(attaquant)
    local sortie = {}
    local ok_dim, dimension = pcall(function() return attaquant:GetDimension() end)
    local function ajouter(classe)
        local ok, liste = pcall(function() return classe.GetAll() end)
        if (not ok or type(liste) ~= "table") then return end
        for _, c in pairs(liste) do
            if (c ~= attaquant and Vivant(c)) then
                local memes = true
                if (ok_dim) then
                    local ok2, d = pcall(function() return c:GetDimension() end)
                    memes = (not ok2) or d == dimension
                end
                if (memes) then
                    local p = c:GetLocation()
                    sortie[#sortie + 1] = { cle = c, x = p.X, y = p.Y, z = p.Z }
                end
            end
        end
    end
    ajouter(Character)
    if (CharacterSimple) then ajouter(CharacterSimple) end
    return sortie
end

--- Statistiques de combat d'un corps : celles du personnage si un joueur le
--- contrôle, le repli des PNJ sinon (`Combat.BASE_INCONNUE`).
StatsDe = function(entite)
    local ok, joueur = pcall(function() return entite:GetPlayer() end)
    -- Un PNJ suivi par l'IA porte les statistiques de SON NIVEAU (2026-09-15) :
    -- défense et résistance. Il encaissait tout, défense 0, quel que soit son niveau.
    if (not (ok and joueur) and Narvos.IaServeur) then
        local pnj = Narvos.IaServeur.StatsCombat(entite)
        if (pnj) then return pnj end
    end
    local s = ok and joueur and Session and Session.De and Session.De(joueur) or nil
    local perso = s and s.perso or nil
    -- Bonus plats des talents (défense, critique) pour un joueur ; rien pour un PNJ.
    local bonus = (perso and Narvos.ProgressionServeur) and Narvos.ProgressionServeur.BonusCombat(joueur) or nil
    return Combat.Statistiques(perso and perso.classId, perso and perso.level, bonus)
end

-- ── Le coup ───────────────────────────────────────────────────────────────────

--- Applique les dégâts du coup, à l'instant d'impact.
---@param player table
---@param character table
---@param plan table
Impact = function(player, character, plan)
    if (not Vivant(character)) then return end

    local ici = character:GetLocation()
    local avant = character:GetRotation():GetForwardVector()
    local cibles = Frappes.Cibles({ x = ici.X, y = ici.Y, z = ici.Z },
        { x = avant.X, y = avant.Y }, Candidats(character), plan)

    local stats = StatsDe(character)
    local total, critique = 0, false
    for _, c in ipairs(cibles) do
        local cible = c.cle
        local stats_cible = StatsDe(cible)
        local d = Combat.Degats(stats, Combat.POINGS, plan.mult, stats_cible, nil)
        -- Résistance de rang d'un PNJ (boss) après la défense, comme au jeu web.
        local resistance = (stats_cible and tonumber(stats_cible.resistance)) or 0
        local degats = math.max(1, math.floor((d and d.degats or 1) * (1 - resistance) + 0.5))
        -- `from_direction` : de l'attaquant VERS la cible. C'est la lecture de
        -- Server/Combat.lua (TakeDamage), qui en déduit le côté du coup reçu.
        local sens = Vector(c.x - ici.X, c.y - ici.Y, c.z - ici.Z)
        local ok = pcall(function()
            cible:ApplyDamage(degats, "", DamageType.Punch, sens, player, character)
        end)
        if (ok) then
            total = total + degats
            critique = critique or (d and d.critique) or false
        end
    end

    -- Le HUD affiche déjà `Narvos:Coup` pour la mêlée armée : même signal.
    pcall(Events.CallRemote, "Narvos:Coup", player, Reliability.Reliable,
        plan.etape, (#cibles > 0) and total or nil, critique)
end

--- Le joueur frappe à mains nues.
---@param player table
---@param entree string  clé de `Frappes.ENTREES`
---@return boolean, string|nil
function FrappesServeur.Frapper(player, entree)
    local character = player:GetControlledCharacter()
    if (not Vivant(character)) then return false, "Aucun personnage" end

    -- Au volant, pas de coup : les boutons appartiennent à la conduite.
    local ok_v, vehicule = pcall(function() return character:GetVehicle() end)
    if (ok_v and vehicule) then return false, "Au volant" end

    -- MAINS VIDES seulement. Une arme à feu tire au clic gauche et vise au clic
    -- droit (natif) ; une arme de mêlée frappe avec elle (Server/Combat.lua).
    local ok_p, tenu = pcall(function() return character:GetPicked() end)
    if (ok_p and tenu) then return false, "Mains occupees" end

    local ok, raison, plan = Frappes.Choisir(EtatDe(player), horloge_ms(), entree)
    if (not ok) then return false, raison end

    -- Une emote en boucle garderait la pose par-dessus le coup.
    local Emotes = Narvos.EmotesServeur
    if (Emotes and Emotes.EnCours and Emotes.EnCours(player)) then
        pcall(function() Emotes.Arreter(player) end)
    end

    -- ── Orientation ─────────────────────────────────────────────────────────
    -- Vers la cible la plus proche dans un cône ÉLARGI autour de la caméra ;
    -- sinon face à la caméra. Le coup part où le joueur regarde.
    local ici = character:GetLocation()
    local ok_r, regard = pcall(function() return character:GetControlRotation() end)
    local lacet = (ok_r and regard) and regard.Yaw or character:GetRotation().Yaw
    local rad = math.rad(lacet)
    local aide = {
        portee_cm = plan.portee_cm, cibles_max = 1,
        demi_angle = plan.demi_angle + FrappesServeur.AIDE_VISEE_DEG,
    }
    local vers = Frappes.Cibles({ x = ici.X, y = ici.Y, z = ici.Z },
        { x = math.cos(rad), y = math.sin(rad) }, Candidats(character), aide)[1]
    if (vers) then
        lacet = Frappes.LacetVers({ x = ici.X, y = ici.Y }, vers) or lacet
    end
    pcall(function() character:SetRotation(Rotator(0, lacet, 0)) end)

    -- ── Geste ───────────────────────────────────────────────────────────────
    local clip = Frappes.Clip(plan, presents)
    if (clip) then
        local slot = (plan.slot == "corps") and AnimationSlotType.FullBody or AnimationSlotType.UpperBody
        pcall(function()
            character:PlayAnimation(Animations.Asset(clip), slot, false,
                FrappesServeur.FONDU_ENTREE, FrappesServeur.FONDU_SORTIE, 1.0, false)
        end)
    end

    Timer.SetTimeout(function() Impact(player, character, plan) end, plan.impact_ms)
    return true, nil
end

-- ── Branchements ──────────────────────────────────────────────────────────────

Events.SubscribeRemote("Narvos:Frapper", function(player, entree)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "melee")) then return end
    if (not EnJeu(player)) then return end
    if (type(entree) ~= "string") then return end
    FrappesServeur.Frapper(player, entree)
end)

Player.Subscribe("Destroy", function(player)
    etats[player] = nil
end)

-- ── Contrôle au chargement ────────────────────────────────────────────────────
-- Un coup sans clip cuit blesserait sans geste : on le dit une fois.
do
    local manquants = Frappes.Verifier(presents)
    if (#manquants > 0) then
        Console.Warn(("Frappes : %d coup(s) sans animation cuite : %s")
            :format(#manquants, table.concat(manquants, ", ")))
    else
        Console.Log("[FRAPPES] mains nues pretes : poings G/D, pieds G/D (animations cuites trouvees)")
    end
end

return FrappesServeur