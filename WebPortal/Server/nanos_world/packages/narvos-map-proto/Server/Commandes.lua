-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Commandes.lua — l'écran Échap → Paramètres → Commandes, côté serveur.
--
-- Câblage : Package.Require("Server/Commandes.lua") depuis Server/Index.lua,
-- APRÈS Server/Session.lua (il lit la session pour connaître le compte).
--
-- ── POURQUOI LE SERVEUR TIENT LES TOUCHES ─────────────────────────────────────
-- Une touche pourrait vivre en `localStorage` côté client — c'est plus simple,
-- et faux dès le deuxième poste : le joueur qui se connecte d'ailleurs retrouve
-- les touches d'usine. Le compte est déjà en base, les touches y vont aussi.
--
-- Conséquence : le client ne DÉCIDE rien. Il demande, le serveur valide et
-- renvoie l'état complet. C'est ce qui garantit qu'un client modifié ne peut pas
-- s'attribuer une touche réservée ni écrire dans le compte d'un autre.
-- ═══════════════════════════════════════════════════════════════════════════════

local CommandesServeur = {}

local Commandes = Narvos.Commandes
local Session = Narvos.SessionServeur

--- Le joueur est-il en état d'agir ?
--- Un joueur encore à l'écran de sélection n'a pas de personnage, mais il a un
--- compte : les commandes se règlent donc dès qu'une session existe, pas
--- seulement une fois en jeu.
local function CompteDe(player)
    local s = Session and Session.De(player)
    return s and s.compte and s.compte.id or nil
end

-- ── Touches de déplacement NATIVES, rapportées par le client (2026-09-19) ─────
-- La liste fixe `Commandes.RESERVEES` (W A S D) est QWERTY. Sur un AZERTY
-- français, nanos lie le déplacement à Z Q S D : sans cette table, le joueur
-- AZERTY pourrait réassigner Z et perdre sa marche avant. Le client lit
-- `Input.GetGameKeyBindings()` (les liaisons réelles du moteur sur SA machine)
-- et rapporte les touches de déplacement — le serveur les refuse ensuite à
-- l'assignation, en plus de la liste fixe.
local reservees_par_joueur = {}

Events.SubscribeRemote("Narvos:TouchesReservees", function(player, touches)
    if (type(touches) ~= "table") then return end
    local reservees = {}
    for _, t in ipairs(touches) do
        if (type(t) == "string" and t ~= "") then
            reservees[Commandes.Normaliser(t)] = true
        end
    end
    reservees_par_joueur[player] = reservees
end)

--- Pousse l'état complet des commandes vers le client.
---
--- On envoie la VUE (liste ordonnée, touche courante, défaut, drapeau modifiée)
--- plutôt que la table brute : sans elle, le client devrait refaire la fusion
--- défauts/base et le tri par catégorie, donc porter une seconde fois une
--- logique qui n'a de sens qu'ici.
---@param player table
function CommandesServeur.Envoyer(player)
    local compte = CompteDe(player)

    Events.CallRemote("Narvos:Commandes", player, Reliability.Reliable, {
        actions = Commandes.Vue(compte),
        categories = Commandes.CATEGORIES,
    })
end

Events.SubscribeRemote("Narvos:DemanderCommandes", function(player)
    CommandesServeur.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:DefinirCommande", function(player, action_id, touche)
    -- ⚠ Le compte vient de la SESSION, jamais du client. Sinon un joueur
    -- réécrirait les touches d'un autre.
    local compte = CompteDe(player)
    if (not compte) then return end

    local ok, raison, liberee = Commandes.Definir(compte, action_id, touche,
        reservees_par_joueur[player] or nil)
    if (not ok) then
        Events.CallRemote("Narvos:CommandeErreur", player, Reliability.Reliable, raison)
        return
    end

    -- Une commande dépouillée de sa touche doit être ANNONCÉE. Découvrir plus
    -- tard que l'inventaire ne s'ouvre plus, sans savoir pourquoi, est pire que
    -- le conflit qu'on vient de résoudre.
    if (liberee) then
        local action = Commandes.Trouver(liberee)
        Events.CallRemote("Narvos:CommandeInfo", player, Reliability.Reliable,
            "« " .. ((action and action.label) or liberee) .. " » n'a plus de touche.")
    end

    CommandesServeur.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:ReinitialiserCommande", function(player, action_id)
    local compte = CompteDe(player)
    if (not compte) then return end

    if (action_id == nil or action_id == "") then
        Commandes.ReinitialiserTout(compte)
    else
        Commandes.Reinitialiser(compte, action_id)
    end

    CommandesServeur.Envoyer(player)
end)

return CommandesServeur