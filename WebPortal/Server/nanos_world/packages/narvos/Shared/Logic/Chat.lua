-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Chat.lua — chat in-game (port PUR de chat/chatStore.ts).
--
-- SOURCE : WebPortal/src/rpg/chat/chatStore.ts. État immuable (transactions →
-- nouvel état). `id`/`timestamp` sont INJECTÉS (le TS utilise Date.now()+
-- Math.random() — runtime) ; le contenu (sender, text, type) est la donnée
-- portée. Dispatch de commandes `/` vers des handlers injectés.
-- ═══════════════════════════════════════════════════════════════════════════════

local Chat = {}

Chat.MAX_MESSAGES = 200

function Chat.Nouveau()
    return { messages = {}, commandes = {}, max = Chat.MAX_MESSAGES }
end

local function cloner(etat)
    local e = { messages = {}, commandes = {}, max = etat.max or Chat.MAX_MESSAGES }
    for k, v in pairs(etat.commandes) do e.commandes[k] = v end
    for _, m in ipairs(etat.messages) do
        e.messages[#e.messages + 1] = { id = m.id, expediteur = m.expediteur, texte = m.texte, horodatage = m.horodatage, type = m.type }
    end
    return e
end

local function ajouter(etat, partial, id, horodatage)
    local e = cloner(etat)
    e.messages[#e.messages + 1] = { id = id, expediteur = partial.expediteur, texte = partial.texte, horodatage = horodatage, type = partial.type }
    -- purge si dépasse la capacité
    if (#e.messages > e.max) then
        local trop = #e.messages - e.max
        local nouveau = {}
        for i = trop + 1, #e.messages do nouveau[#nouveau + 1] = e.messages[i] end
        e.messages = nouveau
    end
    return e
end

function Chat.EnregistrerCommande(etat, nom, handler)
    local e = cloner(etat)
    e.commandes[string.lower(nom)] = handler
    return e
end

function Chat.NomsCommandes(etat)
    local noms = {}
    for k in pairs(etat.commandes) do noms[#noms + 1] = k end
    table.sort(noms)
    return noms
end

-- Point d'entrée principal : envoie un message ou exécute une commande `/`.
-- Retourne { etat, traite = "commande"|"message"|"inconnu", son = ... }.
function Chat.Envoyer(etat, expediteur, texte, id, horodatage)
    local t = tostring(texte or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if (t == "") then return { etat = etat, traite = "message" } end
    if (t:sub(1, 1) == "/") then
        local pos = t:find(" ")
        local cmd, args
        if (pos) then cmd = t:sub(2, pos - 1); args = t:sub(pos + 1):gsub("^%s+", ""):gsub("%s+$", "") else cmd = t:sub(2); args = "" end
        local handler = etat.commandes[string.lower(cmd)]
        if (handler) then
            handler(args)
            return { etat = etat, traite = "commande", son = args }
        end
        -- commande inconnue → message d'erreur
        local e = ajouter(etat, { expediteur = "Systeme", texte = "Commande inconnue : /" .. cmd, type = "error" }, id, horodatage)
        return { etat = e, traite = "inconnu", son = cmd }
    end
    local e = ajouter(etat, { expediteur = expediteur, texte = t, type = "player" }, id, horodatage)
    return { etat = e, traite = "message" }
end

function Chat.Systeme(etat, texte, id, horodatage) return ajouter(etat, { expediteur = "Systeme", texte = texte, type = "system" }, id, horodatage) end
function Chat.Admin(etat, texte, id, horodatage) return ajouter(etat, { expediteur = "Admin", texte = texte, type = "admin" }, id, horodatage) end
function Chat.Erreur(etat, texte, id, horodatage) return ajouter(etat, { expediteur = "Systeme", texte = texte, type = "error" }, id, horodatage) end

function Chat.Messages(etat) return etat.messages end
function Chat.Vider(etat) local e = cloner(etat); e.messages = {}; return e end

return Chat