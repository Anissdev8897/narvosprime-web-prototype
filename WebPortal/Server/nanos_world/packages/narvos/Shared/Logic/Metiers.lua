-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Metiers.lua — progression des MÉTIERS (port PUR de
-- professions/professionTypes.ts + la partie XP de professions/professionStore.ts).
--
-- Câblage : Narvos.MetiersLogique = Package.Require("Logic/Metiers.lua")
--           APRÈS Narvos.Metiers (le catalogue, généré).
--
-- ── D'OÙ VIENT CE MODULE ──────────────────────────────────────────────────────
-- Hanibes demandait « Hyper Skill Level Manager » : des niveaux de métier, de
-- l'XP gagnée en pratiquant, une barre de progression par compétence. Mesuré le
-- 2026-09-12 :
--
--   · ce système EXISTAIT déjà dans le prototype web — 6 métiers, niveaux 1 à 50,
--     paliers de ressources, recettes à niveau requis, store testé — et n'avait
--     JAMAIS été porté vers nanos ;
--   · le pack Hyper n'apporte aucune DataTable de compétences en propre : ses
--     trois tables communes avec Hyper Inventory sont des versions RÉDUITES
--     (DT_Items 22 Ko contre 629 Ko), et sa logique est un composant Blueprint
--     qui suppose un serveur Unreal.
--
-- On porte donc l'existant. La courbe, les paliers et la cascade de niveaux sont
-- ceux du TS, à l'identique : un joueur ne doit pas progresser différemment
-- selon le client qu'il utilise.
--
-- ── CE QUI N'EST PAS PORTÉ, ET POURQUOI ───────────────────────────────────────
-- Le store web tient aussi un SAC de ressources et une ENDURANCE. nanos a déjà un
-- inventaire serveur persisté (la grille), et `Logic/Craft.lua` consomme depuis
-- elle. Porter le sac du web donnerait deux inventaires qui divergent — c'est ce
-- que Hanibes a interdit : « ne recrée pas inutilement des systèmes existants ».
--
-- ── IMMUABLE ──────────────────────────────────────────────────────────────────
-- `AjouterXP` rend un NOUVEL état et ne touche pas l'ancien — même schéma que
-- `Logic/Talents.lua`. Un état muté en place, persisté en retard, perd de l'XP
-- le jour où une écriture échoue au milieu d'une cascade de niveaux.
-- ═══════════════════════════════════════════════════════════════════════════════

local MetiersLogique = {}

--- Niveau maximal d'un métier. Repris de `MAX_PROFESSION_LEVEL` du TS.
MetiersLogique.NIVEAU_MAX = 50

--- ── QUEL MÉTIER PROGRESSE QUAND ON RÉCOLTE ─────────────────────────────────────
---
--- Clé : l'`outil` d'un gisement (`Catalogs/Gisements.lua`). C'est la seule
--- donnée qui dise la NATURE du geste — un filon et un cœur de plasma sont deux
--- ressources différentes, mais la pioche et la foreuse sont toutes deux de
--- l'extraction.
---
--- ⚠ Une table de DÉCISIONS de jeu, pas une copie de clés : les valeurs ne se
--- déduisent d'aucun catalogue. Le harnais vérifie en revanche que chaque outil
--- RÉELLEMENT employé par un gisement y a son entrée — un nouveau gisement ne doit
--- pas cesser de donner de l'XP en silence.
MetiersLogique.METIER_PAR_OUTIL = {
    pioche     = "mineur",
    foreuse    = "mineur",     -- extraction mécanique : cœur de plasma, amplificateur
    collecteur = "recolteur",  -- cueillette biologique : organisme alien
    hache      = "bucheron",
    faucille   = "recolteur",
}

--- ── QUEL MÉTIER PROGRESSE QUAND ON FABRIQUE ────────────────────────────────────
---
--- Clé : la `station` d'une recette. Les quatre stations posées en jeu.
---
--- ⚠ LE JOAILLIER N'A AUCUNE STATION côté nanos aujourd'hui. Ni `forge`, ni
--- `workbench`, ni `alchemy`, ni `refinery` ne sont une joaillerie, et lui en
--- attribuer une donnerait de l'XP de joaillier en forgeant une épée. Il
--- progressera le jour où une station de joaillerie existera.
MetiersLogique.METIER_PAR_STATION = {
    forge     = "forgeron",
    workbench = "forgeron",    -- assemblage mécanique : pièces, outils
    alchemy   = "alchimiste",
    refinery  = "alchimiste",  -- distillation : carburants, solutions
}

--- Le métier qu'exerce une récolte à cet outil, ou nil.
---@param outil any
---@return string|nil
function MetiersLogique.MetierDOutil(outil)
    if (type(outil) ~= "string") then return nil end
    return MetiersLogique.METIER_PAR_OUTIL[outil]
end

--- Le métier qu'exerce une fabrication à cette station, ou nil.
---@param station any
---@return string|nil
function MetiersLogique.MetierDeStation(station)
    if (type(station) ~= "string") then return nil end
    return MetiersLogique.METIER_PAR_STATION[station]
end

--- ── COMBIEN D'XP ─────────────────────────────────────────────────────────────
---
--- ⚠ AUCUN MONTANT N'EST ÉCRIT ICI. Gisements et recettes nanos portent un
--- `palier` (0 à 5) ; le catalogue porté du web porte des `baseXp` rangés par
--- niveau requis. On lit donc l'XP DANS le catalogue, au rang du palier : une
--- valeur recopiée ici divergerait le jour où le catalogue TS est rééquilibré, et
--- les deux clients cesseraient de s'accorder.

--- La définition d'un métier dans le catalogue, ou nil.
---@param catalogue table  Narvos.Metiers
---@param id string
---@return table|nil
local function DefinitionDe(catalogue, id)
    if (type(catalogue) ~= "table" or type(catalogue.PROFESSIONS) ~= "table") then return nil end
    for _, m in ipairs(catalogue.PROFESSIONS) do
        if (m.id == id) then return m end
    end
    return nil
end

--- XP d'une récolte : le `baseXp` du palier de même rang, fois la quantité.
---
--- Palier 0 = premier palier du métier. Un palier au-delà du dernier prend le
--- dernier : un gisement plus rare que tout ce que le catalogue prévoit ne doit
--- pas rapporter ZÉRO.
---@param catalogue table
---@param metier string
---@param palier number
---@param quantite number
---@return number
function MetiersLogique.XpDeRecolte(catalogue, metier, palier, quantite)
    local def = DefinitionDe(catalogue, metier)
    if (def == nil or type(def.tiers) ~= "table" or #def.tiers == 0) then return 0 end
    local rang = math.max(1, math.min(#def.tiers, math.floor(tonumber(palier) or 0) + 1))
    local base = tonumber(def.tiers[rang].baseXp) or 0
    return base * math.max(1, math.floor(tonumber(quantite) or 1))
end

--- XP d'une fabrication : le `baseXp` de la recette du métier au même rang,
--- recettes rangées par niveau requis croissant.
---@param catalogue table
---@param metier string
---@param palier number
---@return number
function MetiersLogique.XpDeFabrication(catalogue, metier, palier)
    if (type(catalogue) ~= "table" or type(catalogue.RECIPES) ~= "table") then return 0 end
    local siennes = {}
    for _, r in ipairs(catalogue.RECIPES) do
        if (r.profession == metier) then siennes[#siennes + 1] = r end
    end
    if (#siennes == 0) then return 0 end
    -- Tri STABLE par niveau requis puis identifiant : deux recettes au même
    -- niveau ne doivent pas échanger leur rang d'un démarrage à l'autre.
    table.sort(siennes, function(a, b)
        if (a.minLevel ~= b.minLevel) then return a.minLevel < b.minLevel end
        return tostring(a.id) < tostring(b.id)
    end)
    local rang = math.max(1, math.min(#siennes, math.floor(tonumber(palier) or 0) + 1))
    return tonumber(siennes[rang].baseXp) or 0
end

--- XP requise pour passer du niveau `niveau` à `niveau + 1`.
---
--- Port exact de `xpForLevel` : `Math.round(50 * level ^ 1.55)`.
---
--- ⚠ `Math.round` du JavaScript arrondit .5 VERS LE HAUT ; `math.floor(x + 0.5)`
--- fait la même chose pour un nombre positif, et cette courbe l'est toujours.
--- Un arrondi « au plus proche pair » décalerait l'XP d'un point sur certains
--- niveaux, et les deux clients ne s'accorderaient plus.
---@param niveau number
---@return number  math.huge au niveau maximal
function MetiersLogique.XpPourNiveau(niveau)
    niveau = tonumber(niveau) or 1
    if (niveau >= MetiersLogique.NIVEAU_MAX) then return math.huge end
    return math.floor(50 * (niveau ^ 1.55) + 0.5)
end

--- XP cumulée nécessaire pour ATTEINDRE `niveau`, depuis le niveau 1.
---@param niveau number
---@return number
function MetiersLogique.XpTotalePourNiveau(niveau)
    niveau = tonumber(niveau) or 1
    local total = 0
    for l = 1, niveau - 1 do total = total + MetiersLogique.XpPourNiveau(l) end
    return total
end

--- Le palier de ressource le plus élevé récoltable à ce niveau, ou nil.
---@param metier table   une entrée de Metiers.PROFESSIONS
---@param niveau number
---@return table|nil
function MetiersLogique.MeilleurPalier(metier, niveau)
    if (type(metier) ~= "table" or type(metier.tiers) ~= "table") then return nil end
    niveau = tonumber(niveau) or 1
    local meilleur = nil
    for _, t in ipairs(metier.tiers) do
        if (t.minLevel <= niveau and (meilleur == nil or t.minLevel > meilleur.minLevel)) then
            meilleur = t
        end
    end
    return meilleur
end

--- Un état de métiers neuf : tous au niveau 1, 0 XP.
---@param ids string[]  Metiers.PROFESSION_IDS
---@return table  { [id] = { niveau, xp } }
function MetiersLogique.EtatNeuf(ids)
    local etat = {}
    for _, id in ipairs(ids or {}) do etat[id] = { niveau = 1, xp = 0 } end
    return etat
end

--- Octroie de l'XP à un métier. Rend (nouvel_etat, niveaux_gagnes).
---
--- Port exact de `addXp` : cascade de niveaux tant que l'XP le permet, plafond
--- au niveau maximal où l'XP retombe à 0.
---
--- ⚠ UN MÉTIER INCONNU N'EST PAS CRÉÉ. L'identifiant vient du serveur, mais un
--- appel avec une faute de frappe ne doit pas faire naître un septième métier
--- fantôme dans la sauvegarde.
---@param etat table
---@param id string
---@param montant number
---@return table nouvel_etat
---@return number niveaux_gagnes
function MetiersLogique.AjouterXP(etat, id, montant)
    montant = tonumber(montant) or 0
    if (type(etat) ~= "table" or montant <= 0) then return etat, 0 end
    local actuel = etat[id]
    if (type(actuel) ~= "table") then return etat, 0 end

    local p = { niveau = actuel.niveau, xp = actuel.xp + montant }
    local gagnes = 0
    while (p.niveau < MetiersLogique.NIVEAU_MAX and p.xp >= MetiersLogique.XpPourNiveau(p.niveau)) do
        p.xp = p.xp - MetiersLogique.XpPourNiveau(p.niveau)
        p.niveau = p.niveau + 1
        gagnes = gagnes + 1
    end
    if (p.niveau >= MetiersLogique.NIVEAU_MAX) then p.xp = 0 end

    -- Copie superficielle : les autres métiers sont partagés, SEUL celui-ci est
    -- neuf. Les copier tous à chaque gain ferait une allocation par métier et par
    -- coup de pioche.
    local suivant = {}
    for k, v in pairs(etat) do suivant[k] = v end
    suivant[id] = p
    return suivant, gagnes
end

--- Le niveau d'un métier dans un état, 1 par défaut.
---@param etat table|nil
---@param id string
---@return number
function MetiersLogique.Niveau(etat, id)
    local p = type(etat) == "table" and etat[id] or nil
    return (type(p) == "table" and tonumber(p.niveau)) or 1
end

--- Ce qu'une fiche de métier montre : niveau, XP dans le niveau, XP cible,
--- progression. C'est le « tooltip » de Skill Level Manager (niveau courant, XP
--- courante, XP cible, pourcentage), calculé ici plutôt que dans la page.
---@param etat table|nil
---@param id string
---@return table
function MetiersLogique.Fiche(etat, id)
    local niveau = MetiersLogique.Niveau(etat, id)
    local p = type(etat) == "table" and etat[id] or nil
    local xp = (type(p) == "table" and tonumber(p.xp)) or 0
    local cible = MetiersLogique.XpPourNiveau(niveau)
    local max = niveau >= MetiersLogique.NIVEAU_MAX
    return {
        niveau = niveau,
        xp = xp,
        -- `math.huge` ne traverse pas bien vers la page : le JSON n'a pas
        -- d'infini. Au niveau maximal on envoie 0, et `max` dit pourquoi.
        cible = max and 0 or cible,
        progression = max and 1 or (cible > 0 and xp / cible or 0),
        xp_cumulee = MetiersLogique.XpTotalePourNiveau(niveau) + xp,
        max = max,
    }
end

return MetiersLogique
