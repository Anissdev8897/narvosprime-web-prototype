-- =============================================================================
-- Shared/Catalogs/Pas.lua — FICHIER GENERE par scripts/narvos-pas-to-lua.mjs.
-- Toute edition a la main sera ecrasee au prochain --apply.
--
-- Source : les entrees [assets.sounds] du pack cuit, dossier
-- Narvos/Footsteps_Sound_Effects_Pro/WAV/<Categorie>/. Les cles sont LUES,
-- jamais fabriquees : le prefixe d'un fichier n'est pas sa categorie
-- (armor -> crystal_foot1) et l'action varie (_walk, _run, _land, _through).
--
-- 490 echantillon(s), 25 categorie(s) :
--   armor             21 marche   21 course    0 chute   11 autre
--   bluntwood         11 marche    0 course    0 chute    5 autre
--   brush              0 marche    0 course    0 chute   11 autre
--   concrete          11 marche   11 course    0 chute    5 autre
--   deckwood           0 marche   11 course    0 chute    0 autre
--   dirt              11 marche   11 course    4 chute    5 autre
--   glass              0 marche    0 course    0 chute    3 autre
--   grass             10 marche    4 course    0 chute    6 autre
--   gravel            11 marche   11 course    2 chute    3 autre
--   leaves             0 marche    0 course    0 chute    7 autre
--   lino               8 marche    6 course    0 chute    0 autre
--   marble            11 marche   11 course    0 chute    7 autre
--   metalbar          11 marche   11 course    1 chute    6 autre
--   metalbox           9 marche   10 course    0 chute    4 autre
--   mud                6 marche    0 course    0 chute    4 autre
--   muffledice        10 marche    0 course    0 chute    0 autre
--   quicksand         11 marche    0 course    0 chute    0 autre
--   rug               11 marche    0 course    0 chute    0 autre
--   sand              11 marche   11 course    0 chute    0 autre
--   snow              11 marche   11 course    0 chute    5 autre
--   squeakywood       11 marche    0 course    0 chute    7 autre
--   stone             11 marche   11 course    0 chute    5 autre
--   water              0 marche    0 course    0 chute   32 autre
--   weakice           10 marche    0 course    0 chute    0 autre
--   wood              11 marche    0 course    0 chute    0 autre
-- =============================================================================

local Pas = {}

Pas.CATEGORIES = { "armor", "bluntwood", "brush", "concrete", "deckwood", "dirt", "glass", "grass", "gravel", "leaves", "lino", "marble", "metalbar", "metalbox", "mud", "muffledice", "quicksand", "rug", "sand", "snow", "squeakywood", "stone", "water", "weakice", "wood" }

--- categorie -> { marche, course, chute, autre } : listes de CLES Assets.toml.
--- L'appelant prefixe par le pack ("narvos::") — le catalogue ne connait pas
--- le nom du pack, c'est une decision de deploiement, pas de donnee.
Pas.PAR_CATEGORIE = {
    -- armor : 53 echantillon(s)
    armor = {
        marche = { "crystal_walk1", "crystal_walk2", "crystal_walk3", "crystal_walk4", "crystal_walk5", "crystal_walk6", "heavy_walk1", "heavy_walk2", "heavy_walk3", "heavy_walk4", "heavy_walk5", "heavy_walk6", "medium_walk1", "medium_walk2", "medium_walk3", "slime_walk1", "slime_walk2", "slime_walk3", "slime_walk4", "slime_walk5", "slime_walk6" },
        course = { "crystal_run1", "crystal_run2", "crystal_run3", "crystal_run4", "crystal_run5", "crystal_run6", "heavy_run1", "heavy_run2", "heavy_run3", "heavy_run4", "heavy_run5", "heavy_run6", "heavy_run7", "heavy_run8", "heavy_run9", "slime_run1", "slime_run2", "slime_run3", "slime_run4", "slime_run5", "slime_run6" },
        chute  = {},
        autre  = { "crystal_foot1", "crystal_foot2", "crystal_foot3", "crystal_foot4", "heavy_foot1", "heavy_foot2", "heavy_foot3", "heavy_foot4", "light_1", "light_2", "light_3" },
    },
    -- bluntwood : 16 echantillon(s)
    bluntwood = {
        marche = { "bluntwood_walk1", "bluntwood_walk10", "bluntwood_walk11", "bluntwood_walk2", "bluntwood_walk3", "bluntwood_walk4", "bluntwood_walk5", "bluntwood_walk6", "bluntwood_walk7", "bluntwood_walk8", "bluntwood_walk9" },
        course = {},
        chute  = {},
        autre  = { "bluntwood_wander1", "bluntwood_wander2", "bluntwood_wander3", "bluntwood_wander4", "bluntwood_wander5" },
    },
    -- brush : 11 echantillon(s)
    brush = {
        marche = {},
        course = {},
        chute  = {},
        autre  = { "brush_through1", "brush_through10", "brush_through11", "brush_through2", "brush_through3", "brush_through4", "brush_through5", "brush_through6", "brush_through7", "brush_through8", "brush_through9" },
    },
    -- concrete : 27 echantillon(s)
    concrete = {
        marche = { "concrete_walk1", "concrete_walk10", "concrete_walk11", "concrete_walk2", "concrete_walk3", "concrete_walk4", "concrete_walk5", "concrete_walk6", "concrete_walk7", "concrete_walk8", "concrete_walk9" },
        course = { "concrete_run1", "concrete_run10", "concrete_run11", "concrete_run2", "concrete_run3", "concrete_run4", "concrete_run5", "concrete_run6", "concrete_run7", "concrete_run8", "concrete_run9" },
        chute  = {},
        autre  = { "concrete_wander1", "concrete_wander2", "concrete_wander3", "concrete_wander4", "concrete_wander5" },
    },
    -- deckwood : 11 echantillon(s)
    deckwood = {
        marche = {},
        course = { "deckwood_run1", "deckwood_run10", "deckwood_run11", "deckwood_run2", "deckwood_run3", "deckwood_run4", "deckwood_run5", "deckwood_run6", "deckwood_run7", "deckwood_run8", "deckwood_run9" },
        chute  = {},
        autre  = {},
    },
    -- dirt : 31 echantillon(s)
    dirt = {
        marche = { "dirt_walk1", "dirt_walk10", "dirt_walk11", "dirt_walk2", "dirt_walk3", "dirt_walk4", "dirt_walk5", "dirt_walk6", "dirt_walk7", "dirt_walk8", "dirt_walk9" },
        course = { "dirt_run1", "dirt_run10", "dirt_run11", "dirt_run2", "dirt_run3", "dirt_run4", "dirt_run5", "dirt_run6", "dirt_run7", "dirt_run8", "dirt_run9" },
        chute  = { "dirt_land1", "dirt_land2", "dirt_land3", "dirt_land4" },
        autre  = { "dirt_wander1", "dirt_wander2", "dirt_wander3", "dirt_wander4", "dirt_wander5" },
    },
    -- glass : 3 echantillon(s)
    glass = {
        marche = {},
        course = {},
        chute  = {},
        autre  = { "glass_hard1", "glass_hit1", "glass_hit2" },
    },
    -- grass : 20 echantillon(s)
    grass = {
        marche = { "grass_walk1", "grass_walk10", "grass_walk2", "grass_walk3", "grass_walk4", "grass_walk5", "grass_walk6", "grass_walk7", "grass_walk8", "grass_walk9" },
        course = { "grass_run1", "grass_run2", "grass_run3", "grass_run4" },
        chute  = {},
        autre  = { "grass_wander1", "grass_wander2", "grass_wander3", "grass_wander4", "grass_wander5", "grass_wander6" },
    },
    -- gravel : 27 echantillon(s)
    gravel = {
        marche = { "gravel_walk1", "gravel_walk10", "gravel_walk11", "gravel_walk2", "gravel_walk3", "gravel_walk4", "gravel_walk5", "gravel_walk6", "gravel_walk7", "gravel_walk8", "gravel_walk9" },
        course = { "gravel_run1", "gravel_run10", "gravel_run11", "gravel_run2", "gravel_run3", "gravel_run4", "gravel_run5", "gravel_run6", "gravel_run7", "gravel_run8", "gravel_run9" },
        chute  = { "gravel_land1", "gravel_land2" },
        autre  = { "gravel_wander1", "gravel_wander2", "gravel_wander3" },
    },
    -- leaves : 7 echantillon(s)
    leaves = {
        marche = {},
        course = {},
        chute  = {},
        autre  = { "leaves_through1", "leaves_through2", "leaves_through3", "leaves_through4", "leaves_through5", "leaves_through6", "leaves_through7" },
    },
    -- lino : 14 echantillon(s)
    lino = {
        marche = { "lino_walk1", "lino_walk2", "lino_walk3", "lino_walk4", "lino_walk5", "lino_walk6", "lino_walk7", "lino_walk8" },
        course = { "lino_run1", "lino_run2", "lino_run3", "lino_run4", "lino_run5", "lino_run6" },
        chute  = {},
        autre  = {},
    },
    -- marble : 29 echantillon(s)
    marble = {
        marche = { "marble_walk1", "marble_walk10", "marble_walk11", "marble_walk2", "marble_walk3", "marble_walk4", "marble_walk5", "marble_walk6", "marble_walk7", "marble_walk8", "marble_walk9" },
        course = { "marble_run1", "marble_run10", "marble_run11", "marble_run2", "marble_run3", "marble_run4", "marble_run5", "marble_run6", "marble_run7", "marble_run8", "marble_run9" },
        chute  = {},
        autre  = { "marble_wander1", "marble_wander2", "marble_wander3", "marble_wander4", "marble_wander5", "marble_wander6", "marble_wander7" },
    },
    -- metalbar : 29 echantillon(s)
    metalbar = {
        marche = { "metalbar_walk1", "metalbar_walk10", "metalbar_walk11", "metalbar_walk2", "metalbar_walk3", "metalbar_walk4", "metalbar_walk5", "metalbar_walk6", "metalbar_walk7", "metalbar_walk8", "metalbar_walk9" },
        course = { "metalbar_run1", "metalbar_run10", "metalbar_run11", "metalbar_run2", "metalbar_run3", "metalbar_run4", "metalbar_run5", "metalbar_run6", "metalbar_run7", "metalbar_run8", "metalbar_run9" },
        chute  = { "metalbar_land1" },
        autre  = { "metalbar_wander1", "metalbar_wander2", "metalbar_wander3", "metalbar_wander4", "metalbar_wander5", "metalbar_wander6" },
    },
    -- metalbox : 23 echantillon(s)
    metalbox = {
        marche = { "metalbox_walk1", "metalbox_walk2", "metalbox_walk3", "metalbox_walk4", "metalbox_walk5", "metalbox_walk6", "metalbox_walk7", "metalbox_walk8", "metalbox_walk9" },
        course = { "metalbox_run1", "metalbox_run10", "metalbox_run2", "metalbox_run3", "metalbox_run4", "metalbox_run5", "metalbox_run6", "metalbox_run7", "metalbox_run8", "metalbox_run9" },
        chute  = {},
        autre  = { "metalbox_wander1", "metalbox_wander2", "metalbox_wander3", "metalbox_wander4" },
    },
    -- mud : 10 echantillon(s)
    mud = {
        marche = { "mud_walk1", "mud_walk2", "mud_walk3", "mud_walk4", "mud_walk5", "mud_walk6" },
        course = {},
        chute  = {},
        autre  = { "mud_wander1", "mud_wander2", "mud_wander3", "mud_wander4" },
    },
    -- muffledice : 10 echantillon(s)
    muffledice = {
        marche = { "muffledice_walk1", "muffledice_walk10", "muffledice_walk2", "muffledice_walk3", "muffledice_walk4", "muffledice_walk5", "muffledice_walk6", "muffledice_walk7", "muffledice_walk8", "muffledice_walk9" },
        course = {},
        chute  = {},
        autre  = {},
    },
    -- quicksand : 11 echantillon(s)
    quicksand = {
        marche = { "quicksand_walk1", "quicksand_walk10", "quicksand_walk11", "quicksand_walk2", "quicksand_walk3", "quicksand_walk4", "quicksand_walk5", "quicksand_walk6", "quicksand_walk7", "quicksand_walk8", "quicksand_walk9" },
        course = {},
        chute  = {},
        autre  = {},
    },
    -- rug : 11 echantillon(s)
    rug = {
        marche = { "rug_walk1", "rug_walk10", "rug_walk11", "rug_walk2", "rug_walk3", "rug_walk4", "rug_walk5", "rug_walk6", "rug_walk7", "rug_walk8", "rug_walk9" },
        course = {},
        chute  = {},
        autre  = {},
    },
    -- sand : 22 echantillon(s)
    sand = {
        marche = { "sand_walk1", "sand_walk10", "sand_walk11", "sand_walk2", "sand_walk3", "sand_walk4", "sand_walk5", "sand_walk6", "sand_walk7", "sand_walk8", "sand_walk9" },
        course = { "sand_run1", "sand_run10", "sand_run11", "sand_run2", "sand_run3", "sand_run4", "sand_run5", "sand_run6", "sand_run7", "sand_run8", "sand_run9" },
        chute  = {},
        autre  = {},
    },
    -- snow : 27 echantillon(s)
    snow = {
        marche = { "snow_walk1", "snow_walk10", "snow_walk11", "snow_walk2", "snow_walk3", "snow_walk4", "snow_walk5", "snow_walk6", "snow_walk7", "snow_walk8", "snow_walk9" },
        course = { "snow_run1", "snow_run10", "snow_run11", "snow_run2", "snow_run3", "snow_run4", "snow_run5", "snow_run6", "snow_run7", "snow_run8", "snow_run9" },
        chute  = {},
        autre  = { "snow_wander1", "snow_wander2", "snow_wander3", "snow_wander4", "snow_wander5" },
    },
    -- squeakywood : 18 echantillon(s)
    squeakywood = {
        marche = { "squeakywood_walk1", "squeakywood_walk10", "squeakywood_walk11", "squeakywood_walk2", "squeakywood_walk3", "squeakywood_walk4", "squeakywood_walk5", "squeakywood_walk6", "squeakywood_walk7", "squeakywood_walk8", "squeakywood_walk9" },
        course = {},
        chute  = {},
        autre  = { "squeakywood_wander1", "squeakywood_wander2", "squeakywood_wander3", "squeakywood_wander4", "squeakywood_wander5", "squeakywood_wander6", "squeakywood_wander7" },
    },
    -- stone : 27 echantillon(s)
    stone = {
        marche = { "stone_walk1", "stone_walk10", "stone_walk11", "stone_walk2", "stone_walk3", "stone_walk4", "stone_walk5", "stone_walk6", "stone_walk7", "stone_walk8", "stone_walk9" },
        course = { "stone_run1", "stone_run10", "stone_run11", "stone_run2", "stone_run3", "stone_run4", "stone_run5", "stone_run6", "stone_run7", "stone_run8", "stone_run9" },
        chute  = {},
        autre  = { "stone_wander1", "stone_wander2", "stone_wander3", "stone_wander4", "stone_wander5" },
    },
    -- water : 32 echantillon(s)
    water = {
        marche = {},
        course = {},
        chute  = {},
        autre  = { "water_through1", "water_through10", "water_through10_2", "water_through11", "water_through11_2", "water_through1_2", "water_through2", "water_through2_2", "water_through3", "water_through3_2", "water_through4", "water_through4_2", "water_through5", "water_through5_2", "water_through6", "water_through6_2", "water_through7", "water_through7_2", "water_through8", "water_through8_2", "water_through9", "water_through9_2", "water_wander1", "water_wander1_2", "water_wander2", "water_wander2_2", "water_wander3", "water_wander3_2", "water_wander4", "water_wander4_2", "water_wander5", "water_wander5_2" },
    },
    -- weakice : 10 echantillon(s)
    weakice = {
        marche = { "weakice_walk1", "weakice_walk10", "weakice_walk2", "weakice_walk3", "weakice_walk4", "weakice_walk5", "weakice_walk6", "weakice_walk7", "weakice_walk8", "weakice_walk9" },
        course = {},
        chute  = {},
        autre  = {},
    },
    -- wood : 11 echantillon(s)
    wood = {
        marche = { "wood_walk1", "wood_walk10", "wood_walk11", "wood_walk2", "wood_walk3", "wood_walk4", "wood_walk5", "wood_walk6", "wood_walk7", "wood_walk8", "wood_walk9" },
        course = {},
        chute  = {},
        autre  = {},
    },
}

return Pas
