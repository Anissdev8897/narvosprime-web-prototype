-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Ciel.lua — pose le ciel du monde où le joueur se trouve.
--
-- Câblage : local Ciel = Package.Require("Client/Ciel.lua")
--           puis Ciel.Appliquer(monde_id) à l'arrivée dans un monde.
--
-- ── POURQUOI CÔTÉ CLIENT, ET SEULEMENT CÔTÉ CLIENT ────────────────────────────
-- `Sky` est une bibliothèque CLIENT — relevé dans la table de bindings du client
-- 1.152.2, sous l'étiquette « Lua Global Client Library », et confirmé par
-- l'API : Class Authority = Client, chaque méthode aussi. L'appeler depuis
-- `Server/` lèverait au chargement du package.
--
-- Conséquence heureuse pour le budget de tick : le ciel ne coûte RIEN au
-- serveur. Il ne crée aucune entité répliquée, aucun acteur à relayer, rien qui
-- entre dans les 33 ms. Le seul message qui traverse le réseau est le
-- `Narvos:Voyage` qui existait déjà.
--
-- ── CE QUI EST DÉCIDÉ AILLEURS ────────────────────────────────────────────────
-- Le contenu des réglages vient de `Narvos.Ciel.Reglages(monde_id)`, qui lit le
-- catalogue `Mondes` et borne tout. Ici on ne décide rien : on applique, dans
-- l'ordre où l'API l'exige.
--
-- ── L'ORDRE N'EST PAS ARBITRAIRE ──────────────────────────────────────────────
-- 1. `Sky.Spawn` d'abord. Tant que l'acteur n'existe pas, tous les autres
--    appels tombent dans le vide — sans erreur, comme d'habitude.
--    ⚠ `spawn_weather` vaut `false` PAR DÉFAUT. Sans `true`, `ChangeWeather`
--    n'a aucun système météo à piloter et la brume de la Tour ne viendrait
--    jamais. On paie donc l'acteur météo une fois, pour tous les mondes.
-- 2. Le MODE ensuite : passer en `Space` retire l'atmosphère, ce qui change le
--    sens de l'heure et de l'intensité qu'on pose après.
-- 3. L'heure, puis la météo, puis les réglages fins.
-- ═══════════════════════════════════════════════════════════════════════════════

local Ciel = {}

--- Dernier monde appliqué. Évite de tout reposer à chaque message : le serveur
--- répond aussi à `Narvos:DemanderMonde`, et un joueur qui rouvre son HUD ne
--- doit pas subir une transition de ciel.
local monde_courant = nil

--- Création confirmée par Sky.IsSpawned, météo incluse pour les autres mondes.
local ciel_pose = false

-- ⚠ DÉCLARÉES AVANT LEURS APPELANTS. Une `local function` écrite après le code
-- qui l'appelle se résout en global `nil` — rencontré cinq fois sur ce projet en
-- une seule séance, et toujours muet au chargement.

--- Appelle une méthode de `Sky` si elle existe, en avalant son échec.
---
--- La table de bindings varie d'une version de client à l'autre :
--- `SetSkyLightIntensity` et `SetFogHeightOffset` sont dans le binaire 1.152.2
--- mais absents de l'API publiée. Un appel à une méthode absente lèverait et
--- couperait la pose du ciel à mi-chemin, laissant un monde à moitié réglé —
--- pire qu'un réglage manquant, parce qu'illisible.
---@param nom string
---@vararg any
---@return boolean
local function poser(nom, ...)
    local fn = Sky and Sky[nom]
    if (type(fn) ~= "function") then return false end
    local ok, err = pcall(fn, ...)
    if (not ok) then
        Console.Warn("[NARVOS] Sky." .. nom .. " a echoue : " .. tostring(err))
    end
    return ok, err
end

--- Crée l'acteur de ciel, une seule fois, AVEC le système météo.
local function assurer_acteur()
    if (ciel_pose) then return true end
    if (not Sky) then
        Console.Warn("[NARVOS] Sky indisponible : ciel non pose.")
        return false
    end
    -- (spawn_weather, find_existing) — le second récupère un ciel déjà présent
    -- sur la map plutôt que d'en empiler un second.
    if (not poser("Spawn", true, true)) then return false end
    -- Spawn renvoie FALSE lorsqu'il crée un acteur neuf : ce n'est pas un échec.
    -- Son retour distingue création et réutilisation ; IsSpawned vérifie le résultat.
    local ok, present = poser("IsSpawned", true)
    ciel_pose = ok and present == true
    return ciel_pose
end

--- Pose un réglage déjà résolu et borné.
---@param r table
local function appliquer_reglages(r)
    if (not assurer_acteur()) then return false end

    -- 1. Le mode. `SkyMode` est une table globale du client ; un nom déjà validé
    --    par `Ciel.Reglages` ne peut pas y manquer, mais on teste quand même :
    --    une version de client plus ancienne n'aurait pas `Space`.
    local mode = SkyMode and SkyMode[r.mode]
    if (mode ~= nil) then
        if (not poser("SetSkyMode", mode)) then return false end
        -- Contrat documenté de SetSkyMode : la reconstruction applique le mode.
        if (not poser("Reconstruct")) then return false end
    else
        Console.Warn("[NARVOS] SkyMode." .. tostring(r.mode) .. " inconnu de ce client.")
        return false
    end

    -- 2. L'heure. Trois arguments : heures, minutes, temps de transition.
    local succes = poser("SetTimeOfDay", r.heures, r.minutes, r.transition)

    -- 3. La météo — sautée dans l'espace, qui n'en a pas.
    if (not r.sans_meteo) then
        local meteo = WeatherType and WeatherType[r.meteo]
        if (meteo ~= nil) then
            succes = poser("ChangeWeather", meteo, r.transition) and succes
        else
            Console.Warn("[NARVOS] WeatherType." .. tostring(r.meteo) .. " inconnu de ce client.")
            succes = false
        end
    end

    -- 4. Les réglages fins.
    succes = poser("SetCloudCoverage", r.nuages) and succes
    succes = poser("SetFog", r.brume) and succes
    succes = poser("SetSunLightIntensity", r.intensite_soleil) and succes
    succes = poser("SetNightBrightness", r.luminosite_nuit) and succes
    succes = poser("SetOverallIntensity", r.intensite_globale) and succes
    -- La « lune » d'Orbital est une planète : à échelle 1 on ne la remarque pas.
    succes = poser("SetMoonScale", r.echelle_lune) and succes
    return succes
end

--- Pose le ciel du monde donné.
---
--- Sans effet si c'est déjà le monde courant : rejouer une transition de 3 s
--- parce que le HUD a redemandé son monde se verrait comme un clignotement.
---@param monde_id any
---@param forcer boolean|nil
function Ciel.Appliquer(monde_id, forcer)
    if (type(monde_id) ~= "string") then return end
    if (monde_courant == monde_id and not forcer) then return end

    local resoudre = Narvos and Narvos.Ciel and Narvos.Ciel.Reglages
    if (type(resoudre) ~= "function") then
        Console.Warn("[NARVOS] Narvos.Ciel absent : ciel non pose pour " .. monde_id)
        return
    end

    local ok, r = pcall(resoudre, monde_id)
    if (not ok or type(r) ~= "table") then
        Console.Warn("[NARVOS] reglages de ciel illisibles pour " .. monde_id)
        return
    end

    if (not appliquer_reglages(r)) then return false end
    monde_courant = monde_id
    Console.Log("[NARVOS] ciel : " .. monde_id .. " (" .. r.mode .. ")")
    return true
end

--- Oublie le monde courant. À appeler si le joueur se déconnecte de sa session
--- sans quitter le client : sinon un retour dans le même monde ne reposerait
--- rien, alors que le ciel a pu être changé entre-temps.
function Ciel.Oublier()
    monde_courant = nil
    ciel_pose = false
end

return Ciel
