-- ═══════════════════════════════════════════════════════════════════════════════
-- Gisements.lua — les points de récolte de NARVOS et ce qu'ils produisent.
--
-- ── ⚠ ÉCRIT À LA MAIN, PAS GÉNÉRÉ ─────────────────────────────────────────────
-- Ce fichier n'est la transposition d'aucun catalogue TS : il EST la source de
-- vérité. Ne pas le régénérer avec un générateur quelconque — il n'en existe pas,
-- et s'il en venait un, il écraserait ce qui suit. Même règle que
-- `Catalogs/Factions.lua`, même raison.
--
-- ── CONTRAT AVEC `Logic/Recolte.lua` ──────────────────────────────────────────
-- `Logic/Recolte.lua` lit `Gisements.GISEMENTS` et `Gisements.ORDRE`. Il ne fait
-- AUCUNE hypothèse sur les valeurs de zone : `zone_id` est une clé libre que le
-- serveur associera à ses zones réelles (à réconcilier avec la map, pas ici).
--
-- Toutes les quantités sont en UNITÉS d'item. `duree_ms` et `repousse_ms` sont
-- en millisecondes. `palier` est le niveau de compétence requis par le joueur.
--
-- ── LE SENS DE CHAQUE CHAMP ───────────────────────────────────────────────────
--   ressource        item_id de la matière produite (DOIT exister dans Items.lua)
--   quantite_min/max bornes du tirage de base ; le palier du joueur ajoute
--                    `bonus_palier` par niveau au-dessus du requis (plafond inclus)
--   outil            identifiant d'outil requis, ou nil pour les mains nues
--   outil_label      texte affichable de la raison d'échec (« il te faut … »)
--   palier           niveau de compétence minimum
--   duree_ms         temps d'une récolte (décidé par le serveur, pas ici)
--   repousse_ms      délai avant qu'un gisement RÉCOLTÉ redevienne prêt
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── icone / mesh : ce qui est branche, et ce qui ne l’est pas encore ────────
-- `icone` pointe un fichier de `public/textures/icons/craft/` (432 icones, 18
-- familles). Les six sont VERIFIEES sur disque.
--
-- ── MESH : QUATRE BRANCHES LE 2026-09-13, DEUX RESTENT EN CUBE ───────────────
-- Les 16 meshes de matieres du pack RPG Engine (`SM_OreMetal`, `SM_Metal`…)
-- sont des GLB de `public/models/`, jamais importes dans l’ADK — zero sur seize
-- dans le pack cuit au 2026-09-07. Ils ne servent toujours pas ici.
--
-- Ce qui a change : les minerais de Hyper Inventory et les rochers de Crystals
-- and Crafting sont CUITS. Relu dans `Server/Assets/narvos/Assets.toml` apres la
-- reconstruction du pack du 2026-09-13, les quatre cles ci-dessous y sont, sous
-- `[assets.static_meshes]` :
--
--   filon_metal_rare  SM_Ore_Iron          Narvos/Hyper/ResourcePack/…/Ores
--   grotte_cristaux   SM_Crystal_Large_01  Narvos/Hypernova/CrystalKeeper/…
--   ceur_plasma       SM_Ore_Uranium       Narvos/Hyper/ResourcePack/…/Ores
--   veine_vie         SM_Ruby              Narvos/Hyper/ResourcePack/…/Diamond
--
-- `organisme_alien` et `puissance_amelioree` gardent le cube de repli
-- (`PoserGisements`) : aucun mesh cuit ne represente un organisme ni un
-- amplificateur, et un rocher quelconque mentirait sur ce qu’on recolte.
--
-- ⚠ TAILLE NON MESUREE. Les minerais de Hyper sont faits pour etre ramasses,
-- pas pour servir de filon : ils peuvent etre petits a cote d’un joueur. Le
-- trigger de 2,5 m reste atteignable quelle que soit la taille ; la mesure des
-- bornes (editeur) dira s’il faut une echelle.
--
-- ⚠ Cote React, les GLB RPG Engine restent utilisables TOUT DE SUITE : c’est
-- le trou documente dans `src/rpg/professions/harvestModelCatalog.ts`.

local Gisements = {}

--- Ordre d'affichage. `pairs` n'a aucun ordre garanti en Lua : sans cette
--- séquence, la liste des gisements changerait de place entre deux rendus.
--- (même règle que `Factions.ORDRE`)
Gisements.ORDRE = {
    "filon_metal_rare",
    "grotte_cristaux",
    "veine_vie",
    "organisme_alien",
    "ceur_plasma",
    "puissance_amelioree",
}

Gisements.GISEMENTS = {
    filon_metal_rare = {
        id = "filon_metal_rare",
        mesh = "narvos::SM_Ore_Iron",
        icone = "tex_ingots_01",
        label = "Filon de métal rare",
        zone_id = "mines",
        ressource = "metal_rare",
        quantite_min = 1,
        quantite_max = 3,
        outil = "pioche",
        outil_label = "pioche",
        palier = 1,
        duree_ms = 4000,
        repousse_ms = 60000,
        bonus_palier = 1,
    },
    grotte_cristaux = {
        id = "grotte_cristaux",
        mesh = "narvos::SM_Crystal_Large_01",
        icone = "tex_gemstone_01",
        label = "Grotte à cristaux",
        zone_id = "mines",
        ressource = "cristal_energie",
        quantite_min = 2,
        quantite_max = 4,
        outil = "pioche",
        outil_label = "pioche",
        palier = 1,
        duree_ms = 5000,
        repousse_ms = 90000,
        bonus_palier = 1,
    },
    veine_vie = {
        id = "veine_vie",
        mesh = "narvos::SM_Ruby",
        icone = "tex_herbs_01",
        label = "Veine de vie",
        zone_id = "cavernes",
        ressource = "fragment_vie",
        quantite_min = 1,
        quantite_max = 2,
        -- Pas d'outil : la veine se cueille à la main.
        outil = nil,
        outil_label = nil,
        palier = 1,
        duree_ms = 6000,
        repousse_ms = 120000,
        bonus_palier = 1,
    },
    organisme_alien = {
        id = "organisme_alien",
        icone = "tex_mushrooms_01",
        label = "Organisme alien",
        zone_id = "cavernes",
        ressource = "adn_alien",
        quantite_min = 1,
        quantite_max = 2,
        outil = "collecteur",
        outil_label = "collecteur de matière",
        palier = 2,
        duree_ms = 8000,
        repousse_ms = 180000,
        bonus_palier = 1,
    },
    ceur_plasma = {
        id = "ceur_plasma",
        mesh = "narvos::SM_Ore_Uranium",
        icone = "tex_reagent_01",
        label = "Cœur de plasma",
        zone_id = "labyrinthe",
        ressource = "noyau_plasma",
        quantite_min = 1,
        quantite_max = 1,
        outil = "foreuse",
        outil_label = "foreuse",
        palier = 3,
        duree_ms = 10000,
        repousse_ms = 300000,
        bonus_palier = 1,
    },
    puissance_amelioree = {
        id = "puissance_amelioree",
        icone = "tex_spare_parts_01",
        label = "Amplificateur de puissance",
        zone_id = "labyrinthe",
        ressource = "powernax",
        quantite_min = 1,
        quantite_max = 1,
        outil = "foreuse",
        outil_label = "foreuse",
        palier = 4,
        duree_ms = 15000,
        repousse_ms = 600000,
        bonus_palier = 0,
    },
}

return Gisements
