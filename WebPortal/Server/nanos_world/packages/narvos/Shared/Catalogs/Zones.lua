-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/Zones.lua — où chacun a le droit d'éditer.
--
-- Câblage : Narvos.ZonesCatalogue = Package.Require("Catalogs/Zones.lua")
--
-- ── ÉCRIT À LA MAIN, ET C'EST ASSUMÉ ──────────────────────────────────────────
-- La plupart des catalogues de ce dossier sont GÉNÉRÉS depuis une source (les
-- GLB importés, `Assets.toml`, les catalogues TS du prototype web). Celui-ci ne
-- l'est pas, pour la même raison que `Mondes.lua` : une zone n'est dérivée de
-- rien. C'est une décision d'auteur — « la maison de Bob fait 50 m de rayon ici »
-- — et aucune mesure ne la produit.
--
-- ⚠ Le jour où les joueurs ACHÈTENT des maisons, leurs zones ne viendront plus
-- d'ici mais de la base : ce fichier ne portera plus que les zones du monde
-- (administratives et libres). `Logic/Zones.lua` prend déjà une LISTE en
-- argument, précisément pour que les deux sources se concatènent sans qu'il ait
-- à savoir laquelle est laquelle.
--
-- ── LA RÈGLE QUE CE FICHIER APPLIQUE ──────────────────────────────────────────
-- Hors de toute zone, personne n'édite sauf un admin. Ce n'est donc PAS une
-- liste d'interdits : c'est la liste, exhaustive, des endroits où l'édition est
-- permise. Ne rien écrire ici = monde verrouillé pour les joueurs, ce qui est le
-- défaut sûr.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosZonesCatalogue
local ZonesCatalogue = {}

--- Mètre, en unités Unreal. `Mondes.lua` emploie la même constante ; on la
--- redéclare ici plutôt que d'exiger `Mondes` chargé avant ce fichier — un
--- catalogue ne doit dépendre de rien.
local M = 100.0

-- ── Les zones du monde ────────────────────────────────────────────────────────
--
-- Champs : `id`, `monde`, `type` (joueur|admin|libre), `forme` (sphere|boite),
-- `x/y/z`, puis `rayon` (sphère) ou `dx/dy/dz` (demi-dimensions de la boîte),
-- et `proprietaire` pour les zones de type `joueur`.
ZonesCatalogue.ZONES = {
    -- ── LE BAC À SABLE DE LA FORGE ───────────────────────────────────────────
    -- Centré sur le point d'arrivée de la Forge (`Mondes.MONDES.forge.arrivee`,
    -- recopié ici — voir l'avertissement plus bas).
    --
    -- POURQUOI IL EXISTE : sans lui, l'arrivée de la garde d'édition rendrait le
    -- jeu muet pour tout le monde — plus un seul prop posable tant qu'aucune
    -- maison n'existe. Une fonctionnalité qui s'ajoute ne doit pas en retirer
    -- une qui marchait.
    --
    -- 60 m de rayon : assez pour bâtir quelque chose de visible, assez peu pour
    -- qu'on voie où le bac s'arrête.
    {
        id = "bac_forge",
        monde = "forge",
        type = "libre",
        forme = "sphere",
        x = -8599410, y = 195426, z = 146475,
        rayon = 60 * M,
        label = "Bac a sable de la Forge",
    },
}

-- ⚠ LES COORDONNÉES CI-DESSUS SONT UNE COPIE de `Mondes.MONDES.forge.arrivee`.
-- Ce dépôt a déjà payé quatre fois « une liste de clés recopiée diverge toujours
-- de sa source ». Ici la copie est assumée pour garder le catalogue sans
-- dépendance — mais elle est donc SOUS SURVEILLANCE : `zones.mjs` compare cette
-- position à celle de `Mondes` et rougit si elles s'écartent. Une copie qu'un
-- test surveille n'est plus une copie qui dérive.

--- Toutes les zones du monde, telles quelles.
--- Rend la table elle-même : `Logic/Zones.lua` ne la modifie jamais.
---@return table
function ZonesCatalogue.Toutes()
    return ZonesCatalogue.ZONES
end

--- Une zone par son identifiant, ou nil.
---@param id string
---@return table|nil
function ZonesCatalogue.Par(id)
    for _, z in ipairs(ZonesCatalogue.ZONES) do
        if (z.id == id) then return z end
    end
    return nil
end

return ZonesCatalogue
