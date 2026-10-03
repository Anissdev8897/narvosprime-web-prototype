-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Dash.lua — esquive directionnelle (dash).
--
-- Câblage : Narvos.Dash = Package.Require("Logic/Dash.lua")
--
-- ── POURQUOI UN FICHIER, ET POURQUOI PUR ───────────────────────────────────────
-- Les clips `ACB_Dash_*` sont cuits depuis le pack (4 directions × IP/RM, deux
-- prises chacune — Catalogs/Animations.lua:154-169) mais n'étaient câblés nulle
-- part : 0 référence hors catalogue. L'esquive manquait au jeu.
-- Comme Frappes, la partie DÉCISION vit ici (quel clip, quelle direction), sans
-- Package ni Character ni horloge : testable seul, réutilisé par le serveur.
--
-- ── IP SEULEMENT ───────────────────────────────────────────────────────────────
-- L'esquive DÉPLACE le personnage (impulsion serveur) : le déplacement est donc
-- piloté par le code, pas par l'animation. ModePour le rappelle — c'est la règle
-- `pilote_par_code` : root motion et impulsion entreraient en conflit.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosDash
local Dash = {}

-- ── Constantes ────────────────────────────────────────────────────────────────

--- Durée du geste (ms) — les clips ACB_Dash font ~0,25 s.
Dash.DUREE_MS = 250

--- Recharge entre deux esquives (ms).
Dash.COOLDOWN_MS = 800

--- Impulsion (cm/s) appliquée par le serveur. Mesurée raisonnable : couvre
--- ~3 mètres en 0,25 s sans traverser une salle.
Dash.FORCE = 1600

--- Vitesse en dessous de laquelle on considère le personnage immobile : sans
--- intention de déplacement, l'esquive part EN ARRIÈRE (retraite défensive).
Dash.SEUIL_VITESSE = 25

--- Fondus du geste, en secondes (entrée sèche, sortie douce).
Dash.FONDU_ENTREE = 0.05
Dash.FONDU_SORTIE = 0.22

-- ── Clips par direction ───────────────────────────────────────────────────────

--- Base d'animation par direction. Les variantes et le mode sont résolus par
--- `Animations.Choisir` — on ne demande ici que la BASE de l'action.
Dash.CLIPS = {
    avant   = "ACB_Dash_Forward",
    arriere = "ACB_Dash_Backward",
    gauche  = "ACB_Dash_Left",
    droite  = "ACB_Dash_Right",
}

-- ── Décision de direction ─────────────────────────────────────────────────────

--- Direction d'esquive depuis un vecteur d'intention au sol (x = avant,
--- y = droite, convention nanos mesurée sur Frappes et Sorts).
---
--- Choisit l'axe dominant : un mouvement diagonal esquive sur son axe le plus
--- franc, jamais entre deux clips.
---@param vers table|nil  { x: number, y: number }
---@return string|nil  "avant" | "arriere" | "gauche" | "droite"
function Dash.DirectionDepuis(vers)
    if (not vers) then return nil end
    local x, y = vers.x or 0, vers.y or 0
    local norme = math.sqrt(x * x + y * y)
    if (norme < 1e-4) then return nil end
    x, y = x / norme, y / norme
    if (math.abs(x) >= math.abs(y)) then
        return (x > 0) and "avant" or "arriere"
    end
    return (y > 0) and "droite" or "gauche"
end

--- Combien de directions n'ont AUCUN clip cuit ? À appeler au chargement : un
--- zéro silencieux donnerait une esquive sans geste, comme le coup sans clip
--- que Frappes signale déjà.
---@param sets table  produit par Animations.Grouper
---@return string[]  bases manquantes
function Dash.Verifier(sets)
    local manquants = {}
    for _, base in pairs(Dash.CLIPS) do
        local parMode = sets and sets[base]
        if (not parMode or not (parMode.IP or parMode.RM or parMode["-"])) then
            table.insert(manquants, base)
        end
    end
    return manquants
end

return Dash
