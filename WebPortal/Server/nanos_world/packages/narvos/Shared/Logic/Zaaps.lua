-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Zaaps.lua — les ZAAPS, purs : points de sauvegarde posés dans le monde.
--
-- Câblage (Shared/Index.lua), APRÈS Teleports dont il réutilise les règles, et
-- APRÈS son catalogue :
--   Narvos.ZaapsCatalogue = Package.Require("Catalogs/Zaaps.lua")
--   Narvos.Zaaps          = Package.Require("Logic/Zaaps.lua")
-- ⚠ Deux modules, deux noms — le piège `Animaux`/`AnimauxCatalogue`.
--
-- ── POURQUOI (2026-09-15, décision D4 de Hanibes) ─────────────────────────────
-- « Lorsqu'un joueur active un Zaap, celui-ci devient son nouveau point de
-- réapparition. S'il n'en a activé aucun, il réapparaît au point de spawn choisi
-- au début du jeu. »
--
-- Un Zaap a la forme d'un point de téléportation SANS destination :
--   { id, nom, monde, x, y, z, yaw, rayon }
-- coordonnées LOCALES au monde (Mondes.DECALAGES), comme Catalogs/Teleports.lua.
-- Les règles de nom, d'identifiant, de bornes et d'immutabilité sont celles de
-- Logic/Teleports.lua : on les APPELLE au lieu de les recopier — une copie
-- divergerait à la première correction. Ce module n'ajoute que ce qui diffère :
-- le rayon d'activation, l'ARRIVÉE après la mort et le fichier catalogue.
--
-- Aucune entité ici : Server/Zaaps.lua pose les déclencheurs et écrit le
-- catalogue ; Client/Zaaps.lua dessine le socle et le cristal.
-- ═══════════════════════════════════════════════════════════════════════════════

local Zaaps = {}

--- Rayon du cercle d'activation (cm) : on s'approche du socle, pas à dix mètres.
Zaaps.RAYON_DEFAUT = 300.0
--- Distance de l'arrivée devant le Zaap, dans l'axe de son lacet (cm). Le lacet
--- est celui de l'administrateur qui l'a posé : il regardait un sol praticable.
--- Arriver au centre poserait le corps dans le cristal.
Zaaps.RECUL_ARRIVEE = 160.0
--- Longueur maximale d'un identifiant : celle que la base accepte
--- (`Roster.CiteValide`, réutilisée par `Roster.ZaapValide`).
Zaaps.ID_MAX = 40

--- Les règles de liste partagées. Lu à l'APPEL : le harnais monte `Narvos` après
--- le chargement de ce fichier.
local function Points()
    return (Narvos and Narvos.Teleports) or Package.Require("Logic/Teleports.lua")
end

--- Un Zaap ne mène nulle part : on retire ce qui n'appartient qu'aux téléports.
local function SansDestination(liste)
    for _, p in ipairs(liste) do
        p.vers, p.dest = nil, nil
    end
    return liste
end

--- Forme d'un identifiant de Zaap (clé de catalogue). Rend l'id, ou nil.
---@param id any
---@return string|nil
function Zaaps.IdValide(id)
    if (type(id) ~= "string" or #id == 0 or #id > Zaaps.ID_MAX) then return nil end
    if (not id:match("^[%w_]+$")) then return nil end
    return id
end

--- Le nom tel qu'on l'affiche : « Zaap du port » reste tel quel, « Port d'Akarlys »
--- devient « Zaap Port d'Akarlys ». Sans cette règle, un administrateur qui nomme
--- ses Zaaps « Zaap … » ferait lire « Retour : Zaap Zaap du port ».
---@param nom any
---@return string
function Zaaps.Libelle(nom)
    local s = tostring(nom or "")
    if (s:lower():match("^zaap[%s%p]") or s:lower() == "zaap") then return s end
    return "Zaap " .. s
end

--- Un Zaap par son identifiant, et son rang.
function Zaaps.Trouver(liste, id)
    return Points().Trouver(liste, id)
end

--- Crée un Zaap. Rend (liste neuve, id) ou (nil, raison).
---@param champs table  { nom, monde, x, y, z, yaw, rayon? }
function Zaaps.Creer(liste, champs)
    local copie = {}
    for k, v in pairs(type(champs) == "table" and champs or {}) do copie[k] = v end
    if (copie.rayon == nil) then copie.rayon = Zaaps.RAYON_DEFAUT end
    copie.vers, copie.dest = nil, nil
    local neuve, id = Points().Creer(liste, copie)
    if (not neuve) then return nil, id end
    return SansDestination(neuve), id
end

function Zaaps.Renommer(liste, id, nom)
    local neuve, raison = Points().Renommer(liste, id, nom)
    if (not neuve) then return nil, raison end
    return SansDestination(neuve)
end

function Zaaps.Deplacer(liste, id, champs)
    local neuve, raison = Points().Deplacer(liste, id, champs)
    if (not neuve) then return nil, raison end
    return SansDestination(neuve)
end

function Zaaps.Supprimer(liste, id)
    local neuve, raison = Points().Supprimer(liste, id)
    if (not neuve) then return nil, raison end
    return SansDestination(neuve)
end

--- Relit le catalogue. Rend (liste, refus) : une entrée mal formée est ÉCARTÉE et
--- nommée ; un identifiant trop long pour la base aussi — un Zaap qu'aucun
--- personnage ne pourrait retenir serait une promesse fausse.
function Zaaps.Charger(catalogue)
    local brut, refus = Points().Charger(catalogue)
    local liste = {}
    for _, p in ipairs(brut) do
        if (Zaaps.IdValide(p.id)) then
            liste[#liste + 1] = p
        else
            refus[#refus + 1] = "zaap " .. tostring(p.id) .. " ecarte (identifiant trop long)"
        end
    end
    return SansDestination(liste), refus
end

--- Où revient un joueur mort dont ce Zaap est le point : devant lui, dans l'axe de
--- son lacet. Rend { monde, x, y, z, yaw } (coordonnées locales), ou (nil, raison).
function Zaaps.Arrivee(liste, id)
    local p = Zaaps.Trouver(liste, id)
    if (not p) then return nil, "zaap inconnu : " .. tostring(id) end
    local a = math.rad(p.yaw or 0)
    return {
        monde = p.monde,
        x = p.x + math.cos(a) * Zaaps.RECUL_ARRIVEE,
        y = p.y + math.sin(a) * Zaaps.RECUL_ARRIVEE,
        z = p.z,
        yaw = p.yaw or 0,
    }
end

local function Entier(v)
    return math.floor((tonumber(v) or 0) + 0.5)
end

--- Le fichier catalogue ENTIER, prêt à écrire. Ordre par identifiant : deux
--- exports de la même liste donnent le même fichier, donc un diff lisible.
---@param liste table
---@return string
function Zaaps.Catalogue(liste)
    local tri = Points().Copier(liste)
    table.sort(tri, function(a, b) return a.id < b.id end)
    local lignes = {}
    for _, p in ipairs(tri) do
        lignes[#lignes + 1] = ("    { id = %q, nom = %q, monde = %q, x = %d, y = %d, z = %d, yaw = %d, rayon = %d },")
            :format(p.id, p.nom, p.monde, Entier(p.x), Entier(p.y), Entier(p.z), Entier(p.yaw), Entier(p.rayon))
    end
    return ([[-- ══════════════════════════════════════════════════════════════════════════════
-- Zaaps.lua — les Zaaps (points de sauvegarde et de réapparition) de toutes les maps.
--
-- ÉCRIT PAR LE JEU (/zaap creer, /zaap ici, /zaap renommer, /zaap supprimer) via
-- Server/Export.lua. Ne pas éditer à la main pendant que le serveur tourne : il
-- réécrit ce fichier à chaque édition. Une entrée mal formée est ÉCARTÉE au
-- chargement, et le journal la nomme.
--
-- %d zaap(s). Coordonnées LOCALES au monde (Mondes.DECALAGES), comme Teleports.lua.
-- Un personnage retient l'IDENTIFIANT de son Zaap (colonne personnages.zaap) :
-- renommer ne casse rien, supprimer renvoie ses joueurs à leur cité.
-- ══════════════════════════════════════════════════════════════════════════════

local Zaaps = {}

Zaaps.LISTE = {
%s
}

return Zaaps
]]):format(#lignes, table.concat(lignes, "\n"))
end

return Zaaps
