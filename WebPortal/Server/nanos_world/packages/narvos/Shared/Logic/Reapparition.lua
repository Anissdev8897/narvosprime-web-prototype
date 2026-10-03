-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Reapparition.lua — où et comment un JOUEUR mort revient en jeu.
--
-- Règles PURES : aucune API nanos. L'exécutant est Server/Reapparition.lua
-- (événement `Death`, `/revive`, bouton du HUD, `Respawn`, `SetHealth`).
--
-- ── POURQUOI (2026-09-15) ─────────────────────────────────────────────────────
-- Aucun code ne relevait un joueur mort : `Character.Subscribe("Death")` servait
-- à l'XP, aux quêtes, à l'IA — jamais à revenir en jeu. Mesuré en jeu : arrivée
-- à la Forge, chute de 33 m, VIE 0/132, et le personnage restait au sol jusqu'à
-- la déconnexion.
--
-- Demande de Hanibes : une commande `revive`, et le retour « au point de spawn
-- correspondant à la cité qu'il a choisie au début du jeu », choix CONSERVÉ
-- (colonne `personnages.cite`, écrite par Server/Session.lua au départ).
-- Vie et mana rendus : règle du jeu web (src/rpg/runtime/RpgGameWorld.tsx,
-- « Mort / Respawn ») — 50 % des PV, 30 % du mana.
--
-- ── DÉCISION D4 DE HANIBES (2026-09-15, soir) ─────────────────────────────────
-- « Lorsqu'un joueur meurt, il doit pouvoir réapparaître automatiquement » ; « en
-- cas de mort, le joueur pourra réapparaître au dernier Zaap activé. S'il n'en a
-- activé aucun, il réapparaît au point de spawn choisi au début du jeu. » La
-- réapparition manuelle (/revive, bouton) reste : elle n'attend que DELAI_MIN_MS,
-- l'automatique attend DELAI_AUTO_MS.
-- ═══════════════════════════════════════════════════════════════════════════════

local Reapparition = {}

--- Temps minimal passé mort avant de pouvoir revenir, en millisecondes : la mort
--- doit se VOIR (ragdoll, message) avant qu'un double appui la fasse disparaître.
Reapparition.DELAI_MIN_MS = 2000
--- Fraction de la vie maximale rendue (web : 50 %).
Reapparition.FRACTION_VIE = 0.5
--- Fraction du mana maximal rendu (web : 30 %).
Reapparition.FRACTION_MANA = 0.3
--- Au bout de ce temps, le mort revient SEUL (D4). Assez long pour lire le panneau
--- et choisir d'appuyer plus tôt ; assez court pour qu'on ne croie pas le jeu figé.
Reapparition.DELAI_AUTO_MS = 8000

local function Nombre(v)
    local n = tonumber(v)
    if (not n or n ~= n or n == math.huge or n == -math.huge) then return nil end
    return n
end

--- Point de réapparition, par ordre de préférence :
---   1. le dernier ZAAP activé, que l'exécutant a déjà résolu en position
---      (`zaap = { position, monde }`) — nil s'il n'en a aucun ou si le Zaap a été
---      supprimé depuis ;
---   2. l'arrivée de la CITÉ du personnage, si elle est encore recevable
---      (`recevable`, en jeu `Depart.Valide` : un monde retiré du départ ne
---      reçoit plus personne) ;
---   3. l'arrivée du monde où le corps est tombé ;
---   4. l'arrivée du monde par défaut.
---@param mondes table   catalogue Mondes (`Trouver`, `ParPosition`)
---@param options table  { zaap = {position, monde}|nil, cite = string|nil, recevable = function|nil, position = {X,Y,Z}|nil, defaut = string }
---@return table|nil, string|nil, string|nil  arrivée, id du monde retenu, source ("zaap" | "cite" | "mort" | "defaut")
function Reapparition.Point(mondes, options)
    if (type(mondes) ~= "table") then return nil, nil, nil end
    options = (type(options) == "table") and options or {}
    local trouver = (type(mondes.Trouver) == "function") and mondes.Trouver or function() return nil end

    local zaap = options.zaap
    if (type(zaap) == "table" and type(zaap.position) == "table") then
        return zaap.position, zaap.monde, "zaap"
    end

    local cite = options.cite
    if (type(cite) == "string" and cite ~= "") then
        local recevable = (type(options.recevable) ~= "function") or options.recevable(cite)
        local monde = recevable and trouver(cite) or nil
        if (monde and monde.arrivee) then return monde.arrivee, monde.id, "cite" end
    end

    if (options.position ~= nil and type(mondes.ParPosition) == "function") then
        local monde = mondes.ParPosition(options.position)
        if (monde and monde.arrivee) then return monde.arrivee, monde.id, "mort" end
    end

    local repli = trouver(options.defaut)
    if (repli and repli.arrivee) then return repli.arrivee, repli.id, "defaut" end
    return nil, nil, nil
end

--- Peut-on revenir maintenant ? Rend (autorisé, millisecondes restantes).
---@param mort_le_ms any     horodatage de la mort (nil = pas mort)
---@param maintenant_ms any
---@return boolean, integer
function Reapparition.PeutRevenir(mort_le_ms, maintenant_ms)
    local mort, maintenant = Nombre(mort_le_ms), Nombre(maintenant_ms)
    if (not mort or not maintenant) then return false, 0 end
    local ecoule = maintenant - mort
    if (ecoule >= Reapparition.DELAI_MIN_MS) then return true, 0 end
    return false, math.ceil(Reapparition.DELAI_MIN_MS - math.max(0, ecoule))
end

--- La réapparition AUTOMATIQUE est-elle due ? Rend (due, millisecondes restantes).
---@param mort_le_ms any     horodatage de la mort (nil = pas mort)
---@param maintenant_ms any
---@return boolean, integer
function Reapparition.Automatique(mort_le_ms, maintenant_ms)
    local mort, maintenant = Nombre(mort_le_ms), Nombre(maintenant_ms)
    if (not mort or not maintenant) then return false, 0 end
    local ecoule = maintenant - mort
    if (ecoule >= Reapparition.DELAI_AUTO_MS) then return true, 0 end
    return false, math.ceil(Reapparition.DELAI_AUTO_MS - math.max(0, ecoule))
end

--- Vie rendue : une fraction du maximum, jamais moins de 1 (un corps relevé à 0 PV
--- remourrait aussitôt).
---@param max_vie any
---@return integer
function Reapparition.Vie(max_vie)
    local m = Nombre(max_vie)
    if (not m or m <= 0) then return 1 end
    return math.max(1, math.floor(m * Reapparition.FRACTION_VIE))
end

--- Mana rendu : une fraction du maximum, jamais négatif.
---@param max_mana any
---@return integer
function Reapparition.Mana(max_mana)
    local m = Nombre(max_mana)
    if (not m or m <= 0) then return 0 end
    return math.floor(m * Reapparition.FRACTION_MANA)
end

return Reapparition
