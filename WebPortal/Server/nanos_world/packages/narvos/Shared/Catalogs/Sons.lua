-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/Sons.lua — correspondance événement → son (port de la DATA des
-- 4 fichiers audio TS : footstepSystem, areaAnnouncements, bossWarningAudio,
-- killStreakAudio).
--
-- ⚠ VÉRIFIÉ contre `Assets.toml [assets.sounds]` (le pack cuit, ~930 sons) :
--   · les PAS (Footsteps_Sound_Effects_Pro) SONT dans le pack → valides.
--   · les sons d'ÉVÉNEMENT (aoe, announce, killStreak) sont ABSENTS du pack
--     (0/13) — références client Web Audio, donc **références mortes** pour
--     `Sound(...)` tant qu'ils ne sont pas cuits. Marqués ⚠ à cuire.
-- La plomberie (détection de surface par raycast, lecture `Sound()`) N'EST PAS
-- ici — c'est l'exécutant Server/Client. Seul le SON se porte.
-- ═══════════════════════════════════════════════════════════════════════════════

local Sons = {}

-- ── Pas : 26 catégories (Footsteps_Sound_Effects_Pro) + sample count ───────────
-- `compte` = nombre de fichiers de la catégorie (CATEGORY_SAMPLE_COUNTS du TS).
-- Les fichiers sont nommés `Narvos/Footsteps.../WAV/<Cat>/<nom>` dans Assets.toml.
Sons.PAS_CATEGORIES = {
    "armor", "bluntwood", "brush", "concrete", "deckwood", "dirt", "glass",
    "grass", "gravel", "leaves", "lino", "marble", "metalbar", "metalbox",
    "mud", "muffledice", "quicksand", "rug", "sand", "snow", "squeakywood",
    "stone", "water", "weakice", "wood",
}

-- ── Pas : règles matériau → catégorie (MATERIAL_RULES du TS, en ordre) ─────────
-- Converties de POSIX → listes de sous-chaînes (Lua `find(..., true)` = plain,
-- insensible à la casse après lower). La PREMIÈRE règle qui matche gagne.
-- Repli = "grass" (PAS_DEFAUT).
Sons.PAS_REGLES = {
    { motifs = { "snow", "neige", "ice" },          categorie = "snow" },
    { motifs = { "rock", "roche", "stone" },        categorie = "stone" },
    { motifs = { "gravel", "cailloux", "pebble" },  categorie = "gravel" },
    { motifs = { "grass", "herbe", "herb" },        categorie = "grass" },
    { motifs = { "dirt", "terre", "soil", "mud" },  categorie = "dirt" },
    { motifs = { "sand", "sable" },                 categorie = "sand" },
    { motifs = { "water", "eau", "flaque", "puddle" }, categorie = "water" },
    { motifs = { "concrete", "beton" },             categorie = "concrete" },
    { motifs = { "marble", "marbre" },              categorie = "marble" },
    { motifs = { "wood", "bois", "parquet", "plank" }, categorie = "wood" },
    { motifs = { "deckwood", "deck" },              categorie = "deckwood" },
    { motifs = { "squeaky", "grince" },             categorie = "squeakywood" },
    { motifs = { "bluntwood" },                     categorie = "bluntwood" },
    { motifs = { "metal", "steel", "fer", "iron" }, categorie = "metalbar" },
    { motifs = { "box", "boite" },                  categorie = "metalbox" },
    { motifs = { "glass", "verre" },                categorie = "glass" },
    { motifs = { "lino", "linoleum" },              categorie = "lino" },
    { motifs = { "brush", "brosse", "buisson" },    categorie = "brush" },
    { motifs = { "leaves", "feuille", "leaf" },     categorie = "leaves" },
    { motifs = { "boue" },                          categorie = "mud" },
    { motifs = { "quicksand", "sables" },           categorie = "quicksand" },
    { motifs = { "armor", "armure", "armour" },     categorie = "armor" },
    { motifs = { "weakice" },                       categorie = "weakice" },
    { motifs = { "muffledice" },                    categorie = "muffledice" },
    { motifs = { "rug", "tapis" },                  categorie = "rug" },
    { motifs = { "stereofix" },                     categorie = "water" },
}
Sons.PAS_DEFAUT = "grass"

Sons.PAS_COMPTE = {
    armor = 53, bluntwood = 16, brush = 11, concrete = 27, deckwood = 11,
    dirt = 31, glass = 3, grass = 20, gravel = 27, leaves = 7, lino = 14,
    marble = 29, metalbar = 29, metalbox = 23, mud = 10, muffledice = 10,
    quicksand = 11, rug = 11, sand = 22, snow = 27, squeakywood = 18,
    stone = 27, water = 32, weakice = 10, wood = 11,
}

-- ── SurfaceType du moteur → catégorie de pas ──────────────────────────────────
--
-- Les 22 valeurs de l'enum `SurfaceType` (relevées dans
-- `libraries/api-main/api-main/Enums.json` le 2026-09-10), traduites vers nos
-- 25 catégories. C'est le signal le plus SÛR : il vient du matériau physique de
-- l'asset, pas d'une ressemblance de nom.
--
-- ⚠ Trois valeurs sont volontairement ABSENTES de cette table :
--   · `Default` (0) — « aucun matériau physique posé », pas « surface par
--     défaut ». La mapper ferait passer pour une réponse ce qui est un silence,
--     et le repli par nom ne serait jamais atteint.
--   · `Air` (21) — on ne marche pas dessus.
--   · `Flesh` (12) — un corps n'est pas un sol.
-- Une clé absente rend `nil`, ce qui fait descendre d'un étage. C'est le but.
Sons.PAS_PAR_SURFACE = {
    [1]  = "rug",         -- Carpet
    [2]  = "concrete",    -- Concrete
    [3]  = "grass",       -- Grass
    [4]  = "gravel",      -- Gravel
    [5]  = "dirt",        -- Ground
    [6]  = "metalbar",    -- MetalLight  (barre : le son léger du pack)
    [7]  = "lino",        -- Plastic     (le lino est le plastique du pack)
    [8]  = "sand",        -- Sand
    [9]  = "snow",        -- Snow
    [10] = "water",       -- Water
    [11] = "wood",        -- WoodLight
    [13] = "metalbox",    -- MetalHeavy  (caisse : le son plein)
    [14] = "deckwood",    -- WoodHeavy   (platelage)
    [15] = "weakice",     -- Ice
    [16] = "mud",         -- Mud
    [17] = "stone",       -- Rock
    [18] = "muffledice",  -- Thump       (sourd)
    [19] = "glass",       -- Glass
    [20] = "lino",        -- Rubber
}

-- ── Boss : alerte AoE, jouée 1× par boss (⚠ à cuire : absent du pack) ─────────
Sons.BOSS_ALERTE = "aoe.mp3"

-- ── Annonces de zone : entrée + niveau conseillé (⚠ à cuire : absents du pack) ─
Sons.ZONES = {
    forge =   { entree = "entre_de_la_mapforge.mp3",  niveau = "1_a_10_mapforge.mp3" },
    orbital = { entree = "entrerzoneorbital.mp3",     niveau = "orbital_zone_20_30.mp3" },
    tower =   { entree = "entre_de_la_map_tower.mp3", niveau = "zone_40_a_50_tower.mp3" },
}
Sons.DONJON_ENTREE = "entre_dans_le_dojon.mp3"
Sons.NIVEAU_DELAI_MS = 3500

-- ── Série de kills : palier → son + libellé (⚠ à cuire : absents du pack) ─────
Sons.SERIES = {
    [2] = { son = "double_kils.mp3",   label = "DOUBLE KILL" },
    [3] = { son = "triple_frague.mp3", label = "TRIPLE KILL" },
    [4] = { son = "quadra_kils.mp3",   label = "QUADRA KILL" },
    [5] = { son = "pentakil.mp3",      label = "PENTA KILL" },
    ["6+"] = { son = "masacre.mp3",    label = "MASSACRE" },
}
Sons.SERIE_FENETRE_S = 10

return Sons