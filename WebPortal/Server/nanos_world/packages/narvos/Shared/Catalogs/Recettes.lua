-- ═══════════════════════════════════════════════════════════════════════════════
-- Recettes.lua — les recettes de craft de NARVOS.
--
-- ── PORTÉ DE `src/rpg/items/craftingSystem.ts` (9) + FUSION C (4 raffinage) ─────
-- Les 9 recettes `craft_*` sont le portage fidèle du catalogue TypeScript
-- `CRAFT_RECIPES` : mêmes identifiants (`craft_plasma_blade`…), mêmes entrées,
-- mêmes sorties, mêmes stations. `palier` = `requiredLevel` du TS, `duree_ms` =
-- `craftTimeSec * 1000`. Le TS reste la source de vérité ; si l'un des deux
-- change, l'autre doit suivre (vérifié par `scripts/lua-harness/craft.mjs`).
-- Les 4 recettes `refine_*` sont le pont FUSION C : elles consomment les
-- ressources récoltées (`professionCatalog`) et produisent les matières sci-fi
-- (`Items.lua`). Voir docs/FUSION_C_2026-09-07.md.
--
-- ── CONTRAT AVEC `Logic/Craft.lua` ────────────────────────────────────────────
-- `Logic/Craft.lua` lit `Recettes.RECETTES` et `Recettes.ORDRE`. Chaque recette :
--   id        identifiant, unique
--   label     texte affichable
--   sortie    { item_id, quantite }  — item du catalogue `Items.lua` (aucun autre)
--   entrees   liste ordonnée de { item_id, quantite }, toutes DIFFÉRENTES
--   station   identifiant de station requis, ou nil pour un craft « mains »
--   palier    niveau de compétence requis
--   duree_ms  temps de fabrication (décidé par le serveur, pas ici)
--
-- ── STATIONS ──────────────────────────────────────────────────────────────────
-- forge / workbench / alchemy / refinery (les 4 du TS). `refinery` est présente :
-- elle produit les matériaux (noyau_plasma, metal_rare) depuis la raffinerie.
-- ═══════════════════════════════════════════════════════════════════════════════

local Recettes = {}

--- Ordre d'affichage (règle `pairs`, cf. `Factions.ORDRE`).
--- C'est l'ordre du catalogue TypeScript : forge, puis workbench, puis alchimie,
--- puis raffinerie.
Recettes.ORDRE = {
    "craft_plasma_blade",
    "craft_cyber_armor",
    "craft_plasma_shield",
    "craft_void_amulet",
    "craft_power_ring",
    "craft_potion_soin_majeure",
    "craft_potion_mana_mineure",
    "craft_noyau_plasma",
    "craft_metal_rare",
    "refine_metal_rare",
    "refine_cristal_energie",
    "refine_fragment_vie",
    "refine_powernax",
"f_dague_fer",
    "f_epee_acier",
    "f_hache_raffinee",
    "f_lame_magique",
    "f_egide_lunaire",
    "f_lame_adamantite",
    "a_soin_mineur",
    "a_vigueur",
    "a_givre",
    "a_arcanique",
    "a_lunaire",
    "a_panacee",
    "j_anneau_fer",
    "j_pendentif_acier",
    "j_bague_givre",
    "j_talisman",
    "j_diademe",
    "j_couronne",
}

Recettes.RECETTES = {
    craft_plasma_blade = {
        id = "craft_plasma_blade",
        label = "Lame Plasma",
        sortie = { item_id = "plasma_blade", quantite = 1 },
        entrees = {
            { item_id = "metal_rare", quantite = 3 },
            { item_id = "noyau_plasma", quantite = 1 },
            { item_id = "cristal_energie", quantite = 5 },
        },
        station = "forge",
        palier = 5,
        duree_ms = 10000,
    },
    craft_cyber_armor = {
        id = "craft_cyber_armor",
        label = "Armure Cybernétique",
        sortie = { item_id = "cyber_armor", quantite = 1 },
        entrees = {
            { item_id = "metal_rare", quantite = 5 },
            { item_id = "noyau_plasma", quantite = 2 },
            { item_id = "adn_alien", quantite = 2 },
        },
        station = "forge",
        palier = 8,
        duree_ms = 15000,
    },
    craft_plasma_shield = {
        id = "craft_plasma_shield",
        label = "Bouclier Plasma",
        sortie = { item_id = "plasma_shield", quantite = 1 },
        entrees = {
            { item_id = "metal_rare", quantite = 4 },
            { item_id = "noyau_plasma", quantite = 1 },
            { item_id = "cristal_energie", quantite = 8 },
        },
        station = "forge",
        palier = 10,
        duree_ms = 12000,
    },
    craft_void_amulet = {
        id = "craft_void_amulet",
        label = "Amulette du Vide",
        sortie = { item_id = "void_amulet", quantite = 1 },
        entrees = {
            { item_id = "powernax", quantite = 2 },
            { item_id = "cristal_energie", quantite = 10 },
            { item_id = "metal_rare", quantite = 2 },
        },
        station = "workbench",
        palier = 8,
        duree_ms = 8000,
    },
    craft_power_ring = {
        id = "craft_power_ring",
        label = "Anneau de Puissance",
        sortie = { item_id = "power_ring", quantite = 1 },
        entrees = {
            { item_id = "metal_rare", quantite = 2 },
            { item_id = "cristal_energie", quantite = 5 },
        },
        station = "workbench",
        palier = 4,
        duree_ms = 5000,
    },
    craft_potion_soin_majeure = {
        id = "craft_potion_soin_majeure",
        label = "Potion de Soin Majeure",
        sortie = { item_id = "potion_soin_majeure", quantite = 1 },
        entrees = {
            { item_id = "fragment_vie", quantite = 5 },
            { item_id = "cristal_energie", quantite = 3 },
        },
        station = "alchemy",
        palier = 5,
        duree_ms = 4000,
    },
    craft_potion_mana_mineure = {
        id = "craft_potion_mana_mineure",
        label = "Potion de Mana Mineure",
        sortie = { item_id = "potion_mana_mineure", quantite = 1 },
        entrees = {
            { item_id = "cristal_energie", quantite = 2 },
        },
        station = "alchemy",
        palier = 1,
        duree_ms = 2000,
    },
    craft_noyau_plasma = {
        id = "craft_noyau_plasma",
        label = "Noyau Plasma",
        sortie = { item_id = "noyau_plasma", quantite = 1 },
        entrees = {
            { item_id = "cristal_energie", quantite = 10 },
            { item_id = "metal_rare", quantite = 1 },
        },
        station = "refinery",
        palier = 5,
        duree_ms = 6000,
    },
    craft_metal_rare = {
        id = "craft_metal_rare",
        label = "Métal Rare",
        sortie = { item_id = "metal_rare", quantite = 1 },
        entrees = {
            { item_id = "fragment_vie", quantite = 3 },
            { item_id = "cristal_energie", quantite = 3 },
        },
        station = "refinery",
        palier = 3,
        duree_ms = 3000,
    },
    -- ── FUSION C — raffinage des ressources récoltées vers les matières sci-fi ──
    -- Pont entre les deux économies (professionCatalog → Items.lua). Consomme les
    -- 18 ressources récoltables, produit les 6 matières à émoji. Voir docs/UNIVERS_OBJETS.
    refine_metal_rare = {
        id = "refine_metal_rare",
        label = "Raffiner du métal rare",
        sortie = { item_id = "metal_rare", quantite = 1 },
        entrees = {
            { item_id = "fer", quantite = 3 },
            { item_id = "acier", quantite = 2 },
        },
        station = "refinery",
        palier = 3,
        duree_ms = 5000,
    },
    refine_cristal_energie = {
        id = "refine_cristal_energie",
        label = "Cristalliser de l'énergie",
        sortie = { item_id = "cristal_energie", quantite = 1 },
        entrees = {
            { item_id = "cristal_magique", quantite = 3 },
            { item_id = "minerai_lunaire", quantite = 2 },
        },
        station = "refinery",
        palier = 3,
        duree_ms = 5000,
    },
    refine_fragment_vie = {
        id = "refine_fragment_vie",
        label = "Extraire un fragment de vie",
        sortie = { item_id = "fragment_vie", quantite = 1 },
        entrees = {
            { item_id = "fleur_eternelle", quantite = 2 },
            { item_id = "essence_lunaire", quantite = 2 },
        },
        station = "refinery",
        palier = 4,
        duree_ms = 6000,
    },
    refine_powernax = {
        id = "refine_powernax",
        label = "Assembler un POWERNAX",
        sortie = { item_id = "powernax", quantite = 1 },
        entrees = {
            { item_id = "bois_legendaire", quantite = 2 },
            { item_id = "adamantite", quantite = 2 },
        },
        station = "refinery",
        palier = 6,
        duree_ms = 12000,
    },
    -- ── FUSION C — recettes métier (professionCatalog.RECIPES) portées dans Craft.lua ──
    f_dague_fer = {
        id = "f_dague_fer",
        label = "Dague de fer",
        sortie = { item_id = "dague_fer", quantite = 1 },
        entrees = {
            { item_id = "fer", quantite = 2 },
            { item_id = "bois_use", quantite = 1 },
        },
        station = "forge",
        palier = 1,
        duree_ms = 1900,
    },
    f_epee_acier = {
        id = "f_epee_acier",
        label = "Épée d'acier",
        sortie = { item_id = "epee_acier", quantite = 1 },
        entrees = {
            { item_id = "acier", quantite = 3 },
            { item_id = "chene_solide", quantite = 2 },
        },
        station = "forge",
        palier = 10,
        duree_ms = 5500,
    },
    f_hache_raffinee = {
        id = "f_hache_raffinee",
        label = "Hache raffinée",
        sortie = { item_id = "hache_raffinee", quantite = 1 },
        entrees = {
            { item_id = "acier", quantite = 4 },
            { item_id = "bois_ancien", quantite = 2 },
        },
        station = "forge",
        palier = 20,
        duree_ms = 9500,
    },
    f_lame_magique = {
        id = "f_lame_magique",
        label = "Lame magique",
        sortie = { item_id = "lame_magique", quantite = 1 },
        entrees = {
            { item_id = "cristal_magique", quantite = 3 },
            { item_id = "bois_spectral", quantite = 2 },
        },
        station = "forge",
        palier = 30,
        duree_ms = 13500,
    },
    f_egide_lunaire = {
        id = "f_egide_lunaire",
        label = "Égide lunaire",
        sortie = { item_id = "egide_lunaire", quantite = 1 },
        entrees = {
            { item_id = "minerai_lunaire", quantite = 4 },
            { item_id = "bois_lunaire", quantite = 3 },
        },
        station = "forge",
        palier = 40,
        duree_ms = 17500,
    },
    f_lame_adamantite = {
        id = "f_lame_adamantite",
        label = "Lame d'adamantite",
        sortie = { item_id = "lame_adamantite", quantite = 1 },
        entrees = {
            { item_id = "adamantite", quantite = 5 },
            { item_id = "bois_legendaire", quantite = 3 },
        },
        station = "forge",
        palier = 50,
        duree_ms = 21500,
    },
    a_soin_mineur = {
        id = "a_soin_mineur",
        label = "Potion de soin mineure",
        sortie = { item_id = "potion_soin_min", quantite = 1 },
        entrees = {
            { item_id = "herbe_commune", quantite = 2 },
        },
        station = "alchemy",
        palier = 1,
        duree_ms = 1900,
    },
    a_vigueur = {
        id = "a_vigueur",
        label = "Élixir de vigueur",
        sortie = { item_id = "elixir_vigueur", quantite = 1 },
        entrees = {
            { item_id = "racine_robuste", quantite = 3 },
            { item_id = "fer", quantite = 1 },
        },
        station = "alchemy",
        palier = 10,
        duree_ms = 5500,
    },
    a_givre = {
        id = "a_givre",
        label = "Philtre de givre",
        sortie = { item_id = "philtre_givre", quantite = 1 },
        entrees = {
            { item_id = "fleur_de_givre", quantite = 3 },
        },
        station = "alchemy",
        palier = 20,
        duree_ms = 9500,
    },
    a_arcanique = {
        id = "a_arcanique",
        label = "Décoction arcanique",
        sortie = { item_id = "decoction_arcanique", quantite = 1 },
        entrees = {
            { item_id = "lichen_arcanique", quantite = 3 },
            { item_id = "cristal_magique", quantite = 1 },
        },
        station = "alchemy",
        palier = 30,
        duree_ms = 13500,
    },
    a_lunaire = {
        id = "a_lunaire",
        label = "Essence concentrée",
        sortie = { item_id = "essence_concentree", quantite = 1 },
        entrees = {
            { item_id = "essence_lunaire", quantite = 4 },
        },
        station = "alchemy",
        palier = 40,
        duree_ms = 17500,
    },
    a_panacee = {
        id = "a_panacee",
        label = "Panacée éternelle",
        sortie = { item_id = "panacee_eternelle", quantite = 1 },
        entrees = {
            { item_id = "fleur_eternelle", quantite = 5 },
            { item_id = "adamantite", quantite = 1 },
        },
        station = "alchemy",
        palier = 50,
        duree_ms = 21500,
    },
    j_anneau_fer = {
        id = "j_anneau_fer",
        label = "Anneau de fer",
        sortie = { item_id = "anneau_fer", quantite = 1 },
        entrees = {
            { item_id = "fer", quantite = 2 },
        },
        station = "workbench",
        palier = 1,
        duree_ms = 1900,
    },
    j_pendentif_acier = {
        id = "j_pendentif_acier",
        label = "Pendentif d'acier",
        sortie = { item_id = "pendentif_acier", quantite = 1 },
        entrees = {
            { item_id = "acier", quantite = 3 },
            { item_id = "racine_robuste", quantite = 1 },
        },
        station = "workbench",
        palier = 10,
        duree_ms = 5500,
    },
    j_bague_givre = {
        id = "j_bague_givre",
        label = "Bague de givre",
        sortie = { item_id = "bague_givre", quantite = 1 },
        entrees = {
            { item_id = "fleur_de_givre", quantite = 2 },
            { item_id = "acier", quantite = 2 },
        },
        station = "workbench",
        palier = 20,
        duree_ms = 9500,
    },
    j_talisman = {
        id = "j_talisman",
        label = "Talisman magique",
        sortie = { item_id = "talisman_magique", quantite = 1 },
        entrees = {
            { item_id = "cristal_magique", quantite = 3 },
        },
        station = "workbench",
        palier = 30,
        duree_ms = 13500,
    },
    j_diademe = {
        id = "j_diademe",
        label = "Diadème lunaire",
        sortie = { item_id = "diademe_lunaire", quantite = 1 },
        entrees = {
            { item_id = "minerai_lunaire", quantite = 4 },
            { item_id = "essence_lunaire", quantite = 1 },
        },
        station = "workbench",
        palier = 40,
        duree_ms = 17500,
    },
    j_couronne = {
        id = "j_couronne",
        label = "Couronne éternelle",
        sortie = { item_id = "couronne_eternelle", quantite = 1 },
        entrees = {
            { item_id = "adamantite", quantite = 4 },
            { item_id = "fleur_eternelle", quantite = 1 },
        },
        station = "workbench",
        palier = 50,
        duree_ms = 21500,
    },
}

return Recettes
