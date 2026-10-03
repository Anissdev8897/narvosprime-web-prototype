-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Jouabilite.lua — l'écran Échap → Paramètres → Jouabilité, côté serveur.
--
-- Câblage : Package.Require("Server/Jouabilite.lua") depuis Server/Index.lua,
-- APRÈS Server/Session.lua (il lit la session pour connaître le compte).
--
-- ── POURQUOI LE SERVEUR TIENT CES RÉGLAGES ────────────────────────────────────
-- Même raison que les touches (Server/Commandes.lua) : un réglage en
-- localStorage serait perdu au premier changement de poste, et un client
-- modifié pourrait s'offrir ce qu'il veut. Le compte est en base, les réglages
-- y vont aussi — le serveur valide, stocke, renvoie. Le CLIENT ne décide rien.
-- ═══════════════════════════════════════════════════════════════════════════════

local JouabiliteServeur = {}

local Jouabilite = Narvos.Jouabilite
local Session = Narvos.SessionServeur

---@param player table
---@return integer|nil
local function CompteDe(player)
    local s = Session and Session.De(player)
    return s and s.compte and s.compte.id or nil
end

--- Pousse l'état complet : registre (structure extensible) + valeurs du compte.
--- Le client rend ce qu'il reçoit, sans refaire la fusion.
---@param player table
function JouabiliteServeur.Envoyer(player)
    local compte = CompteDe(player)
    Events.CallRemote("Narvos:Jouabilite", player, Reliability.Reliable, {
        categories = Jouabilite.CATEGORIES,
        parametres = Jouabilite.Vue(compte),
    })
end

Events.SubscribeRemote("Narvos:DemanderJouabilite", function(player)
    JouabiliteServeur.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:DefinirJouabilite", function(player, parametre_id, valeur)
    -- ⚠ Le compte vient de la SESSION, jamais du client.
    local compte = CompteDe(player)
    if (not compte) then return end

    local ok, raison = Jouabilite.Definir(compte, parametre_id, valeur)
    if (not ok) then
        Events.CallRemote("Narvos:JouabiliteErreur", player, Reliability.Reliable, raison)
        return
    end

    JouabiliteServeur.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:ReinitialiserJouabilite", function(player, parametre_id)
    local compte = CompteDe(player)
    if (not compte) then return end

    if (parametre_id == nil or parametre_id == "") then
        Jouabilite.ReinitialiserTout(compte)
    else
        Jouabilite.Reinitialiser(compte, parametre_id)
    end

    JouabiliteServeur.Envoyer(player)
end)

--- Les réglages courants d'un joueur (pour le butin et la marche côté serveur).
--- Sans session : les défauts.
---@param player table
---@return table
function JouabiliteServeur.ReglagesDe(player)
    return Jouabilite.ParCompte(CompteDe(player))
end

return JouabiliteServeur