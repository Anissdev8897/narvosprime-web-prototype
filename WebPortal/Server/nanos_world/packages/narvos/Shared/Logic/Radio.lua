-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Radio.lua — le talkie-walkie : qui entend qui, sur quel canal.
--
-- Câblage : Narvos.Radio = Package.Require("Logic/Radio.lua") dans Shared/Index.lua.
-- Exécutant : `narvos-map-proto/Server/Communications.lua`, appelé par la commande
-- de chat `/radio` (narvos-map-proto/Server/Index.lua).
--
-- ── LA RÈGLE ──────────────────────────────────────────────────────────────────
-- On émet et on entend SEULEMENT si l'on porte l'objet `talkie_walkie` dans son
-- sac. Un message part vers tous les porteurs réglés sur le MÊME canal, dans la
-- MÊME dimension — sans limite de distance : c'est ce qui distingue la radio du
-- chat de proximité. L'émetteur reçoit son propre message (écho) : sans lui, il
-- ne saurait pas si sa radio a transmis.
--
-- PUR : le serveur fournit les FAITS (qui porte l'objet, sur quel canal, dans
-- quelle dimension) ; ce module décide et formate.
-- ═══════════════════════════════════════════════════════════════════════════════

local Radio = {}

local TexteChat = (Narvos and Narvos.TexteChat) or Package.Require("Logic/TexteChat.lua")

--- L'objet de sac qui donne la radio (Items.ITEM_DB, ajouté le 2026-09-13).
Radio.OBJET = "talkie_walkie"

Radio.CANAL_MIN = 1
Radio.CANAL_MAX = 99
Radio.CANAL_DEFAUT = 1

--- Longueur maximale d'un message radio, en caractères.
Radio.LONGUEUR_MAX = 180

--- Un canal valide, ou nil + raison. Accepte le texte (« 12 ») : il arrive du chat.
---@param valeur any
---@return integer|nil, string|nil
function Radio.Canal(valeur)
    local n = tonumber(valeur)
    if (not n) then return nil, "canal illisible" end
    if (n ~= math.floor(n)) then return nil, "le canal est un nombre entier" end
    if (n < Radio.CANAL_MIN or n > Radio.CANAL_MAX) then
        return nil, ("canal entre %d et %d"):format(Radio.CANAL_MIN, Radio.CANAL_MAX)
    end
    return math.floor(n), nil
end

--- Les identifiants qui entendent un message de `emetteur`, dans l'ordre de
--- `auditeurs` — ou nil + raison si l'émetteur ne peut pas émettre.
---
--- Chaque entrée : { id, a_radio = boolean, canal = integer, dimension = integer }.
---@param auditeurs table
---@param emetteur table
---@return table|nil, string|nil
function Radio.Destinataires(auditeurs, emetteur)
    if (type(emetteur) ~= "table" or emetteur.a_radio ~= true) then
        return nil, "il faut un talkie-walkie dans le sac"
    end
    local sortie = {}
    for _, a in ipairs(auditeurs or {}) do
        if (type(a) == "table" and a.a_radio == true
            and a.canal == emetteur.canal and a.dimension == emetteur.dimension) then
            sortie[#sortie + 1] = a.id
        end
    end
    return sortie, nil
end

--- La ligne de chat d'un message radio. Le NOM est nettoyé comme le texte : un
--- nom de personnage ne doit pas pouvoir porter de balise non plus.
---@param nom any
---@param canal integer
---@param texte string  déjà nettoyé par TexteChat.Nettoyer
---@return string
function Radio.Ligne(nom, canal, texte)
    local n = TexteChat.Nettoyer(tostring(nom or "?"), 40) or "?"
    return ("<cyan>[radio %d]</> <yellow>%s</> : %s"):format(canal, n, tostring(texte))
end

return Radio
