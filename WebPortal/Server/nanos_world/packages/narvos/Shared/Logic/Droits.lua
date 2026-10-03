-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Droits.lua — QUI est administrateur. Pur : aucune base, aucun
-- réseau, aucune entité.
--
-- Câblage : Narvos.Droits = Package.Require("Logic/Droits.lua")
--
-- ── LE CRITÈRE : L'IDENTIFIANT STEAM, JAMAIS LE PSEUDO ────────────────────────
-- Mesuré dans `narvos_comptes.db` le 2026-09-10 : la colonne `pseudo` n'est PAS
-- unique (seuls `steam_id` et `identifiant` le sont). Et à la connexion Steam,
-- le pseudo est le NOM D'AFFICHAGE Steam (`Comptes.ConnexionSteam(steam,
-- player:GetName())`) — que n'importe qui choisit en deux clics.
--
-- Un droit accordé au pseudo « Hanibes » serait donc accordé à quiconque
-- s'appelle « Hanibes » sur Steam. L'identifiant Steam, lui, est attesté par
-- Steam et ne se choisit pas.
--
-- ── LA SOURCE : LA CONFIG SERVEUR, PAS LE PACKAGE ─────────────────────────────
-- `Package.toml` est TÉLÉCHARGÉ par chaque client (journal client du 2026-09-10 :
-- « Downloading 103 Package file(s) »). `Config.toml`, lui, ne quitte jamais la
-- machine du serveur. La liste vit dans son `[custom_settings]`, lue par
-- `Server.GetCustomSettings()`.
--
-- ── ⚠ LE PIÈGE DES 64 BITS ────────────────────────────────────────────────────
-- Un identifiant Steam fait 17 chiffres (76561198254124189), au-delà de 2^53.
-- En ENTIER Lua 5.4 il est exact ; converti en FLOTTANT une seule fois, il perd
-- ses derniers chiffres — et il ne correspondrait plus à personne, ou pire, à
-- un voisin. On refuse donc tout identifiant arrivé en flottant, et on compare
-- des CHAÎNES.
-- ═══════════════════════════════════════════════════════════════════════════════

local Droits = {}

-- Un identifiant Steam 64 bits de compte individuel : 17 chiffres, préfixe
-- 7656119. Tout le reste est refusé — y compris un fragment qui « ressemble ».
local MOTIF_STEAM64 = "^7656119%d%d%d%d%d%d%d%d%d%d$"

--- Normalise UNE valeur de config en identifiant Steam, ou nil + raison.
---@param v any
---@return string|nil, string|nil
function Droits.Normaliser(v)
    if (type(v) == "number") then
        if (math.type(v) ~= "integer") then
            -- Le seul cas où la valeur a DÉJÀ été abîmée avant d'arriver ici.
            return nil, "identifiant en flottant (precision perdue) : l'ecrire entre guillemets"
        end
        v = string.format("%d", v)
    end
    if (type(v) ~= "string") then return nil, "type inattendu : " .. type(v) end
    v = v:gsub("^%s+", ""):gsub("%s+$", "")
    if (not v:match(MOTIF_STEAM64)) then
        return nil, "pas un identifiant Steam 64 bits : '" .. v .. "'"
    end
    return v, nil
end

--- L'ensemble des administrateurs déclarés, depuis `custom_settings`.
---
--- Accepte `admins_steam` en tableau ou en chaîne « a,b,c ». Rend l'ensemble
--- ET la liste des valeurs refusées : un identifiant mal écrit doit se VOIR au
--- démarrage, pas se traduire par un « je ne suis pas admin » incompréhensible.
---@param reglages table|nil
---@return table ensemble, table refus
function Droits.Ensemble(reglages)
    local ensemble, refus = {}, {}
    if (type(reglages) ~= "table") then return ensemble, refus end

    local brut = reglages.admins_steam
    local valeurs = {}
    if (type(brut) == "table") then
        valeurs = brut
    elseif (type(brut) == "string") then
        for morceau in brut:gmatch("[^,;%s]+") do valeurs[#valeurs + 1] = morceau end
    elseif (brut ~= nil) then
        refus[#refus + 1] = "admins_steam doit etre une liste ou une chaine"
        return ensemble, refus
    end

    for _, v in ipairs(valeurs) do
        local id, raison = Droits.Normaliser(v)
        if (id) then
            ensemble[id] = true
        else
            refus[#refus + 1] = raison
        end
    end
    return ensemble, refus
end

--- Ce joueur est-il administrateur ?
---@param steam_id any   `player:GetSteamID()` — une chaîne
---@param ensemble table
---@return boolean
function Droits.EstAdmin(steam_id, ensemble)
    if (type(ensemble) ~= "table") then return false end
    local id = Droits.Normaliser(steam_id)
    return (id ~= nil and ensemble[id] == true)
end

--- Nombre d'administrateurs d'un ensemble (pour le journal de démarrage).
function Droits.Compte(ensemble)
    local n = 0
    for _ in pairs(ensemble or {}) do n = n + 1 end
    return n
end

return Droits
