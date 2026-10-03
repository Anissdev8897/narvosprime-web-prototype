-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Sorts.lua — lancer les pouvoirs : cibles, dégâts, particules.
--
-- Câblage : Package.Require("Server/Sorts.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua.
--
-- ── LA DÉCISION EST AILLEURS ──────────────────────────────────────────────────
-- Tout ce qui se teste — le sort existe-t-il, la classe y a-t-elle droit, la
-- recharge est-elle écoulée, le mana suffit-il — vit dans
-- `Shared/Logic/Sorts.lua`, en Lua pur. Ce fichier-ci n'est que la partie impure :
-- il trouve des cibles dans le monde, pose des particules et retire des points de
-- vie. C'est la même séparation que `CharacterController` / `PlayerRig` côté web.
--
-- ── LES UNITÉS NE SONT PAS LES MÊMES DES DEUX CÔTÉS ───────────────────────────
-- Le catalogue TS exprime portées et rayons en MÈTRES (`range = 4`), nanos
-- travaille en CENTIMÈTRES. Oublier le facteur donne des sorts de quatre
-- centimètres de portée : ils ne touchent jamais rien, sans la moindre erreur.
--
-- ── LES DÉGÂTS PASSENT PAR `ApplyDamage` — QUESTION REFERMÉE LE 2026-09-06 ────
-- Ce fichier employait `SetHealth` faute d'avoir pu lire la signature
-- d'`ApplyDamage` : la doc locale n'embarque pas les tables de méthodes, elles
-- viennent du JSON de `github.com/nanos-world/api` à la compilation du site.
-- Le JSON a été lu (`Classes/BaseDamageable.json`) :
--
--   ApplyDamage(damage, bone_name = "", damage_type = Shot,
--               from_direction = Vector(), instigator = nil, causer = nil)
--   autorité SERVEUR, rend les dégâts réellement appliqués.
--
-- Le changement n'est pas cosmétique. `SetHealth` court-circuite TOUT :
--   · les multiplicateurs de dégâts par os (`SetDamageMultiplier`) ;
--   · l'événement `TakeDamage` — donc la fenêtre de contre du corps-à-corps,
--     qui l'écoute, et le réveil des PNJ frappés, qui l'écoute aussi ;
--   · l'événement `Death`, donc l'attribution du coup et tout ce qui en dépend.
-- Un sort qui tuait avec `SetHealth` ne déclenchait la mort de personne.
--
-- ⚠ LE SOIN RESTE EN `SetHealth`. `ApplyDamage` ne prend pas de valeur négative,
-- et il n'existe pas d'`ApplyHeal` dans le JSON — vérifié, pas supposé.
-- ═══════════════════════════════════════════════════════════════════════════════

local SortsServeur = {}

local Logique = Narvos.Sorts
local Session = Narvos.SessionServeur

--- Conversion mètres -> centimètres. nanos travaille en cm.
local M = 100.0

--- Durée de vie d'une particule d'impact, en millisecondes. Au-delà, les effets
--- s'empilent sur un combat nourri et le serveur porte des centaines d'entités
--- que plus personne ne regarde.
SortsServeur.VIE_EFFET_MS = 3000

--- Période de régénération du mana, en millisecondes.
SortsServeur.PAS_REGEN_MS = 500

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE, avant le `Player.Subscribe("Destroy")` qui les purge.

--- État de lancement par joueur (mana, recharges). Créé au premier sort.
local etats = {}

--- Horloge en SECONDES décimales depuis le démarrage du module. `os.time()` est
--- en secondes entières : une recharge d'une seconde y serait indistinguable de zéro.
---
--- ⚠ TEMPS RÉEL depuis le 2026-09-15 (`Server.GetTime`, millisecondes Unix,
--- StaticClasses/Server.json). L'horloge avançait de 0,5 s par tour de minuterie ;
--- le serveur a journalisé des tours de 475 à 685 ms : une recharge « de 60 s »
--- durait plus d'une minute, et plus le serveur peinait, plus elle s'allongeait.
local T0 = Server.GetTime()
local derniere_regen = T0
local function Maintenant()
    return (Server.GetTime() - T0) / 1000.0
end

-- ── Cibles ────────────────────────────────────────────────────────────────────

---@param a table
---@param b table
---@return number
local function Distance(a, b)
    local dx, dy, dz = a.X - b.X, a.Y - b.Y, a.Z - b.Z
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

--- Personnages à portée d'un point, hors celui du lanceur.
---
--- ⚠ `Character.GetAll()` rend TOUS les personnages, y compris ceux invoqués par
--- le menu de spawn. C'est voulu : un monstre invoqué doit pouvoir être frappé,
--- sinon le menu ne sert qu'à décorer.
---@param centre table
---@param rayon_cm number
---@param sauf table|nil
---@return table
local function CiblesAutour(centre, rayon_cm, sauf)
    local sortie = {}
    -- ⚠ LES DEUX CLASSES (2026-09-13). Les PNJ de peuplement et les monstres du
    -- menu sont souvent des `CharacterSimple` : `Character.GetAll()` seul les
    -- laissait hors d'atteinte de TOUS les sorts — des PNJ « impossibles a tuer »
    -- au pouvoir, alors que la melee (Server/Frappes.lua) les voyait.
    local listes = { Character.GetAll() or {} }
    if (CharacterSimple) then listes[2] = CharacterSimple.GetAll() or {} end
    for _, liste in ipairs(listes) do
        for _, c in pairs(liste) do
            if (c ~= sauf and c:IsValid()) then
                local ok_mort, mort = pcall(function() return c:IsDead() end)
                if (not (ok_mort and mort) and Distance(c:GetLocation(), centre) <= rayon_cm) then
                    sortie[#sortie + 1] = c
                end
            end
        end
    end
    return sortie
end

--- Personnage le plus proche devant le lanceur, dans un cône grossier.
---
--- Pas de raycast : `Trace.LineSingle` toucherait le décor avant la cible et un
--- sort ne partirait jamais dans un couloir encombré. Le produit scalaire suffit
--- à distinguer « devant » de « derrière », qui est la seule question ici.
---@param lanceur table
---@param portee_cm number
---@return table|nil
local function CibleDevant(lanceur, portee_cm)
    local origine = lanceur:GetLocation()
    local avant = lanceur:GetRotation():GetForwardVector()

    local meilleure, meilleure_d = nil, portee_cm + 1

    for _, c in ipairs(CiblesAutour(origine, portee_cm, lanceur)) do
        local p = c:GetLocation()
        local dx, dy = p.X - origine.X, p.Y - origine.Y
        local d = math.sqrt(dx * dx + dy * dy)
        if (d > 0.01) then
            -- Cosinus de l'angle au regard. 0.3 ≈ 72° de demi-ouverture : assez
            -- large pour ne pas exiger une visée au pixel, assez étroit pour ne
            -- pas frapper ce qui est sur le côté.
            local cos = (dx / d) * avant.X + (dy / d) * avant.Y
            if (cos > 0.3 and d < meilleure_d) then
                meilleure, meilleure_d = c, d
            end
        end
    end

    return meilleure
end

-- ── Effets ────────────────────────────────────────────────────────────────────

--- Après `Deactivate`, le temps laissé aux particules déjà émises pour finir
--- avant `Destroy` : un effet qui boucle s'éteint au lieu de disparaître net.
SortsServeur.FONDU_MS = 1200

--- Pose UN effet 3D et le retire après sa durée (`duree_s` du choix, sinon
--- `VIE_EFFET_MS`).
---
--- `auto_destroy = false` : la doc prévient qu'un `true` détruit l'entité
--- IMMÉDIATEMENT après le spawn, donc perd la référence — un système qui boucle
--- jouerait alors jusqu'à la reconnexion du joueur, sans moyen de l'arrêter.
---
--- `attache_a` : l'effet SUIT cet acteur (aura, bouclier) ; `lifespan 0` le
--- détruit si l'acteur disparaît avant la fin (BaseActor.json).
---@param effet table|string|nil  { asset, echelle, duree_s } ou une clé
---@param position table
---@param rotation table|nil
---@param attache_a table|nil
---@return table|nil particule
local function PoserEffet(effet, position, rotation, attache_a, socket)
    if (type(effet) == "string") then effet = { asset = effet } end
    if (type(effet) ~= "table" or type(effet.asset) ~= "string") then return nil end

    local ok, particule = pcall(Particle, position, rotation or Rotator(), effet.asset, false, true)
    if (not ok or not particule) then return nil end

    local echelle = tonumber(effet.echelle) or 1
    if (echelle > 0 and echelle ~= 1) then
        pcall(function() particule:SetScale(Vector(echelle, echelle, echelle)) end)
    end
    if (attache_a) then
        -- `socket` : le point d'attache sur l'acteur (`muzzle`, le canon d'une
        -- arme nanos — doc weapons-meshes). Vide = la racine de l'acteur.
        pcall(function() particule:AttachTo(attache_a, AttachmentRule.SnapToTarget, socket or "", 0) end)
    end

    local duree_ms = (tonumber(effet.duree_s) or 0) > 0
        and math.floor(effet.duree_s * 1000) or SortsServeur.VIE_EFFET_MS
    Timer.SetTimeout(function()
        if (not particule or not particule:IsValid()) then return end
        pcall(function() particule:Deactivate() end)
        Timer.SetTimeout(function()
            if (particule and particule:IsValid()) then particule:Destroy() end
        end, SortsServeur.FONDU_MS)
    end, duree_ms)
    -- Rendue pour le projectile, qui la fait voyager (`TranslateTo`).
    return particule
end

--- Pose une LISTE d'effets au même point. Rend la première particule posée.
---@param liste table|nil
---@param position table
---@param rotation table|nil
---@param attache_a table|nil
---@return table|nil
local function PoserEffets(liste, position, rotation, attache_a, socket)
    local premiere = nil
    for _, effet in ipairs(liste or {}) do
        local p = PoserEffet(effet, position, rotation, attache_a, socket)
        premiere = premiere or p
    end
    return premiere
end

-- ── Point de départ et journal (2026-09-14) ──────────────────────────────────

--- Décalage du point de départ : devant le lanceur et à hauteur de poitrine
--- (`GetLocation` = centre de la capsule, dans le corps).
SortsServeur.DECALAGE_AVANT_CM = 70
SortsServeur.HAUTEUR_MAINS_CM = 40

--- Une ligne par sort lancé au journal du serveur : le seul témoin d'un sort
--- côté serveur tant que personne ne l'a vu partir en jeu. À couper une fois
--- les sorts vus.
SortsServeur.JOURNAL = true

local function Journal(player, plan, texte)
    if (not SortsServeur.JOURNAL) then return end
    local nom = "?"
    pcall(function() nom = player:GetName() end)
    Console.Log(("[SORTS] %s lance %s (%s) : %s"):format(tostring(nom), tostring(plan.sort_id),
        tostring(plan.archetype), tostring(texte)))
end

--- Applique dégâts ou soin à un personnage.
---@param cible table
---@param degats number
---@param soin number
local function Appliquer(cible, degats, soin, instigateur, causeur)
    if (not cible or not cible:IsValid()) then return end

    local d = math.floor((tonumber(degats) or 0) + 0.5)
    -- Un PNJ encaisse selon SON NIVEAU : défense puis résistance (2026-09-15,
    -- Server/Ia.lua). Un corps non suivi (joueur, décor vivant) encaisse tout.
    if (d > 0 and Narvos.IaServeur) then d = Narvos.IaServeur.Attenuer(cible, d) end
    if (d > 0) then
        -- `instigator` = le JOUEUR lanceur, `causer` = son corps (2026-09-13).
        -- Ils valaient nil : une victoire au sort n'etait attribuee a personne —
        -- ni XP (Server/Progression.lua), ni quete « tuer N » (Server/Index.lua).
        -- Jamais la cible : elle se serait attribue sa propre mort.
        pcall(function()
            cible:ApplyDamage(d, "", DamageType.Unknown, Vector(0, 0, 0), instigateur, causeur)
        end)
    end

    -- Le soin n'a pas d'équivalent : `ApplyDamage` ne prend pas de négatif, et
    -- aucun `ApplyHeal` n'existe. On borne au maximum, sinon un soin porterait
    -- les PV au-delà et l'interface afficherait une barre qui déborde.
    local s = math.floor((tonumber(soin) or 0) + 0.5)
    if (s > 0) then
        local ok, pv = pcall(function() return cible:GetHealth() end)
        if (not ok or type(pv) ~= "number") then return end
        local maxi = pv + s
        pcall(function()
            local m = cible:GetMaxHealth()
            if (type(m) == "number" and m > 0 and maxi > m) then maxi = m end
        end)
        pcall(function() cible:SetHealth(maxi) end)
    end
end

-- ── Lancement ─────────────────────────────────────────────────────────────────

--- État de lancement d'un joueur, créé à la demande.
---@param player table
---@return table|nil
function SortsServeur.Etat(player)
    local etat = etats[player]
    if (etat) then return etat end

    local s = Session and Session.De(player)
    -- ⚠ `s.perso`, champ `classId` (Roster.depuisLigne) : `s.personnage` et
    -- `class_id` n'existent pas ; seul le repli par GetValue sauvait le cas.
    local perso = s and s.perso
    local class_id = perso and perso.classId
    if (not class_id) then
        local character = player:GetControlledCharacter()
        class_id = character and character:GetValue("narvos_class") or nil
    end
    if (not class_id) then return nil end

    etat = Logique.NouvelEtat(class_id)
    etats[player] = etat
    return etat
end

--- Lance le sort occupant un emplacement de la barre (1..4).
---@param player table
---@param emplacement integer
---@param canon table|nil  position du canon vue par le client (voir `Lancer`)
---@return boolean, string|nil
function SortsServeur.LancerEmplacement(player, emplacement, canon)
    local etat = SortsServeur.Etat(player)
    if (not etat) then return false, "Classe inconnue" end

    local sort = Logique.ParEmplacement(etat.class_id, emplacement)
    if (not sort) then return false, "Aucun pouvoir sur cet emplacement" end

    return SortsServeur.Lancer(player, sort.id, canon)
end

--- Écart maximal accepté entre le canon annoncé par le client et le corps du
--- lanceur, en cm. Au-delà, la position est ignorée : un client modifié ne fait
--- pas partir un sort de l'autre bout de la carte.
SortsServeur.CANON_MAX_CM = 200

--- Prise de l'arme tenue (`Logique.Prise`), ou nil à mains nues.
local function PriseDe(arme)
    if (not arme or not arme:IsValid()) then return nil end
    local ok, mode = pcall(function() return arme:GetHandlingMode() end)
    return ok and Logique.Prise(mode) or nil
end

--- Le canon annoncé par le client, s'il est plausible : une table {X,Y,Z}
--- numérique à moins de `CANON_MAX_CM` du centre de la capsule.
local function CanonPlausible(canon, origine)
    if (type(canon) ~= "table" and type(canon) ~= "userdata") then return nil end
    local x, y, z = tonumber(canon.X), tonumber(canon.Y), tonumber(canon.Z)
    if (not x or not y or not z or x ~= x or y ~= y or z ~= z) then return nil end
    local dx, dy, dz = x - origine.X, y - origine.Y, z - origine.Z
    if (dx * dx + dy * dy + dz * dz > SortsServeur.CANON_MAX_CM ^ 2) then return nil end
    return Vector(x, y, z)
end

--- Lance un sort par identifiant.
---@param player table
---@param sort_id string
---@return boolean, string|nil
function SortsServeur.Lancer(player, sort_id, canon)
    local etat = SortsServeur.Etat(player)
    if (not etat) then return false, "Classe inconnue" end

    local lanceur = player:GetControlledCharacter()
    if (not lanceur) then return false, "Aucun personnage" end
    -- Un mort ne lance rien — et ne paie ni mana ni recharge pour rien.
    local ok_mort, mort = pcall(function() return lanceur:IsDead() end)
    if (ok_mort and mort) then return false, "Vous etes mort" end

    local ok, raison, plan = Logique.Lancer(etat, sort_id, Maintenant())
    if (not ok) then return false, raison end

    local origine = lanceur:GetLocation()
    local avant = lanceur:GetRotation():GetForwardVector()
    local portee = plan.portee * M
    local rayon = plan.rayon * M

    -- ── LE GESTE, AVANT LES EFFETS ───────────────────────────────────────────
    --
    -- Le personnage bouge d'abord, la particule suit : dans l'ordre inverse,
    -- l'eclat part d'un corps immobile et le geste arrive apres coup.
    --
    -- `AnimationSlotType.UpperBody` : le haut du corps seulement. En FullBody,
    -- un sort lance en marchant figerait les jambes.
    --
    -- ⚠ ISOLE PAR `pcall` : un TYPE de slot inconnu leve, et le sort doit partir
    -- meme si son geste ne se joue pas.
    -- ── ARME EN MAIN (2026-09-15) ─────────────────────────────────────────────
    -- Le geste suit la PRISE de l'arme tenue (`Logique.GesteAvecArme`) : l'arme
    -- reste dans la main droite, la gauche fait le geste. Il ne prend plus la pose
    -- de tir de l'arme, qui faisait « tirer » un bouclier ou un soin.
    local arme = lanceur:GetPicked()
    if (arme and not arme:IsValid()) then arme = nil end
    local arme_feu = arme ~= nil and arme:IsA(Weapon)
    local prise = PriseDe(arme)
    local geste = Logique.GesteAvecArme(plan.archetype, prise)
    local vitesse, liberation_ms = Logique.Rythme(geste)
    if (geste) then
        local joue, erreur = pcall(function()
            lanceur:PlayAnimation(geste, AnimationSlotType.UpperBody, false, 0.15, 0.25, vitesse)
        end)
        if (not joue) then Console.Warn("[SORTS] animation refusée : " .. tostring(erreur)) end
    end

    -- ── D'OU PART LE SORT (2026-09-14) ───────────────────────────────────────
    -- `GetLocation` est le CENTRE de la capsule. L'effet posé la, sans decalage,
    -- naissait DANS le corps du lanceur : invisible en vue iso, et le joueur
    -- concluait que la touche n'avait rien fait. On part de la poitrine, un
    -- pas devant.
    local depart = Vector(
        origine.X + avant.X * SortsServeur.DECALAGE_AVANT_CM,
        origine.Y + avant.Y * SortsServeur.DECALAGE_AVANT_CM,
        origine.Z + SortsServeur.HAUTEUR_MAINS_CM)

    -- ── LE SORT PART DE L'ARME (2026-09-15) ──────────────────────────────────
    -- Le serveur n'a pas de squelette : `GetSocketTransform` est CLIENT
    -- (BaseActor.json). Le client annonce donc la position du canon (`muzzle`) à
    -- l'appui ; on la garde si elle est plausible, sous forme d'ÉCART au corps —
    -- le personnage peut bouger pendant le geste, le départ le suit. Sans canon
    -- lisible (mêlée, client muet) : la racine de l'arme, sinon la poitrine.
    -- Buff et bouclier restent sur le lanceur : ils ne « partent » de nulle part.
    local depuis_arme = arme ~= nil and plan.archetype ~= "buff" and plan.archetype ~= "shield"
    local ecart = nil
    if (depuis_arme) then
        local point = CanonPlausible(canon, origine) or arme:GetLocation()
        ecart = Vector(point.X - origine.X, point.Y - origine.Y, point.Z - origine.Z)
        depart = point
    end
    local socket_depart = arme_feu and "muzzle" or ""

    -- ── LES EFFETS 3D (2026-09-14) ─────────────────────────────────────────────
    -- `plan.effets` vient de `Logique.Effets` : le choix sort par sort parmi les
    -- particules cuites du pack, ou le repli par élément. L'effet de lanceur naît
    -- sur l'ARME (au canon) quand elle porte le sort, sinon devant la poitrine ;
    -- l'aura SUIT le lanceur.
    local effets = plan.effets or {}
    local rotation = lanceur:GetRotation()
    if (depuis_arme) then
        PoserEffets(effets.lanceur, depart, rotation, arme, socket_depart)
    else
        PoserEffets(effets.lanceur, origine, rotation)
    end
    if (effets.aura) then PoserEffet(effets.aura, origine, rotation, lanceur) end

    -- ── LIBÉRATION : effets et dégâts attendent le geste ──────────────────────
    -- `Logique.Rythme` donne l'instant où la main « donne » (durée réelle de la
    -- séquence × fraction ÷ vitesse). Tout ce qui suit part à cet instant, depuis
    -- la position ACTUELLE du lanceur.
    local liberer = function()
        if (not lanceur:IsValid()) then return end
        local ok_m, mort_l = pcall(function() return lanceur:IsDead() end)
        if (ok_m and mort_l) then return end
        origine = lanceur:GetLocation()
        avant = lanceur:GetRotation():GetForwardVector()
        rotation = lanceur:GetRotation()
        if (ecart) then
            depart = Vector(origine.X + ecart.X, origine.Y + ecart.Y, origine.Z + ecart.Z)
        else
            depart = Vector(
                origine.X + avant.X * SortsServeur.DECALAGE_AVANT_CM,
                origine.Y + avant.Y * SortsServeur.DECALAGE_AVANT_CM,
                origine.Z + SortsServeur.HAUTEUR_MAINS_CM)
        end

    if (plan.archetype == "aoe") then
        -- Le centre de zone est devant le lanceur, à la portée du sort. Le
        -- poser sur lui ferait exploser toutes les zones sur ses propres pieds.
        local centre = Vector(origine.X + avant.X * portee, origine.Y + avant.Y * portee, origine.Z)
        PoserEffets(effets.zone, centre, rotation)
        PoserEffets(effets.impact, centre, rotation)
        local touches = 0
        for _, cible in ipairs(CiblesAutour(centre, rayon, lanceur)) do
            Appliquer(cible, plan.degats, plan.soin, player, lanceur)
            touches = touches + 1
        end
        Journal(player, plan, "zone, " .. touches .. " cible(s)")

    elseif (plan.archetype == "buff" or plan.archetype == "shield") then
        -- Le soin d'un buff s'applique au lanceur. Les dégâts n'ont pas de sens
        -- ici : le catalogue en met zéro sur tous ses buffs.
        Appliquer(lanceur, 0, plan.soin)
        Journal(player, plan, "aura sur le lanceur")

    elseif (plan.archetype == "projectile") then
        -- ── LE PROJECTILE VOYAGE ─────────────────────────────────────────────
        -- Avant : l'effet « voyage » etait pose au depart et y restait trois
        -- secondes, pendant que l'impact apparaissait deja sur la cible. Rien
        -- ne partait. Il glisse maintenant jusqu'a l'arrivee (`TranslateTo`,
        -- autorite du serveur, interpole chez chaque client) ; l'impact et les
        -- degats tombent A L'ARRIVEE.
        local cible = CibleDevant(lanceur, portee)
        local arrivee = cible and cible:GetLocation()
            or Vector(origine.X + avant.X * portee, origine.Y + avant.Y * portee, depart.Z)
        local dx, dy, dz = arrivee.X - depart.X, arrivee.Y - depart.Y, arrivee.Z - depart.Z
        local temps = Logique.TempsDeVol(math.sqrt(dx * dx + dy * dy + dz * dz), plan.vitesse_cm_s)

        -- Le PREMIER effet de voyage glisse ; les suivants (braises) s'y attachent.
        local voyage = effets.voyage or {}
        local boule = PoserEffet(voyage[1], depart, rotation)
        if (boule) then
            pcall(function() boule:TranslateTo(arrivee, temps, 0) end)
            for i = 2, #voyage do PoserEffet(voyage[i], depart, rotation, boule) end
        end

        Timer.SetTimeout(function()
            if (boule and boule:IsValid()) then boule:Destroy() end
            local point = arrivee
            if (cible and cible:IsValid()) then
                point = cible:GetLocation()
                Appliquer(cible, plan.degats, plan.soin, player, lanceur)
            end
            PoserEffets(effets.impact, point, rotation)
        end, math.floor(temps * 1000))
        Journal(player, plan, (cible and "projectile vers une cible" or "projectile dans le vide")
            .. (" (%.2f s)"):format(temps))

    else -- basic, et tout archétype non prévu
        local cible = CibleDevant(lanceur, portee)
        local point = cible and cible:GetLocation()
            or Vector(origine.X + avant.X * portee, origine.Y + avant.Y * portee, depart.Z)
        PoserEffets(effets.impact, point, rotation)
        if (cible) then Appliquer(cible, plan.degats, plan.soin, player, lanceur) end
        -- Aucun ennemi : le sort part quand même. Le mana est déjà consommé,
        -- et un pouvoir qui ne fait RIEN quand on rate donne l'impression
        -- que la touche n'a pas répondu.
        Journal(player, plan, cible and "frappe sur une cible" or "frappe dans le vide")
    end
    end

    if (liberation_ms > 0) then
        Timer.SetTimeout(liberer, liberation_ms)
    else
        liberer()
    end
    Journal(player, plan, ("geste %s x%.1f (prise %s), liberation %d ms, depart %s")
        :format(tostring(geste), vitesse, tostring(prise or "mains nues"), liberation_ms,
            depuis_arme and (CanonPlausible(canon, lanceur:GetLocation()) and "canon" or "arme") or "poitrine"))
    return true, nil
end

-- ── Réseau ────────────────────────────────────────────────────────────────────

local function EnJeu(player)
    return Session and Session.EnJeu(player)
end

--- Pousse la barre de sorts vers le HUD.
---@param player table
function SortsServeur.Envoyer(player)
    local etat = SortsServeur.Etat(player)
    if (not etat) then return end

    Events.CallRemote("Narvos:Sorts", player, Reliability.Reliable, {
        barre = Logique.VueBarre(etat, Maintenant()),
        mana = math.floor(etat.mana),
        mana_max = etat.mana_max,
    })
end

Events.SubscribeRemote("Narvos:DemanderSorts", function(player)
    if (not EnJeu(player)) then return end
    SortsServeur.Envoyer(player)
end)

-- ── Consommables de la roue (TAB) ─────────────────────────────────────────────
--
-- Deux petites portes, et pas davantage : le mana et les PV restent PRIVES à ce
-- fichier, et Server/Index.lua n'a pas à connaître `etats` ni `SetHealth`.

--- Soigne le personnage contrôlé, borné à sa vie maximale.
--- Passe par `Appliquer` : le même chemin que les sorts, jamais une barre qui
--- déborde. Rend false sans personnage — l'appelant consomme quand même :
--- la potion est bue, le corps aurait dû être là.
---@param player table
---@param soin number
---@return boolean
function SortsServeur.Soigner(player, soin)
    local character = player and player:GetControlledCharacter()
    if (not character) then return false end
    Appliquer(character, 0, soin)
    return true
end

--- Ajoute du mana, borné à `mana_max`, et pousse le HUD.
--- Rend la quantité RÉELLEMENT ajoutée pour que l'appelant puisse l'annoncer.
---@param player table
---@param quantite number
---@return number
function SortsServeur.AjouterMana(player, quantite)
    local etat = SortsServeur.Etat(player)
    if (not etat) then return 0 end

    local n = math.floor((tonumber(quantite) or 0) + 0.5)
    if (n <= 0) then return 0 end

    local avant = etat.mana
    etat.mana = math.min(etat.mana_max, etat.mana + n)
    SortsServeur.Envoyer(player)
    return etat.mana - avant
end

Events.SubscribeRemote("Narvos:LancerSort", function(player, emplacement, canon)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "sort")) then return end
    if (not EnJeu(player)) then return end

    local ok, raison = SortsServeur.LancerEmplacement(player, emplacement, canon)
    if (not ok) then
        Events.CallRemote("Narvos:SortErreur", player, Reliability.Reliable, raison)
        -- Le refus se lit AUSSI au journal : « la touche ne fait rien » a trois
        -- causes possibles (classe, emplacement vide, mana/recharge) que seule
        -- cette ligne départage sans voir l'écran du joueur.
        if (SortsServeur.JOURNAL) then
            local nom = "?"
            pcall(function() nom = player:GetName() end)
            Console.Log(("[SORTS] %s emplacement %s refuse : %s"):format(tostring(nom),
                tostring(emplacement), tostring(raison)))
        end
    end
    SortsServeur.Envoyer(player)
end)

-- ── Boucle ────────────────────────────────────────────────────────────────────
--
-- Une seule minuterie pour tout le monde : elle avance l'horloge, régénère le
-- mana et rafraîchit les HUD. Une minuterie par joueur multiplierait le coût
-- sans rien gagner, puisqu'elles tomberaient de toute façon au même rythme.

Timer.SetInterval(function()
    -- Le pas est le temps RÉELLEMENT écoulé depuis le tour précédent.
    local t = Server.GetTime()
    local pas = math.max(0, (t - derniere_regen) / 1000.0)
    derniere_regen = t

    for player, etat in pairs(etats) do
        if (player and player:IsValid()) then
            Logique.Regenerer(etat, pas)
            SortsServeur.Envoyer(player)
        end
    end
end, SortsServeur.PAS_REGEN_MS)

--- Purge à la déconnexion. Sans ça la table retiendrait le joueur, et son mana
--- serait restauré au niveau où il l'avait laissé s'il revenait.
Player.Subscribe("Destroy", function(player)
    etats[player] = nil
end)

return SortsServeur