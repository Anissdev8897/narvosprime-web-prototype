-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Energie.lua — tient la jauge d'énergie de chaque joueur.
--
-- Câblage : Package.Require("Server/Energie.lua") depuis Server/Index.lua,
-- AVANT Server/Traversee.lua (qui la consulte à chaque traversée).
--
-- ── LA SÉPARATION ─────────────────────────────────────────────────────────────
-- Shared/Logic/Energie.lua DÉCIDE (constantes, régénération, purge). Ce fichier
-- POSSÈDE l'état par joueur et l'horloge réelle. Même découpage que Dash et
-- Traversee : un seul modèle « module pur + exécutant », pas un quatrième.
--
-- ── PAS DE TIMER ───────────────────────────────────────────────────────────────
-- La régénération est PARESSEUSE (recalculée à la lecture par le module pur) :
-- pas de SetInterval par joueur — le serveur ne doit rien tourner pour une
-- jauge que personne ne regarde.
-- ═══════════════════════════════════════════════════════════════════════════════

local EnergieServeur = {}

local Energie = Narvos.Energie

--- État par joueur : { reserve, dernier }.
local etats = {}

local function horloge_ms() return Server.GetTime() end

local function Etat(player)
    local etat = etats[player]
    if (not etat) then
        etat = { reserve = Energie.DEPART, dernier = 0 }
        etats[player] = etat
    end
    return etat
end

--- Peut-on se permettre le coût du type demandé ?
---@param player table
---@param typ string  "vault" | "mantle" | "climb"
---@return boolean
function EnergieServeur.Peut(player, typ)
    local cout = Energie.COUTS[typ]
    if (not cout) then return false end
    return Energie.Peut(Etat(player), cout, horloge_ms())
end

--- Purge pendant l'escalade : false quand la réserve est vide (→ retomber).
---@param player table
---@param montant number
---@return boolean
function EnergieServeur.Purger(player, montant)
    return Energie.Purger(Etat(player), montant, horloge_ms())
end

--- Réserve courante (diagnostic / HUD plus tard).
---@return number
function EnergieServeur.Reserve(player)
    return Energie.Reserve(Etat(player), horloge_ms())
end

Player.Subscribe("Destroy", function(player)
    etats[player] = nil
end)

return EnergieServeur