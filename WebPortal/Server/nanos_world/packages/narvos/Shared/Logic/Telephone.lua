-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Telephone.lua — le smartphone : applications, messages, contacts.
--
-- Câblage : Narvos.Telephone = Package.Require("Logic/Telephone.lua") dans
-- Shared/Index.lua. Exécutant : `narvos-map-proto/Server/Communications.lua`,
-- panneau WebUI `telephone` (touche « menu_telephone », F7 par défaut).
--
-- ── CE QUE LE TÉLÉPHONE FAIT ──────────────────────────────────────────────────
--   · Carte    — dessine les données du radar existant (`Narvos:Radar`, filtrées
--                par `Logic/Radar.lua`) dans l'écran du téléphone : une seconde
--                VUE, pas un second radar ;
--   · Messages — un message privé d'un porteur de téléphone à un autre, en ligne ;
--   · Contacts — les joueurs connectés, joignables ou non.
-- Il faut porter l'objet `smartphone` pour ouvrir le téléphone ET pour recevoir.
--
-- ── ⚠ LES MESSAGES SONT DE SESSION ────────────────────────────────────────────
-- La boîte vit en mémoire du serveur : elle ne survit ni à la déconnexion ni au
-- redémarrage. La persister demande une table et une décision de rétention —
-- dit, pas caché.
--
-- PUR, ET IMMUABLE : `Deposer` et `MarquerLus` rendent une NOUVELLE boîte.
-- ═══════════════════════════════════════════════════════════════════════════════

local Telephone = {}

local TexteChat = (Narvos and Narvos.TexteChat) or Package.Require("Logic/TexteChat.lua")

--- L'objet de sac qui donne le téléphone (Items.ITEM_DB, ajouté le 2026-09-13).
Telephone.OBJET = "smartphone"

--- Messages gardés par boîte : les plus anciens partent en premier.
Telephone.BOITE_MAX = 50

--- Longueur maximale d'un message, en caractères.
Telephone.LONGUEUR_MAX = 280

--- Les applications, dans l'ordre de l'écran d'accueil.
Telephone.APPLICATIONS = {
    { id = "carte", label = "Carte" },
    { id = "messages", label = "Messages" },
    { id = "contacts", label = "Contacts" },
}

--- Une boîte vide.
---@return table
function Telephone.NouvelleBoite()
    return { messages = {} }
end

local function copier(message)
    return { de = message.de, texte = message.texte, quand = message.quand, lu = message.lu == true }
end

--- Une NOUVELLE boîte portant le message en plus, non lu, plafonnée.
---@param boite table
---@param message table  { de, texte, quand }
---@return table
function Telephone.Deposer(boite, message)
    local anciens = (type(boite) == "table" and type(boite.messages) == "table") and boite.messages or {}
    local depart = math.max(1, #anciens + 1 - (Telephone.BOITE_MAX - 1))
    local sortie = {}
    for i = depart, #anciens do sortie[#sortie + 1] = copier(anciens[i]) end
    sortie[#sortie + 1] = { de = message.de, texte = message.texte, quand = message.quand, lu = false }
    return { messages = sortie }
end

--- Une NOUVELLE boîte où tout est lu.
---@param boite table
---@return table
function Telephone.MarquerLus(boite)
    local sortie = {}
    for _, m in ipairs((boite and boite.messages) or {}) do
        local c = copier(m)
        c.lu = true
        sortie[#sortie + 1] = c
    end
    return { messages = sortie }
end

--- Combien de messages non lus.
---@param boite table
---@return integer
function Telephone.NonLus(boite)
    local n = 0
    for _, m in ipairs((boite and boite.messages) or {}) do
        if (not m.lu) then n = n + 1 end
    end
    return n
end

--- L'expéditeur peut-il écrire au destinataire ? Rend true, ou false + raison.
---
--- expediteur   : { id, nom, a_telephone }
--- destinataire : { id, nom, a_telephone, en_ligne } ou nil (inconnu)
---@return boolean, string|nil
function Telephone.PeutEnvoyer(expediteur, destinataire)
    if (type(expediteur) ~= "table" or expediteur.a_telephone ~= true) then
        return false, "il faut un smartphone dans le sac"
    end
    if (type(destinataire) ~= "table") then return false, "destinataire inconnu" end
    if (destinataire.id == expediteur.id) then return false, "on ne s'ecrit pas a soi-meme" end
    if (destinataire.en_ligne ~= true) then return false, "destinataire deconnecte" end
    if (destinataire.a_telephone ~= true) then return false, "destinataire hors reseau (pas de smartphone)" end
    return true, nil
end

--- Les contacts : tous les joueurs sauf soi, triés par nom (casse ignorée).
---
--- joueurs : séquence de { id, nom, a_telephone }
---@param joueurs table
---@param moi_id any
---@return table  séquence de { id, nom, joignable }
function Telephone.Contacts(joueurs, moi_id)
    local sortie = {}
    for _, j in ipairs(joueurs or {}) do
        if (type(j) == "table" and j.id ~= moi_id) then
            sortie[#sortie + 1] = {
                id = j.id,
                nom = TexteChat.Nettoyer(tostring(j.nom or "?"), 40) or "?",
                joignable = j.a_telephone == true,
            }
        end
    end
    table.sort(sortie, function(a, b)
        local na, nb = a.nom:lower(), b.nom:lower()
        if (na == nb) then return tostring(a.id) < tostring(b.id) end
        return na < nb
    end)
    return sortie
end

return Telephone
