-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Ciel.lua — le ciel de chaque monde : les règles, pas le rendu.
--
-- Câblage : Narvos.Ciel = Package.Require("Logic/Ciel.lua")
--
-- ── CE QUI EST ICI, ET CE QUI N'Y EST PAS ─────────────────────────────────────
-- Ici : quel réglage de ciel correspond à quel monde, et ce réglage est-il
-- valide. Pas ici : le moindre appel à `Sky`. La classe `Sky` est une
-- bibliothèque CLIENT (relevé dans la table de bindings du client 1.152.2, sous
-- « Lua Global Client Library ») — l'invoquer ici ferait planter le serveur au
-- chargement du package.
--
-- L'application vit dans `narvos-map-proto/Client/Ciel.lua`, qui consomme les
-- décisions prises ici. Même séparation que `Voyage` : ce fichier se teste hors
-- moteur, sans map, sans joueur et sans ciel.
--
-- ── POURQUOI VALIDER LES NOMS D'ÉNUMÉRATION ───────────────────────────────────
-- C'est le mode d'échec le plus cher du projet, déjà payé sur les morphs : un
-- nom faux N'ÉCHOUE PAS, il est ignoré. `SkyMode.Spce` vaut `nil`, `SetSkyMode`
-- reçoit nil, et le ciel reste celui d'avant — sans une ligne de log. On
-- vérifie donc les noms contre les listes relevées dans le binaire du client,
-- et `Ciel.Verifier` les rend au harnais de test.
--
-- ⚠ Les deux listes ci-dessous sont RELEVÉES, pas supposées : extraites de la
-- table d'énumérations de `NanosWorld-Win64-Shipping.exe` (client 1.152.2), dans
-- l'ordre de déclaration. La doc locale ne les contient pas — elle les injecte
-- depuis `github.com/nanos-world/api` à la compilation du site.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosCiel
local Ciel = {}

local Mondes = (Narvos and Narvos.Mondes) or Package.Require("Catalogs/Mondes.lua")

--- Les modes de ciel d'Ultra Dynamic Sky, tel que nanos les expose.
--- `Space` est celui qui fait de l'orbite autre chose qu'un décor bleu.
Ciel.MODES = {
    "VolumetricClouds",
    "StaticClouds",
    "DynamicClouds2D",
    "NoClouds",
    "VolumetricAurora",
    "Space",
}

--- Les météos. `Foggy` est la brume demandée pour la Tour.
Ciel.METEOS = {
    "ClearSkies",
    "Cloudy",
    "Foggy",
    "Overcast",
    "PartlyCloudy",
    "Rain",
    "RainLight",
    "RainThunderstorm",
    "SandDustCalm",
    "SandDustStorm",
    "Snow",
    "SnowBlizzard",
    "SnowLight",
}

--- Réglage appliqué quand un monde ne déclare pas de ciel. Un monde sans ciel
--- déclaré garde le ciel du monde précédent — c'est-à-dire un ciel faux, choisi
--- pour ailleurs. Mieux vaut un défaut nommé.
Ciel.DEFAUT = {
    mode = "VolumetricClouds",
    meteo = "ClearSkies",
    heure = { 12, 0 },
    nuages = 0.4,
    brume = 0.0,
    intensite_soleil = 1.0,
    luminosite_nuit = 1.0,
    intensite_globale = 1.0,
    transition = 2.0,
}

-- ── Appartenance ──────────────────────────────────────────────────────────────

--- Construit un ensemble indexé par nom. `pairs` n'a pas d'ordre garanti d'une
--- VM à l'autre ; on ne s'en sert donc que pour tester l'appartenance, jamais
--- pour énumérer.
---@param liste table
---@return table
local function ensemble(liste)
    local set = {}
    for _, nom in ipairs(liste) do set[nom] = true end
    return set
end

local MODES_SET = ensemble(Ciel.MODES)
local METEOS_SET = ensemble(Ciel.METEOS)

---@param nom any
---@return boolean
function Ciel.ModeValide(nom)
    return type(nom) == "string" and MODES_SET[nom] == true
end

---@param nom any
---@return boolean
function Ciel.MeteoValide(nom)
    return type(nom) == "string" and METEOS_SET[nom] == true
end

-- ── Bornes ────────────────────────────────────────────────────────────────────

--- Ramène une valeur dans [mini, maxi], en retombant sur `defaut` si ce n'est
--- pas un nombre.
---
--- ⚠ Tester le TYPE avant de comparer. `nil < 0` lève en Lua là où JS compare
--- sans broncher : une valeur absente ferait planter le chargement du package,
--- pas seulement le ciel.
---@param valeur any
---@param mini number
---@param maxi number
---@param defaut number
---@return number
local function borner(valeur, mini, maxi, defaut)
    if (type(valeur) ~= "number") then return defaut end
    if (valeur ~= valeur) then return defaut end -- NaN
    if (valeur < mini) then return mini end
    if (valeur > maxi) then return maxi end
    return valeur
end

--- Normalise un couple heure/minute. `SetTimeOfDay` prend deux ENTIERS.
---@param heure any
---@return integer, integer
local function normaliser_heure(heure)
    if (type(heure) ~= "table") then return 12, 0 end
    local h = borner(heure[1], 0, 23, 12)
    local m = borner(heure[2], 0, 59, 0)
    return math.floor(h), math.floor(m)
end

-- ── Résolution ────────────────────────────────────────────────────────────────

--- Le réglage de ciel d'un monde, complété par les défauts et borné.
---
--- Rend TOUJOURS une table exploitable : un monde inconnu ou sans ciel déclaré
--- reçoit `Ciel.DEFAUT`. Le client n'a donc jamais à décider quoi faire d'un nil,
--- et un monde ajouté sans ciel ne laisse pas le précédent en place.
---@param monde_id any
---@return table
function Ciel.Reglages(monde_id)
    local monde = Mondes.Trouver(monde_id)
    local brut = (type(monde) == "table" and type(monde.ciel) == "table") and monde.ciel or {}
    local d = Ciel.DEFAUT

    local h, m = normaliser_heure(brut.heure or d.heure)

    return {
        monde = (type(monde) == "table") and monde.id or nil,
        mode = Ciel.ModeValide(brut.mode) and brut.mode or d.mode,
        meteo = Ciel.MeteoValide(brut.meteo) and brut.meteo or d.meteo,
        heures = h,
        minutes = m,
        nuages = borner(brut.nuages, 0.0, 1.0, d.nuages),
        brume = borner(brut.brume, 0.0, 1.0, d.brume),
        intensite_soleil = borner(brut.intensite_soleil, 0.0, 20.0, d.intensite_soleil),
        luminosite_nuit = borner(brut.luminosite_nuit, 0.0, 10.0, d.luminosite_nuit),
        intensite_globale = borner(brut.intensite_globale, 0.0, 10.0, d.intensite_globale),
        -- Une valeur explicitement nulle est LÉGITIME : une transition
        -- instantanée est ce qu'on veut à la connexion. On borne sans forcer.
        transition = borner(brut.transition, 0.0, 30.0, d.transition),
        echelle_lune = borner(brut.echelle_lune, 0.0, 50.0, 1.0),
        -- L'espace n'a pas de météo. Le drapeau évite au client de redécouvrir
        -- cette règle en comparant des chaînes.
        sans_meteo = brut.mode == "Space",
    }
end

-- ── Vérification, pour le harnais ─────────────────────────────────────────────

--- Relit TOUS les mondes et rend la liste des défauts trouvés.
---
--- C'est ce que le harnais appelle. Un nom d'énumération faux étant silencieux à
--- l'exécution, le seul endroit où il peut encore faire du bruit est ici.
---@return table listes des problèmes, vide si tout va bien
function Ciel.Verifier()
    local problemes = {}
    for _, monde in ipairs(Mondes.MONDES) do
        local c = monde.ciel
        if (type(c) ~= "table") then
            problemes[#problemes + 1] = monde.id .. " : aucun ciel declare"
        else
            if (not Ciel.ModeValide(c.mode)) then
                problemes[#problemes + 1] = monde.id .. " : mode inconnu " .. tostring(c.mode)
            end
            -- L'espace se passe de météo ; ailleurs, une météo absente ou fausse
            -- retomberait en silence sur ClearSkies.
            if (c.mode ~= "Space" and not Ciel.MeteoValide(c.meteo)) then
                problemes[#problemes + 1] = monde.id .. " : meteo inconnue " .. tostring(c.meteo)
            end
        end
    end
    return problemes
end

return Ciel
