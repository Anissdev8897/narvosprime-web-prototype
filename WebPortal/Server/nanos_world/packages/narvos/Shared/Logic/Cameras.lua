-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Cameras.lua — caméras de surveillance : pose bornée, balayage ou suivi,
-- détection dans le cône, machine d'alarme.
--
-- Câblage : Narvos.Cameras = Package.Require("Logic/Cameras.lua") dans
-- Shared/Index.lua.
--
-- ── SOURCE DE LA SPÉCIFICATION ────────────────────────────────────────────────
-- `BP_Video_Camera1` du pack Sci Fi Orion Mars Med Lab (UE 4.19, audit
-- docs/AUDIT_A_TRIER_LOT2.md §4) : classe `BP_Security_Camera_Tracking`,
-- variables « Camera Max Yaw » / « Camera Pitch », animation de rotation en
-- yaw, SceneCapture, interface `BPI_Security_Alarm_Interface`. Le BP est la
-- SPÉCIFICATION ; la logique est réécrite ici en Lua pur.
--
-- ── PUR ET PROUVABLE ──────────────────────────────────────────────────────────
-- Aucun appel API nanos, AUCUN mesh nommé : une caméra est une base + une tête
-- (positions et angles), rien de plus. Les positions sont des tables
-- { x, y, z } dans l'unité de l'appelant (nanos : unités Unreal, centimètres) ;
-- les angles sont en DEGRÉS, convention Unreal : yaw autour de Z (0 = +X),
-- pitch positif vers le haut.
--
-- ── L'ALARME ──────────────────────────────────────────────────────────────────
-- `BPI_Security_Alarm_Interface` est une interface Blueprint : chez nous,
-- l'alarme est un ÉVÉNEMENT. Ce module ne l'émet pas (il est pur) : `Detecter`
-- rend les TRANSITIONS (« declenchee », « eteinte »), et l'exécutant serveur
-- les traduira en Events.BroadcastRemote. Anti-rebond paramétrable : une cible
-- doit rester `delai_confirmation` secondes dans le cône pour déclencher, et
-- absente `delai_extinction` secondes pour éteindre — un passage éclair ne doit
-- pas hurler, une ombre d'une frame ne doit pas éteindre.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosCameras
local Cameras = {}

-- ── État des alarmes — EN TÊTE, toujours ──────────────────────────────────────
-- [camera_id] = { phase, depuis, absence_depuis, cibles = { [id] = true } }
local alarmes = {}

-- ── Constantes ────────────────────────────────────────────────────────────────

Cameras.MODES = { FIXE = "fixe", BALAYAGE = "balayage", SUIVI = "suivi" }

-- Phases de la machine d'alarme.
Cameras.PHASES = { REPOS = "repos", CONFIRMATION = "confirmation", ACTIVE = "active" }

-- Champs reconnus d'une définition : tout le reste est refusé à la création
-- (une faute de frappe dans un champ deviendrait un défaut muet de caméra).
local CHAMPS = { "id", "position", "yaw_base", "pitch_base", "max_yaw",
                 "pitch_min", "pitch_max", "portee", "demi_angle",
                 "demi_angle_vertical", "mode", "periode_balayage",
                 "delai_confirmation", "delai_extinction" }

-- ── Helpers d'angles — déclarés AVANT tout appelant ───────────────────────────

--- Ramène un angle dans (-180, 180] : la différence entre deux cap doit se
--- mesurer par le chemin le plus court, sinon une caméra à 350° verrait une
--- cible à 10° comme étant à 340° d'écart.
---@param a number
---@return number
local function normaliser180(a)
    a = a % 360
    if (a > 180) then a = a - 360 end
    if (a <= -180) then a = a + 360 end
    return a
end

--- Rampe triangulaire : phase ∈ [0, 1) → [-1, 1]. Aller-retour régulier,
--- sans saut — c'est la forme du « Camera animation of yaw rotation » de la
--- spécification.
---@param phase number
---@return number
local function triangle(phase)
    phase = phase % 1
    if (phase < 0.5) then return phase * 4 - 1 end
    return 3 - phase * 4
end

local function deg(rad) return rad * 180 / math.pi end

--- Position valide ? Trois nombres, rien de plus.
local function estPosition(p)
    return type(p) == "table"
        and tonumber(p.x) ~= nil and tonumber(p.y) ~= nil and tonumber(p.z) ~= nil
end

-- ── Création ──────────────────────────────────────────────────────────────────

--- Valide et normalise la définition d'une caméra. Rend la caméra (une copie,
--- les défauts résolus) ou nil + raison — une caméra mal définie est REFUSÉE,
--- jamais devinée.
---
--- Champs :
---   id (chaîne, obligatoire) · position { x, y, z } (obligatoire)
---   yaw_base / pitch_base    — pose de repos de la tête (défaut 0)
---   max_yaw                  — « Camera Max Yaw » : demi-amplitude horizontale
---                              du balayage ET borne du suivi (obligatoire, > 0)
---   pitch_min / pitch_max    — « Camera Pitch » : bornes verticales
---                              (défaut -45 / +45 ; pitch_base doit être dedans)
---   portee                   — distance de vue (obligatoire, > 0)
---   demi_angle               — demi-angle du cône horizontal (obligatoire,
---                              dans ]0, 180[)
---   demi_angle_vertical      — défaut : demi_angle
---   mode                     — "fixe" (défaut) | "balayage" | "suivi"
---   periode_balayage         — secondes pour l'aller-retour (obligatoire en
---                              balayage, > 0)
---   delai_confirmation       — secondes de présence avant l'alarme (défaut 0)
---   delai_extinction         — secondes d'absence avant l'extinction (défaut 0)
---@param def table
---@return table|nil camera, string|nil raison
function Cameras.Creer(def)
    if (type(def) ~= "table") then return nil, "definition attendue" end
    for k in pairs(def) do
        local connu = false
        for _, c in ipairs(CHAMPS) do
            if (c == k) then connu = true break end
        end
        if (not connu) then return nil, "champ inconnu : " .. tostring(k) end
    end

    if (type(def.id) ~= "string" or def.id == "") then return nil, "id requis" end
    if (not estPosition(def.position)) then return nil, "position invalide" end

    local max_yaw = tonumber(def.max_yaw)
    if (not max_yaw or max_yaw <= 0 or max_yaw > 180) then
        return nil, "max_yaw hors ]0, 180]"
    end
    local portee = tonumber(def.portee)
    if (not portee or portee <= 0) then return nil, "portee invalide" end
    local demi_angle = tonumber(def.demi_angle)
    if (not demi_angle or demi_angle <= 0 or demi_angle >= 180) then
        return nil, "demi_angle hors ]0, 180["
    end
    local demi_angle_vertical = tonumber(def.demi_angle_vertical) or demi_angle
    if (demi_angle_vertical <= 0 or demi_angle_vertical >= 180) then
        return nil, "demi_angle_vertical hors ]0, 180["
    end

    local pitch_min = tonumber(def.pitch_min) or -45
    local pitch_max = tonumber(def.pitch_max) or 45
    if (pitch_min > pitch_max) then return nil, "pitch_min au-dessus de pitch_max" end
    local pitch_base = tonumber(def.pitch_base) or 0
    if (pitch_base < pitch_min or pitch_base > pitch_max) then
        return nil, "pitch_base hors de ses bornes"
    end

    local mode = def.mode or Cameras.MODES.FIXE
    local mode_connu = false
    for _, m in pairs(Cameras.MODES) do
        if (m == mode) then mode_connu = true break end
    end
    if (not mode_connu) then return nil, "mode inconnu : " .. tostring(mode) end

    local periode = tonumber(def.periode_balayage)
    if (mode == Cameras.MODES.BALAYAGE and (not periode or periode <= 0)) then
        return nil, "balayage sans periode"
    end

    local confirmation = tonumber(def.delai_confirmation) or 0
    local extinction = tonumber(def.delai_extinction) or 0
    if (confirmation < 0 or extinction < 0) then return nil, "delai negatif" end

    return {
        id = def.id,
        position = { x = tonumber(def.position.x), y = tonumber(def.position.y),
                     z = tonumber(def.position.z) },
        yaw_base = tonumber(def.yaw_base) or 0,
        pitch_base = pitch_base,
        max_yaw = max_yaw,
        pitch_min = pitch_min,
        pitch_max = pitch_max,
        portee = portee,
        demi_angle = demi_angle,
        demi_angle_vertical = demi_angle_vertical,
        mode = mode,
        periode_balayage = periode,
        delai_confirmation = confirmation,
        delai_extinction = extinction,
    }, nil
end

-- ── Orientation de la tête ────────────────────────────────────────────────────

--- Cap (yaw, pitch) vers un point, en degrés, convention Unreal : yaw =
--- math.atan(y, x) à DEUX arguments (Lua 5.4 : math.atan2 n'existe plus —
--- la forme à deux arguments de math.atan lui a succédé, cf. Combat.lua),
--- pitch = atan(z, distance horizontale).
---@param camera table
---@param point table
---@return number yaw, number pitch
local function capVers(camera, point)
    local dx = point.x - camera.position.x
    local dy = point.y - camera.position.y
    local dz = point.z - camera.position.z
    local horizontal = math.sqrt(dx * dx + dy * dy)
    return deg(math.atan(dy, dx)), deg(math.atan(dz, horizontal))
end

--- La pose de la tête à un instant.
---   fixe     — la pose de base.
---   balayage — yaw = base ± max_yaw, rampe triangulaire sur la période ;
---              DÉTERMINISTE : deux appels au même instant rendent la même pose.
---   suivi    — vers la cible, BORNÉ par max_yaw et pitch_min/max ; si la cible
---              est hors de portée de rotation, la tête s'arrête au bord et
---              `serree` vaut true — la caméra regarde au plus près, elle ne
---              prétend pas suivre.
---@param camera table
---@param instant any      secondes
---@param cible table|nil  position, requise en mode suivi
---@return table|nil pose { yaw, pitch, serree }, string|nil raison
function Cameras.Orienter(camera, instant, cible)
    if (type(camera) ~= "table") then return nil, "camera inconnue" end
    local t = tonumber(instant)
    if (not t) then return nil, "instant inconnu" end

    if (camera.mode == Cameras.MODES.FIXE) then
        return { yaw = camera.yaw_base, pitch = camera.pitch_base, serree = false }, nil
    end

    if (camera.mode == Cameras.MODES.BALAYAGE) then
        return {
            yaw = camera.yaw_base + camera.max_yaw * triangle(t / camera.periode_balayage),
            pitch = camera.pitch_base,
            serree = false,
        }, nil
    end

    -- Suivi.
    if (not estPosition(cible)) then
        -- Rien à suivre : la tête revient à sa pose de base.
        return { yaw = camera.yaw_base, pitch = camera.pitch_base, serree = false }, nil
    end
    local yaw_cible, pitch_cible = capVers(camera, cible)
    local yaw = camera.yaw_base
        + math.max(-camera.max_yaw,
                   math.min(camera.max_yaw, normaliser180(yaw_cible - camera.yaw_base)))
    local pitch = math.max(camera.pitch_min, math.min(camera.pitch_max, pitch_cible))
    return {
        yaw = yaw,
        pitch = pitch,
        serree = (math.abs(normaliser180(yaw_cible - camera.yaw_base)) > camera.max_yaw)
            or pitch_cible < camera.pitch_min or pitch_cible > camera.pitch_max,
    }, nil
end

-- ── Détection ─────────────────────────────────────────────────────────────────

--- Le point est-il dans le cône de vue, pour une pose donnée ?
--- Trois conditions, toutes mesurées : distance dans la portée, écart
--- d'azimut dans le demi-angle horizontal, écart d'élévation dans le
--- demi-angle vertical.
---@param camera table
---@param point table
---@param pose table   { yaw, pitch }
---@return boolean
function Cameras.DansLeCone(camera, point, pose)
    if (type(camera) ~= "table" or not estPosition(point) or type(pose) ~= "table") then
        return false
    end

    local dx = point.x - camera.position.x
    local dy = point.y - camera.position.y
    local dz = point.z - camera.position.z
    local horizontal = math.sqrt(dx * dx + dy * dy)
    local distance = math.sqrt(horizontal * horizontal + dz * dz)
    if (distance > camera.portee) then return false end

    if (distance == 0) then return true end   -- dans la lentille : pas d'angle

    local azimut = deg(math.atan(dy, dx))
    if (math.abs(normaliser180(azimut - pose.yaw)) > camera.demi_angle) then
        return false
    end

    local elevation = deg(math.atan(dz, horizontal))
    return math.abs(normaliser180(elevation - pose.pitch)) <= camera.demi_angle_vertical
end

--- La cible suivie : la plus proche dans la portée, tous angles confondus —
--- c'est ensuite la rotation BORNÉE qui décide si la caméra peut la viser.
---@param camera table
---@param cibles table   { { id = …, position = { x, y, z } }, … }
---@return table|nil position, any id
local function plusProche(camera, cibles)
    local meilleure, meilleur_id, meilleure_d = nil, nil, nil
    for _, c in ipairs(cibles) do
        if (estPosition(c.position)) then
            local dx = c.position.x - camera.position.x
            local dy = c.position.y - camera.position.y
            local dz = c.position.z - camera.position.z
            local d = dx * dx + dy * dy + dz * dz
            if (d <= camera.portee * camera.portee
                and (meilleure_d == nil or d < meilleure_d)) then
                meilleure, meilleur_id, meilleure_d = c.position, c.id, d
            end
        end
    end
    return meilleure, meilleur_id
end

--- Un pas de détection. Rend :
---   detectees  — les identifiants des cibles dans le cône À CET INSTANT
---   pose       — la pose de la tête utilisée (pour orienter les meshes)
---   alarme     — phase courante ("repos" | "confirmation" | "active")
---   transitions — { { type = "declenchee" | "eteinte" }, … } : ce que
---                 l'exécutant traduira en événements (la spécification
---                 `BPI_Security_Alarm_Interface` s'arrête là).
---
--- La machine d'alarme (état par caméra, table en tête) :
---   repos → présence → confirmation (depuis = instant)
---   confirmation + delai_confirmation écoulé → ACTIVE, transition « declenchee »
---   confirmation + absence → repos, SANS transition (un passage éclair ne hurle pas)
---   active + absence → compte à rebours ; delai_extinction écoulé → repos,
---   transition « eteinte » ; un retour dans le cône avant le terme annule le
---   compte à rebours (l'alarme ne clignote pas).
---@param camera table
---@param cibles table
---@param instant any
---@return table|nil resultat, string|nil raison
function Cameras.Detecter(camera, cibles, instant)
    if (type(camera) ~= "table" or type(camera.id) ~= "string") then
        return nil, "camera inconnue"
    end
    local t = tonumber(instant)
    if (not t) then return nil, "instant inconnu" end
    cibles = (type(cibles) == "table") and cibles or {}

    -- La pose : en suivi, vers la cible la plus proche ; sinon selon le mode.
    local cible_suivie = nil
    if (camera.mode == Cameras.MODES.SUIVI) then
        cible_suivie = plusProche(camera, cibles)
    end
    local pose, raison = Cameras.Orienter(camera, t, cible_suivie)
    if (not pose) then return nil, raison end

    local detectees = {}
    for _, c in ipairs(cibles) do
        if (estPosition(c.position) and Cameras.DansLeCone(camera, c.position, pose)) then
            detectees[#detectees + 1] = c.id
        end
    end
    local presence = #detectees > 0

    local alarme = alarmes[camera.id]
    if (not alarme) then
        alarme = { phase = Cameras.PHASES.REPOS, depuis = t, absence_depuis = nil }
        alarmes[camera.id] = alarme
    end

    local transitions = {}

    if (alarme.phase == Cameras.PHASES.REPOS) then
        if (presence) then
            alarme.phase = Cameras.PHASES.CONFIRMATION
            alarme.depuis = t
        end
    elseif (alarme.phase == Cameras.PHASES.CONFIRMATION) then
        if (not presence) then
            alarme.phase = Cameras.PHASES.REPOS      -- passage éclair : silence
        elseif (t - alarme.depuis >= camera.delai_confirmation) then
            alarme.phase = Cameras.PHASES.ACTIVE
            alarme.absence_depuis = nil
            transitions[#transitions + 1] = { type = "declenchee" }
        end
    else -- ACTIVE
        if (presence) then
            alarme.absence_depuis = nil               -- le compte à rebours s'annule
        else
            if (alarme.absence_depuis == nil) then alarme.absence_depuis = t end
            if (t - alarme.absence_depuis >= camera.delai_extinction) then
                alarme.phase = Cameras.PHASES.REPOS
                alarme.absence_depuis = nil
                transitions[#transitions + 1] = { type = "eteinte" }
            end
        end
    end

    return {
        detectees = detectees,
        pose = pose,
        alarme = alarme.phase,
        transitions = transitions,
    }, nil
end

--- L'alarme est-elle active pour cette caméra ?
---@param camera_id any
---@return boolean
function Cameras.EnAlarme(camera_id)
    local a = (type(camera_id) == "string") and alarmes[camera_id] or nil
    return a ~= nil and a.phase == Cameras.PHASES.ACTIVE
end

--- Oublie l'état d'alarme d'une caméra (démontage, redémarrage de zone).
---@param camera_id any
function Cameras.Reinitialiser(camera_id)
    if (camera_id == nil) then return end
    alarmes[camera_id] = nil
end

return Cameras
