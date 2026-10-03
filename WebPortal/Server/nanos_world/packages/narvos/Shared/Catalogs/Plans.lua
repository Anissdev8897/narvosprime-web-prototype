-- Généré par scripts/narvos-plans-to-lua.mjs depuis :
--   · Catalogs/Recettes.lua (exécuté sous wasmoon — jamais recopié),
--   · runtime/vehicles/vehicleCatalog.ts (VOITURES_NANOS, garde Assets.toml),
--   · Catalogs/Items.lua (la garde d'existence de chaque pièce nommée).
-- Ne pas éditer à la main : régénérer après toute évolution d'une source.
--
-- CONTRAT : chaque plan est passé sous Assemblage.ValiderPlan (modules réels)
-- avant écriture, et repasse sous le harnais scripts/lua-harness/plans.mjs.
-- Champs au-delà du contrat ValiderPlan, documentés pour l'UI (chantier C) :
--   genre   = "vehicule" | "arme" | "objet"  (déduit du type du résultat)
--   station = station de craft héritée de la recette (plans recettes)
--   palier  = niveau requis hérité de la recette (plans recettes)
--   visuel  = { mesh = "narvos::SK_…" } (plans véhicules — vérifié cuit)
-- Plans.EXCLUS : les plans NON émis, chacun avec son motif. Vide = rien exclu.

local Plans = {}

Plans.ORDRE = {
    "plan_craft_plasma_blade",
    "plan_craft_cyber_armor",
    "plan_craft_plasma_shield",
    "plan_craft_void_amulet",
    "plan_craft_power_ring",
    "plan_craft_potion_soin_majeure",
    "plan_craft_potion_mana_mineure",
    "plan_craft_noyau_plasma",
    "plan_craft_metal_rare",
    "plan_refine_metal_rare",
    "plan_refine_cristal_energie",
    "plan_refine_fragment_vie",
    "plan_refine_powernax",
    "plan_f_dague_fer",
    "plan_f_epee_acier",
    "plan_f_hache_raffinee",
    "plan_f_lame_magique",
    "plan_f_egide_lunaire",
    "plan_f_lame_adamantite",
    "plan_a_soin_mineur",
    "plan_a_vigueur",
    "plan_a_givre",
    "plan_a_arcanique",
    "plan_a_lunaire",
    "plan_a_panacee",
    "plan_j_anneau_fer",
    "plan_j_pendentif_acier",
    "plan_j_bague_givre",
    "plan_j_talisman",
    "plan_j_diademe",
    "plan_j_couronne",
    "plan_vehicule_executive_sedan",
    "plan_vehicule_luxury_car",
    "plan_vehicule_sport_wagon",
    "plan_vehicule_station_wagon",
    "plan_vehicule_family_hatchback",
    "plan_vehicule_hatchback1",
    "plan_vehicule_sporty_compact_hatchback",
    "plan_vehicule_compact_crossover",
    "plan_vehicule_fullsize_suv",
    "plan_vehicule_minivan",
    "plan_vehicule_compact_panel_van",
    "plan_vehicule_pickup",
}

Plans.PLANS = {
    plan_craft_plasma_blade = {
        id = "plan_craft_plasma_blade",
        label = "Lame Plasma",
        genre = "arme",
        station = "forge",
        palier = 5,
        resultat = {
            item_id = "plasma_blade",
            quantite = 1,
        },
        emplacements = {
            {
                id = "metal_rare",
                label = "Métal Rare",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "metal_rare",
                    },
                },
            },
            {
                id = "noyau_plasma",
                label = "Noyau Plasma",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "noyau_plasma",
                    },
                },
            },
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 5,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
        },
    },
    plan_craft_cyber_armor = {
        id = "plan_craft_cyber_armor",
        label = "Armure Cybernétique",
        genre = "objet",
        station = "forge",
        palier = 8,
        resultat = {
            item_id = "cyber_armor",
            quantite = 1,
        },
        emplacements = {
            {
                id = "metal_rare",
                label = "Métal Rare",
                obligatoire = true,
                quantite = 5,
                filtre = {
                    items = {
                        "metal_rare",
                    },
                },
            },
            {
                id = "noyau_plasma",
                label = "Noyau Plasma",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "noyau_plasma",
                    },
                },
            },
            {
                id = "adn_alien",
                label = "ADN Alien",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "adn_alien",
                    },
                },
            },
        },
    },
    plan_craft_plasma_shield = {
        id = "plan_craft_plasma_shield",
        label = "Bouclier Plasma",
        genre = "arme",
        station = "forge",
        palier = 10,
        resultat = {
            item_id = "plasma_shield",
            quantite = 1,
        },
        emplacements = {
            {
                id = "metal_rare",
                label = "Métal Rare",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "metal_rare",
                    },
                },
            },
            {
                id = "noyau_plasma",
                label = "Noyau Plasma",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "noyau_plasma",
                    },
                },
            },
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 8,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
        },
    },
    plan_craft_void_amulet = {
        id = "plan_craft_void_amulet",
        label = "Amulette du Vide",
        genre = "objet",
        station = "workbench",
        palier = 8,
        resultat = {
            item_id = "void_amulet",
            quantite = 1,
        },
        emplacements = {
            {
                id = "powernax",
                label = "POWERNAX",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "powernax",
                    },
                },
            },
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 10,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
            {
                id = "metal_rare",
                label = "Métal Rare",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "metal_rare",
                    },
                },
            },
        },
    },
    plan_craft_power_ring = {
        id = "plan_craft_power_ring",
        label = "Anneau de Puissance",
        genre = "objet",
        station = "workbench",
        palier = 4,
        resultat = {
            item_id = "power_ring",
            quantite = 1,
        },
        emplacements = {
            {
                id = "metal_rare",
                label = "Métal Rare",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "metal_rare",
                    },
                },
            },
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 5,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
        },
    },
    plan_craft_potion_soin_majeure = {
        id = "plan_craft_potion_soin_majeure",
        label = "Potion de Soin Majeure",
        genre = "objet",
        station = "alchemy",
        palier = 5,
        resultat = {
            item_id = "potion_soin_majeure",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fragment_vie",
                label = "Fragment de Vie",
                obligatoire = true,
                quantite = 5,
                filtre = {
                    items = {
                        "fragment_vie",
                    },
                },
            },
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
        },
    },
    plan_craft_potion_mana_mineure = {
        id = "plan_craft_potion_mana_mineure",
        label = "Potion de Mana Mineure",
        genre = "objet",
        station = "alchemy",
        palier = 1,
        resultat = {
            item_id = "potion_mana_mineure",
            quantite = 1,
        },
        emplacements = {
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
        },
    },
    plan_craft_noyau_plasma = {
        id = "plan_craft_noyau_plasma",
        label = "Noyau Plasma",
        genre = "objet",
        station = "refinery",
        palier = 5,
        resultat = {
            item_id = "noyau_plasma",
            quantite = 1,
        },
        emplacements = {
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 10,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
            {
                id = "metal_rare",
                label = "Métal Rare",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "metal_rare",
                    },
                },
            },
        },
    },
    plan_craft_metal_rare = {
        id = "plan_craft_metal_rare",
        label = "Métal Rare",
        genre = "objet",
        station = "refinery",
        palier = 3,
        resultat = {
            item_id = "metal_rare",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fragment_vie",
                label = "Fragment de Vie",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "fragment_vie",
                    },
                },
            },
            {
                id = "cristal_energie",
                label = "Cristal d'Énergie",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "cristal_energie",
                    },
                },
            },
        },
    },
    plan_refine_metal_rare = {
        id = "plan_refine_metal_rare",
        label = "Raffiner du métal rare",
        genre = "objet",
        station = "refinery",
        palier = 3,
        resultat = {
            item_id = "metal_rare",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fer",
                label = "Fer",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "fer",
                    },
                },
            },
            {
                id = "acier",
                label = "Acier",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "acier",
                    },
                },
            },
        },
    },
    plan_refine_cristal_energie = {
        id = "plan_refine_cristal_energie",
        label = "Cristalliser de l'énergie",
        genre = "objet",
        station = "refinery",
        palier = 3,
        resultat = {
            item_id = "cristal_energie",
            quantite = 1,
        },
        emplacements = {
            {
                id = "cristal_magique",
                label = "Cristal magique",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "cristal_magique",
                    },
                },
            },
            {
                id = "minerai_lunaire",
                label = "Minerai lunaire",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "minerai_lunaire",
                    },
                },
            },
        },
    },
    plan_refine_fragment_vie = {
        id = "plan_refine_fragment_vie",
        label = "Extraire un fragment de vie",
        genre = "objet",
        station = "refinery",
        palier = 4,
        resultat = {
            item_id = "fragment_vie",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fleur_eternelle",
                label = "Fleur éternelle",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "fleur_eternelle",
                    },
                },
            },
            {
                id = "essence_lunaire",
                label = "Essence lunaire",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "essence_lunaire",
                    },
                },
            },
        },
    },
    plan_refine_powernax = {
        id = "plan_refine_powernax",
        label = "Assembler un POWERNAX",
        genre = "objet",
        station = "refinery",
        palier = 6,
        resultat = {
            item_id = "powernax",
            quantite = 1,
        },
        emplacements = {
            {
                id = "bois_legendaire",
                label = "Bois légendaire",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "bois_legendaire",
                    },
                },
            },
            {
                id = "adamantite",
                label = "Adamantite",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "adamantite",
                    },
                },
            },
        },
    },
    plan_f_dague_fer = {
        id = "plan_f_dague_fer",
        label = "Dague de fer",
        genre = "arme",
        station = "forge",
        palier = 1,
        resultat = {
            item_id = "dague_fer",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fer",
                label = "Fer",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "fer",
                    },
                },
            },
            {
                id = "bois_use",
                label = "Bois usé",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "bois_use",
                    },
                },
            },
        },
    },
    plan_f_epee_acier = {
        id = "plan_f_epee_acier",
        label = "Épée d'acier",
        genre = "arme",
        station = "forge",
        palier = 10,
        resultat = {
            item_id = "epee_acier",
            quantite = 1,
        },
        emplacements = {
            {
                id = "acier",
                label = "Acier",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "acier",
                    },
                },
            },
            {
                id = "chene_solide",
                label = "Chêne solide",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "chene_solide",
                    },
                },
            },
        },
    },
    plan_f_hache_raffinee = {
        id = "plan_f_hache_raffinee",
        label = "Hache raffinée",
        genre = "arme",
        station = "forge",
        palier = 20,
        resultat = {
            item_id = "hache_raffinee",
            quantite = 1,
        },
        emplacements = {
            {
                id = "acier",
                label = "Acier",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "acier",
                    },
                },
            },
            {
                id = "bois_ancien",
                label = "Bois ancien",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "bois_ancien",
                    },
                },
            },
        },
    },
    plan_f_lame_magique = {
        id = "plan_f_lame_magique",
        label = "Lame magique",
        genre = "arme",
        station = "forge",
        palier = 30,
        resultat = {
            item_id = "lame_magique",
            quantite = 1,
        },
        emplacements = {
            {
                id = "cristal_magique",
                label = "Cristal magique",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "cristal_magique",
                    },
                },
            },
            {
                id = "bois_spectral",
                label = "Bois spectral",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "bois_spectral",
                    },
                },
            },
        },
    },
    plan_f_egide_lunaire = {
        id = "plan_f_egide_lunaire",
        label = "Égide lunaire",
        genre = "arme",
        station = "forge",
        palier = 40,
        resultat = {
            item_id = "egide_lunaire",
            quantite = 1,
        },
        emplacements = {
            {
                id = "minerai_lunaire",
                label = "Minerai lunaire",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "minerai_lunaire",
                    },
                },
            },
            {
                id = "bois_lunaire",
                label = "Bois lunaire",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "bois_lunaire",
                    },
                },
            },
        },
    },
    plan_f_lame_adamantite = {
        id = "plan_f_lame_adamantite",
        label = "Lame d'adamantite",
        genre = "arme",
        station = "forge",
        palier = 50,
        resultat = {
            item_id = "lame_adamantite",
            quantite = 1,
        },
        emplacements = {
            {
                id = "adamantite",
                label = "Adamantite",
                obligatoire = true,
                quantite = 5,
                filtre = {
                    items = {
                        "adamantite",
                    },
                },
            },
            {
                id = "bois_legendaire",
                label = "Bois légendaire",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "bois_legendaire",
                    },
                },
            },
        },
    },
    plan_a_soin_mineur = {
        id = "plan_a_soin_mineur",
        label = "Potion de soin mineure",
        genre = "objet",
        station = "alchemy",
        palier = 1,
        resultat = {
            item_id = "potion_soin_min",
            quantite = 1,
        },
        emplacements = {
            {
                id = "herbe_commune",
                label = "Herbe commune",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "herbe_commune",
                    },
                },
            },
        },
    },
    plan_a_vigueur = {
        id = "plan_a_vigueur",
        label = "Élixir de vigueur",
        genre = "objet",
        station = "alchemy",
        palier = 10,
        resultat = {
            item_id = "elixir_vigueur",
            quantite = 1,
        },
        emplacements = {
            {
                id = "racine_robuste",
                label = "Racine robuste",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "racine_robuste",
                    },
                },
            },
            {
                id = "fer",
                label = "Fer",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "fer",
                    },
                },
            },
        },
    },
    plan_a_givre = {
        id = "plan_a_givre",
        label = "Philtre de givre",
        genre = "objet",
        station = "alchemy",
        palier = 20,
        resultat = {
            item_id = "philtre_givre",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fleur_de_givre",
                label = "Fleur de givre",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "fleur_de_givre",
                    },
                },
            },
        },
    },
    plan_a_arcanique = {
        id = "plan_a_arcanique",
        label = "Décoction arcanique",
        genre = "objet",
        station = "alchemy",
        palier = 30,
        resultat = {
            item_id = "decoction_arcanique",
            quantite = 1,
        },
        emplacements = {
            {
                id = "lichen_arcanique",
                label = "Lichen arcanique",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "lichen_arcanique",
                    },
                },
            },
            {
                id = "cristal_magique",
                label = "Cristal magique",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "cristal_magique",
                    },
                },
            },
        },
    },
    plan_a_lunaire = {
        id = "plan_a_lunaire",
        label = "Essence concentrée",
        genre = "objet",
        station = "alchemy",
        palier = 40,
        resultat = {
            item_id = "essence_concentree",
            quantite = 1,
        },
        emplacements = {
            {
                id = "essence_lunaire",
                label = "Essence lunaire",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "essence_lunaire",
                    },
                },
            },
        },
    },
    plan_a_panacee = {
        id = "plan_a_panacee",
        label = "Panacée éternelle",
        genre = "objet",
        station = "alchemy",
        palier = 50,
        resultat = {
            item_id = "panacee_eternelle",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fleur_eternelle",
                label = "Fleur éternelle",
                obligatoire = true,
                quantite = 5,
                filtre = {
                    items = {
                        "fleur_eternelle",
                    },
                },
            },
            {
                id = "adamantite",
                label = "Adamantite",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "adamantite",
                    },
                },
            },
        },
    },
    plan_j_anneau_fer = {
        id = "plan_j_anneau_fer",
        label = "Anneau de fer",
        genre = "objet",
        station = "workbench",
        palier = 1,
        resultat = {
            item_id = "anneau_fer",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fer",
                label = "Fer",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "fer",
                    },
                },
            },
        },
    },
    plan_j_pendentif_acier = {
        id = "plan_j_pendentif_acier",
        label = "Pendentif d'acier",
        genre = "objet",
        station = "workbench",
        palier = 10,
        resultat = {
            item_id = "pendentif_acier",
            quantite = 1,
        },
        emplacements = {
            {
                id = "acier",
                label = "Acier",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "acier",
                    },
                },
            },
            {
                id = "racine_robuste",
                label = "Racine robuste",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "racine_robuste",
                    },
                },
            },
        },
    },
    plan_j_bague_givre = {
        id = "plan_j_bague_givre",
        label = "Bague de givre",
        genre = "objet",
        station = "workbench",
        palier = 20,
        resultat = {
            item_id = "bague_givre",
            quantite = 1,
        },
        emplacements = {
            {
                id = "fleur_de_givre",
                label = "Fleur de givre",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "fleur_de_givre",
                    },
                },
            },
            {
                id = "acier",
                label = "Acier",
                obligatoire = true,
                quantite = 2,
                filtre = {
                    items = {
                        "acier",
                    },
                },
            },
        },
    },
    plan_j_talisman = {
        id = "plan_j_talisman",
        label = "Talisman magique",
        genre = "objet",
        station = "workbench",
        palier = 30,
        resultat = {
            item_id = "talisman_magique",
            quantite = 1,
        },
        emplacements = {
            {
                id = "cristal_magique",
                label = "Cristal magique",
                obligatoire = true,
                quantite = 3,
                filtre = {
                    items = {
                        "cristal_magique",
                    },
                },
            },
        },
    },
    plan_j_diademe = {
        id = "plan_j_diademe",
        label = "Diadème lunaire",
        genre = "objet",
        station = "workbench",
        palier = 40,
        resultat = {
            item_id = "diademe_lunaire",
            quantite = 1,
        },
        emplacements = {
            {
                id = "minerai_lunaire",
                label = "Minerai lunaire",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "minerai_lunaire",
                    },
                },
            },
            {
                id = "essence_lunaire",
                label = "Essence lunaire",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "essence_lunaire",
                    },
                },
            },
        },
    },
    plan_j_couronne = {
        id = "plan_j_couronne",
        label = "Couronne éternelle",
        genre = "objet",
        station = "workbench",
        palier = 50,
        resultat = {
            item_id = "couronne_eternelle",
            quantite = 1,
        },
        emplacements = {
            {
                id = "adamantite",
                label = "Adamantite",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "adamantite",
                    },
                },
            },
            {
                id = "fleur_eternelle",
                label = "Fleur éternelle",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "fleur_eternelle",
                    },
                },
            },
        },
    },
    plan_vehicule_executive_sedan = {
        id = "plan_vehicule_executive_sedan",
        label = "Berline Exécutive",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_executive_sedan",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Executive_Sedan",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_luxury_car = {
        id = "plan_vehicule_luxury_car",
        label = "Voiture de Luxe",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_luxury_car",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Luxury_Car",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_sport_wagon = {
        id = "plan_vehicule_sport_wagon",
        label = "Break Sport",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_sport_wagon",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Sport_Wagon",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_station_wagon = {
        id = "plan_vehicule_station_wagon",
        label = "Break Familial",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_station_wagon",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Station_Wagon",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_family_hatchback = {
        id = "plan_vehicule_family_hatchback",
        label = "Compacte Familiale",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_family_hatchback",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Family_Hatchback",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_hatchback1 = {
        id = "plan_vehicule_hatchback1",
        label = "Hatchback",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_hatchback1",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Hatchback1",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_sporty_compact_hatchback = {
        id = "plan_vehicule_sporty_compact_hatchback",
        label = "Compacte Sportive",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_sporty_compact_hatchback",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Sporty_Compact_Hatchback",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_compact_crossover = {
        id = "plan_vehicule_compact_crossover",
        label = "Crossover Compact",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_compact_crossover",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Compact_Crossover",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_fullsize_suv = {
        id = "plan_vehicule_fullsize_suv",
        label = "SUV Grand Format",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_fullsize_suv",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Full-size_SUV",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_minivan = {
        id = "plan_vehicule_minivan",
        label = "Minivan",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_minivan",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Minivan",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_compact_panel_van = {
        id = "plan_vehicule_compact_panel_van",
        label = "Fourgonnette Compacte",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_compact_panel_van",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Compact_Panel_Van",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
    plan_vehicule_pickup = {
        id = "plan_vehicule_pickup",
        label = "Pickup",
        genre = "vehicule",
        resultat = {
            item_id = "vehicule_pickup",
            quantite = 1,
        },
        visuel = {
            mesh = "narvos::SK_Pickup",
        },
        emplacements = {
            {
                id = "carrosserie",
                label = "Carrosserie",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_carrosserie",
                    },
                },
            },
            {
                id = "moteur",
                label = "Moteur",
                obligatoire = true,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_moteur",
                    },
                },
            },
            {
                id = "roues",
                label = "Roues",
                obligatoire = true,
                quantite = 4,
                filtre = {
                    items = {
                        "piece_roue",
                    },
                },
            },
            {
                id = "plaque",
                label = "Plaque d'immatriculation",
                obligatoire = false,
                quantite = 1,
                filtre = {
                    items = {
                        "piece_plaque",
                    },
                },
            },
        },
    },
}

Plans.EXCLUS = {}

return Plans
