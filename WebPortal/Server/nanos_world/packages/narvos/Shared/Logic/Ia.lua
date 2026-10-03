-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Ia.lua — ce qu'un PNJ DÉCIDE de faire, et rien d'autre.
-- Câblage : Narvos.Ia = Package.Require("Logic/Ia.lua")
--
-- IL DÉCIDE, IL N'AGIT PAS : il rend une INTENTION — « attendre », « aller là »,
-- « frapper ceci » — et ne déplace, n'anime, ne blesse rien, n'appelle AUCUNE API du
-- moteur. Même raison que pour `Sorts` : il se teste hors moteur, sans map, sans
-- joueur et sans horloge ; le côté impur vit dans `Server/`, et ce qu'il lui reste à
-- brancher est en fin de fichier. `maintenant_ms` est un compteur monotone en
-- MILLISECONDES passé par l'appelant (`Server/Spawner.lua` en tient un), la
-- perception arrive dans `monde`. ⚠ `os.time()` est en SECONDES : 200 ms y vaut 0.
--
-- CE QUI BORNE LE COÛT — LIRE AVANT DE TOUCHER À LA CADENCE. nanos vise 30 Hz, soit
-- 33 ms pour TOUT, et ce qui coûte est le NOMBRE d'entités : décider à chaque tick
-- pour 400 PNJ ferait 12 000 décisions/s. Quatre choix réglables le bornent.
-- (1) Cadence de DÉCISION distincte du tick (`CADENCE_MS`, par profil) : 12 000 →
-- 2 000/s. (2) Phase initiale ÉTALÉE par PNJ, sinon les 400 tombent sur le même tick
-- une fois sur six — moyenne correcte, jeu saccadé ; étalés, ~67 par tick. (3) Zéro
-- allocation par décision : une table d'intention par PNJ, réécrite sur place. (4)
-- `Decider` rend `frais`, pour ne réémettre un ordre de déplacement que sur décision
-- fraîche. À l'appelant : interroger `DoitExaminer` AVANT de bâtir `monde` (balayer
-- les candidats est le vrai coût) et n'y mettre que des cibles déjà proches.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosIa
local Ia = {}

-- ── Réglages ──────────────────────────────────────────────────────────────────
-- ⚠ Distances en CENTIMÈTRES : Unreal l'est, `Spawner.lua` aussi (`DISTANCE = 420`).
-- En mètres, toutes les portées seraient cent fois trop courtes — sans erreur.

--- Période de décision par défaut, en millisecondes.
Ia.CADENCE_MS = 200
--- Point de route atteint, puis distance au-delà de laquelle un PNJ au repos regagne
--- son ancre. Trop petite, la première le ferait tourner autour du point sans fin.
Ia.TOLERANCE_POINT = 150.0
Ia.TOLERANCE_RETOUR = 300.0
--- ⚠ Sortie d'attaque à 125 % de la portée, pas à 100 % : sinon une cible qui oscille
--- autour fait basculer l'état à chaque décision, et le PNJ paraît convulser.
Ia.HYSTERESIS_ATTAQUE = 1.25
--- Marge de changement de cible : deux joueurs côte à côte feraient sinon hésiter.
Ia.MARGE_CIBLE = 250.0
--- Types d'intention : l'exécutant ne connaît que ces trois-là.
Ia.ATTENDRE, Ia.ALLER, Ia.FRAPPER = "attendre", "aller", "frapper"
--- ⚠ Séquence EXPLICITE : `pairs` n'a ni ordre garanti ni stabilité entre VM.
Ia.ETATS = { "repos", "patrouille", "poursuite", "attaque", "repli" }
--- À ne jamais modifier : elle existe pour que `Decider` ne rende JAMAIS `nil`.
Ia.RIEN = { type = Ia.ATTENDRE, etat = "repos", cible_id = false,
            x = 0.0, y = 0.0, z = 0.0, urgence = "marche" }

-- ── Profils ───────────────────────────────────────────────────────────────────
-- Un profil est un jeu de seuils, pas un comportement : les transitions sont les
-- mêmes pour tous. `portee_abandon` dépasse toujours `portee_detection` — on lâche
-- plus loin qu'on n'accroche, sinon un joueur reculant d'un pas ferait décrocher puis
-- raccrocher sans fin. Une sentinelle est un `patrouilleur` SANS route.

Ia.PROFILS = {
    -- Alliés, marchands, quêtes : jamais le combat, et presque aucune décision.
    passif = {
        agressif = false, patrouille = false, cadence_ms = 600, laisse = 0.0,
        portee_detection = 0.0, portee_attaque = 0.0, portee_abandon = 0.0,
        seuil_repli = 0.0, seuil_reengagement = 0.0,
        repos_min_ms = 0, repos_max_ms = 0, duree_repli_ms = 0,
    },
    -- Fait sa ronde, engage, revient. Le PNJ ennemi ordinaire.
    patrouilleur = {
        agressif = true, patrouille = true, cadence_ms = 200, laisse = 3000.0,
        portee_detection = 1500.0, portee_attaque = 200.0, portee_abandon = 2600.0,
        seuil_repli = 0.25, seuil_reengagement = 0.45,
        repos_min_ms = 1500, repos_max_ms = 4000, duree_repli_ms = 10000,
    },
    -- Monstre : il peut lui aussi rompre le combat sous 25 %. L'executant rend
    -- alors une partie de sa vie ; il revient seulement une fois sorti du seuil.
    traqueur = {
        agressif = true, patrouille = true, cadence_ms = 200, laisse = 6000.0,
        portee_detection = 2200.0, portee_attaque = 250.0, portee_abandon = 4000.0,
        seuil_repli = 0.25, seuil_reengagement = 0.45,
        repos_min_ms = 1000, repos_max_ms = 3000, duree_repli_ms = 6000,
    },
}
Ia.PROFILS_ORDRE = { "passif", "patrouilleur", "traqueur" }
Ia.PROFIL_DEFAUT = "passif"

--- ⚠ LES DEUX CATALOGUES NE PARLENT PAS LA MÊME LANGUE : `Catalogs/Npc.lua` écrit
--- `ally / enemy / merchant / quest`, `Catalogs/Spawnables.lua` (ce que manipule
--- `Server/Spawner.lua`) `allie / ennemi / monstre / marchand / quete / neutre /
--- test`. Générés tous deux : on accepte les deux, ici et nulle part ailleurs.
Ia.PROFIL_PAR_ROLE = {
    allie = "passif", ennemi = "patrouilleur", monstre = "traqueur",
    marchand = "passif", quete = "passif", neutre = "passif", test = "passif",
    ally = "passif", enemy = "patrouilleur", merchant = "passif", quest = "passif",
}

--- ⚠ LE REPLI EST `passif`, PAS `patrouilleur` : un rôle inconnu qui chargerait les
--- joueurs est le pire des deux échecs ; inerte, il se voit et ne casse rien.
function Ia.ProfilPourRole(role)
    if (type(role) ~= "string") then return Ia.PROFIL_DEFAUT end
    return Ia.PROFIL_PAR_ROLE[role] or Ia.PROFIL_DEFAUT
end

--- Lire `PROFILS[nil]` est légal (seule l'ÉCRITURE `t[nil] = v` lève) ; le repli
--- reste explicite : un profil absent doit rendre un profil.
function Ia.Profil(profil_id)
    return Ia.PROFILS[profil_id] or Ia.PROFILS[Ia.PROFIL_DEFAUT]
end

-- ── Petits outils ─────────────────────────────────────────────────────────────

--- Rend TROIS NOMBRES, jamais une table : appelée plusieurs fois par décision et par
--- PNJ, une allocation ici serait le premier poste de ramassage du serveur. Accepte
--- `{x,y,z}` comme `{X,Y,Z}` — le `Vector` nanos est en majuscules, les tests non.
local function Point(v)
    if (type(v) ~= "table") then return nil end
    local x, y, z = tonumber(v.x or v.X), tonumber(v.y or v.Y), tonumber(v.z or v.Z)
    if (not x or not y or not z) then return nil end
    return x, y, z
end

--- Distance 3D. Le Z est GARDÉ délibérément : sans lui, un PNJ posté sur une
--- passerelle chargerait un joueur dix mètres plus bas, à travers le plancher.
local function Distance(ax, ay, az, bx, by, bz)
    local dx, dy, dz = ax - bx, ay - by, az - bz
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

--- ⚠ PAS `math.random` : chaque VM Lua a son propre `math.randomseed`, serveur et
--- client ne tireraient pas pareil. Un compteur est déterministe ET distinct par PNJ.
local compteur_graine = 0

--- Tirage dans [0,1). `options.alea` l'emporte : un test impose sa suite.
local function Alea(etat)
    if (etat.alea) then
        local v = tonumber(etat.alea())
        return (v and v >= 0.0 and v < 1.0) and v or 0.0
    end
    etat.graine = (etat.graine * 1103515245 + 12345) % 2147483648
    return etat.graine / 2147483648
end

--- Entre dans un état. L'attente avant de repartir en ronde est tirée dans la
--- fourchette du profil : vingt gardes repartant au même instant se verraient.
local function Entrer(etat, profil, nom, t)
    etat.etat, etat.depuis_ms = nom, t
    if (nom ~= "repos") then return end
    local mini = profil.repos_min_ms or 0
    local ecart = (profil.repos_max_ms or 0) - mini
    etat.attente_ms = (ecart > 0) and (mini + math.floor(Alea(etat) * ecart + 0.5)) or mini
end

-- ── État d'un PNJ ─────────────────────────────────────────────────────────────

--- `options` : `ancre` (apparition, référence de la laisse), `route` (points de
--- ronde), `faction` (on ne frappe pas la sienne), `graine`/`alea`, `maintenant_ms`.
function Ia.NouvelEtat(profil_id, options)
    local o = (type(options) == "table") and options or {}
    local nom = Ia.PROFILS[profil_id] and profil_id or Ia.PROFIL_DEFAUT
    local profil = Ia.PROFILS[nom]
    local t0 = tonumber(o.maintenant_ms) or 0
    -- ⚠ Ancre à `false`, jamais un point par défaut : (0,0,0) enverrait tous les PNJ
    -- sans ancre marcher vers le centre du monde.
    local ax, ay, az = Point(o.ancre)
    -- Route recopiée en séquence dense — un trou la TRONQUE ici, et c'est voulu :
    -- `#t` n'a pas de sens sur une table à trous.
    local route = {}
    if (type(o.route) == "table") then
        for _, p in ipairs(o.route) do
            local x, y, z = Point(p)
            if (x) then route[#route + 1] = { x = x, y = y, z = z } end
        end
    end
    compteur_graine = compteur_graine + 1
    local etat = {
        profil = nom, etat = "repos", depuis_ms = t0, attente_ms = 0,
        prochain_ms = t0, cible_id = false, etape = 1, route = route,
        ancre = ax and { x = ax, y = ay, z = az } or false,
        faction = (type(o.faction) == "string") and o.faction or false,
        graine = math.floor(tonumber(o.graine) or (compteur_graine * 2654435761)) % 2147483648,
        alea = (type(o.alea) == "function") and o.alea or false,
        -- Toutes les clés dès la création : un champ mis à `nil` DISPARAÎT, et
        -- « vidé » ne se distinguerait plus d'« absent ».
        intention = { type = Ia.ATTENDRE, etat = "repos", cible_id = false,
                      x = 0.0, y = 0.0, z = 0.0, urgence = "marche" },
    }
    -- Phase initiale : c'est elle qui étale la charge (en-tête, point 2).
    etat.prochain_ms = t0 + math.floor(Alea(etat) * (profil.cadence_ms or Ia.CADENCE_MS) + 0.5)
    Entrer(etat, profil, "repos", t0)
    return etat
end

--- Recale l'ancre d'un PNJ (référence de la laisse et du retour au poste).
---
--- ⚠ POURQUOI (2026-09-15) : le peuplement fait naître les PNJ 5 m AU-DESSUS du sol
--- mesuré, et l'ancre était prise à l'apparition. Tombé au sol, le PNJ « revenait à
--- son poste » en visant un point en l'air qu'il n'atteignait jamais, et la laisse
--- se mesurait depuis le ciel. L'exécutant appelle ceci une fois le PNJ posé.
--- Un point illisible laisse l'ancre intacte ; rend vrai si elle a changé.
---@param etat table
---@param position table  { x, y, z } ou { X, Y, Z }
---@return boolean
function Ia.Reancrer(etat, position)
    if (type(etat) ~= "table") then return false end
    local x, y, z = Point(position)
    if (not x) then return false end
    etat.ancre = { x = x, y = y, z = z }
    return true
end

--- L'instant est-il venu de décider ? À interroger AVANT de construire `monde`.
function Ia.DoitExaminer(etat, maintenant_ms)
    if (type(etat) ~= "table") then return false end
    local t = tonumber(maintenant_ms)
    if (not t) then return false end
    return t >= (tonumber(etat.prochain_ms) or 0)
end

--- Force une décision au prochain appel. ⚠ 200 ms est un compromis de coût, pas de
--- gameplay : branché sur les dégâts, un PNJ frappé se retourne au tick suivant.
function Ia.Reveiller(etat, maintenant_ms)
    if (type(etat) ~= "table") then return end
    local t = tonumber(maintenant_ms)
    if (t) then etat.prochain_ms = t end
end

-- ── Choix de la cible ─────────────────────────────────────────────────────────

--- Rend la cible retenue et sa distance, ou `nil, math.huge`. Le filtre de DÉTECTION
--- n'est pas ici : la machine à états juge si elle est assez proche — sinon
--- `portee_abandon`, plus grande que `portee_detection`, ne servirait jamais.
function Ia.ChoisirCible(etat, profil, monde, mx, my, mz)
    if (not profil.agressif) then return nil, math.huge end
    local liste = (type(monde) == "table") and monde.cibles or nil
    if (type(liste) ~= "table") then return nil, math.huge end
    local meilleure, d_meilleure = nil, math.huge
    local ancienne, d_ancienne = nil, math.huge
    -- ⚠ `ipairs`, jamais `pairs` : deux cibles à égalité seraient départagées par
    -- l'ordre de parcours, qui varie d'une VM à l'autre.
    for _, c in ipairs(liste) do
        local retenue = (type(c) == "table") and (type(c.id) == "string")
        if (retenue) then
            -- ⚠ `tonumber` AVANT de comparer : `nil < 0` lève. Sans `vie`, la cible
            -- est tenue pour vivante : au serveur de transmettre les PV.
            local pv = tonumber(c.vie)
            if (pv and pv <= 0) then retenue = false end
        end
        if (retenue and etat.faction and c.faction == etat.faction) then retenue = false end
        if (retenue) then
            local x, y, z = Point(c.position)
            if (x) then
                local d = Distance(mx, my, mz, x, y, z)
                -- Départage stable à distance égale : le plus petit identifiant.
                if (d < d_meilleure or (d == d_meilleure and meilleure and c.id < meilleure.id)) then
                    meilleure, d_meilleure = c, d
                end
                if (c.id == etat.cible_id) then ancienne, d_ancienne = c, d end
            end
        end
    end
    -- Collage : on garde sa cible dans la portée d'abandon, sauf si une autre est
    -- plus proche d'au moins `MARGE_CIBLE`.
    if (ancienne and d_ancienne <= profil.portee_abandon
        and (not meilleure or d_meilleure > (d_ancienne - Ia.MARGE_CIBLE))) then
        return ancienne, d_ancienne
    end
    if (not meilleure) then return nil, math.huge end
    return meilleure, d_meilleure
end

-- ── Transitions ───────────────────────────────────────────────────────────────
-- Une entrée par état, même signature, chacune rend le nom de l'état suivant. Aucune
-- n'alloue ni ne tire au sort : une transition dépend de faits mesurables — distance,
-- PV, temps écoulé. Sur un `math.random` nu, plus aucun bug ne serait reproductible.

local function EngagementPossible(profil, cible, d_cible, d_ancre, ratio)
    if (not profil.agressif or not cible or d_cible > profil.portee_detection) then return false end
    -- Blesse sous son seuil il ne repart pas au contact. L'executant le soigne
    -- pendant le repli ; avant d'avoir depasse ce seuil, il resterait sinon dans
    -- une boucle poursuite -> repli. Au bout de sa laisse, engager l'eloignerait.
    local seuil_retour = math.max(profil.seuil_repli or 0, profil.seuil_reengagement or 0)
    if (seuil_retour > 0 and ratio < seuil_retour) then return false end
    return not (profil.laisse > 0 and d_ancre > profil.laisse)
end

local TRANSITIONS = {}

TRANSITIONS.repos = function(etat, profil, cible, d_cible, d_ancre, ratio, ecoule)
    if (EngagementPossible(profil, cible, d_cible, d_ancre, ratio)) then return "poursuite" end
    if (profil.patrouille and #etat.route > 0 and ecoule >= etat.attente_ms) then return "patrouille" end
    return "repos"
end

TRANSITIONS.patrouille = function(etat, profil, cible, d_cible, d_ancre, ratio, ecoule)
    if (EngagementPossible(profil, cible, d_cible, d_ancre, ratio)) then return "poursuite" end
    if (#etat.route == 0) then return "repos" end
    if (profil.laisse > 0 and d_ancre > profil.laisse) then return "repli" end
    return "patrouille"
end

TRANSITIONS.poursuite = function(etat, profil, cible, d_cible, d_ancre, ratio, ecoule)
    if (not cible) then return "repos" end
    if (profil.seuil_repli > 0 and ratio <= profil.seuil_repli) then return "repli" end
    if (profil.laisse > 0 and d_ancre > profil.laisse) then return "repli" end
    if (d_cible <= profil.portee_attaque) then return "attaque" end
    if (d_cible > profil.portee_abandon) then return "repos" end
    return "poursuite"
end

TRANSITIONS.attaque = function(etat, profil, cible, d_cible, d_ancre, ratio, ecoule)
    if (not cible) then return "repos" end
    if (profil.seuil_repli > 0 and ratio <= profil.seuil_repli) then return "repli" end
    if (d_cible > profil.portee_attaque * Ia.HYSTERESIS_ATTAQUE) then return "poursuite" end
    return "attaque"
end

--- Le temps ou le retour a l'ancre termine la fuite. Si le soin n'a pas encore
--- depasse le seuil, `EngagementPossible` le garde au repos au lieu de le renvoyer
--- immediatement au contact.
TRANSITIONS.repli = function(etat, profil, cible, d_cible, d_ancre, ratio, ecoule)
    local soigne = ratio >= (profil.seuil_reengagement or profil.seuil_repli or 0)
    if (ecoule >= profil.duree_repli_ms or (soigne and d_ancre <= Ia.TOLERANCE_RETOUR)) then return "repos" end
    return "repli"
end

-- ── Intention ─────────────────────────────────────────────────────────────────

--- ⚠ LES SEPT CHAMPS SONT RÉÉCRITS À CHAQUE FOIS, sur place : ne poser `cible_id` que
--- s'il y en a une garderait celle d'avant, et un `nil` la ferait DISPARAÎTRE.
local function Poser(etat, type_intention, cible_id, x, y, z, urgence)
    local i = etat.intention
    i.type, i.etat, i.cible_id = type_intention, etat.etat, cible_id or false
    i.x, i.y, i.z = x or 0.0, y or 0.0, z or 0.0
    i.urgence = urgence or "marche"
    return i
end

--- Point de ronde courant, avancé d'un cran s'il est atteint.
local function AvancerRoute(etat, mx, my, mz)
    local n = #etat.route
    if (n == 0) then return nil end
    local i = etat.etape
    if (type(i) ~= "number" or i < 1 or i > n) then i = 1 end
    local p = etat.route[i]
    if (Distance(mx, my, mz, p.x, p.y, p.z) <= Ia.TOLERANCE_POINT) then
        i = (i % n) + 1 -- la ronde boucle : le dernier point ramène au premier
        p = etat.route[i]
    end
    etat.etape = i
    return p
end

-- ── Décision ──────────────────────────────────────────────────────────────────

--- Décide, ou rend la décision précédente si la cadence n'est pas écoulée. `monde` :
--- `position`, `vie`/`vie_max`, `cibles` (séquence DÉJÀ filtrée par proximité).
---@return table intention
---@return boolean frais vrai si la décision vient d'être prise
function Ia.Decider(etat, monde, maintenant_ms)
    if (type(etat) ~= "table" or type(etat.intention) ~= "table") then return Ia.RIEN, false end
    local t = tonumber(maintenant_ms)
    if (not t) then return etat.intention, false end
    if (t < (tonumber(etat.prochain_ms) or 0)) then return etat.intention, false end

    local profil = Ia.Profil(etat.profil)
    etat.prochain_ms = t + (profil.cadence_ms or Ia.CADENCE_MS)
    -- Sans position, toute transition serait un pari : attendre est le seul choix.
    local mx, my, mz = Point(type(monde) == "table" and monde.position or nil)
    if (not mx) then return Poser(etat, Ia.ATTENDRE, false, 0.0, 0.0, 0.0, "marche"), true end

    -- Ratio de vie : 1 si le serveur ne transmet rien — ignorer les PV d'un PNJ ne
    -- le rend pas mourant.
    local ratio = 1.0
    local vie, vie_max = tonumber(monde.vie), tonumber(monde.vie_max)
    if (vie and vie_max and vie_max > 0) then ratio = vie / vie_max end

    local d_ancre = 0.0
    if (etat.ancre) then d_ancre = Distance(mx, my, mz, etat.ancre.x, etat.ancre.y, etat.ancre.z) end

    local cible, d_cible = Ia.ChoisirCible(etat, profil, monde, mx, my, mz)
    etat.cible_id = cible and cible.id or false

    local ecoule = t - (tonumber(etat.depuis_ms) or t)
    local suivant = (TRANSITIONS[etat.etat] or TRANSITIONS.repos)(
        etat, profil, cible, d_cible, d_ancre, ratio, ecoule)
    if (suivant ~= etat.etat) then Entrer(etat, profil, suivant, t) end

    local nom = etat.etat
    if (cible and (nom == "attaque" or nom == "poursuite")) then
        local cx, cy, cz = Point(cible.position)
        local acte = (nom == "attaque") and Ia.FRAPPER or Ia.ALLER
        return Poser(etat, acte, cible.id, cx, cy, cz, "course"), true
    end
    if (nom == "repli" and etat.ancre) then
        return Poser(etat, Ia.ALLER, false, etat.ancre.x, etat.ancre.y, etat.ancre.z, "course"), true
    end
    if (nom == "patrouille") then
        local p = AvancerRoute(etat, mx, my, mz)
        if (p) then return Poser(etat, Ia.ALLER, false, p.x, p.y, p.z, "marche"), true end
    end
    -- Repos : on ne bouge qu'après avoir dérivé loin de son poste (poussé par un
    -- joueur, ou repli expiré loin de l'ancre).
    if (etat.ancre and d_ancre > Ia.TOLERANCE_RETOUR) then
        return Poser(etat, Ia.ALLER, false, etat.ancre.x, etat.ancre.y, etat.ancre.z, "marche"), true
    end
    return Poser(etat, Ia.ATTENDRE, false, 0.0, 0.0, 0.0, "marche"), true
end

-- ═══════════════════════════════════════════════════════════════════════════════
-- POINTS D'EXTENSION — rien ci-dessous n'est appelé ici, et aucune signature n'est
-- devinée : une signature inventée est le mode d'échec le plus coûteux du projet.
--  · ALLER `entite:MoveTo(location, <2e arg>)`, `:StopMovement()`, `:GetMovingTo()`
--    — employés par l'exemple officiel du dépôt, `game-mod/default-characters-main/
--    Shared/NPC.lua`, dont l'en-tête précise que sa base sert « Character AND
--    CharacterSimple ». ⚠ Le 2e argument n'est documenté nulle part localement
--    (l'exemple y passe 250 puis 1000) : le lire dans nanos-world/api d'abord.
--  · FRAPPER laissé au module de combat : l'intention dit QUI frapper, jamais avec
--    quoi ni pour combien — arme, recharge et dégâts sont son affaire.
--  · Orientation `Character:LookAt(location)` — serveur, donnée pour l'IA.
--  · Urgence `marche`/`course` → `Character:SetGaitMode(...)`. ⚠ L'exemple garde cet
--    appel derrière `IsA(Character)`, or nos PNJ sont surtout des `CharacterSimple`
--    (`entree.simple`) : l'équivalent n'est PAS vérifié, ne rien appeler avant.
--  · Réveil brancher `Ia.Reveiller` sur l'événement de dégâts ; l'exemple y réagit
--    par `__OnTakeDamage`, dont la forme d'abonnement reste à confirmer.
-- ═══════════════════════════════════════════════════════════════════════════════

return Ia
