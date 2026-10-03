-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Audio.lua — logique de SÉLECTION audio (port de footstepSystem.ts,
-- bossWarningAudio.ts, areaAnnouncements.ts, killStreakAudio.ts — PUR).
--
-- Consomme `Shared/Catalogs/Sons.lua` (injecté via `Configurer`). Ne joue AUCUN
-- son : `Sound(...)` est l'API nanos, c'est l'exécutant Server/Client.
-- ═══════════════════════════════════════════════════════════════════════════════

local Audio = {}
local Sons = nil        -- catalogue des RÈGLES et des sons d'événement
local Pas = nil         -- catalogue GÉNÉRÉ des clés d'échantillon

--- @param catalog table|nil  Catalogs/Sons.lua
--- @param catalog_pas table|nil  Catalogs/Pas.lua (généré) — facultatif : sans
---        lui, la classification marche toujours, seul le CHOIX d'un
---        échantillon devient impossible (et le dit, en rendant nil).
function Audio.Configurer(catalog, catalog_pas)
    Sons = catalog
    Pas = catalog_pas
end

--- Classifie un nom de matériau → catégorie (première règle qui matche, insensible à la casse).
function Audio.ClasseSurface(nom)
    if not Sons then return nil end
    local n = string.lower(tostring(nom or ""))
    for _, r in ipairs(Sons.PAS_REGLES) do
        for _, m in ipairs(r.motifs) do
            if string.find(n, m, 1, true) then return r.categorie end
        end
    end
    return Sons.PAS_DEFAUT
end

--- Nombre d'échantillons d'une catégorie (pour un tirage aléatoire sans répétition).
function Audio.ComptePas(categorie)
    if not Sons then return 0 end
    return Sons.PAS_COMPTE[categorie] or 0
end

-- ── Boss : alerte AoE jouée 1× par boss (Set des boss déjà annoncés).
local boss_avertis = {}
function Audio.BossEngage(bossId)
    if not Sons then return nil end
    if boss_avertis[bossId] then return nil end
    boss_avertis[bossId] = true
    return Sons.BOSS_ALERTE
end
function Audio.BossReset() boss_avertis = {} end

-- ── Annonce d'entrée de zone. Retourne { entree, niveau, delai_ms } ou nil.
function Audio.AnnounceZone(mapId)
    if not Sons then return nil end
    local mid = tostring(mapId or "")
    if string.sub(mid, 1, 6) == "donjon" then
        return { entree = Sons.DONJON_ENTREE, niveau = nil, delai_ms = 0 }
    end
    local z = Sons.ZONES[mid]
    if not z then return nil end
    return { entree = z.entree, niveau = z.niveau, delai_ms = Sons.NIVEAU_DELAI_MS }
end

-- ── Série de kills (LoL/Halo) : fenêtre, palier, fraction. PURE. ──────────────
local serie = { count = 0, since = 0 }
function Audio.SerieFenetre() return (Sons and Sons.SERIE_FENETRE_S) or 10 end

--- Enregistre un kill ; retourne la série courante (≥1).
function Audio.SerieKill()
    local fen = Audio.SerieFenetre()
    if serie.since > fen then serie.count = 0 end
    serie.count = serie.count + 1
    serie.since = 0
    return serie.count
end

--- Avance le timer ; remet à zéro si la fenêtre est dépassée.
function Audio.SerieTick(dt)
    if serie.count == 0 then return end
    serie.since = serie.since + dt
    if serie.since > Audio.SerieFenetre() then serie.count = 0 end
end

--- Annonce du palier courant (Sons.SERIES[n]) ou nil.
function Audio.SerieNiveau()
    if not Sons then return nil end
    local n = serie.count
    if n >= 6 then return Sons.SERIES["6+"] end
    return Sons.SERIES[n]
end

function Audio.SerieCount() return serie.count end
function Audio.SerieFraction()
    if serie.count == 0 then return 0 end
    local fen = Audio.SerieFenetre()
    return math.max(0, 1 - serie.since / fen)
end
function Audio.SerieReset() serie = { count = 0, since = 0 } end

-- ══════════════════════════════════════════════════════════════════════════════
-- PAS — de la surface touchée à une CLÉ d'échantillon
--
-- Trois étages, du plus sûr au plus flou :
--   1. `SurfaceType` renvoyé par le raycast — un entier du moteur, posé par le
--      matériau physique de l'asset. Sûr quand il est renseigné.
--   2. le NOM de l'acteur/composant touché, passé aux règles de `Sons.PAS_REGLES`
--      (recherche de sous-chaîne). C'est le repli quand la map n'a pas de
--      matériaux physiques — le cas de nos maps importées.
--   3. `Sons.PAS_DEFAUT`.
--
-- ⚠ L'étage 1 ne peut PAS être un simple « si non nul » : `SurfaceType.Default`
-- vaut 0, et 0 est une valeur légitime qui ne dit rien de la surface. La traiter
-- comme une réponse ferait jouer le même pas partout, sans erreur.
-- ══════════════════════════════════════════════════════════════════════════════

--- Catégorie déduite d'un `SurfaceType` du moteur, ou nil si le type n'est pas
--- concluant (Default / Air / valeur inconnue).
function Audio.CategorieDeSurface(surface_type)
    if (not Sons or type(Sons.PAS_PAR_SURFACE) ~= "table") then return nil end
    local n = tonumber(surface_type)
    if (n == nil) then return nil end
    return Sons.PAS_PAR_SURFACE[n]
end

--- La catégorie retenue pour un impact : surface d'abord, nom ensuite, défaut
--- en dernier. Ne rend JAMAIS nil tant que `Sons` est configuré — un pas muet
--- est un bug qu'on ne verrait pas.
function Audio.CategorieImpact(surface_type, ...)
    if (not Sons) then return nil end
    local parSurface = Audio.CategorieDeSurface(surface_type)
    if (parSurface) then return parSurface end
    for _, nom in ipairs({ ... }) do
        if (type(nom) == "string" and nom ~= "") then
            local c = Audio.ClasseSurface(nom)
            -- `ClasseSurface` rend le défaut quand rien ne matche : on ne peut
            -- pas s'en contenter ici, sinon le premier nom examiné gagne
            -- toujours et les suivants ne sont jamais lus.
            if (c and c ~= Sons.PAS_DEFAUT) then return c end
        end
    end
    return Sons.PAS_DEFAUT
end

-- L'ordre de repli par allure. Mesuré dans le pack : cinq catégories n'ont
-- AUCUN échantillon `marche` (brush, deckwood, glass, leaves, water) et huit
-- n'ont aucun `course`. Sans repli, marcher dans l'eau serait silencieux.
local REPLIS = {
    marche = { "marche", "autre", "course", "chute" },
    course = { "course", "marche", "autre", "chute" },
    chute  = { "chute", "autre", "marche", "course" },
}

--- Choisit une clé d'échantillon.
--- @param categorie string
--- @param allure string|nil   "marche" | "course" | "chute" (défaut : marche)
--- @param tirage number|nil   dans [0,1[ — INJECTÉ, pour rester pur et testable
--- @return string|nil cle, string|nil seau  (le seau réellement utilisé)
function Audio.ChoisirPas(categorie, allure, tirage)
    if (not Pas or type(Pas.PAR_CATEGORIE) ~= "table") then return nil, nil end
    local seaux = Pas.PAR_CATEGORIE[categorie]
    if (type(seaux) ~= "table") then return nil, nil end

    local ordre = REPLIS[allure or "marche"] or REPLIS.marche
    local t = tonumber(tirage)
    if (t == nil or t < 0 or t >= 1) then t = 0 end

    for _, seau in ipairs(ordre) do
        local liste = seaux[seau]
        if (type(liste) == "table" and #liste > 0) then
            local i = math.floor(t * #liste) + 1
            if (i > #liste) then i = #liste end
            return liste[i], seau
        end
    end
    return nil, nil
end

--- Les catégories réellement pourvues par le pack — pour un garde qui veut
--- vérifier que chaque règle de `Sons` mène quelque part.
function Audio.CategoriesPourvues()
    if (not Pas or type(Pas.CATEGORIES) ~= "table") then return {} end
    return Pas.CATEGORIES
end

return Audio
