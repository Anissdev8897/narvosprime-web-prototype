-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Quetes.lua — État runtime des quêtes (port de questStore.ts, pur)
--
-- ── PUR ET PROUVABLE ─────────────────────────────────────────────────────────
-- Aucun appel API nanos. La persistance et l'émission d'événements ENTRENT EN
-- PARAMÈTRE (callbacks posés par le serveur) : en VM nue, on pose des no-op et
-- la logique reste rejouable.
--
-- ── RÈGLE : IMMUABLE ─────────────────────────────────────────────────────────
-- Aucune fonction ne mute l'état qu'on lui donne ; `appliquer` renvoie un état
-- NEUF. `etat` d'entrée reste intact (règle du dépôt, cf. Inventory/Recolte).
--
-- Auto-complétion : dès que tous les objectifs d'une quête active sont remplis,
-- elle passe en `completed` et les fonctions `record*()` RETOURNENT sa définition.
-- L'appelant octroie la récompense — le store reste pur.
-- ═══════════════════════════════════════════════════════════════════════════════

local Quetes = {}

-- ── Callbacks injectés (no-op par défaut, le serveur les remplace) ──────────
local persister = function(etat) end
local emettre = function(nom, donnees) end

function Quetes.Callbacks(p, e)
    if (type(p) == "function") then persister = p end
    if (type(e) == "function") then emettre = e end
end

local catalog = nil
local ETAT = { active = {}, completed = {}, abandoned = {}, branchChoices = {} }
-- Forward-déclarations : ces fonctions s'appellent mutuellement et sont définies
-- plus bas ; sans cette déclaration, `Incr` dans SurKill serait un global nil.
local Incr, Absolu, Appliquer, cible

function Quetes.Initialiser(quetes)
    catalog = quetes or catalog
end

--- Recharge l'état depuis une sauvegarde (spawn). `nil`/vide = personnage neuf.
function Quetes.Charger(etat)
    if (etat == nil or etat.active == nil) then
        ETAT = { active = {}, completed = {}, abandoned = {}, branchChoices = {} }
        return
    end
    ETAT = {
        active = etat.active or {},
        completed = etat.completed or {},
        abandoned = etat.abandoned or {},
        branchChoices = etat.branchChoices or {},
    }
end

--- Snapshot courant (référence stable tant que rien ne change).
function Quetes.Etat() return ETAT end

local function Quete(id)
    return catalog and catalog.Quete(id)
end

function Quetes.EstActive(id)
    for _, a in ipairs(ETAT.active) do if (a.id == id) then return true end end
    return false
end
function Quetes.EstTerminee(id)
    for _, c in ipairs(ETAT.completed) do if (c == id) then return true end end
    return false
end
function Quetes.EstAbandonnee(id)
    for _, a in ipairs(ETAT.abandoned) do if (a == id) then return true end end
    return false
end

--- Une quête est proposable : prérequis complété, ni active/terminée/abandonnée,
--- embranchement (si parente) choisi, groupe exclusif libre.
function Quetes.Disponible(def)
    if (def == nil) then return false end
    if (Quetes.EstActive(def.id) or Quetes.EstTerminee(def.id) or Quetes.EstAbandonnee(def.id)) then
        return false
    end
    if (def.requires and not Quetes.EstTerminee(def.requires)) then return false end
    if (def.requires) then
        local parent = Quete(def.requires)
        if (parent and parent.branches) then
            local choisi = ETAT.branchChoices[parent.id]
            if (not choisi) then return false end
            local mene = false
            for _, br in ipairs(parent.branches) do
                for _, c in ipairs(br.choices) do
                    if (c.id == choisi and c.leadsTo == def.id) then mene = true end
                end
            end
            if (not mene) then return false end
        end
    end
    if (def.exclusiveGroup) then
        for _, q in ipairs(catalog.QUETES) do
            if (q.exclusiveGroup == def.exclusiveGroup and q.id ~= def.id) then
                if (Quetes.EstActive(q.id) or Quetes.EstTerminee(q.id)) then return false end
            end
        end
    end
    return true
end

function Quetes.ProposeesCarte(map_id)
    local out = {}
    for _, q in ipairs(catalog.DeCarte(map_id)) do
        if (Quetes.Disponible(q)) then out[#out + 1] = q end
    end
    return out
end

--- Accepte une quête (no-op si déjà active/terminée/indisponible).
function Quetes.Accepter(id)
    local def = Quete(id)
    if (def == nil or not Quetes.Disponible(def)) then return end
    local prog = { id = id, counts = {}, done = false }
    for i = 1, #def.objectives do prog.counts[i] = 0 end
    local abandoned = {}
    for _, a in ipairs(ETAT.abandoned) do if (a ~= id) then abandoned[#abandoned + 1] = a end end
    local actifs = {}
    for _, a in ipairs(ETAT.active) do actifs[#actifs + 1] = a end
    actifs[#actifs + 1] = prog
    ETAT = { active = actifs, completed = ETAT.completed, abandoned = abandoned, branchChoices = ETAT.branchChoices }
    persister(ETAT)
end

--- Abandonne une quête active.
function Quetes.Abandonner(id)
    if (not Quetes.EstActive(id)) then return end
    local actifs = {}
    for _, a in ipairs(ETAT.active) do if (a.id ~= id) then actifs[#actifs + 1] = a end end
    local abandonnees = {}
    for _, a in ipairs(ETAT.abandoned) do abandonnees[#abandonnees + 1] = a end
    abandonnees[#abandonnees + 1] = id
    ETAT = { active = actifs, completed = ETAT.completed, abandoned = abandonnees, branchChoices = ETAT.branchChoices }
    persister(ETAT)
end

--- Choisit une branche après complétion d'une quête à embranchements.
function Quetes.ChoisirBranche(quete_id, choix_id)
    local def = Quete(quete_id)
    if (def == nil or not def.branches) then return false end
    local valide = false
    for _, br in ipairs(def.branches) do
        for _, c in ipairs(br.choices) do if (c.id == choix_id) then valide = true end end
    end
    if (not valide) then return false end
    local choices = {}
    for k, v in pairs(ETAT.branchChoices) do choices[k] = v end
    choices[quete_id] = choix_id
    ETAT = { active = ETAT.active, completed = ETAT.completed, abandoned = ETAT.abandoned, branchChoices = choices }
    persister(ETAT)
    return true
end

--- Branches disponibles pour une quête complétée (choix pas encore fait).
function Quetes.BranchesDisponibles(quete_id)
    local def = Quete(quete_id)
    if (def == nil or not def.branches) then return nil end
    if (ETAT.branchChoices[quete_id]) then return nil end
    if (not Quetes.EstTerminee(quete_id)) then return nil end
    return def.branches
end

-- ── Objectif rempli ? ─────────────────────────────────────────────────────────
local function ObjectifFait(def, i, compte)
    local obj = def.objectives[i]
    if (obj == nil) then return true end
    return compte >= (obj.target or math.huge)
end

local function QueteComplete(def, comptes)
    for i = 1, #def.objectives do
        if (not ObjectifFait(def, i, comptes[i] or 0)) then return false end
    end
    return true
end

-- ── Enregistreurs ─────────────────────────────────────────────────────────────
function Quetes.SurKill(folder)
    return Incr(function(def, obj)
        if (obj.kind ~= "kill") then return 0 end
        -- `folder` peut être une chaîne (ancien) OU une liste de tags (GetActorTags).
        -- enemyFolder == nil → "kill n'importe quel ennemi" (matche toujours).
        -- enemyFolder == un tag → matche si la liste contient ce tag.
        if (obj.enemyFolder == nil) then return 1 end
        if (type(folder) == "table") then
            for _, t in ipairs(folder) do
                if (t == obj.enemyFolder) then return 1 end
            end
            return 0
        end
        if (folder == obj.enemyFolder) then return 1 end
        return 0
    end)
end

function Quetes.Atteindre(map_id, x, z)
    return Incr(function(def, obj)
        if (obj.kind ~= "reach" or obj.zone == nil or obj.mapId ~= map_id) then return 0 end
        local dx = x - obj.zone.x
        local dz = z - obj.zone.z
        local r = obj.zone.radius
        if (dx * dx + dz * dz <= r * r) then return 1 end
        return 0
    end)
end

function Quetes.Collecter(have)
    return Absolu(function(def, obj)
        if (obj.kind == "collect" and obj.itemId) then return have(obj.itemId) end
        return nil
    end)
end

function Quetes.Parler(npc_id)
    return Incr(function(def, obj)
        if (obj.kind == "talk" and (obj.npcId == nil or obj.npcId == npc_id)) then return 1 end
        return 0
    end)
end

function Quetes.Utiliser(item_id) return Incr(cible(item_id, "use")) end
function Quetes.Fabriquer(item_id) return Incr(cible(item_id, "craft")) end

cible = function(item_id, genre)
    return function(def, obj)
        if (obj.kind == genre and (obj.itemId == nil or obj.itemId == item_id)) then return 1 end
        return 0
    end
end

function Quetes.Survivre(dt)
    return Appliquer(function(def, prog, comptes)
        local a_survivre = 0
        for _, o in ipairs(def.objectives) do if (o.kind == "survive") then a_survivre = a_survivre + 1 end end
        if (a_survivre == 0) then return comptes end
        local progression = (prog.surviveProgress or 0) + dt
        for i = 1, #def.objectives do
            local obj = def.objectives[i]
            if (obj.kind == "survive") then
                comptes[i] = (progression >= (obj.duration or 0)) and obj.target or 0
            end
        end
        prog.surviveProgress = progression
        return comptes
    end)
end

function Quetes.Escorter(npc_id)
    return Appliquer(function(def, prog, comptes)
        local a_escorter = 0
        for _, o in ipairs(def.objectives) do if (o.kind == "escort") then a_escorter = a_escorter + 1 end end
        if (a_escorter == 0) then return comptes end
        local escortes = prog.escortedIds or {}
        for i = 1, #def.objectives do
            local obj = def.objectives[i]
            if (obj.kind == "escort") then
                local present = false
                for _, e in ipairs(escortes) do if (e == npc_id) then present = true end end
                if (not present) then
                    escortes[#escortes + 1] = npc_id
                    prog.escortedIds = escortes
                    local requis = obj.escortCount or 1
                    if (#escortes >= requis) then
                        comptes[i] = math.min(obj.target, #escortes)
                    else
                        comptes[i] = #escortes
                    end
                end
            end
        end
        return comptes
    end)
end

-- ── Cœur commun ───────────────────────────────────────────────────────────────
local function Cloner(id, a)
    local prog = { id = id, counts = {}, done = a.done }
    for i, c in ipairs(a.counts) do prog.counts[i] = c end
    if (a.surviveProgress ~= nil) then prog.surviveProgress = a.surviveProgress end
    if (a.escortedIds) then
        prog.escortedIds = {}
        for _, e in ipairs(a.escortedIds) do prog.escortedIds[#prog.escortedIds + 1] = e end
    end
    return prog
end

--- INCRÉMENT (delta ≥ 0) à chaque objectif. (kill/reach/talk/use/craft)
Incr = function(deltaFn)
    return Appliquer(function(def, prog, comptes)
        for i, obj in ipairs(def.objectives) do
            if (obj.kind ~= "survive" and obj.kind ~= "escort") then
                local d = deltaFn(def, obj)
                if (d > 0) then comptes[i] = math.min(obj.target, (comptes[i] or 0) + d) end
            end
        end
        return comptes
    end)
end

--- Valeur ABSOLUE (ex: "possède N items"). `valueFn` nil = inchangé. (collect)
Absolu = function(valueFn)
    return Appliquer(function(def, prog, comptes)
        for i, obj in ipairs(def.objectives) do
            if (obj.kind ~= "survive" and obj.kind ~= "escort") then
                local v = valueFn(def, obj)
                if (v ~= nil) then comptes[i] = math.min(obj.target, v) end
            end
        end
        return comptes
    end)
end

--- Cœur commun : recompute les compteurs, détecte les complétions, mute l'état.
Appliquer = function(nextFn)
    local justeTerminees = {}
    local change = false
    local encoreActives = {}
    local nouvellesTerminees = {}

    for _, a in ipairs(ETAT.active) do
        local def = Quete(a.id)
        if (def == nil) then change = true else
            local prog = Cloner(a.id, a)
            local comptes = {}
            for i, c in ipairs(prog.counts) do comptes[i] = c end
            comptes = nextFn(def, prog, comptes)

            local comptesChanges = false
            for i, c in ipairs(comptes) do
                if (c ~= (prog.counts[i] or 0)) then comptesChanges = true end
            end

            if (QueteComplete(def, comptes)) then
                justeTerminees[#justeTerminees + 1] = def
                nouvellesTerminees[#nouvellesTerminees + 1] = def.id
                change = true
            else
                local maj = Cloner(a.id, a)
                for i, c in ipairs(comptes) do maj.counts[i] = c end
                if (prog.surviveProgress ~= nil) then maj.surviveProgress = prog.surviveProgress end
                if (prog.escortedIds) then
                    maj.escortedIds = {}
                    for _, e in ipairs(prog.escortedIds) do maj.escortedIds[#maj.escortedIds + 1] = e end
                end
                encoreActives[#encoreActives + 1] = maj
                -- ⚠ Ne pas oublier que surviveProgress/escortedIds sont AUSSI un
                -- changement : sans ça, une survie qui n'a pas encore rempli son
                -- compteur ne persistait pas sa progression entre deux appels.
                local surv_changed = (prog.surviveProgress ~= nil) and (a.surviveProgress ~= prog.surviveProgress)
                local esc_change = (prog.escortedIds ~= nil) and (#prog.escortedIds ~= #(a.escortedIds or {}))
                if (comptesChanges or surv_changed or esc_change) then change = true end
            end
        end
    end

    if (not change) then return {} end
    local terminees = {}
    for _, c in ipairs(ETAT.completed) do terminees[#terminees + 1] = c end
    for _, id in ipairs(nouvellesTerminees) do terminees[#terminees + 1] = id end
    ETAT = { active = encoreActives, completed = terminees, abandoned = ETAT.abandoned, branchChoices = ETAT.branchChoices }
    persister(ETAT)
    for _, def in ipairs(justeTerminees) do
        emettre("quest:complete", { questId = def.id, title = def.title })
    end
    return justeTerminees
end

return Quetes
