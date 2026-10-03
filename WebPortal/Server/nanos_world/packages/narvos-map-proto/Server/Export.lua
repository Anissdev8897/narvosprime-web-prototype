-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Export.lua — figer en catalogue ce qui a été posé en jeu.
--
-- Câblage : Package.Require("Server/Export.lua") depuis Server/Index.lua, APRÈS
-- Server/Props.lua, Server/Spawner.lua et Server/Peuplement.lua.
--
-- ── LE CHAÎNON QUI MANQUAIT ───────────────────────────────────────────────────
-- Le gizmo DÉPLACE un prop, le spawner FAIT APPARAÎTRE un PNJ — et les deux
-- disparaissent au rechargement du package. Poser du décor à la main était donc
-- une démonstration, jamais un travail d'auteur.
--
-- Ce fichier ferme la boucle :
--
--     poser au gizmo  →  figer en catalogue  →  le monde les repose seul
--
-- C'est exactement la mécanique de `Patches.lua` et `Vegetation.lua`, qui ont
-- été exportés depuis l'ÉDITEUR. Ici on exporte depuis LE JEU, ce qui évite
-- d'ouvrir Unreal pour placer un tonneau.
--
-- ── ⚠ OÙ ÇA S'ÉCRIT, ET POURQUOI ÇA MARCHE ────────────────────────────────────
-- `File(chemin)` écrit relativement à l'exécutable du serveur. Or
-- `Server/Packages/narvos*` sont des JONCTIONS vers le dépôt
-- (`nanos-deploy-server.mjs`) : un fichier écrit là atterrit dans le projet, pas
-- dans l'installation Steam.
--
-- ⚠ Si les jonctions sont refaites ou absentes, l'écriture réussit quand même —
-- dans l'installation Steam, où personne n'ira la chercher. Le chemin complet
-- est donc TOUJOURS annoncé dans le chat : c'est la seule façon de voir où le
-- fichier est parti.
--
-- ── CE QUE ÇA N'EST PAS ───────────────────────────────────────────────────────
-- Pas une sauvegarde de partie. Un catalogue est du CONTENU : il se relit au
-- démarrage, il se versionne, il se relit à l'œil. L'état d'un joueur, lui, vit
-- en base.
-- ═══════════════════════════════════════════════════════════════════════════════

local Export = {}

local Props = Narvos.PropsServeur
local Spawner = Narvos.SpawnerServeur
local Session = Narvos.SessionServeur
local Mondes = Narvos.Mondes

--- Où les catalogues sont écrits, relativement à l'exécutable du serveur.
Export.DOSSIER = "Packages/narvos/Shared/Catalogs"

-- Déclarations avancées.
local Entier, Decalage, Ecrire

--- Arrondi à l'entier. `%d` et `%.0f` font de l'arrondi BANCAIRE en Lua : 0,5
--- va au pair le plus proche, donc 2,5 → 2. Sur une coordonnée, l'écart est
--- invisible ; sur une comparaison d'égalité plus tard, il ne l'est pas.
Entier = function(v)
    return math.floor((tonumber(v) or 0) + 0.5)
end

--- Décalage du monde où se trouve le joueur.
---
--- ⚠ ON EXPORTE EN COORDONNÉES LOCALES, PAS MONDE. Les quatre mondes sont des
--- sous-niveaux décalés jusqu'à 80 km ; un catalogue en coordonnées monde serait
--- faux le jour où le décalage change dans l'éditeur. En local, il suit.
---@param player table
---@return table vecteur, string monde_id
Decalage = function(player)
    local c = player:GetControlledCharacter()
    local ok, p = pcall(function() return c and c:GetLocation() end)
    if (not ok or not p or not Mondes) then return Vector(), "?" end
    local monde = Mondes.ParPosition(p)
    if (not monde) then return Vector(), "?" end
    return (Mondes.DECALAGES[monde.id] or Vector()), monde.id
end

--- Écrit un fichier et rend son chemin complet, ou nil.
---@param nom string
---@param contenu string
---@return string|nil
Ecrire = function(nom, contenu)
    local chemin = Export.DOSSIER .. "/" .. nom
    local ok = pcall(function()
        pcall(function() File.CreateDirectory(Export.DOSSIER) end)
        -- `truncate = true` : sans lui, une seconde écriture s'ajouterait à la
        -- première et le fichier ne compilerait plus.
        local f = File(chemin, true)
        f:Write(contenu)
        -- ⚠ `Close` N'EST PAS dans la liste de methodes que j'ai lue dans
        -- `Classes/File.json`. Il existe peut-etre ; je ne le suppose pas. Un
        -- pcall separe : s'il n'existe pas, l'ecriture reste valide au lieu
        -- d'etre rapportee en echec.
        pcall(function() f:Close() end)
    end)
    if (not ok) then return nil end
    local complet = chemin
    pcall(function() complet = File.GetFullPath(chemin) end)
    return complet
end

-- ── Les props posés ───────────────────────────────────────────────────────────

--- Fige les props d'un joueur dans `Catalogs/DecorPose.lua`.
---
--- Le format est celui de `Patches.lua` — position, rotation, échelle par
--- entrée — parce que `MapLoader.PoserPatches` sait déjà le consommer. Écrire un
--- format neuf obligerait à écrire aussi son chargeur.
---@param player table
---@return boolean|nil, string
function Export.Props(player)
    local liste = Props and Props.MesProps and Props.MesProps(player) or nil
    -- `nil`, pas `false` : ne rien avoir a sauver n'est pas une PANNE. Le
    -- gestionnaire de sortie du mode edition (F3) le distingue d'un vrai echec
    -- d'ecriture. Avant, il criait en rouge « Aucun prop pose » a CHAQUE
    -- fermeture — vu trois fois dans une seule session de jeu le 2026-09-10 —
    -- et un bandeau qui crie pour rien apprend au joueur a ne plus le lire.
    -- `/exporter decor` affiche toujours le message : la, c'est une question.
    if (not liste or #liste == 0) then return nil, "Aucun prop pose" end

    local dec, monde = Decalage(player)
    local lignes = {}
    for _, p in ipairs(liste) do
        lignes[#lignes + 1] = ("    { mesh = %q, position = { %d, %d, %d },"
            .. " rotation = { %d, %d, %d }, echelle = { %.3f, %.3f, %.3f } },")
            :format(p.asset or "",
                    Entier(p.x - dec.X), Entier(p.y - dec.Y), Entier(p.z - dec.Z),
                    Entier(p.pitch), Entier(p.yaw), Entier(p.roll),
                    p.sx or 1, p.sy or 1, p.sz or 1)
    end

    local contenu = ([[-- Genere par Server/Export.lua depuis le jeu (/exporter decor).
-- Ne pas editer a la main : reexporter.
--
-- %d element(s) poses au gizmo dans le monde « %s ».
--
-- ⚠ COORDONNEES LOCALES au sous-niveau, decalage deduit. Un catalogue en
-- coordonnees monde serait faux des que le decalage change dans l'editeur.
--
-- Se pose par MapLoader.PoserPatches(Narvos.DecorPose, { decalage = ... }).
local DecorPose = {}

DecorPose.MONDE = %q

DecorPose.LISTE = {
%s
}

return DecorPose
]]):format(#lignes, monde, monde, table.concat(lignes, "\n"))

    local chemin = Ecrire("DecorPose.lua", contenu)
    if (not chemin) then return false, "Ecriture refusee" end
    return true, ("%d element(s) ecrits dans %s"):format(#lignes, chemin)
end

-- ── Les PNJ invoqués ──────────────────────────────────────────────────────────

--- Fige les PNJ d'un joueur en points de peuplement.
---
--- ⚠ ON EXPORTE UN POINT, PAS UNE ENTITÉ. Le catalogue dit « ici, une bête de
--- cette espèce » ; c'est `Server/Peuplement.lua` qui décidera de la faire
--- exister quand un joueur approchera. Exporter l'entité elle-même ramènerait le
--- défaut qu'on vient de corriger : deux cents bêtes vivantes en permanence.
---@param player table
---@return boolean, string
function Export.Pnj(player)
    local entites = Spawner and Spawner.Invoques and Spawner.Invoques(player) or {}
    if (#entites == 0) then return false, "Aucun PNJ invoque" end

    local dec, monde = Decalage(player)
    local lignes, n = {}, 0
    for _, e in ipairs(entites) do
        -- L'identifiant de catalogue est posé sur l'entité à l'invocation par
        -- une valeur d'entité : c'est la seule façon de retrouver QUELLE espèce
        -- a produit ce corps. Sans elle, on exporterait une position sans nom.
        local ok, id = pcall(function() return e:GetValue("narvos_spawnable", nil) end)
        local niveau_ok, niveau = pcall(function() return e:GetValue("narvos_niveau", nil) end)
        local pos_ok, p = pcall(function() return e:GetLocation() end)
        local rot_ok, r = pcall(function() return e:GetRotation() end)
        if (ok and id and niveau_ok and tonumber(niveau) and pos_ok and p) then
            n = n + 1
            lignes[#lignes + 1] = ("    { id = %q, spawnable = %q,"
                .. " x = %d, y = %d, z = %d, yaw = %d, niveau = %d },")
                :format(monde .. "_" .. n, id,
                        Entier(p.X - dec.X), Entier(p.Y - dec.Y), Entier(p.Z - dec.Z),
                        Entier(rot_ok and r and r.Yaw or 0), Entier(niveau))
        end
    end

    if (n == 0) then
        return false, "PNJ sans identifiant ou niveau — invoques avant l'export ?"
    end

    local contenu = ([[-- Genere par Server/Export.lua depuis le jeu (/exporter pnj).
-- Ne pas editer a la main : reexporter.
--
-- %d point(s) de peuplement dans le monde « %s ».
--
-- ⚠ CE SONT DES POINTS, PAS DES ENTITES. Server/Peuplement.lua fait naitre une
-- bete quand un joueur approche a 80 m, et la retire a 140 m. La carte peut donc
-- en declarer cinq cents sans qu'aucune n'existe tant que personne n'y va.
--
-- ⚠ COORDONNEES LOCALES au sous-niveau.
local Peuplement = {}

Peuplement.MONDE = %q

Peuplement.LISTE = {
%s
}

return Peuplement
]]):format(n, monde, monde, table.concat(lignes, "\n"))

    local chemin = Ecrire("Peuplement.lua", contenu)
    if (not chemin) then return false, "Ecriture refusee" end
    return true, ("%d point(s) ecrits dans %s"):format(n, chemin)
end

-- ── Un catalogue entier, sérialisé par son module ─────────────────────────────

--- Écrit un catalogue que son module sait déjà sérialiser (Logic/Teleports.lua,
--- `Teleports.Catalogue`). Même dossier, même annonce du chemin complet.
--- Le nom est BORNÉ : un appelant ne doit pas pouvoir écrire hors du dossier.
---@param nom string      « Xxx.lua », lettres/chiffres/_ seulement
---@param contenu string
---@return string|nil     chemin complet, ou nil si refusé
function Export.Catalogue(nom, contenu)
    if (type(nom) ~= "string" or not nom:match("^[%w_]+%.lua$") or type(contenu) ~= "string") then
        return nil
    end
    return Ecrire(nom, contenu)
end

return Export