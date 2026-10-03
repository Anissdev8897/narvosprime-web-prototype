-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/TexteChat.lua — ce qu'un joueur a le droit d'écrire dans un canal que le
-- serveur relaie (radio, téléphone).
--
-- Câblage : Narvos.TexteChat = Package.Require("Logic/TexteChat.lua") dans
-- Shared/Index.lua, AVANT Radio et Telephone qui le lisent.
--
-- ── POURQUOI UN MODULE, ET PAS UNE LIGNE DANS CHAQUE SYSTÈME ─────────────────
-- Deux systèmes relaient du texte de joueur (2026-09-13) : la radio et les
-- messages du téléphone. Le nettoyage recopié deux fois divergerait au premier
-- correctif — exactement le mode d'échec des listes recopiées de CLAUDE.md.
--
-- ── CE QUI EST NETTOYÉ, ET POURQUOI ───────────────────────────────────────────
--   · les CHEVRONS : `Chat.SendMessage` de nanos interprète `<cyan>…</>`. Un
--     joueur qui écrit `<red>ADMIN</>` se ferait passer pour le système ;
--   · les retours à la ligne et tabulations : une ligne de chat par message ;
--   · la LONGUEUR, comptée en CARACTÈRES : couper « é » entre ses deux octets
--     rendrait de l'UTF-8 invalide, affiché en losanges.
-- PUR : aucune API nanos.
-- ═══════════════════════════════════════════════════════════════════════════════

local TexteChat = {}

--- Un texte de joueur prêt à être relayé, ou nil + raison.
---@param texte any
---@param max number  longueur maximale, en caractères
---@return string|nil, string|nil
function TexteChat.Nettoyer(texte, max)
    if (type(texte) ~= "string") then return nil, "message vide" end
    local t = texte:gsub("[<>]", ""):gsub("[\r\n\t]", " ")
    t = t:gsub("^%s+", ""):gsub("%s+$", "")
    if (t == "") then return nil, "message vide" end

    local limite = math.floor(tonumber(max) or 0)
    if (limite < 1) then return nil, "longueur maximale invalide" end

    -- Un texte qui n'est PAS de l'UTF-8 valide (octets arbitraires envoyés par un
    -- client modifié) : on garde les seuls octets ASCII imprimables plutôt que
    -- de relayer des octets que les autres clients ne sauraient pas afficher.
    if (utf8.len(t) == nil) then
        t = t:gsub("[^\32-\126]", "")
        if (t == "") then return nil, "message vide" end
    end

    if (utf8.len(t) > limite) then
        t = t:sub(1, utf8.offset(t, limite + 1) - 1)
    end
    return t, nil
end

return TexteChat
