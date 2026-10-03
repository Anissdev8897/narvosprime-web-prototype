-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Menottes.lua — arrestation : qui peut menotter qui, et ce qu'un menotté
-- ne peut plus faire.
--
-- Câblage : Narvos.Menottes = Package.Require("Logic/Menottes.lua") dans
-- Shared/Index.lua.
--
-- ── SOURCE DE LA SPÉCIFICATION ────────────────────────────────────────────────
-- Le pack Multiplayer_Handcuff_System (UE 4.26, audit docs/AUDIT_A_TRIER_LOT1.md
-- §4) sert de SPÉCIFICATION, pas de source de code : BP_Handcuff (l'objet
-- menottes, ramassable), BP_PC (le contrôleur, qui crée UI_Arrest — « [E]
-- Arrest / Release »), BP_GM. La logique est réécrite ici en Lua pur.
--
-- ── PUR ET PROUVABLE ──────────────────────────────────────────────────────────
-- Aucun appel API nanos, AUCUN asset nommé. Le mesh des menottes et
-- l'animation « menotté » ne sont pas cuits : ce module prend des CHAÎNES en
-- paramètres (config), et le branchement visuel viendra après cook.
--
-- ── ÉTAT EN MÉMOIRE, ÉTAT DE SESSION ──────────────────────────────────────────
-- Menotté est un état de SESSION : il ne survit ni à la déconnexion ni au
-- redémarrage. Les tables indexées par joueur sont déclarées EN TÊTE (règle du
-- dépôt : un local déclaré après son appelant se résout en global nil, muet).
--
-- ── L'ANIMATION, POINT D'INJECTION ────────────────────────────────────────────
-- `CleAnimation` rend la clé d'animation à jouer sur la cible. Aujourd'hui la
-- configuration porte une CHAÎNE VIDE : l'exécutant ne joue rien, et rien ne
-- plante. Après cook, le serveur injectera la clé par `Configurer` — ce fichier
-- ne la nommera jamais.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosMenottes
local Menottes = {}

-- ── État par joueur — EN TÊTE, toujours ───────────────────────────────────────
-- [cible_id] = { par = agent_id, depuis = instant }
local etats = {}
-- [cible_id] = { { action = "menotte"|"libere"|"evasion", par = id, quand = t }, … }
local journaux = {}

-- ── Constantes ────────────────────────────────────────────────────────────────

Menottes.ETAT_LIBRE = "libre"
Menottes.ETAT_MENOTTE = "menotte"

--- Capacités qu'un menotté PERD, liste ordonnée. Les autres systèmes (combat,
--- inventaire, roue, conduite…) lisent `Drapeaux`, qui rend une entrée par
--- capacité — dans les DEUX états, pour qu'un consommateur n'ait jamais à
--- distinguer « libre » de « absent ».
---
--- `sort` et `emote` ajoutés le 2026-09-13 avec l'exécutant : l'animation
--- d'entrave boucle sur le HAUT du corps, et un geste de sort (UpperBody) ou une
--- emote (FullBody, qui arrête les montages) la remplacerait. La cible paraîtrait
--- libre à l'écran tout en restant menottée pour le serveur.
---
--- `esquive` et `traversee` ajoutés le 2026-10-03 : `Server/Dash.lua` et
--- `Server/Traversee.lua` les refusaient déjà par `Refuse`, mais une capacité
--- non déclarée n'a pas de drapeau — `Refuse` rendait false et le menotté
--- esquivait et escaladait (garde : `menottes-cablage-check.mjs`).
Menottes.CAPACITES = { "melee", "arme_feu", "inventaire", "roue", "interaction", "conduite", "sort", "emote", "esquive", "traversee" }

-- ── Configuration — paramétrable, jamais en dur chez l'appelant ───────────────
--
-- Qui peut menotter est une RÈGLE DE SERVEUR, pas un choix de ce fichier :
-- porteur de menottes ? grade ? les deux ? `Configurer` tranche.
local config = {
    -- L'agent doit-il PORTER l'objet menottes ? Le fait est fourni par
    -- l'appelant (`a_menottes`) : ce module ne connaît pas l'inventaire.
    exige_menottes = true,
    -- ⚠ `false` = tout le monde ; sinon liste de grades, ex. { "policier" }.
    -- PAS nil : un champ à nil DISPARAIT d'une table Lua, et
    -- `Configurer({ grades_autorises = nil })` ne réinitialiserait rien —
    -- la restriction resterait posée, sans que rien ne le signale.
    grades_autorises = false,
    -- Distance maximale agent ↔ cible. Unité de l'APPELANT — nanos travaille
    -- en unités Unreal (centimètres) : 300 ≈ 3 m.
    portee_max = 300.0,
    -- Un tiers (non menotté) peut-il libérer une cible ? Sinon, seul l'agent
    -- qui a posé les menottes le peut.
    liberation_par_tiers = true,
    -- Évasion : possible ou non, délai minimum menotté avant toute tentative,
    -- probabilité de réussite par tentative. Le TIRAGE vient de l'appelant —
    -- « le serveur tire, le client reçoit » : ce module ne lance aucun dé.
    evasion = { possible = true, delai_min = 30.0, chance = 0.20 },
    -- POINT D'INJECTION de l'animation « menotté ». Chaîne vide = pas d'anim,
    -- pas de crash. Remplie par le serveur après cook, via Configurer.
    animation_menotte = "",
}

-- Clés reconnues. Une clé hors de ces listes est REFUSÉE à la configuration :
-- une faute de frappe y serait ignorée en silence, et la règle qu'on croit
-- avoir changée n'aurait jamais bougé.
local CLES_CONFIG = { "exige_menottes", "grades_autorises", "portee_max",
                      "liberation_par_tiers", "animation_menotte", "evasion" }
local CLES_EVASION = { "possible", "delai_min", "chance" }

local function connue(cle, liste)
    for _, c in ipairs(liste) do
        if (c == cle) then return true end
    end
    return false
end

--- Change la configuration. Rend false + raison sur option inconnue, sans rien
--- modifier d'autre. `evasion` se FUSIONNE clé par clé : écrire
--- `{ evasion = { possible = false } }` ne doit pas effacer `delai_min` —
--- un remplacement en bloc laisserait des champs à nil, et la première
--- comparaison contre eux lèverait loin de la cause.
---@param options table
---@return boolean, string|nil
function Menottes.Configurer(options)
    if (type(options) ~= "table") then return false, "options attendues" end

    -- Validation D'ABORD, écriture ENSUITE : un refus à mi-table laisserait
    -- une configuration à moitié appliquée.
    for k, v in pairs(options) do
        if (not connue(k, CLES_CONFIG)) then
            return false, "option inconnue : " .. tostring(k)
        end
        if (k == "evasion") then
            if (type(v) ~= "table") then return false, "evasion : table attendue" end
            for ke in pairs(v) do
                if (not connue(ke, CLES_EVASION)) then
                    return false, "option inconnue : evasion." .. tostring(ke)
                end
            end
        end
    end

    for k, v in pairs(options) do
        if (k == "evasion") then
            for ke, ve in pairs(v) do config.evasion[ke] = ve end
        else
            config[k] = v
        end
    end
    return true, nil
end

--- La configuration courante (copie de surface — `evasion` reste partagé,
--- l'appelant qui veut la changer passe par Configurer).
---@return table
function Menottes.Configuration()
    return {
        exige_menottes = config.exige_menottes,
        grades_autorises = config.grades_autorises,
        portee_max = config.portee_max,
        liberation_par_tiers = config.liberation_par_tiers,
        evasion = { possible = config.evasion.possible, delai_min = config.evasion.delai_min,
                    chance = config.evasion.chance },
        animation_menotte = config.animation_menotte,
    }
end

-- ── Lectures ──────────────────────────────────────────────────────────────────

--- La cible est-elle menottée ?
---@param cible_id any
---@return boolean
function Menottes.EstMenotte(cible_id)
    return cible_id ~= nil and etats[cible_id] ~= nil
end

--- L'état d'une cible. Toujours une table : { etat = "libre" } ou
--- { etat = "menotte", par = agent_id, depuis = instant }. Jamais nil — un
--- consommateur ne doit pas avoir à tester l'existence avant de lire l'état.
---@param cible_id any
---@return table
function Menottes.Etat(cible_id)
    local e = cible_id ~= nil and etats[cible_id] or nil
    if (not e) then return { etat = Menottes.ETAT_LIBRE } end
    return { etat = Menottes.ETAT_MENOTTE, par = e.par, depuis = e.depuis }
end

--- Ce que la cible peut faire, capacité par capacité.
--- Menotté : tout est false. Libre : tout est true. La table porte TOUTES les
--- capacités dans les deux cas — sa forme ne dépend pas de l'état.
---@param cible_id any
---@return table
function Menottes.Drapeaux(cible_id)
    local permis = not Menottes.EstMenotte(cible_id)
    local drapeaux = {}
    for _, capacite in ipairs(Menottes.CAPACITES) do
        drapeaux[capacite] = permis
    end
    return drapeaux
end

--- La clé d'animation à jouer sur la cible. POINT D'INJECTION post-cook :
--- une chaîne vide signifie « rien à jouer », jamais nil.
---@param cible_id any
---@return string
function Menottes.CleAnimation(cible_id)
    if (not Menottes.EstMenotte(cible_id)) then return "" end
    return config.animation_menotte or ""
end

--- Le journal d'une cible (copie), du plus ancien au plus récent.
---@param cible_id any
---@return table
function Menottes.Journal(cible_id)
    local sortie = {}
    for _, entree in ipairs(journaux[cible_id] or {}) do
        sortie[#sortie + 1] = { action = entree.action, par = entree.par, quand = entree.quand }
    end
    return sortie
end

-- ── Garde et transitions ──────────────────────────────────────────────────────

--- L'agent peut-il menotter cette cible MAINTENANT ?
--- Un refus est un cas normal, jamais une exception — et la raison le dit.
---
--- `contexte` porte les FAITS, que seul l'appelant connaît :
---   agent_id, cible_id  — identifiants (chaînes non vides)
---   distance            — nombre, dans l'unité de l'appelant (obligatoire :
---                         une distance inconnue ne doit pas valoir « assez
---                         près » — un garde qui ne mesure rien compte pour vert)
---   a_menottes          — booléen : l'agent porte-t-il l'objet menottes ?
---   grade               — chaîne ou nil
---@param contexte table
---@return boolean, string|nil
function Menottes.PeutMenotter(contexte)
    if (type(contexte) ~= "table") then return false, "contexte attendu" end
    local agent_id, cible_id = contexte.agent_id, contexte.cible_id
    if (type(agent_id) ~= "string" or agent_id == "") then return false, "agent inconnu" end
    if (type(cible_id) ~= "string" or cible_id == "") then return false, "cible inconnue" end
    if (agent_id == cible_id) then return false, "on ne se menotte pas soi-meme" end
    if (Menottes.EstMenotte(cible_id)) then return false, "cible deja menottee" end
    if (Menottes.EstMenotte(agent_id)) then return false, "l'agent a les mains liees" end

    local distance = tonumber(contexte.distance)
    if (not distance) then return false, "distance inconnue" end
    if (distance > config.portee_max) then return false, "cible trop loin" end

    if (type(config.grades_autorises) == "table") then
        local grade = contexte.grade
        local admis = false
        for _, g in ipairs(config.grades_autorises) do
            if (g == grade) then admis = true break end
        end
        if (not admis) then return false, "grade non autorise" end
    end

    if (config.exige_menottes and contexte.a_menottes ~= true) then
        return false, "l'agent ne porte pas de menottes"
    end

    return true, nil
end

--- Menotte la cible. Revalide TOUT par PeutMenotter : l'état a pu changer
--- entre la question et le geste.
---@param contexte table   celui de PeutMenotter
---@param maintenant any   instant fourni par l'appelant (secondes)
---@return boolean, string|nil
function Menottes.Menotter(contexte, maintenant)
    local ok, raison = Menottes.PeutMenotter(contexte)
    if (not ok) then return false, raison end

    local t = tonumber(maintenant) or 0
    etats[contexte.cible_id] = { par = contexte.agent_id, depuis = t }

    local journal = journaux[contexte.cible_id] or {}
    journal[#journal + 1] = { action = "menotte", par = contexte.agent_id, quand = t }
    journaux[contexte.cible_id] = journal

    return true, nil
end

--- Libère la cible. Un menotté ne libère personne — ses mains sont liées ; et
--- personne ne se libère soi-même : ça s'appelle une évasion, plus bas.
---@param par_id any      qui libère
---@param cible_id any
---@param maintenant any
---@return boolean, string|nil
function Menottes.Liberer(par_id, cible_id, maintenant)
    if (type(cible_id) ~= "string" or cible_id == "") then return false, "cible inconnue" end
    local etat = etats[cible_id]
    if (not etat) then return false, "la cible n'est pas menottee" end
    if (type(par_id) ~= "string" or par_id == "") then return false, "liberateur inconnu" end
    if (par_id == cible_id) then return false, "on ne se libere pas soi-meme" end
    if (Menottes.EstMenotte(par_id)) then return false, "le liberateur a les mains liees" end
    if (not config.liberation_par_tiers and etat.par ~= par_id) then
        return false, "seul l'agent qui a menotte peut liberer"
    end

    etats[cible_id] = nil
    local journal = journaux[cible_id] or {}
    journal[#journal + 1] = { action = "libere", par = par_id, quand = tonumber(maintenant) or 0 }
    journaux[cible_id] = journal
    return true, nil
end

--- Tentative d'évasion. Le TIRAGE est fourni par l'appelant (le serveur tire,
--- jamais ce module) : un nombre dans [0, 1). Un tirage absent ou hors bornes
--- est refusé — un dé non lancé ne vaut pas un dé favorable.
---@param cible_id any
---@param maintenant any
---@param tirage any
---@return boolean, string|nil
function Menottes.TenterEvasion(cible_id, maintenant, tirage)
    local etat = (type(cible_id) == "string") and etats[cible_id] or nil
    if (not etat) then return false, "la cible n'est pas menottee" end
    if (not config.evasion.possible) then return false, "evasion impossible" end

    local t = tonumber(maintenant)
    if (not t) then return false, "instant inconnu" end
    if (t - etat.depuis < config.evasion.delai_min) then
        return false, "trop tot pour une tentative"
    end

    local de = tonumber(tirage)
    if (not de or de < 0 or de >= 1) then return false, "tirage absent ou hors bornes" end
    if (de >= config.evasion.chance) then return false, "tentative ratee" end

    etats[cible_id] = nil
    local journal = journaux[cible_id] or {}
    journal[#journal + 1] = { action = "evasion", par = cible_id, quand = t }
    journaux[cible_id] = journal
    return true, nil
end

--- Ce que fait la touche d'arrestation, pour cet agent devant cette cible.
---
--- Une seule touche porte trois gestes — la spec du pack, « [E] Arrest /
--- Release » — et le choix est une décision de jeu :
---   "evasion"  l'agent est lui-même menotté : il tente de se libérer, QUELLE QUE
---              SOIT la cible (sinon il « menotterait » et lirait « mains liées ») ;
---   "liberer"  la cible est menottée ;
---   "menotter" la cible est libre ;
---   "aucune"   pas de cible, agent inconnu, ou soi-même.
--- La décision ne valide RIEN d'autre : `Menotter`, `Liberer` et `TenterEvasion`
--- revalident tout au moment du geste.
---@param agent_id any
---@param cible_id any
---@return string
function Menottes.ActionPour(agent_id, cible_id)
    if (type(agent_id) ~= "string" or agent_id == "") then return "aucune" end
    if (Menottes.EstMenotte(agent_id)) then return "evasion" end
    if (type(cible_id) ~= "string" or cible_id == "" or cible_id == agent_id) then return "aucune" end
    if (Menottes.EstMenotte(cible_id)) then return "liberer" end
    return "menotter"
end

--- Oublie la cible (déconnexion, changement de dimension). L'état de session
--- ne survit pas à son joueur ; le journal, non plus — il est mémoire, pas
--- archive.
---@param cible_id any
function Menottes.Purger(cible_id)
    if (cible_id == nil) then return end
    etats[cible_id] = nil
    journaux[cible_id] = nil
end

return Menottes
