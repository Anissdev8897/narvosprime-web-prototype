-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Pas.lua — L'EXÉCUTANT des bruits de pas.
--
-- Câblage : `local Pas = Package.Require("Client/Pas.lua")` depuis Client/Index.lua.
--
-- ── LE PARTAGE ────────────────────────────────────────────────────────────────
--   · `Catalogs/Pas.lua` (GÉNÉRÉ) — les 490 clés d'échantillon du pack cuit,
--     rangées par catégorie et par allure ;
--   · `Catalogs/Sons.lua` — les règles nom → catégorie, et `PAS_PAR_SURFACE` ;
--   · `Logic/Audio.lua` — la DÉCISION, pure : quelle catégorie, quelle clé ;
--   · CE FICHIER — le raycast, l'horloge, et `Sound(...)`. Rien d'autre.
--
-- `Sound` est d'autorité CLIENT (Sound.json) : ce fichier ne peut pas vivre
-- côté serveur, et chaque joueur entend ses propres pas au bon endroit.
--
-- ── LA CADENCE EST UNE DISTANCE, PAS UNE HORLOGE ──────────────────────────────
-- Un pas toutes les N millisecondes se désynchronise dès que la vitesse change
-- (marche, sprint, pente, eau). Un pas tous les N centimètres PARCOURUS reste
-- juste à toutes les vitesses et ne demande aucune constante de timing par
-- allure. On échantillonne la position à intervalle fixe et on accumule.
--
-- ── ⚠ CE QUE CE FICHIER NE PEUT PAS PROUVER ───────────────────────────────────
-- Que les maps portent des matériaux physiques. Si elles n'en portent pas,
-- `SurfaceType` vaut `Default` partout et c'est le repli par NOM d'acteur qui
-- décide — d'où le mode diagnostic (`/pas`), qui dit à voix haute quelle
-- catégorie a gagné et par quel étage.
-- ═══════════════════════════════════════════════════════════════════════════════

local PasClient = {}

local Audio = Narvos.Audio

-- ── Réglages ─────────────────────────────────────────────────────────────────
local ECHANTILLONNAGE_MS = 100      -- fréquence de mesure de la position
local DISTANCE_MARCHE = 95.0        -- cm parcourus entre deux pas (marche)
local DISTANCE_COURSE = 150.0       -- cm parcourus entre deux pas (sprint)
local PORTEE_TRACE = 140.0          -- cm sous les pieds : le sol, pas le vide
local VOLUME = 0.55
local PITCH_MIN, PITCH_MAX = 0.94, 1.06

-- ── État (déclaré EN TÊTE, avant tout lecteur) ───────────────────────────────
local distance_cumulee = 0.0
local derniere_position = nil
local diagnostic = false
local dernier_diag = nil

--- Le personnage local, ou nil. Nil est un cas NORMAL (menu, écran de création,
--- respawn) — jamais une erreur.
local function PersoLocal()
    local joueur = Client.GetLocalPlayer()
    if (not joueur) then return nil end
    local perso = joueur:GetControlledCharacter()
    if (not perso or not perso:IsValid()) then return nil end
    return perso
end

--- L'allure courante, traduite dans le vocabulaire du catalogue.
local function AllureDe(perso)
    local ok, gait = pcall(function() return perso:GetGaitMode() end)
    if (ok and gait == GaitMode.Sprinting) then return "course" end
    return "marche"
end

--- Le sol sous les pieds : succès, point d'impact, type de surface, noms.
--- ⚠ On ignore le personnage lui-même : sans ça le rayon touche sa propre
--- capsule et rend « Flesh », c'est-à-dire aucun pas.
local function SolSous(perso)
    local depart = perso:GetLocation()
    local arrivee = Vector(depart.X, depart.Y, depart.Z - PORTEE_TRACE)
    -- ⚠ `trace_mode` est un MASQUE DE BITS, et la doc est explicite :
    -- « You need to explicitly pass the modes to return the values you want ».
    -- Sans `ReturnPhysicalMaterial`, `SurfaceType` revient vide ; sans
    -- `ReturnNames`, `ActorName`/`ComponentName` reviennent vides. Les deux
    -- étages de classification tomberaient alors sur `PAS_DEFAUT` — de l'herbe
    -- partout, y compris sur le béton, SANS la moindre erreur.
    -- `TraceComplex` est nécessaire ici : nos maps sont de gros meshes
    -- multi-matériaux, et un trace simple ne rend que le premier matériau.
    local mode = TraceMode.ReturnPhysicalMaterial | TraceMode.ReturnNames
        | TraceMode.TraceComplex
    local ok, resultat = pcall(function()
        return Trace.LineSingle(depart, arrivee, CollisionChannel.WorldStatic,
            mode, { perso })
    end)
    if (not ok or type(resultat) ~= "table" or not resultat.Success) then return nil end
    return resultat
end

--- Joue un pas. `allure` vaut "marche", "course" ou "chute".
local function JouerPas(perso, allure)
    local sol = SolSous(perso)
    if (not sol) then return end   -- en l'air : pas de sol, pas de pas

    local categorie = Audio.CategorieImpact(sol.SurfaceType, sol.ComponentName, sol.ActorName)
    if (not categorie) then return end

    local cle, seau = Audio.ChoisirPas(categorie, allure, math.random())
    if (not cle) then
        -- Une catégorie sans échantillon est un défaut de catalogue, pas un
        -- silence acceptable : on le dit une fois, on ne le répète pas 60×/s.
        if (dernier_diag ~= categorie) then
            dernier_diag = categorie
            Console.Warn("Pas : aucune cle pour la categorie '" .. tostring(categorie) .. "'")
        end
        return
    end

    local pitch = PITCH_MIN + math.random() * (PITCH_MAX - PITCH_MIN)
    Sound(sol.ImpactPoint, "narvos::" .. cle, false, true, SoundType.SFX, VOLUME, pitch)

    if (diagnostic) then
        Console.Log(("Pas : %s / %s -> %s  (surface=%s acteur=%s)")
            :format(categorie, seau or "?", cle, tostring(sol.SurfaceType),
                tostring(sol.ActorName)))
    end
end

-- ── L'horloge : mesurer, accumuler, déclencher ───────────────────────────────
Timer.SetInterval(function()
    local perso = PersoLocal()
    if (not perso) then
        derniere_position = nil
        distance_cumulee = 0.0
        return
    end

    -- Dans un véhicule, c'est le véhicule qui fait le bruit.
    local dans_vehicule = false
    local ok, v = pcall(function() return perso:GetVehicle() end)
    if (ok and v) then dans_vehicule = true end

    local position = perso:GetLocation()
    if (derniere_position == nil or dans_vehicule) then
        derniere_position = position
        distance_cumulee = 0.0
        return
    end

    -- Distance HORIZONTALE : monter une pente ou tomber n'est pas marcher, et
    -- compter le Z ferait sonner une chute comme une course.
    local dx = position.X - derniere_position.X
    local dy = position.Y - derniere_position.Y
    derniere_position = position
    distance_cumulee = distance_cumulee + math.sqrt(dx * dx + dy * dy)

    -- En l'air, on n'accumule pas : l'atterrissage est traité par son propre
    -- événement, et un saut long ne doit pas lâcher trois pas au toucher.
    local en_l_air = false
    local ok2, chute = pcall(function() return perso:GetFallingMode() end)
    if (ok2 and chute ~= nil and chute ~= FallingMode.None) then en_l_air = true end
    if (en_l_air) then
        distance_cumulee = 0.0
        return
    end

    local allure = AllureDe(perso)
    local seuil = (allure == "course") and DISTANCE_COURSE or DISTANCE_MARCHE
    if (distance_cumulee >= seuil) then
        distance_cumulee = distance_cumulee - seuil
        JouerPas(perso, allure)
    end
end, ECHANTILLONNAGE_MS)

-- ── Atterrissage ─────────────────────────────────────────────────────────────
-- `FallingModeChange` porte l'ancien et le nouveau mode : le toucher du sol est
-- le passage vers `None`. On remet aussi le cumul à zéro, sinon le premier pas
-- après un saut arrive trop tôt.
Character.Subscribe("FallingModeChange", function(perso, ancien, nouveau)
    local local_perso = PersoLocal()
    if (not local_perso or perso ~= local_perso) then return end
    distance_cumulee = 0.0
    if (nouveau == FallingMode.None and ancien ~= FallingMode.None) then
        JouerPas(perso, "chute")
    end
end)

--- Bascule le mode diagnostic. Sans lui, une map sans matériau physique sonne
--- « correctement » sur la mauvaise catégorie et rien ne le signale.
function PasClient.Diagnostic(actif)
    diagnostic = (actif == true)
    Console.Log("Pas : diagnostic " .. (diagnostic and "ACTIF" or "inactif"))
    return diagnostic
end

function PasClient.EnDiagnostic() return diagnostic end

return PasClient
