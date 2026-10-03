-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Ia.lua — ce qui exécute les décisions des PNJ.
--
-- Câblage : Package.Require("Server/Ia.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua et AVANT Server/Spawner.lua, qui l'appelle à chaque
-- invocation.
--
-- ── LA SÉPARATION ─────────────────────────────────────────────────────────────
-- `Shared/Logic/Ia.lua` DÉCIDE : état, cible, intention. Il se teste sans moteur
-- et n'appelle aucune API. Ce fichier-ci EXÉCUTE : il construit la description du
-- monde, appelle `Decider`, et traduit l'intention en gestes. Il a SON harnais
-- depuis le 2026-09-15 (scripts/lua-harness/ia-serveur.mjs) : l'écart qui suit
-- était invisible à tous les tests de la décision.
--
-- ── CE QUI A CHANGÉ LE 2026-09-15 (enquête .hermes/ENQUETE_IA_PNJ_NIVEAUX) ──────
--   · PERCEPTION : les joueurs partaient en `{ id, x, y, z }`, la décision lit
--     `position` → AUCUN PNJ n'a jamais vu un joueur. Détection, poursuite,
--     attaque et laisse n'avaient jamais pu se déclencher.
--   · MOUVEMENT : `MoveTo` réémis à chaque décision (5/s) ; il ne repart plus que
--     si la destination a bougé ou l'état changé. Allure et orientation posées.
--   · ANCRE : prise à l'apparition, 5 m au-dessus du sol pour le peuplement — le
--     PNJ revenait « à son poste » en visant le ciel. Recalée une fois posé.
--   · COUP : les dégâts partent à l'IMPACT du geste, portée revérifiée, défense du
--     joueur appliquée (règle `Combat.Degats`, formule du jeu web).
--   · NIVEAUX : PV, dégâts, défense, résistance et cadence suivent le niveau
--     (`Progression.StatistiquesEnnemi`, port de Npc.tsx), niveau synchronisé.
--   · MORT : le cadavre se détruit (`SetLifeSpan`) au lieu de rester à jamais.
--
-- ── L'API, LUE ET NON DEVINÉE (Classes/*.json) ─────────────────────────────────
--   MoveTo(location, acceptance_radius = 50) / StopMovement / GetMovingTo  [authority/both]
--   événement MoveComplete(self, succeeded)                                [both]
--   Character:LookAt(Vector) / SetGaitMode(GaitMode)                       [server]
--   SetMaxHealth / SetHealth [server] · SetLifeSpan / SetRotation [authority]
--   ⚠ Le 2ᵉ argument de `MoveTo` est un RAYON d'acceptation, pas une vitesse.
--   ⚠ La doc nanos exige une NavMesh pour que `MoveTo` trouve un chemin
--     (docs/core-concepts/scripting/artificial-intelligence.mdx) : les échecs sont
--     comptés et dits au journal.
--
-- ── LE COÛT ───────────────────────────────────────────────────────────────────
-- UN SEUL Timer pour tous les PNJ ; `Ia.DoitExaminer` AVANT de construire `monde` ;
-- joueurs relevés UNE fois par tick.
-- ═══════════════════════════════════════════════════════════════════════════════

local IaServeur = {}

local Ia = Narvos.Ia
local Combat = Narvos.Combat
local Session = Narvos.SessionServeur
local Animations = Narvos.Animations
local AnimNoms = Narvos.AnimNoms

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE, avant les `Subscribe` qui les purgent : un `local` posé
-- après eux se résoudrait en GLOBAL nil, sans erreur au chargement.

--- PNJ suivis : entité -> { etat, entite, degats, cadence_ms, stats, ... }.
local suivis = {}

--- Combien de PNJ sont suivis. `#` ne marche pas sur une table indexée par entité.
local nb_suivis = 0

--- Compteur monotone, en millisecondes.
local horloge_ms = 0

--- Animations groupées par action, calculées au PREMIER coup de PNJ.
local sets_gestes = nil

--- Compteurs du bilan périodique (journal).
local bilan = { ordres = 0, arrivees = 0, echecs = 0, coups = 0, impacts = 0, rates = 0 }

--- Callback injecte par Server/Index.lua : (instigator, suivi, entite).
--- L'IA ne connait ni le sac ni la persistance du joueur.
local callback_mort = nil

--- Cadence du tick d'exécution (plus fine que la cadence de décision, 200 ms).
IaServeur.TICK_MS = 100

--- Filtre grossier des joueurs proposés comme cibles (la détection fine est dans
--- la décision).
IaServeur.PORTEE_MONDE = 6000.0

--- Récupération entre deux coups, en ms, quand un PNJ n'a pas de statistiques.
IaServeur.CADENCE_COUP_MS = 1800

--- Valeur d'entité (serveur seul) : l'étape de chaîne du DERNIER coup du PNJ.
--- Lue par la réaction de la cible (`Server/Combat.lua`).
IaServeur.MARQUE_ETAPE = "narvos_etape_coup"

--- Délai entre le début du geste d'attaque et l'impact, en ms.
IaServeur.IMPACT_MS = 380
--- À l'impact, la cible doit encore être à portée × cette marge : un joueur qui
--- recule à temps ESQUIVE le coup.
IaServeur.MARGE_IMPACT = 1.35

--- Un ordre de déplacement ne repart que si la destination a bougé de plus de
--- REEMISSION_CM, si l'état a changé, ou après REEMISSION_MS.
IaServeur.REEMISSION_CM = 200.0
IaServeur.REEMISSION_MS = 1500

--- Ancre recalée au sol : PNJ considéré posé sous cette vitesse verticale (cm/s),
--- au plus tôt après DELAI_ANCRAGE_MS, au plus tard après ANCRAGE_MAX_MS.
IaServeur.VITESSE_POSE = 20.0
IaServeur.DELAI_ANCRAGE_MS = 1200
IaServeur.ANCRAGE_MAX_MS = 10000

--- Durée de vie d'un cadavre de PNJ, en secondes.
IaServeur.CADAVRE_S = 20

--- Pendant un repli, le PNJ recupere 5 % de sa vie maximale par seconde,
--- plafonne a 45 %. Il ne repart donc ni mourant, ni entierement regenere.
IaServeur.SOIN_REPLI_PAR_SECONDE = 0.05
IaServeur.SOIN_REPLI_CIBLE = 0.45

--- Échecs de `MoveTo` au-delà desquels le journal soupçonne l'absence de NavMesh.
IaServeur.SEUIL_ECHECS_MOVE = 5

--- Valeurs d'entité SYNCHRONISÉES : niveau, rang et couleur de palier du PNJ.
--- `narvos_niveau` est aussi lu par l'XP de victoire (Server/Progression.lua).
IaServeur.CLE_NIVEAU = "narvos_niveau"
IaServeur.CLE_RANG = "narvos_rang"
IaServeur.CLE_COULEUR = "narvos_niveau_couleur"

--- Période du bilan au journal, en ms (0 = jamais).
IaServeur.BILAN_MS = 30000

--- Une ligne par changement d'état de PNJ au journal.
IaServeur.JOURNAL = true

-- Déclarations avancées : ces fonctions s'appellent mutuellement.
local Vivant, DecrireMonde, Executer, Frapper, Journal, NomDe

Vivant = function(entite)
    if (not entite) then return false end
    local ok, valide = pcall(function() return entite:IsValid() end)
    if (not ok or not valide) then return false end
    local ok2, mort = pcall(function() return entite:IsDead() end)
    return not (ok2 and mort)
end

NomDe = function(entite)
    local nom = nil
    pcall(function() nom = entite:GetValue("narvos_pnj") or entite:GetValue("narvos_spawnable") end)
    return tostring(nom or "pnj")
end

Journal = function(texte)
    if (IaServeur.JOURNAL) then Console.Log("[IA] " .. texte) end
end

local function Distance(a, b)
    local dx, dy, dz = a.X - b.X, a.Y - b.Y, a.Z - b.Z
    return math.sqrt(dx * dx + dy * dy + dz * dz)
end

-- ── Prendre un PNJ en charge ──────────────────────────────────────────────────

--- Statistiques d'un PNJ au niveau de sa zone (ou déclaré), via la logique pure.
local function StatistiquesPour(entite, entree, options)
    local P = Narvos.Progression
    if (not P or type(P.StatistiquesEnnemi) ~= "function") then return nil end
    local zone = nil
    pcall(function()
        local m = Narvos.Mondes.ParPosition(entite:GetLocation())
        zone = m and m.id
    end)
    local niveau = P.NiveauEnnemi(zone, options.niveau or entree.niveau)
    local class_id = entree.class_id
    local sorts = P.SortsPourClasse(Narvos.Spells and Narvos.Spells.SPELL_CATALOG, class_id or P.CLASSE_PNJ_DEFAUT)
    local ok, stats = pcall(P.StatistiquesEnnemi, {
        class_id = class_id, niveau = niveau, rang = options.rang or entree.rang, sorts = sorts,
    })
    return ok and stats or nil
end

--- Confie un PNJ à l'IA. Appelé par `Server/Spawner.lua` et `Server/Peuplement.lua`.
---
--- ⚠ LE RÔLE DÉCIDE DU PROFIL, ET LE REPLI EST `passif` (`Ia.ProfilPourRole`) : un
--- rôle inconnu qui chargerait les joueurs est le pire des deux échecs.
---@param entite table       Character ou CharacterSimple
---@param entree table|nil   l'entrée de catalogue qui l'a produit
---@param options table|nil  { niveau, rang } imposés par l'appelant
---@return boolean
function IaServeur.Prendre(entite, entree, options)
    if (not Vivant(entite)) then return false end
    if (suivis[entite]) then return true end

    entree = entree or {}
    options = (type(options) == "table") and options or {}
    local profil = Ia.ProfilPourRole(entree.role)

    local ok, position = pcall(function() return entite:GetLocation() end)
    local ancre = nil
    if (ok and position) then ancre = { x = position.X, y = position.Y, z = position.Z } end

    -- `graine` distincte par PNJ : sans elle, tous décideraient sur la même phase.
    local etat = Ia.NouvelEtat(profil, {
        ancre = ancre,
        faction = entree.faction,
        graine = nb_suivis * 7919 + 13,
        maintenant_ms = horloge_ms,
    })

    local suivi = {
        etat = etat,
        entite = entite,
        degats = tonumber(entree.degats) or 8,
        cadence_ms = IaServeur.CADENCE_COUP_MS,
        prochain_coup_ms = 0,
        -- La famille du catalogue (Spawnables) : elle choisit les gestes propres
        -- (Catalogs/Gestes.lua) — un infecté ne frappe pas au sabre.
        famille = entree.famille,
        pris_ms = horloge_ms,
        a_ancrer = ancre ~= nil,
        echecs_move = 0,
        etat_journal = etat.etat,
    }

    -- ── NIVEAU (2026-09-15) : un PNJ hostile porte les statistiques de son niveau.
    -- Les passifs (marchands, alliés) gardent leur santé : ils ne combattent pas.
    if (Ia.Profil(profil).agressif) then
        local stats = StatistiquesPour(entite, entree, options)
        if (stats) then
            suivi.stats = stats
            suivi.degats = stats.degats
            suivi.cadence_ms = stats.cadence_ms
            pcall(function()
                entite:SetMaxHealth(stats.vie_max)
                entite:SetHealth(stats.vie_max)
            end)
            pcall(function()
                entite:SetValue(IaServeur.CLE_NIVEAU, stats.niveau, true)
                entite:SetValue(IaServeur.CLE_RANG, stats.rang, true)
                entite:SetValue(IaServeur.CLE_COULEUR, stats.couleur, true)
            end)
            Journal(("%s pris en charge : %s niv %d %s — vie %d, degats %.1f, defense %d, cadence %d ms")
                :format(NomDe(entite), profil, stats.niveau, stats.rang, stats.vie_max, stats.degats,
                    stats.defense, stats.cadence_ms))
        end
    end

    suivis[entite] = suivi
    nb_suivis = nb_suivis + 1
    return true
end

--- La famille d'un PNJ suivi (« Infectes », « PNJ »…), ou nil. Lue par
--- Server/Combat.lua pour choisir la réaction propre au coup reçu.
---@param entite any
---@return string|nil
function IaServeur.FamilleDe(entite)
    local suivi = entite and suivis[entite]
    return suivi and suivi.famille or nil
end

--- Statistiques de COMBAT d'un PNJ suivi, au format de `Combat.Statistiques`
--- (+ `resistance`), ou nil. Lues par la mêlée du joueur (Server/Frappes.lua).
---@param entite any
---@return table|nil
function IaServeur.StatsCombat(entite)
    local suivi = entite and suivis[entite]
    local s = suivi and suivi.stats
    if (not s) then return nil end
    return { puissance = 0, defense = s.defense, critique = 0, resistance = s.resistance, niveau = s.niveau }
end

--- Dégâts qu'un PNJ suivi encaisse vraiment : défense (formule `Combat.Degats`)
--- puis résistance de rang. Un corps non suivi encaisse tout.
---@param entite any
---@param degats number
---@return integer
function IaServeur.Attenuer(entite, degats)
    local d = math.floor((tonumber(degats) or 0) + 0.5)
    local s = IaServeur.StatsCombat(entite)
    if (not s or d <= 0) then return d end
    local r = Combat.Degats({ puissance = 0, critique = 0 }, { degats = d }, 1, { defense = s.defense },
        function() return 1 end)
    local apres = math.floor(r.degats * (1 - (tonumber(s.resistance) or 0)) + 0.5)
    return math.max(1, apres)
end

--- Retire un PNJ du suivi. Sans ça la table retiendrait des entités mortes.
---@param entite table
function IaServeur.Oublier(entite)
    if (not suivis[entite]) then return end
    suivis[entite] = nil
    nb_suivis = nb_suivis - 1
    if (nb_suivis < 0) then nb_suivis = 0 end
end

--- Combien de PNJ l'IA pilote-t-elle ? Sert au diagnostic, pas au gameplay.
function IaServeur.Compte() return nb_suivis end

--- Branche la consequence d'une mort hostile (butin, quete...).
---@param fn function|nil
function IaServeur.UtiliserMort(fn)
    callback_mort = (type(fn) == "function") and fn or nil
end

-- ── Décrire le monde ──────────────────────────────────────────────────────────

--- Construit la description que `Ia.Decider` attend, pour UN PNJ.
---@param suivi table
---@param joueurs table  relevé une fois par tick
---@return table|nil
DecrireMonde = function(suivi, joueurs)
    local ok, p = pcall(function() return suivi.entite:GetLocation() end)
    if (not ok or not p) then return nil end

    local cibles = {}
    local r2 = IaServeur.PORTEE_MONDE * IaServeur.PORTEE_MONDE
    for _, j in ipairs(joueurs) do
        local dx, dy, dz = j.x - p.X, j.y - p.Y, j.z - p.Z
        if ((dx * dx + dy * dy + dz * dz) <= r2) then
            cibles[#cibles + 1] = j
        end
    end

    local vie, vie_max = 100, 100
    pcall(function()
        vie = suivi.entite:GetHealth()
        vie_max = suivi.entite:GetMaxHealth()
    end)

    return {
        position = { x = p.X, y = p.Y, z = p.Z },
        vie = vie, vie_max = vie_max,
        cibles = cibles,
    }
end

--- Rend progressivement de la vie pendant la fuite, sans jamais depasser la
--- cible de soin. Une seule ecriture moteur par tick et seulement si necessaire.
local function SoignerRepli(suivi)
    if (suivi.etat.etat ~= "repli") then return end
    local vie, vie_max = nil, nil
    pcall(function()
        vie = suivi.entite:GetHealth()
        vie_max = suivi.entite:GetMaxHealth()
    end)
    vie, vie_max = tonumber(vie), tonumber(vie_max)
    if (not vie or not vie_max or vie_max <= 0 or vie <= 0) then return end
    local cible = vie_max * IaServeur.SOIN_REPLI_CIBLE
    if (vie >= cible) then return end
    local gain = vie_max * IaServeur.SOIN_REPLI_PAR_SECONDE * IaServeur.TICK_MS / 1000
    pcall(function() suivi.entite:SetHealth(math.min(cible, vie + gain)) end)
end

-- ── Exécuter ──────────────────────────────────────────────────────────────────

--- Tourne le PNJ vers un point : `LookAt` pour un Character (serveur, « AI »),
--- lacet posé pour un CharacterSimple.
local function Orienter(suivi, cible)
    local e = suivi.entite
    local ok_p, a = pcall(function() return e:GetLocation() end)
    local ok_c, b = pcall(function() return cible:GetLocation() end)
    if (not ok_p or not ok_c or not a or not b) then return end
    local humanoide = false
    pcall(function() humanoide = e:IsA(Character) end)
    if (humanoide) then
        pcall(function() e:LookAt(b) end)
    else
        local lacet = math.deg(math.atan(b.Y - a.Y, b.X - a.X))
        pcall(function() e:SetRotation(Rotator(0, lacet, 0)) end)
    end
end

--- Allure d'un Character selon l'urgence de l'intention (course / marche).
local function Allure(suivi, urgence)
    if (suivi.allure == urgence) then return end
    suivi.allure = urgence
    local humanoide = false
    pcall(function() humanoide = suivi.entite:IsA(Character) end)
    if (not humanoide) then return end
    pcall(function()
        suivi.entite:SetGaitMode((urgence == "course") and GaitMode.Sprinting or GaitMode.Walking)
    end)
end

--- Le coup, à l'IMPACT : portée revérifiée, défense de la cible appliquée.
local function Impact(suivi, entite, cible)
    if (not Vivant(entite) or not Vivant(cible)) then return end
    local ok, a, b = pcall(function() return entite:GetLocation(), cible:GetLocation() end)
    if (not ok or not a or not b) then return end
    local portee = Ia.Profil(suivi.etat.profil).portee_attaque * IaServeur.MARGE_IMPACT
    if (Distance(a, b) > portee) then
        bilan.rates = bilan.rates + 1
        return
    end
    local defense = 0
    pcall(function()
        local joueur = cible:GetPlayer()
        local stats = joueur and Narvos.ProgressionServeur and Narvos.ProgressionServeur.Statistiques(joueur)
        defense = (stats and tonumber(stats.defense)) or 0
    end)
    local r = Combat.Degats({ puissance = 0, critique = 0 }, { degats = suivi.degats }, 1, { defense = defense },
        function() return 1 end)
    local depuis = Vector(b.X - a.X, b.Y - a.Y, b.Z - a.Z)
    local applique = pcall(function()
        cible:ApplyDamage(r.degats, "", DamageType.Melee, depuis, nil, entite)
    end)
    if (applique) then bilan.impacts = bilan.impacts + 1 end
end

--- Un PNJ frappe sa cible.
---
--- ⚠ `ApplyDamage` ET NON `SetHealth` (Classes/BaseDamageable.json) : `SetHealth`
--- court-circuiterait les multiplicateurs par os, `TakeDamage` (fenêtre de contre
--- du joueur) et `Death`.
---@param suivi table
---@param cible table  le Character visé
Frapper = function(suivi, cible)
    if (horloge_ms < (suivi.prochain_coup_ms or 0)) then return end
    suivi.prochain_coup_ms = horloge_ms + (suivi.cadence_ms or IaServeur.CADENCE_COUP_MS)
    bilan.coups = bilan.coups + 1

    Orienter(suivi, cible)

    -- ── LE GESTE, AVANT LES DÉGÂTS ────────────────────────────────────────────
    -- Un PNJ humanoïde (`Character`, SKEL_Mannequin) joue le coup de sa famille
    -- ou de la chaîne du joueur ; les `CharacterSimple` ont chacun leur squelette.
    -- L'étape est posée sur l'entité AVANT l'impact : la réaction de la cible
    -- (`Server/Combat.lua`, TakeDamage) la lit.
    local humanoide = false
    pcall(function() humanoide = suivi.entite:IsA(Character) end)
    local propres = Narvos.Gestes and Narvos.Gestes.De(suivi.famille)
    if (humanoide and propres and #propres.attaques > 0) then
        suivi.etape_coup = Combat.EtapeCyclique(suivi.etape_coup)
        suivi.attaque_propre = ((suivi.attaque_propre or 0) % #propres.attaques) + 1
        local asset = propres.attaques[suivi.attaque_propre]
        pcall(function()
            suivi.entite:PlayAnimation(asset, AnimationSlotType.FullBody, false, 0.1, 0.2, 1.0, false)
        end)
        pcall(function() suivi.entite:SetValue(IaServeur.MARQUE_ETAPE, suivi.etape_coup, false) end)
    elseif (humanoide) then
        suivi.etape_coup = Combat.EtapeCyclique(suivi.etape_coup)
        suivi.histo_gestes = suivi.histo_gestes or {}
        if (sets_gestes == nil) then
            sets_gestes = Animations.Grouper((AnimNoms and AnimNoms.NOMS) or {})
        end
        local def = Combat.CHAINE[suivi.etape_coup]
        local nom = def and Animations.Choisir(sets_gestes, def.action, "IP", suivi.histo_gestes)
        if (nom) then
            pcall(function()
                suivi.entite:PlayAnimation(Animations.Asset(nom), AnimationSlotType.FullBody,
                    false, 0.1, 0.2, 1.0, false)
            end)
        end
        pcall(function() suivi.entite:SetValue(IaServeur.MARQUE_ETAPE, suivi.etape_coup, false) end)
    end

    -- ── L'IMPACT, AU MILIEU DU GESTE ─────────────────────────────────────────
    -- Les dégâts tombaient à l'instant où le geste COMMENÇAIT, sans revérifier la
    -- portée : un coup inesquivable, porté par un bras encore levé.
    local entite = suivi.entite
    Timer.SetTimeout(function() Impact(suivi, entite, cible) end, IaServeur.IMPACT_MS)
end

--- Traduit une intention en gestes.
---@param suivi table
---@param intention table
---@param frais boolean  la décision vient-elle d'être prise ?
---@param joueurs_par_id table
Executer = function(suivi, intention, frais, joueurs_par_id)
    local e = suivi.entite

    if (intention.type == Ia.FRAPPER) then
        -- ⚠ ARRÊTER LE DÉPLACEMENT AVANT DE FRAPPER, une fois : un PNJ qui court
        -- encore dépasse sa cible pendant le coup.
        if (suivi.dernier_ordre) then
            suivi.dernier_ordre = nil
            pcall(function() e:StopMovement(true) end)
        end
        local cible = joueurs_par_id[intention.cible_id]
        if (cible and Vivant(cible)) then Frapper(suivi, cible) end
        return
    end

    if (intention.type == Ia.ALLER) then
        -- ⚠ L'ORDRE NE REPART QUE SI LA DESTINATION A BOUGÉ. `MoveTo` relancé à
        -- chaque décision (5 fois par seconde) recalculait le chemin : le PNJ
        -- piétinait (même constat que Server/Animaux.lua pour les compagnons).
        local d = suivi.dernier_ordre
        local destination = { X = intention.x, Y = intention.y, Z = intention.z }
        local repartir = (not d) or d.etat ~= intention.etat
            or Distance(d, destination) > IaServeur.REEMISSION_CM
            or (horloge_ms - d.t) > IaServeur.REEMISSION_MS
        if (not repartir) then return end
        Allure(suivi, intention.urgence)
        pcall(function() e:MoveTo(Vector(intention.x, intention.y, intention.z), Ia.TOLERANCE_POINT) end)
        suivi.dernier_ordre = { X = intention.x, Y = intention.y, Z = intention.z, t = horloge_ms, etat = intention.etat }
        bilan.ordres = bilan.ordres + 1
        return
    end

    -- ATTENDRE : on n'arrête le déplacement que s'il y en a un.
    if (frais and suivi.dernier_ordre) then
        suivi.dernier_ordre = nil
        pcall(function() e:StopMovement(false) end)
    end
end

--- Recale l'ancre du PNJ au sol, une fois posé (vitesse verticale quasi nulle).
local function Ancrer(suivi)
    if (not suivi.a_ancrer) then return end
    local age = horloge_ms - (suivi.pris_ms or 0)
    if (age < IaServeur.DELAI_ANCRAGE_MS) then return end
    local ok_v, v = pcall(function() return suivi.entite:GetVelocity() end)
    local pose = ok_v and v and math.abs(tonumber(v.Z) or 0) <= IaServeur.VITESSE_POSE
    if (not pose and age < IaServeur.ANCRAGE_MAX_MS) then return end
    local ok_p, p = pcall(function() return suivi.entite:GetLocation() end)
    if (ok_p and p) then Ia.Reancrer(suivi.etat, { x = p.X, y = p.Y, z = p.Z }) end
    suivi.a_ancrer = false
end

-- ── Le tick ───────────────────────────────────────────────────────────────────

local function Tick()
    horloge_ms = horloge_ms + IaServeur.TICK_MS
    if (nb_suivis == 0) then return end

    -- Les joueurs, relevés UNE fois. ⚠ `position` ET `vie` : c'est ce que lit la
    -- décision (`Ia.ChoisirCible`). `x, y, z` restent pour le filtre de proximité.
    local joueurs, par_id = {}, {}
    for _, player in ipairs(Player.GetAll()) do
        if (not Session or Session.EnJeu(player)) then
            local c = player:GetControlledCharacter()
            if (c and Vivant(c)) then
                local ok, p = pcall(function() return c:GetLocation() end)
                if (ok and p) then
                    local id = tostring(player:GetID())
                    local vie = nil
                    pcall(function() vie = c:GetHealth() end)
                    joueurs[#joueurs + 1] = {
                        id = id, x = p.X, y = p.Y, z = p.Z,
                        position = { x = p.X, y = p.Y, z = p.Z },
                        vie = vie,
                    }
                    par_id[id] = c
                end
            end
        end
    end

    local morts = nil
    for entite, suivi in pairs(suivis) do
        if (not Vivant(entite)) then
            morts = morts or {}
            morts[#morts + 1] = entite
        else
            Ancrer(suivi)
            SoignerRepli(suivi)
            if (Ia.DoitExaminer(suivi.etat, horloge_ms)) then
                local monde = DecrireMonde(suivi, joueurs)
                if (monde) then
                    local intention, frais = Ia.Decider(suivi.etat, monde, horloge_ms)
                    if (suivi.etat.etat ~= suivi.etat_journal) then
                        Journal(("%s %s -> %s%s"):format(NomDe(entite), tostring(suivi.etat_journal),
                            tostring(suivi.etat.etat), intention.cible_id and (" (cible " .. tostring(intention.cible_id) .. ")") or ""))
                        suivi.etat_journal = suivi.etat.etat
                    end
                    Executer(suivi, intention, frais, par_id)
                end
            else
                local intention = suivi.etat.intention
                if (intention and intention.type == Ia.FRAPPER) then
                    -- Frapper a sa propre cadence, plus lente que la décision.
                    local cible = par_id[intention.cible_id]
                    if (cible and Vivant(cible)) then Frapper(suivi, cible) end
                end
            end
        end
    end

    -- Purge APRÈS le parcours : modifier une table pendant `pairs` est indéfini.
    if (morts) then
        for _, e in ipairs(morts) do IaServeur.Oublier(e) end
    end
end

Timer.SetInterval(Tick, IaServeur.TICK_MS)

if (IaServeur.BILAN_MS > 0) then
    Timer.SetInterval(function()
        if (nb_suivis == 0 and bilan.ordres == 0) then return end
        Journal(("bilan : %d suivi(s), %d ordre(s) MoveTo, %d arrivee(s), %d echec(s), %d coup(s), %d impact(s), %d esquive(s)")
            :format(nb_suivis, bilan.ordres, bilan.arrivees, bilan.echecs, bilan.coups, bilan.impacts, bilan.rates))
        bilan = { ordres = 0, arrivees = 0, echecs = 0, coups = 0, impacts = 0, rates = 0 }
    end, IaServeur.BILAN_MS)
end

-- ── Réveils ───────────────────────────────────────────────────────────────────

--- Un PNJ frappé décide au tick suivant. Les deux classes (les monstres sont
--- souvent des CharacterSimple, qui ne se retournaient pas).
local function SurDegats(entite)
    local suivi = suivis[entite]
    if (suivi) then Ia.Reveiller(suivi.etat, horloge_ms) end
end
Character.Subscribe("TakeDamage", SurDegats)
pcall(function() CharacterSimple.Subscribe("TakeDamage", SurDegats) end)

--- Arrivée ou échec d'un déplacement. Un échec est COMPTÉ : sans NavMesh, `MoveTo`
--- échoue à chaque ordre, et c'est ce que le journal doit dire. On ne réveille pas
--- un PNJ en attaque (`StopMovement` déclenche aussi MoveComplete).
local function SurArrivee(entite, reussi)
    local suivi = suivis[entite]
    if (not suivi) then return end
    if (reussi) then
        bilan.arrivees = bilan.arrivees + 1
    else
        bilan.echecs = bilan.echecs + 1
        suivi.echecs_move = (suivi.echecs_move or 0) + 1
        if (suivi.echecs_move == IaServeur.SEUIL_ECHECS_MOVE) then
            Journal(("%s : MoveTo refuse %d fois — la map a-t-elle une NavMesh ?")
                :format(NomDe(entite), suivi.echecs_move))
        end
    end
    suivi.dernier_ordre = nil
    if (suivi.etat.etat ~= "attaque") then Ia.Reveiller(suivi.etat, horloge_ms) end
end
pcall(function() Character.Subscribe("MoveComplete", SurArrivee) end)
pcall(function() CharacterSimple.Subscribe("MoveComplete", SurArrivee) end)

--- Un PNJ mort sort du suivi immédiatement, et son cadavre se détruira : il restait
--- au sol à jamais et remplissait le plafond d'invocations.
local function SurMort(entite, last_damage_taken, bone, damage_type_reason, hit_direction, instigator, causer)
    local suivi = suivis[entite]
    if (suivi) then
        local joueur = nil
        pcall(function() joueur = entite:GetPlayer() end)
        if (not joueur) then
            pcall(function() entite:SetLifeSpan(IaServeur.CADAVRE_S) end)
            Journal(("%s mort (niv %s) — cadavre detruit dans %d s")
                :format(NomDe(entite), tostring(suivi.stats and suivi.stats.niveau or "?"), IaServeur.CADAVRE_S))
        end
        if (callback_mort and instigator ~= nil) then
            local ok, raison = pcall(callback_mort, instigator, suivi, entite)
            if (not ok) then Console.Error("[IA] consequence de mort refusee : " .. tostring(raison)) end
        end
    end
    IaServeur.Oublier(entite)
end
Character.Subscribe("Death", SurMort)
pcall(function() CharacterSimple.Subscribe("Death", SurMort) end)

return IaServeur