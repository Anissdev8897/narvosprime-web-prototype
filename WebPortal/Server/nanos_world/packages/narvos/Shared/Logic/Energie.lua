-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Energie.lua — jauge d'énergie des actions physiques (escalade).
--
-- Câblage : Narvos.Energie = Package.Require("Logic/Energie.lua")
--
-- ── POURQUOI, ET POURQUOI PUR ──────────────────────────────────────────────────
-- L'escalade ne devait pas être gratuite : « consommer une jauge d'énergie, sur
-- le même principe que le sprint. Si l'énergie est épuisée, le personnage doit
-- arrêter l'escalade et retomber. » Aucune jauge n'existait côté jeu (le sprint
-- natif nanos n'en a pas) : on la crée, PUR, pour la tester sans moteur.
-- L'état d'un joueur est une simple table { reserve, dernier } que le serveur
-- tient à jour — les fonctions ne touchent ni Package ni Character ni horloge
-- globale : le temps arrive en paramètre.
--
-- ── RÉGÉNÉRATION PARESSEUSE ────────────────────────────────────────────────────
-- Pas de timer de régénération : la réserve se recale à la LECTURE (Reserve),
-- en comptant le repos écoulé depuis la dernière dépense, moins le délai. Un
-- tick par joueur serait 30 timers pour rien — et l'horloge incrémentale des
-- callbacks dérive (leçon mesurée ailleurs).
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosEnergie
local Energie = {}

-- ── Constantes ────────────────────────────────────────────────────────────────

Energie.MAX = 100
Energie.DEPART = 100

--- Coût d'une traversée par type. Grimper est le plus cher : c'est lui qui
--- plafonne la hauteur pratique (on ne grimpe pas deux murs de suite sans
--- attendre la régénération).
Energie.COUTS = {
    vault  = 15,
    mantle = 30,
    climb  = 55,
}

--- Régénération, en points par seconde.
Energie.REGEN_S = 15

--- Repos exigé avant que la régénération reprenne (ms).
Energie.DELAI_REGEN_MS = 1500

--- Pas de purge pendant l'escalade (ms) — même cadence que la courbe serveur.
Energie.PAS_PURGE_MS = 33

-- ── État et régénération ──────────────────────────────────────────────────────

--- Réserve après régénération paresseuse.
---@param etat table  { reserve, dernier }
---@param maintenant number  horloge réelle (ms)
---@return number
function Energie.Reserve(etat, maintenant)
    etat.reserve = etat.reserve or Energie.DEPART
    local dernier = etat.dernier or 0
    local repos = maintenant - dernier
    if (repos > Energie.DELAI_REGEN_MS) then
        etat.reserve = math.min(Energie.MAX,
            etat.reserve + (repos - Energie.DELAI_REGEN_MS) / 1000 * Energie.REGEN_S)
        etat.dernier = maintenant
    end
    return etat.reserve
end

--- Peut-on se permettre ce montant ?
---@return boolean
function Energie.Peut(etat, montant, maintenant)
    return Energie.Reserve(etat, maintenant) >= montant
end

--- Dépense un montant, renvoie ce qui reste.
---@return number
function Energie.Depenser(etat, montant, maintenant)
    Energie.Reserve(etat, maintenant)
    etat.reserve = math.max(0, etat.reserve - montant)
    etat.dernier = maintenant
    return etat.reserve
end

--- Purge pendant l'escalade : renvoie false quand la réserve est VIDE.
--- C'est le signal de « retomber ».
---@return boolean
function Energie.Purger(etat, montant, maintenant)
    local reste = Energie.Depenser(etat, montant, maintenant)
    return reste > 0
end

return Energie
