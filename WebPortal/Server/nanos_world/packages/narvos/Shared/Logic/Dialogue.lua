-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Dialogue.lua — Moteur d'exécution des dialogues (port de dialogueRunner.ts)
--
-- ── PUR ET PROUVABLE ─────────────────────────────────────────────────────────
-- Aucun appel API nanos. L'évaluation des CONDITIONS et l'exécution des ACTIONS
-- ENTRENT EN PARAMÈTRE (callbacks posés par le serveur) : le moteur reste pur et
-- rejouable ; il ne connaît ni quêtes, ni inventaire, ni PNJ.
--
-- ── SESSION ──────────────────────────────────────────────────────────────────
-- `Demarrer(id)` → noeud initial (nil si verrouillé par conditions).
-- `NoeudCourant()` / `ChoixFiltres()` → état courant de la bulle.
-- `Choix(index)` / `Aller(id)` → navigue ; exécute onExit/onSelect/onEnter.
-- ═══════════════════════════════════════════════════════════════════════════════

local Dialogue = {}

local registre = {}
local actif = nil

-- Callbacks injectés (le serveur les remplace ; no-op par défaut).
local evaluer_conditions = function(page, conditions) return true end
local executer_actions = function(page, actions) end

function Dialogue.Callbacks(evalCond, execAct)
    if (type(evalCond) == "function") then evaluer_conditions = evalCond end
    if (type(execAct) == "function") then executer_actions = execAct end
end

-- ── Registre ──────────────────────────────────────────────────────────────────
function Dialogue.Enregistrer(def) registre[def.id] = def end
function Dialogue.EnregistrerTout(defs) for i, d in ipairs(defs) do Dialogue.Enregistrer(d) end end
function Dialogue.Def(id) return registre[id] end
function Dialogue.PourPnj(folder)
    local out = {}
    for _, d in pairs(registre) do if (d.npcFolder == folder) then out[#out + 1] = d end end
    return out
end
function Dialogue.ViderRegistre() registre = {} end

local function NoeudParId(def, id)
    for _, n in ipairs(def.nodes) do if (n.id == id) then return n end end
    return nil
end

local function NoeudCourant()
    if (actif == nil) then return nil end
    return NoeudParId(actif.def, actif.currentNodeId)
end

local function Page()
    return (actif and actif.vars) or {}
end

-- ── Session ──────────────────────────────────────────────────────────────────
function Dialogue.Demarrer(id)
    local def = registre[id]
    if (def == nil) then actif = nil; return nil end
    local debut = NoeudParId(def, def.startNode)
    if (debut == nil) then actif = nil; return nil end
    if (not evaluer_conditions({}, debut.conditions)) then actif = nil; return nil end
    actif = { def = def, currentNodeId = def.startNode, history = { def.startNode }, vars = {} }
    executer_actions(Page(), debut.onEnter)
    return debut
end

--- Rend le curseur de conversation courant, pour que l’appelant le range.
---
--- ── ⚠ POURQUOI CE COUPLE EXISTE ───────────────────────────────────────────────
--- `actif` est UNIQUE pour tout le module. Le serveur gardait bien
--- `dialogue_actifs[player]` — mais ca ne memorise que QUEL dialogue, pas OU on
--- en est. Deux joueurs en conversation en meme temps : le second ecrasait
--- `actif`, et le choix du premier faisait avancer la conversation du second.
---
--- Meme patron que `Quetes.Etat` / `Quetes.Charger`, deja en place et correct :
--- le module reste PUR et testable, l’executant echange l’etat autour de chaque
--- appel. Trouve le 2026-09-07 en verifiant le cablage du lot M5.
---@return table|nil
function Dialogue.Etat() return actif end

--- Repose un curseur rendu par `Dialogue.Etat`. `nil` = aucune conversation.
---@param etat table|nil
function Dialogue.Charger(etat) actif = etat end

function Dialogue.Arreter()
    if (actif) then
        local noeud = NoeudCourant()
        if (noeud) then executer_actions(Page(), noeud.onExit) end
    end
    actif = nil
end

function Dialogue.ChoixFiltres()
    local noeud = NoeudCourant()
    if (noeud == nil or noeud.choices == nil) then return {} end
    local out = {}
    for _, c in ipairs(noeud.choices) do
        if (evaluer_conditions(Page(), c.conditions)) then out[#out + 1] = c end
    end
    return out
end

function Dialogue.Aller(next_id)
    if (actif == nil) then return nil end
    local noeud = NoeudCourant()
    if (noeud == nil) then return nil end
    executer_actions(Page(), noeud.onExit)
    local suivant = NoeudParId(actif.def, next_id)
    if (suivant == nil) then actif = nil; return nil end
    if (not evaluer_conditions(Page(), suivant.conditions)) then actif = nil; return nil end
    actif.currentNodeId = next_id
    actif.history[#actif.history + 1] = next_id
    executer_actions(Page(), suivant.onEnter)
    return suivant
end

function Dialogue.Choix(index_filtre)
    local choix = Dialogue.ChoixFiltres()[index_filtre]
    if (choix == nil) then return nil end
    executer_actions(Page(), choix.onSelect)
    return Dialogue.Aller(choix.nextNode)
end

function Dialogue.NoeudCourant() return NoeudCourant() end
function Dialogue.Actif() return actif end
function Dialogue.EstActif() return actif ~= nil end

function Dialogue.Vars() if (actif) then return actif.vars end return nil end

return Dialogue
