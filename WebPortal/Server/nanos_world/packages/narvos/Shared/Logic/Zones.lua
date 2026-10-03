-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Zones.lua — QUI a le droit d'éditer OÙ.
--
-- Câblage : Narvos.Zones = Package.Require("Logic/Zones.lua") dans Shared/Index.lua
--
-- ── PUR ET PROUVABLE ──────────────────────────────────────────────────────────
-- Aucun appel à l'API nanos, aucune lecture de base. Le module reçoit une LISTE
-- de zones et un CONTEXTE, et rend une décision. `Server/Zones.lua` s'occupe de
-- la persistance ; ici on ne fait que décider, ce qui rend la règle testable
-- sans moteur ni base.
--
-- ── LA RÈGLE, EN UNE PHRASE ───────────────────────────────────────────────────
-- Un admin édite partout. Un joueur n'édite QUE dans une zone de type `joueur`
-- dont il est propriétaire. **Hors de toute zone, personne n'édite sauf un
-- admin** — c'est le monde général, et c'est le défaut le plus important de ce
-- fichier : il refuse par ABSENCE de droit, jamais par présence d'interdit.
--
-- Une liste d'interdits laisse passer tout ce qu'on a oublié d'y mettre. Une
-- liste de permissions ne laisse passer que ce qu'on a nommé. Le premier modèle
-- se troue à chaque nouvelle map ; le second non.
--
-- ── POURQUOI PAS UN SIMPLE BOOLÉEN `peut_editer` SUR LE COMPTE ────────────────
-- Parce que la question n'est pas « ce joueur a-t-il le droit d'éditer », mais
-- « a-t-il le droit d'éditer ICI ». Un booléen sur le compte donnerait à un
-- propriétaire de maison le droit de déplacer le spatioport.
--
-- ── CE QUE `Trouver` REND QUAND DEUX ZONES SE CHEVAUCHENT ─────────────────────
-- La PLUS PETITE. Une maison posée dans une zone administrative doit rester la
-- maison de son propriétaire ; prendre la première trouvée dépendrait de l'ordre
-- d'insertion en base, c'est-à-dire du hasard.
--
-- ── PIÈGES LUA TRAITÉS ICI ────────────────────────────────────────────────────
--   · Les zones viennent de la BASE, donc de l'extérieur : un champ peut être
--     absent, d'un mauvais type, ou `nil`. `nil < 0` LÈVE en Lua là où JS
--     compare. On valide le type AVANT toute comparaison.
--   · Un champ à `nil` disparaît de la table : `proprietaire = nil` est
--     indistinguable de « jamais renseigné ». Une zone sans propriétaire est
--     donc marquée par son TYPE, pas par l'absence du champ.
--   · `pairs` n'a pas d'ordre garanti et n'a pas le même d'une VM à l'autre :
--     on itère `ipairs` sur une séquence, jamais `pairs` sur les zones.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosZones
local Zones = {}

-- ── Les types de zone ─────────────────────────────────────────────────────────
--
-- Le type dit QUI peut y prétendre, pas qui la possède aujourd'hui.
--
--   `joueur` — maison, atelier, parcelle : éditable par son propriétaire.
--   `admin`  — spatioport, zone de spawn, décor structurant : admin seulement,
--              MÊME si un `proprietaire` y traîne (donnée héritée, bug d'import).
--   `libre`  — bac à sable explicitement ouvert. Tout joueur en jeu y édite.
--              N'existe que si quelqu'un le crée : il n'y en a aucun par défaut.
Zones.TYPES = { "joueur", "admin", "libre" }

--- Vrai si `valeur` est un type de zone connu.
--- Une zone d'un type inconnu (faute de frappe, colonne ajoutée puis retirée)
--- ne doit PAS se comporter comme `libre` par accident.
---@param valeur any
---@return boolean
function Zones.TypeValide(valeur)
    if (type(valeur) ~= "string") then return false end
    for _, t in ipairs(Zones.TYPES) do
        if (t == valeur) then return true end
    end
    return false
end

-- ── Les formes ────────────────────────────────────────────────────────────────
--
-- Deux suffisent. Une sphère se décrit en un nombre et convient à une maison ou
-- un checkpoint ; une boîte alignée convient à un bâtiment rectangulaire. On
-- n'ajoute pas de forme orientée tant que personne n'en a eu besoin — une forme
-- qu'on ne sait pas dessiner à l'écran ne sert à rien.

local function nombre(v)
    return (type(v) == "number" and v == v) and v or nil   -- v ~= v écarte NaN
end

--- Le point est-il dans la zone ?
--- ⚠ Rend `false` sur toute zone mal formée, jamais une erreur : ces données
--- viennent de la base, et une ligne corrompue ne doit pas tuer la partie.
---@param zone table
---@param monde_id string
---@param x number @y number @z number
---@return boolean
function Zones.Contient(zone, monde_id, x, y, z)
    if (type(zone) ~= "table") then return false end
    if (zone.monde ~= monde_id) then return false end

    local zx, zy, zz = nombre(zone.x), nombre(zone.y), nombre(zone.z)
    local px, py, pz = nombre(x), nombre(y), nombre(z)
    if (not zx or not zy or not zz or not px or not py or not pz) then return false end

    if (zone.forme == "boite") then
        local dx, dy, dz = nombre(zone.dx), nombre(zone.dy), nombre(zone.dz)
        if (not dx or not dy or not dz) then return false end
        return math.abs(px - zx) <= dx
           and math.abs(py - zy) <= dy
           and math.abs(pz - zz) <= dz
    end

    -- Défaut : sphère. Une zone sans `forme` lisible est traitée en sphère si
    -- elle porte un rayon — mais une zone sans rayon NON PLUS n'est pas « tout
    -- l'univers » : elle ne contient rien.
    local r = nombre(zone.rayon)
    if (not r or r <= 0) then return false end
    local ex, ey, ez = px - zx, py - zy, pz - zz
    return (ex * ex + ey * ey + ez * ez) <= (r * r)
end

--- Le volume d'une zone, pour départager deux zones qui se chevauchent.
--- Sert UNIQUEMENT à comparer : l'unité n'a pas d'importance, seule la relation
--- d'ordre compte.
---@param zone table
---@return number
local function Volume(zone)
    if (zone.forme == "boite") then
        local dx, dy, dz = nombre(zone.dx) or 0, nombre(zone.dy) or 0, nombre(zone.dz) or 0
        return 8 * dx * dy * dz
    end
    local r = nombre(zone.rayon) or 0
    return (4 / 3) * math.pi * r * r * r
end

--- La zone la PLUS PETITE qui contienne le point, ou nil.
---@param zones table  @séquence 1..n
---@param monde_id string
---@param x number @y number @z number
---@return table|nil
function Zones.Trouver(zones, monde_id, x, y, z)
    if (type(zones) ~= "table") then return nil end
    local meilleure, meilleur_volume = nil, nil
    for _, zone in ipairs(zones) do
        if (Zones.Contient(zone, monde_id, x, y, z)) then
            local v = Volume(zone)
            if (not meilleure or v < meilleur_volume) then
                meilleure, meilleur_volume = zone, v
            end
        end
    end
    return meilleure
end

-- ── La décision ───────────────────────────────────────────────────────────────

--- Ce joueur peut-il éditer à cet endroit ?
---
--- `contexte` : { compte_id = number|string, est_admin = boolean }
---
--- Rend `true` seul, ou `false, raison`. La RAISON est destinée au joueur : un
--- refus muet se lit comme un bug, et il a coûté assez cher sur ce projet.
---@param zones table
---@param monde_id string
---@param x number @y number @z number
---@param contexte table
---@return boolean, string|nil
function Zones.PeutEditer(zones, monde_id, x, y, z, contexte)
    contexte = (type(contexte) == "table") and contexte or {}

    -- L'admin passe avant toute recherche de zone : c'est le sens d'« accès à
    -- toutes les fonctions, y compris celles qui ne sont pas accessibles à un
    -- joueur lambda ».
    if (contexte.est_admin == true) then return true end

    local zone = Zones.Trouver(zones, monde_id, x, y, z)

    -- ⚠ LE CAS QUI PORTE TOUT LE MODÈLE. Hors de toute zone, c'est la map
    -- générale : un joueur n'y touche pas. Rendre `true` ici ouvrirait le monde
    -- entier à quiconque, et aucun test de zone ne le rattraperait.
    if (not zone) then
        return false, "Hors de vos zones : la map generale est reservee aux admins"
    end

    if (not Zones.TypeValide(zone.type)) then
        return false, "Zone de type inconnu — editon refusee par prudence"
    end

    if (zone.type == "admin") then
        return false, "Zone administrative"
    end

    if (zone.type == "libre") then
        return true
    end

    -- Reste `joueur` : il faut en être propriétaire.
    -- ⚠ On compare en CHAÎNE. Le `compte_id` vient tantôt de SQLite (INTEGER),
    -- tantôt d'un événement réseau (string) : `1 == "1"` est FAUX en Lua, et le
    -- propriétaire se verrait refuser sa propre maison sans qu'aucune erreur ne
    -- soit levée.
    local proprio = zone.proprietaire
    if (proprio == nil) then
        return false, "Zone sans proprietaire"
    end
    if (tostring(proprio) ~= tostring(contexte.compte_id)) then
        return false, "Cette zone ne vous appartient pas"
    end
    return true
end

--- Les zones qu'un joueur peut éditer, pour les lui montrer.
--- Un admin voit tout : on rend la liste telle quelle plutôt qu'une copie
--- filtrée, l'appelant n'a pas à savoir laquelle des deux il tient.
---@param zones table
---@param contexte table
---@return table
function Zones.Siennes(zones, contexte)
    if (type(zones) ~= "table") then return {} end
    contexte = (type(contexte) == "table") and contexte or {}
    if (contexte.est_admin == true) then return zones end

    local sortie = {}
    for _, zone in ipairs(zones) do
        local a_lui = (zone.type == "joueur")
            and zone.proprietaire ~= nil
            and tostring(zone.proprietaire) == tostring(contexte.compte_id)
        if (a_lui or zone.type == "libre") then
            sortie[#sortie + 1] = zone
        end
    end
    return sortie
end

return Zones
