-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Teleports.lua — les POINTS DE TÉLÉPORTATION, purs : créer, nommer,
-- déplacer, relier, résoudre une destination, sérialiser.
--
-- Câblage (Shared/Index.lua), APRÈS son catalogue :
--   Narvos.TeleportsCatalogue = Package.Require("Catalogs/Teleports.lua")
--   Narvos.Teleports          = Package.Require("Logic/Teleports.lua")
-- ⚠ Deux modules, deux noms — le piège `Animaux`/`AnimauxCatalogue`.
--
-- ── À QUOI ÇA SERT ─────────────────────────────────────────────────────────────
-- Un point devant un bâtiment envoie à l'intérieur ; son point « retour » ramène
-- dehors. GÉNÉRIQUE : un point porte son MONDE et des coordonnées LOCALES à ce
-- monde (même règle que Server/Export.lua), il sert donc dans toutes les maps.
--
-- ── LA FORME D'UN POINT ───────────────────────────────────────────────────────
--   { id, nom, monde, x, y, z, yaw, rayon,
--     vers = "autre_id"                    -- destination : un AUTRE point
--     dest = { monde, x, y, z, yaw } }     -- OU une position libre
-- Un point sans destination existe (on le pose d'abord, on le relie ensuite) :
-- il se voit, et refuse le passage EN LE DISANT.
--
-- Aucune entité ici : Server/Teleports.lua pose les déclencheurs, téléporte et
-- écrit le catalogue. Chaque fonction rend une liste NEUVE.
-- ═══════════════════════════════════════════════════════════════════════════════

local Teleports = {}

Teleports.NOM_MAX = 48
Teleports.RAYON_DEFAUT = 150.0     -- cm : on entre dans le cercle, pas à côté
Teleports.RAYON_MIN = 50.0
Teleports.RAYON_MAX = 1000.0
Teleports.COORD_MAX = 10000000.0   -- 100 km : au-delà, une coordonnée est une erreur
--- À l'arrivée sur un AUTRE point, on se pose devant lui, hors de son cercle :
--- arriver au centre ferait réapparaître aussitôt l'invite du retour.
Teleports.RECUL_ARRIVEE = 60.0

-- Majuscules et minuscules accentuées -> ASCII, pour fabriquer un identifiant.
local ACCENTS = {
    ["à"] = "a", ["â"] = "a", ["ä"] = "a", ["À"] = "a", ["Â"] = "a",
    ["é"] = "e", ["è"] = "e", ["ê"] = "e", ["ë"] = "e", ["É"] = "e", ["È"] = "e", ["Ê"] = "e",
    ["î"] = "i", ["ï"] = "i", ["Î"] = "i", ["ô"] = "o", ["ö"] = "o", ["Ô"] = "o",
    ["ù"] = "u", ["û"] = "u", ["ü"] = "u", ["Û"] = "u", ["ç"] = "c", ["Ç"] = "c",
}

local function Fini(v)
    return type(v) == "number" and v == v and v > -math.huge and v < math.huge
end

local function Entier(v)
    return math.floor((tonumber(v) or 0) + 0.5)
end

local function BornerRayon(r)
    r = tonumber(r)
    if (not Fini(r)) then r = Teleports.RAYON_DEFAUT end
    return math.max(Teleports.RAYON_MIN, math.min(Teleports.RAYON_MAX, r))
end

--- Une position valide { monde, x, y, z, yaw }, ou nil et la raison.
local function Position(t)
    if (type(t) ~= "table" or type(t.monde) ~= "string" or t.monde == "") then
        return nil, "monde manquant"
    end
    if (not t.monde:match("^[%w_]+$")) then return nil, "monde invalide" end
    for _, v in ipairs({ t.x, t.y, t.z }) do
        if (not Fini(v) or math.abs(v) > Teleports.COORD_MAX) then return nil, "position invalide" end
    end
    local yaw = tonumber(t.yaw) or 0
    if (not Fini(yaw)) then yaw = 0 end
    return { monde = t.monde, x = t.x, y = t.y, z = t.z, yaw = ((yaw + 180) % 360) - 180 }
end

--- Un nom propre : sans caractère de contrôle, sans blancs aux bords, UTF-8
--- valide, au plus NOM_MAX caractères. nil s'il ne reste rien.
---@param nom any
---@return string|nil
function Teleports.NettoyerNom(nom)
    if (type(nom) ~= "string") then return nil end
    local s = nom:gsub("%c", ""):gsub("^%s+", ""):gsub("%s+$", "")
    if (s == "" or utf8.len(s) == nil) then return nil end
    if (utf8.len(s) > Teleports.NOM_MAX) then
        s = s:sub(1, utf8.offset(s, Teleports.NOM_MAX + 1) - 1)
    end
    return s
end

--- Un identifiant stable tiré du nom : [a-z0-9_], 32 caractères au plus.
---@param nom any
---@return string
function Teleports.Slug(nom)
    local s = tostring(nom or ""):lower()
    for accent, lettre in pairs(ACCENTS) do s = s:gsub(accent, lettre) end
    s = s:gsub("[^%w]+", "_"):gsub("^_+", ""):gsub("_+$", "")
    if (s == "") then s = "tp" end
    return s:sub(1, 32)
end

local function CopierPoint(p)
    local c = {}
    for k, v in pairs(p) do c[k] = v end
    if (type(p.dest) == "table") then
        c.dest = { monde = p.dest.monde, x = p.dest.x, y = p.dest.y, z = p.dest.z, yaw = p.dest.yaw }
    end
    return c
end

--- Copie PROFONDE d'une liste de points.
function Teleports.Copier(liste)
    local sortie = {}
    for i, p in ipairs(liste or {}) do sortie[i] = CopierPoint(p) end
    return sortie
end

--- Un point par son identifiant, et son rang.
---@return table|nil, integer|nil
function Teleports.Trouver(liste, id)
    for i, p in ipairs(liste or {}) do
        if (p.id == id) then return p, i end
    end
    return nil
end

--- Crée un point. Rend (liste neuve, id) ou (nil, raison).
---@param champs table  { nom, monde, x, y, z, yaw, rayon? }
function Teleports.Creer(liste, champs)
    champs = champs or {}
    local nom = Teleports.NettoyerNom(champs.nom)
    if (not nom) then return nil, "nom vide ou invalide" end
    local pos, raison = Position(champs)
    if (not pos) then return nil, raison end

    local base = Teleports.Slug(nom)
    local id, n = base, 1
    while (Teleports.Trouver(liste, id)) do
        n = n + 1
        id = base .. "_" .. n
    end

    local neuve = Teleports.Copier(liste)
    neuve[#neuve + 1] = {
        id = id, nom = nom, monde = pos.monde, x = pos.x, y = pos.y, z = pos.z,
        yaw = pos.yaw, rayon = BornerRayon(champs.rayon),
    }
    return neuve, id
end

--- Renomme un point (l'identifiant, lui, ne change pas : les liens tiennent).
function Teleports.Renommer(liste, id, nom)
    local _, i = Teleports.Trouver(liste, id)
    if (not i) then return nil, "point inconnu : " .. tostring(id) end
    local propre = Teleports.NettoyerNom(nom)
    if (not propre) then return nil, "nom vide ou invalide" end
    local neuve = Teleports.Copier(liste)
    neuve[i].nom = propre
    return neuve
end

--- Déplace un point. `champs` = { monde, x, y, z, yaw, rayon? }.
function Teleports.Deplacer(liste, id, champs)
    local _, i = Teleports.Trouver(liste, id)
    if (not i) then return nil, "point inconnu : " .. tostring(id) end
    local pos, raison = Position(champs)
    if (not pos) then return nil, raison end
    local neuve = Teleports.Copier(liste)
    local p = neuve[i]
    p.monde, p.x, p.y, p.z, p.yaw = pos.monde, pos.x, pos.y, pos.z, pos.yaw
    if (champs.rayon ~= nil) then p.rayon = BornerRayon(champs.rayon) end
    return neuve
end

--- Donne une destination : `{ vers = autre_id }` ou une position libre.
function Teleports.DefinirDestination(liste, id, dest)
    local _, i = Teleports.Trouver(liste, id)
    if (not i) then return nil, "point inconnu : " .. tostring(id) end
    local neuve = Teleports.Copier(liste)
    if (type(dest) == "table" and type(dest.vers) == "string") then
        if (dest.vers == id) then return nil, "un point ne peut pas mener a lui-meme" end
        if (not Teleports.Trouver(liste, dest.vers)) then
            return nil, "destination inconnue : " .. dest.vers
        end
        neuve[i].vers, neuve[i].dest = dest.vers, nil
        return neuve
    end
    local pos, raison = Position(dest)
    if (not pos) then return nil, raison end
    neuve[i].dest, neuve[i].vers = pos, nil
    return neuve
end

--- Supprime un point, et ce qui menait à lui : un lien vers un point disparu
--- enverrait nulle part.
function Teleports.Supprimer(liste, id)
    local _, i = Teleports.Trouver(liste, id)
    if (not i) then return nil, "point inconnu : " .. tostring(id) end
    local neuve = {}
    for _, p in ipairs(liste) do
        if (p.id ~= id) then
            local c = CopierPoint(p)
            if (c.vers == id) then c.vers = nil end
            neuve[#neuve + 1] = c
        end
    end
    return neuve
end

--- Relie un point à son RETOUR. Deux cas :
---   · il mène déjà à un autre point : celui-ci mènera en retour à lui ;
---   · il mène à une position libre : on y crée le point retour, et les deux
---     deviennent une paire (chacun mène à l'autre).
--- Rend (liste neuve, id du retour) ou (nil, raison).
function Teleports.Lier(liste, id, nom_retour)
    local p = Teleports.Trouver(liste, id)
    if (not p) then return nil, "point inconnu : " .. tostring(id) end

    if (p.vers) then
        local cible, j = Teleports.Trouver(liste, p.vers)
        if (not cible) then return nil, "destination disparue : " .. p.vers end
        if (cible.vers == id) then return nil, "deja relies" end
        local neuve = Teleports.Copier(liste)
        neuve[j].vers, neuve[j].dest = id, nil
        return neuve, cible.id
    end

    if (not p.dest) then return nil, "definir d'abord la destination de ce point" end
    local neuve, retour = Teleports.Creer(liste, {
        nom = nom_retour or ("Retour - " .. p.nom),
        monde = p.dest.monde, x = p.dest.x, y = p.dest.y, z = p.dest.z,
        yaw = p.dest.yaw, rayon = p.rayon,
    })
    if (not neuve) then return nil, retour end
    local _, i = Teleports.Trouver(neuve, id)
    local _, j = Teleports.Trouver(neuve, retour)
    neuve[j].vers = id
    neuve[i].vers, neuve[i].dest = retour, nil
    return neuve, retour
end

--- Où mène ce point : { monde, x, y, z, yaw }, ou (nil, raison NOMMÉE).
function Teleports.Destination(liste, id)
    local p = Teleports.Trouver(liste, id)
    if (not p) then return nil, "point inconnu : " .. tostring(id) end
    if (p.vers) then
        local c = Teleports.Trouver(liste, p.vers)
        if (not c) then return nil, "destination disparue : " .. p.vers end
        local a = math.rad(c.yaw or 0)
        local d = (c.rayon or Teleports.RAYON_DEFAUT) + Teleports.RECUL_ARRIVEE
        return { monde = c.monde, x = c.x + math.cos(a) * d, y = c.y + math.sin(a) * d,
                 z = c.z, yaw = c.yaw or 0 }
    end
    if (p.dest) then
        return { monde = p.dest.monde, x = p.dest.x, y = p.dest.y, z = p.dest.z, yaw = p.dest.yaw or 0 }
    end
    return nil, tostring(p.nom) .. " n'a pas encore de destination"
end

--- Relit le catalogue. Rend (liste, refus) : une entrée mal formée est ÉCARTÉE
--- et nommée, jamais posée à moitié.
function Teleports.Charger(catalogue)
    local liste, refus = {}, {}
    local brut = (type(catalogue) == "table" and type(catalogue.LISTE) == "table") and catalogue.LISTE or {}
    for i, e in ipairs(brut) do
        local nom = (type(e) == "table") and Teleports.NettoyerNom(e.nom) or nil
        local pos = (type(e) == "table") and Position(e) or nil
        local id = (type(e) == "table") and e.id or nil
        if (type(id) ~= "string" or not id:match("^[%w_]+$") or not nom or not pos
            or Teleports.Trouver(liste, id)) then
            refus[#refus + 1] = "entree " .. i .. " ecartee (" .. tostring(id) .. ")"
        else
            local p = { id = id, nom = nom, monde = pos.monde, x = pos.x, y = pos.y, z = pos.z,
                        yaw = pos.yaw, rayon = BornerRayon(e.rayon) }
            if (type(e.vers) == "string") then
                p.vers = e.vers
            elseif (type(e.dest) == "table") then
                p.dest = Position(e.dest)
            end
            liste[#liste + 1] = p
        end
    end
    for _, p in ipairs(liste) do
        if (p.vers and not Teleports.Trouver(liste, p.vers)) then
            refus[#refus + 1] = p.id .. " : destination inconnue " .. p.vers
            p.vers = nil
        end
    end
    return liste, refus
end

--- Le fichier catalogue ENTIER, prêt à écrire. Ordre par identifiant : deux
--- exports de la même liste donnent le même fichier, donc un diff lisible.
---@param liste table
---@return string
function Teleports.Catalogue(liste)
    local tri = Teleports.Copier(liste)
    table.sort(tri, function(a, b) return a.id < b.id end)
    local lignes = {}
    for _, p in ipairs(tri) do
        local fin = ""
        if (p.vers) then
            fin = (", vers = %q"):format(p.vers)
        elseif (p.dest) then
            fin = (", dest = { monde = %q, x = %d, y = %d, z = %d, yaw = %d }"):format(
                p.dest.monde, Entier(p.dest.x), Entier(p.dest.y), Entier(p.dest.z), Entier(p.dest.yaw))
        end
        lignes[#lignes + 1] = ("    { id = %q, nom = %q, monde = %q, x = %d, y = %d, z = %d, yaw = %d, rayon = %d%s },")
            :format(p.id, p.nom, p.monde, Entier(p.x), Entier(p.y), Entier(p.z), Entier(p.yaw),
                    Entier(p.rayon), fin)
    end
    return ([[-- ══════════════════════════════════════════════════════════════════════════════
-- Teleports.lua — les points de téléportation de toutes les maps.
--
-- ÉCRIT PAR LE JEU (mode édition, /tp) via Server/Export.lua, ET PAR L'ÉDITEUR
-- UNREAL (menu NARVOS > Points de TP, scripts/adk-menu-narvos.py). Ne pas éditer à
-- la main : une entrée mal formée est ÉCARTÉE au chargement, et le journal la nomme.
--
-- %d point(s). Coordonnées LOCALES au monde (Mondes.DECALAGES), comme DecorPose.lua.
-- Une entrée par ligne : l'outil de l'éditeur relit ce fichier ligne à ligne.
-- ══════════════════════════════════════════════════════════════════════════════

local Teleports = {}

Teleports.LISTE = {
%s
}

return Teleports
]]):format(#lignes, table.concat(lignes, "\n"))
end

return Teleports
