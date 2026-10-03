-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Progression.lua — niveau et XP du PERSONNAGE, statistiques qui en
-- découlent, points de talents (port PUR du prototype web).
--
-- Câblage : Narvos.Progression = Package.Require("Logic/Progression.lua")
--           Narvos.Progression.Configurer({ stats = …, niveaux_pnj = …,
--               classes = …, talents = …, talents_logique = … })
--
-- ── SOURCES ────────────────────────────────────────────────────────────────────
--   stats/PlayerStats.ts      xpForLevel, addXp, createStats, effectiveStats
--   npc/npcLeveling.ts        zoneLevelRange, xpForKill
--   talents/talentEffects.ts  aggregateTalents (déjà porté : Logic/Talents.lua)
--
-- Les DONNÉES (niveau max, plages de zone, K de victoire, taux du serveur, arbre
-- de talents) arrivent des catalogues GÉNÉRÉS. Seules les FORMULES sont ici, et
-- `scripts/lua-harness/progression.mjs` les oppose au TS EXÉCUTÉ.
--
-- ── POURQUOI CE MODULE (2026-09-13) ────────────────────────────────────────────
-- Demande C5/C6 : « menu personnage / compétences relié au système de
-- compétences ; Skill Level Manager intégré au personnage, aux NIVEAUX ».
-- Mesure : le niveau du personnage existait en base (`personnages.niveau`) mais
-- RIEN ne le faisait monter. La récompense de quête l'incrémentait du montant
-- d'XP brut, sur un champ `niveau` que personne ne lit (`Roster.depuisLigne`
-- le rend sous le nom `level`) — une quête à 120 XP aurait donné 120 niveaux,
-- si elle avait écrit au bon endroit. `Logic/Talents.lua` était câblé et jamais
-- appelé : ses points dépendent du niveau, qui ne bougeait pas.
--
-- ── IMMUABLE ───────────────────────────────────────────────────────────────────
-- `AjouterXP` rend un NOUVEL état : l'exécutant compare, persiste, puis remplace.
-- ═══════════════════════════════════════════════════════════════════════════════

local Progression = {}

-- Dépendances injectées. ⚠ NON CONFIGURÉ = ERREUR FRANCHE (voir `Requis`) : un
-- repli silencieux sur un niveau max recopié ici divergerait du catalogue au
-- premier changement côté TS, sans le moindre signal.
local Stats, NiveauxPnj, Classes, TalentsCat, TalentsLogique = nil, nil, nil, nil, nil

--- +8 % par niveau sur PV, mana, puissance et défense (`createStats`).
--- ⚠ Même fait que `Combat.BONUS_NIVEAU` : la paire est gardée par
--- `scripts/lua-harness/constantes-check.mjs`.
Progression.BONUS_PAR_NIVEAU = 0.08

--- Plage d'une zone absente de `ZONE_LEVEL_RANGES`. Le TS la garde PRIVÉE
--- (`const DEFAULT_RANGE`, npcLeveling.ts) : le générateur ne peut pas la
--- sortir. Le harnais la vérifie en appelant `zoneLevelRange` sur une zone
--- inconnue — une copie, mais une copie PROUVÉE.
Progression.PLAGE_PAR_DEFAUT = { 1, 20 }

---@param deps table { stats, niveaux_pnj, classes, talents, talents_logique }
function Progression.Configurer(deps)
    deps = (type(deps) == "table") and deps or {}
    Stats = deps.stats
    NiveauxPnj = deps.niveaux_pnj
    Classes = deps.classes
    TalentsCat = deps.talents
    TalentsLogique = deps.talents_logique
end

local function Requis(valeur, nom)
    if (valeur == nil) then
        error("Progression non configuree : " .. nom .. " manquant (Progression.Configurer)", 3)
    end
    return valeur
end

--- `Math.round` du JavaScript pour un nombre POSITIF : .5 vers le haut.
local function Arrondir(x)
    return math.floor(x + 0.5)
end

-- ── Courbe du joueur ──────────────────────────────────────────────────────────

---@return integer
function Progression.NiveauMax()
    return math.floor(tonumber(Requis(Stats, "stats").MAX_LEVEL) or 1)
end

--- XP requise pour passer DU niveau `niveau` au suivant. Port de `xpForLevel` :
--- `Math.round(80 * level ** 1.5)`, infini au niveau maximal.
---@param niveau number
---@return number
function Progression.XpPourNiveau(niveau)
    niveau = tonumber(niveau) or 1
    if (niveau >= Progression.NiveauMax()) then return math.huge end
    return Arrondir(80 * (niveau ^ 1.5))
end

--- XP cumulée nécessaire pour ATTEINDRE `niveau` depuis le niveau 1.
---@param niveau number
---@return number
function Progression.XpTotalePourNiveau(niveau)
    niveau = math.floor(tonumber(niveau) or 1)
    local total = 0
    for l = 1, niveau - 1 do total = total + Progression.XpPourNiveau(l) end
    return total
end

--- État normalisé `{ niveau, xp }` : niveau borné à [1, max], XP positive.
---@param etat table|nil
---@return table
function Progression.Normaliser(etat)
    local max = Progression.NiveauMax()
    local n = math.floor(tonumber(type(etat) == "table" and etat.niveau) or 1)
    if (n < 1) then n = 1 end
    if (n > max) then n = max end
    local xp = tonumber(type(etat) == "table" and etat.xp) or 0
    if (xp < 0 or n >= max) then xp = 0 end
    return { niveau = n, xp = math.floor(xp) }
end

--- Octroie de l'XP. Rend (nouvel_etat, niveaux_gagnes). Port exact d'`addXp` :
--- rien au niveau maximal, cascade de niveaux, reliquat reporté, XP à 0 au max.
---@param etat table { niveau, xp }
---@param montant number
---@return table
---@return integer
function Progression.AjouterXP(etat, montant)
    local depart = Progression.Normaliser(etat)
    local max = Progression.NiveauMax()
    if (depart.niveau >= max) then return depart, 0 end

    local gain = tonumber(montant) or 0
    if (gain < 0) then gain = 0 end

    local niveau, xp = depart.niveau, depart.xp + gain
    while (niveau < max and xp >= Progression.XpPourNiveau(niveau)) do
        xp = xp - Progression.XpPourNiveau(niveau)
        niveau = niveau + 1
    end
    if (niveau >= max) then xp = 0 end
    return { niveau = niveau, xp = math.floor(xp) }, niveau - depart.niveau
end

--- Ce qu'affiche la fiche : niveau, XP dans le niveau, cible, progression.
--- Même forme que `MetiersLogique.Fiche` : la page lit les deux avec le même code.
---@param etat table|nil
---@return table
function Progression.Fiche(etat)
    local e = Progression.Normaliser(etat)
    local max = e.niveau >= Progression.NiveauMax()
    local cible = Progression.XpPourNiveau(e.niveau)
    return {
        niveau = e.niveau,
        xp = e.xp,
        -- Le JSON n'a pas d'infini : 0 au niveau maximal, et `max` dit pourquoi.
        cible = max and 0 or cible,
        progression = max and 1 or (cible > 0 and e.xp / cible or 0),
        xp_cumulee = Progression.XpTotalePourNiveau(e.niveau) + e.xp,
        max = max,
        niveau_max = Progression.NiveauMax(),
    }
end

-- ── Ennemis ───────────────────────────────────────────────────────────────────

--- Plage `{ min, max }` d'une zone (identifiant de monde). Port de `zoneLevelRange`.
---@param zone_id any
---@return table
function Progression.PlageZone(zone_id)
    local plages = Requis(NiveauxPnj, "niveaux_pnj").ZONE_LEVEL_RANGES or {}
    local p = (type(zone_id) == "string") and plages[zone_id] or nil
    if (type(p) ~= "table") then p = Progression.PLAGE_PAR_DEFAUT end
    return { tonumber(p[1]) or 1, tonumber(p[2]) or 1 }
end

--- Niveau d'un ennemi vaincu. Un niveau DÉCLARÉ sur l'entité est borné à la
--- plage de sa zone ; sans niveau déclaré, le bas de la plage.
---
--- ⚠ Le web répartit les niveaux selon la distance au hub (`levelFromDistance`),
--- ce qui suppose de connaître tous les ennemis d'une zone au moment du spawn.
--- Le peuplement nanos ne pose aucun niveau aujourd'hui : le bas de plage est la
--- valeur honnête — la plus prudente pour l'XP distribuée.
---@param zone_id any
---@param niveau_declare any
---@return integer
function Progression.NiveauEnnemi(zone_id, niveau_declare)
    local plage = Progression.PlageZone(zone_id)
    local n = tonumber(niveau_declare)
    if (not n) then return math.floor(plage[1]) end
    n = math.floor(n + 0.5)
    if (n < plage[1]) then n = plage[1] end
    if (n > plage[2]) then n = plage[2] end
    return math.floor(n)
end

--- XP d'une victoire sur un ennemi de ce niveau, taux du serveur compris.
--- Port de `xpForKill` : `Math.round(K * level ** 1.5 * xpRate)`.
---@param niveau any
---@return integer
function Progression.XpPourVictoire(niveau)
    local cat = Requis(NiveauxPnj, "niveaux_pnj")
    local k = tonumber(cat.XP_PER_KILL_K) or 0
    local taux = tonumber(cat.SERVER_CONFIG and cat.SERVER_CONFIG.xpRate) or 1
    local n = tonumber(niveau) or 1
    if (n < 1) then n = 1 end
    return Arrondir(k * (n ^ 1.5) * taux)
end

-- ── Puissance des ennemis par niveau (2026-09-15) ────────────────────────────
--
-- Demande de Hanibes : « un système de niveaux pour les PNJ, afin que leur
-- puissance, leurs dégâts et éventuellement leur résistance évoluent selon leur
-- niveau ». Mesuré avant : tous les PNJ à 100 PV, 8 dégâts, 0 défense — mais un
-- PNJ de la Tour rapportait déjà 4 272 XP (enquête .hermes/ENQUETE_IA_PNJ_NIVEAUX).
-- Port des règles du jeu web : `enemyHpMultiplier` / `enemyDamageMultiplier` /
-- `levelFromDistance` / `levelTierColor` (npc/npcLeveling.ts), assemblage des
-- statistiques de `Npc.tsx`, rangs de `npcStatPresets.ts`. Parité prouvée contre
-- le TS exécuté : scripts/lua-harness/progression.mjs.

--- ⚠ Constantes PRIVÉES du TS (non exportées) : copies, gardées par le harnais.
--- `NPC_DMG_SCALE` (Npc.tsx) : les coups de PNJ font moins mal que ceux du joueur.
Progression.ECHELLE_DEGATS_PNJ = 0.35
--- Montée de la défense par niveau (Npc.tsx, `enemyDefense`).
Progression.CROISSANCE_DEFENSE_PNJ = 0.05
--- Cadence : `Math.max(primarySpell?.cooldown ?? 1.6, 1.8)` secondes (Npc.tsx).
Progression.RECHARGE_SORT_PNJ_DEFAUT_S = 1.6
Progression.CADENCE_MIN_PNJ_S = 1.8
--- Classe d'un PNJ sans classe (Npc.tsx : `CLASSES.warrior_bruiser` en repli).
Progression.CLASSE_PNJ_DEFAUT = "warrior_bruiser"
--- Rangs (npcStatPresets.ts : MOB_STATS, BOSS_STATS). Le rang « élite » n'existe
--- pas au web : c'est une couleur de palier au-delà du niveau 40.
Progression.RANGS_ENNEMI = {
    mob  = { echelle = 1.0, vie = 1.0, resistance = 0.0 },
    boss = { echelle = 1.8, vie = 4.0, resistance = 0.2 },
}
--- Résistance bornée (`clampResist`) : un PNJ n'est jamais invincible.
Progression.RESISTANCE_MAX = 0.9

local function MultEnnemi(niveau, croissance)
    local cat = Requis(NiveauxPnj, "niveaux_pnj")
    local n = tonumber(niveau) or 1
    local mult = tonumber(cat.SERVER_CONFIG and cat.SERVER_CONFIG.enemyStatMult) or 1
    return (1 + (n - 1) * (tonumber(croissance) or 0)) * mult
end

--- Multiplicateur de PV d'un ennemi de ce niveau (port d'`enemyHpMultiplier`).
---@param niveau any
---@return number
function Progression.MultVieEnnemi(niveau)
    return MultEnnemi(niveau, Requis(NiveauxPnj, "niveaux_pnj").HP_GROWTH_PER_LEVEL)
end

--- Multiplicateur de dégâts d'un ennemi (port d'`enemyDamageMultiplier`).
---@param niveau any
---@return number
function Progression.MultDegatsEnnemi(niveau)
    return MultEnnemi(niveau, Requis(NiveauxPnj, "niveaux_pnj").DMG_GROWTH_PER_LEVEL)
end

--- Niveau d'un point d'apparition selon sa distance au centre de sa zone, sur la
--- plage des distances des ennemis de cette zone (port de `levelFromDistance`) :
--- le plus proche au bas de la plage, le plus loin en haut.
---@param zone_id any
---@param distance number
---@param distance_min number
---@param distance_max number
---@return integer
function Progression.NiveauParDistance(zone_id, distance, distance_min, distance_max)
    local plage = Progression.PlageZone(zone_id)
    local d, dmin, dmax = tonumber(distance) or 0, tonumber(distance_min) or 0, tonumber(distance_max) or 0
    local ecart = dmax - dmin
    local t = 0
    if (ecart > 0) then t = math.min(1, math.max(0, (d - dmin) / ecart)) end
    -- `Math.round` du JS : arrondi vers +∞ à .5, comme `Arrondir`.
    local n = Arrondir(plage[1] + t * (plage[2] - plage[1]))
    return math.max(plage[1], math.min(plage[2], n))
end

--- Couleur du palier de niveau (port de `levelTierColor`) : jauger le danger d'un
--- coup d'œil.
---@param niveau any
---@return string
function Progression.CouleurPalier(niveau)
    local n = tonumber(niveau) or 1
    if (n <= 10) then return "#c8d4e0" end
    if (n <= 20) then return "#6ee7a8" end
    if (n <= 30) then return "#5bb8ff" end
    if (n <= 40) then return "#c084fc" end
    return "#ff8a4c"
end

--- Sorts d'une classe (port de `getSpellsForClass`, spells/spellCatalog.ts) : ses
--- sorts propres s'il y en a au moins deux, sinon complétés par ceux du bruiser ;
--- six au plus, dans l'ordre du catalogue.
---@param catalogue table|nil  `Spells.SPELL_CATALOG`
---@param class_id any
---@return table
function Progression.SortsPourClasse(catalogue, class_id)
    local propres, generiques = {}, {}
    for _, s in ipairs((type(catalogue) == "table") and catalogue or {}) do
        if (type(s) == "table") then
            if (s.classId == class_id) then propres[#propres + 1] = s end
            if (s.classId == Progression.CLASSE_PNJ_DEFAUT) then generiques[#generiques + 1] = s end
        end
    end
    local sortie = {}
    local sources = (#propres >= 2) and { propres } or { propres, generiques }
    for _, liste in ipairs(sources) do
        for _, s in ipairs(liste) do
            if (#sortie < 6) then sortie[#sortie + 1] = s end
        end
    end
    return sortie
end

--- Sort d'attaque principal d'une classe (port de `pickPrimaryAttackSpell`) :
--- le premier projectile qui fait des dégâts, sinon le premier sort offensif.
---@param sorts table|nil  sorts de la classe, dans l'ordre du catalogue
---@return table|nil
function Progression.SortPrincipal(sorts)
    if (type(sorts) ~= "table") then return nil end
    for _, s in ipairs(sorts) do
        if (type(s) == "table" and s.archetype == "projectile" and (tonumber(s.damage) or 0) > 0) then return s end
    end
    for _, s in ipairs(sorts) do
        if (type(s) == "table" and (tonumber(s.damage) or 0) > 0) then return s end
    end
    return nil
end

--- Statistiques de combat d'un ennemi (assemblage de `Npc.tsx`).
---@param options table { class_id, niveau, rang ("mob"|"boss"), sorts (liste de la classe), vie_mult }
---@return table { niveau, rang, vie_max, degats, defense, resistance, cadence_ms, echelle, xp, couleur }
function Progression.StatistiquesEnnemi(options)
    options = (type(options) == "table") and options or {}
    local classes = Requis(Classes, "classes").CLASSES or {}
    local class_id = (type(options.class_id) == "string" and classes[options.class_id]) and options.class_id
        or Progression.CLASSE_PNJ_DEFAUT
    local base = (classes[class_id] and classes[class_id].baseStats) or {}
    local rang_id = Progression.RANGS_ENNEMI[options.rang] and options.rang or "mob"
    local rang = Progression.RANGS_ENNEMI[rang_id]

    local n = math.floor(tonumber(options.niveau) or 1)
    if (n < 1) then n = 1 end
    local vie_mult = tonumber(options.vie_mult) or 1

    local sort = Progression.SortPrincipal(options.sorts)
    local socle = (sort and tonumber(sort.damage)) or tonumber(base.attackPower) or 0
    local recharge = (sort and tonumber(sort.cooldown)) or Progression.RECHARGE_SORT_PNJ_DEFAUT_S

    return {
        niveau = n,
        rang = rang_id,
        vie_max = math.max(1, Arrondir((tonumber(base.hp) or 100) * Progression.MultVieEnnemi(n) * rang.vie * vie_mult)),
        degats = socle * Progression.ECHELLE_DEGATS_PNJ * Progression.MultDegatsEnnemi(n),
        defense = Arrondir((tonumber(base.defense) or 0) * (1 + (n - 1) * Progression.CROISSANCE_DEFENSE_PNJ)),
        resistance = math.max(0, math.min(Progression.RESISTANCE_MAX, rang.resistance)),
        cadence_ms = math.floor(math.max(recharge, Progression.CADENCE_MIN_PNJ_S) * 1000 + 0.5),
        echelle = rang.echelle,
        xp = Progression.XpPourVictoire(n),
        couleur = Progression.CouleurPalier(n),
    }
end

-- ── Statistiques ──────────────────────────────────────────────────────────────

--- Statistiques d'un personnage : classe × niveau × talents (sans équipement).
--- Port de `createStats` puis de la part talents d'`effectiveStats` :
---   · PV et mana : base ×(1 + 8 %/niveau) arrondis, PUIS ×multiplicateur talent ;
---   · défense et critique : base, PUIS + bonus plats des talents ;
---   · vitesse : `moveSpeed` de classe × multiplicateur de mobilité.
--- ⚠ Une classe inconnue rend nil : inventer des statistiques pour un id faux
--- donnerait un personnage jouable avec des nombres venus de nulle part.
---@param class_id any
---@param niveau any
---@param talents table|nil  { [id] = rang }
---@return table|nil
function Progression.Statistiques(class_id, niveau, talents, equipement)
    local classe = (type(class_id) == "string") and (Requis(Classes, "classes").CLASSES or {})[class_id] or nil
    local b = classe and classe.baseStats
    if (type(b) ~= "table") then return nil end

    local n = Progression.Normaliser({ niveau = niveau }).niveau
    local facteur = 1 + (n - 1) * Progression.BONUS_PAR_NIVEAU
    local t = Requis(TalentsLogique, "talents_logique").Agreger(talents)

    -- L'ÉQUIPEMENT PORTÉ (2026-09-14) : somme des stats des objets équipés
    -- (`Inventory.GetEquippedStats`). Même ordre qu'`effectiveStats` : PV et mana
    -- = (base + équipement) × talents ; puissance, défense, critique = base +
    -- équipement (+ bonus plats des talents).
    local g = (type(equipement) == "table") and equipement or {}
    local function gear(cle) return tonumber(g[cle]) or 0 end

    local vie = Arrondir((tonumber(b.hp) or 0) * facteur)
    local mana = Arrondir((tonumber(b.mana) or 0) * facteur)
    return {
        vie_max = Arrondir((vie + gear("maxHp")) * t.maxHpMult),
        mana_max = Arrondir((mana + gear("maxMana")) * t.maxManaMult),
        puissance = Arrondir((tonumber(b.attackPower) or 0) * facteur) + gear("puissance"),
        defense = Arrondir((tonumber(b.defense) or 0) * facteur) + gear("defense") + t.defenseFlat,
        critique = Arrondir((tonumber(b.critChance) or 0) * 100) + gear("critique") + t.critFlat,
        vitesse = (tonumber(b.moveSpeed) or 1) * t.moveSpeedMult,
        bonus = t,
        equipement = g,
    }
end

--- Modificateurs de l'état de lancement (`Sorts.Moduler`), depuis des
--- statistiques rendues par `Statistiques`. Dégâts : la formule du web
--- (`handleCastSpell`, RpgGameWorld.tsx) `base × (1 + puissance/100) × talents`,
--- sans élément ni bonus de vaisseau — nanos n'a ni l'un ni l'autre.
---@param stats table|nil
---@return table
function Progression.ModificateursSorts(stats)
    if (type(stats) ~= "table" or type(stats.bonus) ~= "table") then
        return { cout_mult = 1, regen_mult = 1, degats_mult = 1 }
    end
    return {
        mana_max = stats.mana_max,
        cout_mult = stats.bonus.manaCostMult,
        regen_mult = stats.bonus.manaRegenMult,
        degats_mult = (1 + (tonumber(stats.puissance) or 0) / 100) * stats.bonus.damageMult,
    }
end

--- Bonus plats des talents au format de `Combat.Statistiques(class, niveau, bonus)`
--- (défense et critique s'AJOUTENT, comme dans `effectiveStats`).
---@param stats table|nil
---@return table
function Progression.BonusCombat(stats)
    local b = type(stats) == "table" and stats.bonus or nil
    if (type(b) ~= "table") then return {} end
    -- `Combat.Statistiques` ajoute ces bonus à plat : talents ET équipement.
    local g = (type(stats.equipement) == "table") and stats.equipement or {}
    return {
        puissance = tonumber(g.puissance) or 0,
        defense = b.defenseFlat + (tonumber(g.defense) or 0),
        critique = b.critFlat + (tonumber(g.critique) or 0),
    }
end

-- ── Talents ───────────────────────────────────────────────────────────────────

--- Rangs valides seulement : identifiant connu du catalogue, rang entier borné
--- à [0, maxRank]. Un état venu de la base ou d'une ancienne version ne doit pas
--- donner des rangs au-delà du maximum, ni des nœuds que l'arbre ne connaît plus.
---@param talents table|nil
---@return table
function Progression.TalentsValides(talents)
    local sortie = {}
    if (type(talents) ~= "table") then return sortie end
    for _, noeud in ipairs(Requis(TalentsCat, "talents").TALENTS or {}) do
        local r = math.floor(tonumber(talents[noeud.id]) or 0)
        if (r > (tonumber(noeud.maxRank) or 0)) then r = tonumber(noeud.maxRank) or 0 end
        if (r > 0) then sortie[noeud.id] = r end
    end
    return sortie
end

--- Vue de l'arbre pour la page : points, branches dans l'ordre du catalogue,
--- nœuds avec rang, déverrouillage et possibilité d'investir ou de rembourser.
--- ⚠ Les possibilités sont calculées ICI, en rejouant `Investir`/`Rembourser` :
--- la page n'a pas de seconde copie des règles de prérequis.
---@param niveau any
---@param talents table|nil
---@return table
function Progression.VueTalents(niveau, talents)
    local cat = Requis(TalentsCat, "talents")
    local logique = Requis(TalentsLogique, "talents_logique")
    local n = Progression.Normaliser({ niveau = niveau }).niveau
    local rangs = Progression.TalentsValides(talents)
    local stats = { niveau = n, talents = rangs }

    local branches = {}
    for _, id in ipairs(cat.BRANCH_META_ORDER or {}) do
        local m = (cat.BRANCH_META or {})[id] or {}
        branches[#branches + 1] = { id = id, label = m.label or id, color = m.color, icon = m.icon }
    end

    local noeuds = {}
    for _, noeud in ipairs(cat.TALENTS or {}) do
        local rang = rangs[noeud.id] or 0
        local apres_plus = logique.Investir(stats, noeud.id)
        local apres_moins = logique.Rembourser(stats, noeud.id)
        noeuds[#noeuds + 1] = {
            id = noeud.id,
            branch = noeud.branch,
            name = noeud.name,
            description = noeud.description,
            tier = noeud.tier,
            maxRank = noeud.maxRank,
            requires = noeud.requires or false,
            effect = noeud.effect,
            rang = rang,
            deverrouille = logique.Deverrouille(stats, noeud),
            -- Une mutation refusée rend l'état D'ORIGINE (même table) : c'est le
            -- signal, sans recopier les conditions.
            peut_investir = apres_plus ~= stats,
            peut_rembourser = apres_moins ~= stats,
        }
    end

    local gagnes = logique.PointsGagnes(n)
    local depenses = logique.PointsDepenses(rangs)
    return {
        gagnes = gagnes,
        depenses = depenses,
        disponibles = gagnes - depenses,
        par_point = logique.NIVEAUX_PAR_POINT,
        -- Le prochain point : au multiple suivant de NIVEAUX_PAR_POINT, comme
        -- `nextAt` de TalentTreePanel.tsx. Nil au-delà du niveau maximal.
        prochain_point = (function()
            local suivant = (math.floor(n / logique.NIVEAUX_PAR_POINT) + 1) * logique.NIVEAUX_PAR_POINT
            return (suivant <= Progression.NiveauMax()) and suivant or false
        end)(),
        branches = branches,
        noeuds = noeuds,
    }
end

--- Applique un geste sur l'arbre. Rend (ok, nouveaux_talents | raison).
--- `geste` : "investir" | "rembourser" | "reinitialiser".
---@param niveau any
---@param talents table|nil
---@param geste any
---@param talent_id any
---@return boolean
---@return table|string
function Progression.ModifierTalents(niveau, talents, geste, talent_id)
    local logique = Requis(TalentsLogique, "talents_logique")
    local stats = { niveau = Progression.Normaliser({ niveau = niveau }).niveau,
        talents = Progression.TalentsValides(talents) }

    if (geste == "reinitialiser") then
        if (logique.PointsDepenses(stats.talents) == 0) then return false, "Aucun point investi" end
        return true, {}
    end
    if (type(talent_id) ~= "string") then return false, "Talent inconnu" end

    local suivant
    if (geste == "investir") then
        if (logique.PointsDisponibles(stats) <= 0) then return false, "Aucun point de talent disponible" end
        suivant = logique.Investir(stats, talent_id)
    elseif (geste == "rembourser") then
        suivant = logique.Rembourser(stats, talent_id)
    else
        return false, "Geste inconnu"
    end

    -- `Investir`/`Rembourser` rendent l'état d'origine quand ils refusent.
    if (suivant == stats) then
        return false, (geste == "investir") and "Talent verrouille ou deja au maximum"
            or "Rien a rembourser (ou un talent en depend)"
    end
    return true, Progression.TalentsValides(suivant.talents)
end

return Progression
