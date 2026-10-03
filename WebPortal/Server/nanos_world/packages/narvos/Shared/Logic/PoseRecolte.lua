-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/PoseRecolte.lua — les entités de JEU posables à la main, et ce que la
-- pose doit enregistrer. PUR : aucune API nanos (Vector, Prop, Trigger, Player).
--
-- ── POURQUOI (demande du 2026-09-19) ──────────────────────────────────────────
-- Les six gisements et les quatre ateliers sont aujourd'hui posés par le serveur
-- sur un cercle fixe de 10 m autour de l'arrivée d'Akarlys (`PoserGisements`,
-- `Server/Index.lua:1285`). Hanibes veut pouvoir les FAIRE APPARAÎTRE et les
-- PLACER LUI-MÊME, comme les décors du menu de props.
--
-- Les meshes sont DÉJÀ dans le catalogue de props (`Catalogs/PropsNarvos.lua`,
-- généré : SM_Ore_Iron, SM_Crystal_Large_01, SM_Ruby, SM_Ore_Uranium) — donc un
-- admin peut déjà les poser comme DÉCOR. Mais un décor posé ainsi est INERTE :
-- pas de déclencheur, pas d'état, pas de récolte, pas de panneau.
--
-- Ce module dit CE QU'UNE POSE DOIT ENREGISTRER pour que l'entité soit VIVANTE,
-- et il le dit sans toucher au moteur : le serveur exécute, ce fichier décide.
-- Il est prouvé par `scripts/lua-harness/pose-recolte.mjs`.
--
-- ── RÈGLE : IMMUABLE ──────────────────────────────────────────────────────────
-- Aucune fonction ne modifie l'état qu'on lui donne (règle du dépôt, cf.
-- `Logic/Inventory.lua` et `Logic/Recolte.lua`).
--
-- ── RÈGLE : LES MESHES VIENNENT DES CATALOGUES ────────────────────────────────
-- `PoseRecolte.Integrer(Gisements, Ateliers)` lit les deux catalogues RÉELS
-- (`Catalogs/Gisements.lua`, `Catalogs/Ateliers.lua`) : un mesh recuit change de
-- clé, et une liste recopiée ici mentirait au premier cook. Un gisement sans
-- mesh cuit garde le CUBE de repli — visible et atteignable, comme
-- `PoserGisements` le fait déjà.
-- ═══════════════════════════════════════════════════════════════════════════════

local PoseRecolte = {}

--- Mesh de repli quand le pack n'a rien cuit pour l'entité (même choix que
--- `Server/Index.lua` dans `PoserGisements`, et même raison : invisible = introuvable).
PoseRecolte.MESH_REPLI = "nanos-world::SM_Cube"

--- Rayon du déclencheur de proximité, en mètres. Les gisements posés par le
--- serveur utilisent 2,5 m (`Vecchose` 2.5 * M) : on garde la même valeur pour
--- qu'une entité posée à la main se comporte comme une entité du cercle.
PoseRecolte.RAYON_TRIGGER_M = 2.5

--- Plafond de sécurité : une pose manuelle peut se tromper (double-clic,
--- gizmo laissé actif). Le serveur a déjà `PLAFOND_PAR_JOUEUR` pour les décors ;
--- ici c'est un plafond par ENTRÉE (quatre filons de métal rare, pas soixante).
PoseRecolte.PLAFOND_PAR_ENTREE = 12

--- Préfixes des clés d'instance. Une entité posée n'est PAS le nœud du
--- catalogue : il en existe plusieurs, et chacune a son propre état (repousse,
--- position). `filon_metal_rare` reste l'entrée de catalogue ; `g:filon_metal_rare#2`
--- est la deuxième pose de cette entrée.
PoseRecolte.PREFIXE = { gisement = "g", station = "s" }

-- ── Utilitaires ───────────────────────────────────────────────────────────────

local function nombre(v)
    local n = tonumber(v)
    if (n == nil or n ~= n) then return nil end
    return n
end

--- Une position utilisable : trois nombres finis. Zéro est valide ; `nil` ne l'est pas.
local function PositionValide(p)
    if (type(p) ~= "table") then return false end
    return nombre(p.X) ~= nil and nombre(p.Y) ~= nil and nombre(p.Z) ~= nil
end

-- ── Catalogue des entités posables ────────────────────────────────────────────

--- Les entités posables, telles qu'`Integrer` les a construites. Déclaré ICI —
--- et non créé de l'extérieur : `scripts/lua-harness/cablage-check.mjs` refuse
--- un champ `Narvos.X.Y` absent du module `Logic/X.lua`, et il a raison : un
--- champ posé ailleurs est un champ que le module ne connaît pas.
PoseRecolte.ENTREES = {}

--- Construit le catalogue des entités posables depuis les catalogues RÉELS et
--- REMPLIT `PoseRecolte.ENTREES` (rend la même liste, pour l'appel en une ligne).
---@return table  { { id, kind, ref, label, icone, mesh, cuit, echelle, rayon_trigger_m }, ... }
function PoseRecolte.Integrer(Gisements, Ateliers)
    local entrees = {}

    -- 1. LES GISEMENTS — depuis `Catalogs/Gisements.lua` (écrit à la main).
    if (type(Gisements) == "table" and type(Gisements.GISEMENTS) == "table") then
        for _, id in ipairs(Gisements.ORDRE or {}) do
            local g = Gisements.GISEMENTS[id]
            if (type(g) == "table") then
                local mesh = (type(g.mesh) == "string" and g.mesh ~= "") and g.mesh or PoseRecolte.MESH_REPLI
                entrees[#entrees + 1] = {
                    id = "gisement:" .. tostring(id),
                    kind = "gisement",
                    ref = id,
                    label = g.label or tostring(id),
                    icone = g.icone,
                    mesh = mesh,
                    cuit = mesh ~= PoseRecolte.MESH_REPLI,
                    echelle = g.echelle,
                    rayon_trigger_m = PoseRecolte.RAYON_TRIGGER_M,
                    ressource = g.ressource,
                    outil = g.outil,
                    palier = g.palier,
                }
            end
        end
    end

    -- 2. LES ATELIERS — depuis `Catalogs/Ateliers.lua` (généré).
    if (type(Ateliers) == "table" and type(Ateliers.STATIONS) == "table") then
        for _, id in ipairs(Ateliers.ORDRE or { "forge", "workbench", "alchemy", "refinery" }) do
            local s = Ateliers.STATIONS[id]
            if (type(s) == "table") then
                local mesh = (type(s.mesh) == "string" and s.mesh ~= "") and s.mesh or PoseRecolte.MESH_REPLI
                entrees[#entrees + 1] = {
                    id = "station:" .. tostring(id),
                    kind = "station",
                    ref = id,
                    label = s.label or tostring(id),
                    mesh = mesh,
                    cuit = s.cuit == true,
                    en_plus = s.en_plus,          -- La forge pose aussi son enclume.
                    animation = s.animation,
                    mesh_squelettique = s.squelettique,
                    rayon_trigger_m = PoseRecolte.RAYON_TRIGGER_M,
                }
            end
        end
    end

    -- 3. L'ÉTABLI D'ASSEMBLAGE (2026-09-19) — le 5e atelier. Il n'appartient pas
    -- au craft (OuvrirAtelier) mais au système d'assemblage pièce par pièce :
    -- son déclencheur appelle AssemblageServeur.Entrer/Sortir, pas le craft.
    -- Posé à la main uniquement, comme les stations — son spawn automatique a
    -- été retiré en même temps que le leur.
    if (type(Ateliers) == "table" and type(Ateliers.ETABLI) == "table") then
        local etabli = Ateliers.ETABLI
        local mesh = (type(etabli.mesh) == "string" and etabli.mesh ~= "") and etabli.mesh or PoseRecolte.MESH_REPLI
        entrees[#entrees + 1] = {
            id = "station:etabli_assemblage",
            kind = "etabli",
            ref = "etabli_assemblage",
            label = etabli.label or "Établi d'assemblage",
            mesh = mesh,
            cuit = etabli.cuit == true,
            rayon_trigger_m = PoseRecolte.RAYON_TRIGGER_M,
        }
    end

    PoseRecolte.ENTREES = entrees
    return entrees
end

--- L'entrée de menu d'un identifiant, ou nil.
---@param entrees table  ce que rend `Integrer`
---@param id string
function PoseRecolte.Trouver(entrees, id)
    if (type(entrees) ~= "table" or id == nil) then return nil end
    local cible = tostring(id)
    for i = 1, #entrees do
        if (entrees[i].id == cible) then return entrees[i], i end
    end
    return nil
end

-- ── Clés d'instance ───────────────────────────────────────────────────────────

--- Rang suivant pour une entrée, d'après les clés déjà posées.
--- Les trous ne sont pas réutilisés : retirer la #2 puis poser rend #3 — deux
--- entités ne partagent donc JAMAIS une clé, même après un retrait.
---@param cles table  liste des clés existantes
---@param id string
---@return integer
function PoseRecolte.RangSuivant(cles, id)
    local prefixe = tostring(id) .. "#"
    local max = 0
    if (type(cles) == "table") then
        for i = 1, #cles do
            local c = tostring(cles[i])
            if (c:sub(1, #prefixe) == prefixe) then
                local n = nombre(c:sub(#prefixe + 1))
                if (n and n > max) then max = n end
            end
        end
    end
    return max + 1
end

--- La clé d'instance d'une entrée à ce rang.
function PoseRecolte.CleInstance(id, rang)
    return tostring(id) .. "#" .. tostring(math.floor(nombre(rang) or 1))
end

--- Combien d'entités posées pour cette entrée.
function PoseRecolte.CompteDe(cles, id)
    local prefixe = tostring(id) .. "#"
    local n = 0
    if (type(cles) == "table") then
        for i = 1, #cles do
            if (tostring(cles[i]):sub(1, #prefixe) == prefixe) then n = n + 1 end
        end
    end
    return n
end

-- ── Le plan de pose ───────────────────────────────────────────────────────────

--- Ce que le serveur doit faire pour UNE pose manuelle. Ne mute rien.
---
--- Rend `nil, raison` quand la pose doit être refusée — jamais une pose à
--- moitié : un prop posé sans son déclencheur serait un décor qui ment.
---@param entrees table   ce que rend `Integrer`
---@param cles table      clés d'instance déjà posées
---@param id string       identifiant de l'entrée de menu (`gisement:filon_metal_rare`)
---@param position table  { X, Y, Z } — celle du serveur, jamais celle du client
---@param yaw any         orientation en degrés
---@return table|nil plan
---@return string|nil raison
function PoseRecolte.PlanDePose(entrees, cles, id, position, yaw)
    local entree = PoseRecolte.Trouver(entrees, id)
    if (not entree) then return nil, "Entrée inconnue" end
    if (not PositionValide(position)) then return nil, "Position invalide" end
    if (PoseRecolte.CompteDe(cles, id) >= PoseRecolte.PLAFOND_PAR_ENTREE) then
        return nil, "Plafond atteint pour " .. tostring(entree.label)
    end

    local rang = PoseRecolte.RangSuivant(cles, id)
    local cle = PoseRecolte.CleInstance(id, rang)

    return {
        cle = cle,
        id = id,
        kind = entree.kind,
        ref = entree.ref,
        label = entree.label,
        mesh = entree.mesh,
        cuit = entree.cuit,
        en_plus = entree.en_plus,
        animation = entree.animation,
        mesh_squelettique = entree.mesh_squelettique,
        echelle = entree.echelle,
        -- Le déclencheur qui rend l'entité VIVANTE (panneau + récolte/atelier).
        trigger = { rayon_m = entree.rayon_trigger_m },
        -- La ligne à persister : de quoi reconstruire la pose au démarrage.
        persistance = {
            cle = cle, id = id,
            x = nombre(position.X), y = nombre(position.Y), z = nombre(position.Z),
            yaw = nombre(yaw) or 0,
        },
    }
end

-- ── Persistance ───────────────────────────────────────────────────────────────
-- Les props posés en jeu ne survivent à aucun redémarrage aujourd'hui (aucune
-- persistance dans `Server/Props.lua`). Le serveur écrira la liste ci-dessous
-- via `Package.SetPersistentData` — le même mécanisme que `EditionPnj`
-- (`radar_styles`) et que les réglages du radar.

--- La ligne de persistance d'un plan, en NOMBRES seulement (une table à clés se
--- perd en silence entre deux Lua ; des scalaires ne se décodent pas à moitié).
function PoseRecolte.LigneDe(plan)
    if (type(plan) ~= "table" or type(plan.persistance) ~= "table") then return nil end
    local p = plan.persistance
    if (nombre(p.x) == nil or nombre(p.y) == nil or nombre(p.z) == nil) then return nil end
    return { p.cle, p.id, p.x, p.y, p.z, nombre(p.yaw) or 0 }
end

--- Ordre STABLE : la persistance doit se relire telle qu'elle s'est écrite, sinon
--- deux redémarrages donnent deux ordres et le diff ment.
function PoseRecolte.Serialiser(lignes)
    local copie = {}
    for i = 1, #(lignes or {}) do
        local l = lignes[i]
        if (type(l) == "table" and #l >= 6) then
            copie[#copie + 1] = { tostring(l[1]), tostring(l[2]),
                nombre(l[3]) or 0, nombre(l[4]) or 0, nombre(l[5]) or 0, nombre(l[6]) or 0 }
        end
    end
    table.sort(copie, function(a, b) return a[1] < b[1] end)
    local sortie = {}
    for i = 1, #copie do
        local l = copie[i]
        sortie[#sortie + 1] = string.format("%s|%s|%.2f|%.2f|%.2f|%.2f", l[1], l[2], l[3], l[4], l[5], l[6])
    end
    return table.concat(sortie, "\n")
end

--- Relit ce qu'a écrit `Serialiser`. Rend une liste de plans minimaux
--- (`{ cle, id, position = { X, Y, Z }, yaw }`), prête à reposer.
function PoseRecolte.DepuisPersistance(texte)
    local lignes = {}
    for ligne in tostring(texte or ""):gmatch("[^\n]+") do
        local champs = {}
        for champ in ligne:gmatch("[^|]+") do champs[#champs + 1] = champ end
        if (#champs >= 6) then
            lignes[#lignes + 1] = {
                cle = champs[1], id = champs[2],
                position = { X = nombre(champs[3]) or 0, Y = nombre(champs[4]) or 0, Z = nombre(champs[5]) or 0 },
                yaw = nombre(champs[6]) or 0,
            }
        end
    end
    return lignes
end

return PoseRecolte
