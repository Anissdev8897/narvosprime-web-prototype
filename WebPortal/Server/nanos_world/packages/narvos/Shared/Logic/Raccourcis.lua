-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Raccourcis.lua — touches assignées aux animations, par compte.
--
-- Câblage : Narvos.Raccourcis = Package.Require("Logic/Raccourcis.lua")
--
-- ── POURQUOI PAR COMPTE ET PAS PAR PERSONNAGE ─────────────────────────────────
-- Un raccourci clavier est une habitude du JOUEUR, pas une propriété de son
-- personnage. Le lier au personnage obligerait à tout réapprendre en changeant
-- d'occupant, ce qui n'a aucun sens.
--
-- ── CE QUI REND LE SYSTÈME ÉVOLUTIF ───────────────────────────────────────────
-- La table ne stocke QUE (compte, touche, identifiant d'animation). Elle ne
-- connaît ni les catégories, ni les assets, ni le nombre d'animations. Ajouter
-- un pack d'animations demain n'y change rien : le catalogue grossit, les
-- raccourcis existants restent valides, et un raccourci pointant vers une
-- animation disparue est simplement ignoré à la lecture — jamais une erreur.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosRaccourcis
local Raccourcis = {}

local Emotes = (Narvos and Narvos.Emotes) or Package.Require("Catalogs/Emotes.lua")

--- Plafond par compte. Sans lui, un client bavard remplirait la table.
Raccourcis.MAX = 24

local db = nil

--- Injecte la base. Appelé par Server/Index.lua après Comptes.Ouvrir.
function Raccourcis.UtiliserBase(instance)
    db = instance
end

function Raccourcis.Prete()
    return db ~= nil
end

-- ── Validation (pure, testable hors moteur) ───────────────────────────────────

--- Touches acceptées, en motifs Lua.
---
--- ⚠ On valide en LISTE BLANCHE, pas en liste noire. `Input.Register` reçoit
--- cette chaîne telle quelle ; une valeur fantaisiste ne lèverait pas forcément,
--- elle créerait un binding mort que le joueur ne comprendrait jamais. Et une
--- liste noire laisserait toujours passer la prochaine bizarrerie.
--- ⚠ SEULEMENT ce que le code existant PROUVE. `Client/Index.lua` enregistre
--- déjà `Input.Register(..., "I")` et `"F10"` et ça fonctionne en jeu : lettres
--- et touches F sont donc sûres. Les chiffres suivent la même convention.
---
--- Le pavé numérique est volontairement ABSENT : la doc locale n'expose pas la
--- liste des noms de touches de nanos, et rien ne dit s'il attend `NumPad3`,
--- `NumPadThree` ou autre chose. Un nom inventé ne lève PAS — il crée un
--- raccourci mort que le joueur ne comprendrait jamais. À rouvrir quand on aura
--- lu la vraie liste dans `github.com/nanos-world/api`.
local TOUCHES_VALIDES = {
    "^[A-Z]$",               -- A..Z
    "^[0-9]$",               -- 0..9
    "^F[1-9]$", "^F1[0-2]$", -- F1..F12
}

--- Touches réservées par le MOTEUR. nanos gère le déplacement en amont du
--- script : les réassigner ne les libérerait pas, le joueur perdrait juste la
--- touche.
local RESERVEES = { W = true, A = true, S = true, D = true }

--- Arbitre des touches de COMMANDE. Injecté par Server/Index.lua avec
--- `Commandes.ToucheOccupee`.
---
--- ⚠ POURQUOI UNE INJECTION ET PAS UNE LISTE EN DUR. La liste figée qui vivait
--- ici (`B`, `I`, `F3`, `F10`) est devenue fausse le jour où ces touches sont
--- devenues RECONFIGURABLES : un joueur ayant déplacé son inventaire sur `J` se
--- voyait toujours refuser `I`, et pouvait poser une émote sur `J` — exactement
--- le conflit que la liste prétendait empêcher.
---
--- Nil par défaut : sans arbitre, aucun conflit n'est détecté. C'est ce qui
--- permet de tester ce fichier seul, sans base ni catalogue de commandes.
local arbitre = nil

--- @param fn fun(compte_id: integer|nil, touche: string): string|nil
function Raccourcis.UtiliserArbitre(fn)
    arbitre = fn
end

--- La touche est-elle assignable ?
--- Rend (ok, raison) : une touche refusée est un cas normal, pas une exception.
---@param touche any
---@param compte_id? integer  requis pour detecter un conflit avec une commande
---@return boolean, string|nil
function Raccourcis.ToucheValide(touche, compte_id)
    if (type(touche) ~= "string" or touche == "") then
        return false, "Touche requise"
    end

    local t = touche:upper()

    local reconnue = false
    for _, motif in ipairs(TOUCHES_VALIDES) do
        if (t:match(motif)) then reconnue = true break end
    end
    if (not reconnue) then
        -- Le message doit dire la VERITE : le pave numerique est refuse (voir
        -- TOUCHES_VALIDES). Annoncer NumPad0-9 envoyait le joueur essayer une
        -- touche que le serveur allait refuser.
        return false, "Touche non reconnue : lettre, chiffre ou F1-F12"
    end

    if (RESERVEES[t]) then
        return false, "La touche " .. t .. " sert au deplacement"
    end

    -- Conflit avec une commande du jeu. On refuse au lieu de voler : entre une
    -- émote et l'ouverture de l'inventaire, c'est l'inventaire qui doit gagner,
    -- et le joueur a un écran dédié pour le déplacer s'il y tient.
    if (arbitre) then
        local prise = arbitre(compte_id, t)
        if (prise) then
            return false, "La touche " .. t .. " est utilisee par une commande"
        end
    end

    return true, nil
end

--- Normalise une touche pour le stockage et la comparaison.
--- Sans ça, « e » et « E » seraient deux raccourcis distincts sur la même touche.
---@param touche string
---@return string
function Raccourcis.Normaliser(touche)
    return tostring(touche or ""):upper()
end

-- ── Accès à la base ───────────────────────────────────────────────────────────

--- Raccourcis d'un compte : { TOUCHE = anim_id }.
---
--- Les entrées pointant vers une animation ABSENTE du catalogue sont écartées
--- silencieusement. C'est ce qui rend le système évolutif : retirer un pack ne
--- casse rien, le raccourci devient simplement inerte au lieu de faire planter
--- le menu à l'ouverture.
---@param compte_id integer
---@return table
function Raccourcis.ParCompte(compte_id)
    local sortie = {}
    if (not db or compte_id == nil) then return sortie end

    local lignes = db:Select(
        "SELECT touche, anim_id FROM raccourcis WHERE compte_id = :0 ORDER BY touche ASC", compte_id)

    for _, l in ipairs(lignes or {}) do
        if (Emotes.Trouver(l.anim_id)) then
            sortie[l.touche] = l.anim_id
        end
    end
    return sortie
end

--- Assigne une touche à une animation.
---
--- Une touche déjà prise est RÉÉCRITE, pas refusée : c'est ce que le joueur
--- attend quand il réassigne. La clé primaire (compte, touche) le garantit.
---@param compte_id integer
---@param touche string
---@param anim_id string
---@return boolean, string|nil
function Raccourcis.Definir(compte_id, touche, anim_id)
    if (not db) then return false, "Base indisponible" end
    if (compte_id == nil) then return false, "Compte inconnu" end

    local ok, raison = Raccourcis.ToucheValide(touche, compte_id)
    if (not ok) then return false, raison end

    if (not Emotes.Trouver(anim_id)) then
        return false, "Animation inconnue : " .. tostring(anim_id)
    end

    local t = Raccourcis.Normaliser(touche)

    -- Le plafond ne compte QUE les touches nouvelles : réassigner une touche
    -- déjà utilisée doit rester possible même à la limite.
    -- ⚠ COMPTER LES LIGNES REELLES, pas celles que `ParCompte` sait lire.
    -- `ParCompte` ECARTE les raccourcis dont l'animation a quitte le catalogue :
    -- s'appuyer dessus laissait la table depasser MAX en base, silencieusement.
    -- Trouve par audit le 2026-09-03.
    local existe = false
    local n = 0
    for _, l in ipairs(db:Select(
        "SELECT touche FROM raccourcis WHERE compte_id = :0", compte_id) or {}) do
        n = n + 1
        if (l.touche == t) then existe = true end
    end

    if (not existe and n >= Raccourcis.MAX) then
        return false, "Maximum de " .. Raccourcis.MAX .. " raccourcis atteint"
    end

    -- `INSERT OR REPLACE` : une seule requête, atomique. Un DELETE puis INSERT
    -- laisserait une fenêtre où la touche n'existe plus.
    db:Execute(
        "INSERT OR REPLACE INTO raccourcis (compte_id, touche, anim_id) VALUES (:0, :1, :2)",
        compte_id, t, anim_id)

    return true, nil
end

--- Libère une touche.
---@param compte_id integer
---@param touche string
---@return boolean
function Raccourcis.Retirer(compte_id, touche)
    if (not db or compte_id == nil) then return false end

    -- ⚠ Le `compte_id` dans le WHERE n'est pas décoratif : la touche vient du
    -- client, et sans lui un joueur effacerait les raccourcis d'un autre.
    local touchees = db:Execute(
        "DELETE FROM raccourcis WHERE compte_id = :0 AND touche = :1",
        compte_id, Raccourcis.Normaliser(touche))

    return (tonumber(touchees) or 0) > 0
end

return Raccourcis
