-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/Arenes.lua — configurations des 3 arènes (GÉNÉRÉ, ne pas éditer).
-- SOURCE : WebPortal/src/rpg/arenas/arenaConfig.ts (ARENA_CONFIGS). Régénérer via
-- scripts/lua-harness/arenas-gen.mjs après toute évolution du catalogue.
-- ═══════════════════════════════════════════════════════════════════════════════

local Arenes = {}

Arenes.CONFIGS = {
    {
    mapId = "donjon_furiste", name = "La Fosse aux Meutes", description = "Au cœur du donjon, une vaste salle circulaire taillée dans la roche volcanique. Des piliers de basalte ponctuent l'arène, offrant un cover précaire. Au centre, une fosse fumante d'où émerge le Gralynis, gardien des lieux. Des meutes de sbires montent des tunnels latéraux par vagues successives.",
    arenaType = "boss", faction = "zayan", chunkCount = 4,
    covers = {
      {pos = {-12, 0, -12}, size = {3, 6, 3}, kind = "hard", state = "static", height = "high", label = "Pilier NE"},
      {pos = {12, 0, -12}, size = {3, 6, 3}, kind = "hard", state = "static", height = "high", label = "Pilier NO"},
      {pos = {-12, 0, 12}, size = {3, 6, 3}, kind = "hard", state = "static", height = "high", label = "Pilier SE"},
      {pos = {12, 0, 12}, size = {3, 6, 3}, kind = "hard", state = "static", height = "high", label = "Pilier SO"},
      {pos = {-20, 0, 0}, size = {2, 2.5, 6}, kind = "hard", state = "static", height = "low", label = "Muret Ouest"},
      {pos = {20, 0, 0}, size = {2, 2.5, 6}, kind = "hard", state = "static", height = "low", label = "Muret Est"},
      {pos = {0, 0, -20}, size = {6, 2.5, 2}, kind = "hard", state = "static", height = "low", label = "Muret Nord"},
      {pos = {0, 0, 20}, size = {6, 2.5, 2}, kind = "hard", state = "static", height = "low", label = "Muret Sud"},
      {pos = {0, 0, 30}, size = {4, 4, 1}, kind = "hard", state = "static", height = "high", label = "Pilier Entrée"},
      {pos = {-8, 0, -18}, size = {1.5, 2, 1.5}, kind = "soft", state = "dynamic", height = "low", label = "Baril Ouest"},
      {pos = {8, 0, -18}, size = {1.5, 2, 1.5}, kind = "soft", state = "dynamic", height = "low", label = "Baril Est"}
    },
    triggers = {
      {kind = "entry", center = {0, 0, 25}, radius = 8, label = "Entrée Arène", enabled = true, activates = {"wave1"}},
      {kind = "encounter", center = {0, 0, 10}, radius = 15, label = "Devant du Boss", enabled = false, activates = {"wave2"}},
      {kind = "boss", center = {0, 0, 0}, radius = 10, label = "Fosse du Boss", enabled = false, activates = {"boss_spawn"}},
      {kind = "vantage", center = {0, 0, 34}, radius = 4, label = "Vue d'Entrée", enabled = true},
      {kind = "safe", center = {0, 0, 32}, radius = 5, label = "Zone Sûre Entrée", enabled = true},
      {kind = "encounter", center = {-18, 0, -5}, radius = 6, label = "Flanc Gauche", enabled = false},
      {kind = "encounter", center = {18, 0, -5}, radius = 6, label = "Flanc Droit", enabled = false}
    },
    waves = {
      {label = "Meute d'Accueil", delayMs = 1000, spawns = {{folder = "lion", count = 2, pos = {-10, 0, -5}, packSize = 1}, {folder = "Grunt", count = 2, pos = {10, 0, -5}, packSize = 1}, {folder = "Grunt", count = 1, pos = {0, 0, -2}, packSize = 2}}, curveballs = {}, waitPrevious = false},
      {label = "Renforts des Flancs", delayMs = 8000, spawns = {{folder = "lion", count = 1, pos = {-15, 0, -8}, fromDirection = "left", packSize = 2}, {folder = "venom_stalker", count = 1, pos = {15, 0, -8}, fromDirection = "right"}, {folder = "mercenaire_alien", count = 1, pos = {0, 0, -10}, fromDirection = "front"}}, curveballs = {"cover_change"}, waitPrevious = true},
      {label = "Le Gralynis", delayMs = 3000, spawns = {{folder = "gralynis_boss", count = 1, pos = {0, 0, 0}, packSize = 1}, {folder = "gronomi_ardent", count = 2, pos = {-5, 0, 5}, packSize = 1}, {folder = "gronomi_infaterie", count = 2, pos = {5, 0, 5}, packSize = 1}}, curveballs = {}, waitPrevious = true},
      {label = "Enrage — Renforts", delayMs = 1000, spawns = {{folder = "gronomi_mineur", count = 3, pos = {-12, 0, 12}, fromDirection = "rear", packSize = 1}, {folder = "mercenaire_alien", count = 2, pos = {12, 0, 12}, fromDirection = "rear", packSize = 1}}, curveballs = {"smoke", "reinforcement"}, waitPrevious = false}
    },
    routes = {
      {id = "route_main", kind = "main", label = "Route Principale", waypoints = {{0, 6, 34}, {0, 0, 25}, {0, 0, 15}, {0, 0, 5}}, recommendedFor = {"warrior", "warrior_tank"}},
      {id = "route_flank_left", kind = "flank_left", label = "Contournement Ouest", waypoints = {{0, 0, 25}, {-16, 0, 15}, {-16, 0, 0}, {-8, 0, -5}}, recommendedFor = {"ninja"}},
      {id = "route_flank_right", kind = "flank_right", label = "Contournement Est", waypoints = {{0, 0, 25}, {16, 0, 15}, {16, 0, 0}, {8, 0, -5}}, recommendedFor = {"ninja"}},
      {id = "route_sniper", kind = "sniper_nest", label = "Position Surélevée", waypoints = {{0, 0, 25}, {0, 0, 20}}, recommendedFor = {"archer", "mage"}}
    },
    recommendedNpcs = {
      {folder = "gralynis_boss", pos = {0, 0, 0}, level = 25, rank = "boss", respawnSec = 0, aggroRange = 30, attackRange = 15},
      {folder = "profhete", pos = {-8, 0, 8}, level = 22, rank = "mob", packSize = 1, respawnSec = 60, aggroRange = 20, attackRange = 12},
      {folder = "profhete_alien", pos = {8, 0, 8}, level = 22, rank = "mob", packSize = 1, respawnSec = 60, aggroRange = 20, attackRange = 12},
      {folder = "lion", pos = {-14, 0, -14}, level = 18, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "lion", pos = {14, 0, -14}, level = 18, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "Grunt", pos = {-10, 0, 15}, level = 16, rank = "mob", packSize = 3, respawnSec = 45},
      {folder = "Grunt", pos = {10, 0, 15}, level = 16, rank = "mob", packSize = 3, respawnSec = 45},
      {folder = "venom_stalker", pos = {-18, 0, -2}, level = 20, rank = "mob", packSize = 2, respawnSec = 60},
      {folder = "mercenaire_alien", pos = {18, 0, -2}, level = 20, rank = "mob", packSize = 2, respawnSec = 60}
    },
  },
    {
    mapId = "fungaria", name = "Le Cœur de la Colonie", description = "Au cœur de Fungaria, une colonie mycélienne gigantesque pulse d'une vie alien. Des champignons bioluminescents violets percent le sol, projetant une lueur malsaine. Des hôtes parasités errent entre les piliers fongiques, tandis que des prophètes canalisent la lumière corrompue de la colonie. Au centre, le Cœur — un champignon-titan dont les spores contrôlent toute la zone.",
    arenaType = "expedition", faction = "zayan", chunkCount = 8,
    covers = {
      {pos = {-16, 0, -16}, size = {5, 8, 5}, kind = "hard", state = "static", height = "high", label = "Champi Géant NE"},
      {pos = {16, 0, -16}, size = {5, 8, 5}, kind = "hard", state = "static", height = "high", label = "Champi Géant NO"},
      {pos = {-16, 0, 16}, size = {5, 8, 5}, kind = "hard", state = "static", height = "high", label = "Champi Géant SE"},
      {pos = {16, 0, 16}, size = {5, 8, 5}, kind = "hard", state = "static", height = "high", label = "Champi Géant SO"},
      {pos = {-25, 0, 0}, size = {4, 10, 4}, kind = "hard", state = "static", height = "high", label = "Pilier Fongique Ouest"},
      {pos = {25, 0, 0}, size = {4, 10, 4}, kind = "hard", state = "static", height = "high", label = "Pilier Fongique Est"},
      {pos = {-8, 0, -24}, size = {3, 3, 3}, kind = "soft", state = "static", height = "low", label = "Petit Champi N"},
      {pos = {8, 0, -24}, size = {3, 3, 3}, kind = "soft", state = "static", height = "low", label = "Petit Champi N"},
      {pos = {-24, 0, 8}, size = {3, 3, 3}, kind = "soft", state = "static", height = "low", label = "Petit Champi O"},
      {pos = {24, 0, 8}, size = {3, 3, 3}, kind = "soft", state = "static", height = "low", label = "Petit Champi E"},
      {pos = {-5, 0, -30}, size = {2, 3, 2}, kind = "soft", state = "dynamic", height = "low", label = "Spore Explosive 1"},
      {pos = {5, 0, -30}, size = {2, 3, 2}, kind = "soft", state = "dynamic", height = "low", label = "Spore Explosive 2"},
      {pos = {0, 0, -10}, size = {6, 5, 0.5}, kind = "hybrid", state = "static", height = "high", label = "Voile Mycélien"}
    },
    triggers = {
      {kind = "entry", center = {-50, 0, 30}, radius = 8, label = "Lisière de la Colonie", enabled = true, activates = {"zone_spores"}},
      {kind = "vantage", center = {-50, 0, 30}, radius = 5, label = "Vue sur la Colonie", enabled = true},
      {kind = "safe", center = {-50, 0, 30}, radius = 6, label = "Zone Sûre Lisière", enabled = true},
      {kind = "encounter", center = {-25, 0, 15}, radius = 12, label = "Salle des Spores", enabled = false, activates = {"coeur_colonie"}},
      {kind = "boss", center = {0, 0, 0}, radius = 18, label = "Le Cœur", enabled = false, activates = {"vague_coeur1", "vague_coeur2"}},
      {kind = "no_mans_land", center = {-38, 0, 22}, radius = 10, label = "Zone Dangereuse", enabled = false},
      {kind = "safe", center = {-55, 0, 35}, radius = 6, label = "Repli Lisière", enabled = true},
      {kind = "encounter", center = {-20, 0, -10}, radius = 8, label = "Nid Ouest", enabled = false},
      {kind = "encounter", center = {20, 0, -10}, radius = 8, label = "Nid Est", enabled = false}
    },
    waves = {
      {label = "Éclaireurs Fongiques", delayMs = 2000, spawns = {{folder = "mycelium_host_female", count = 2, pos = {-20, 0, 12}, packSize = 1}, {folder = "mycelium_host_male", count = 1, pos = {-25, 0, 18}, packSize = 1}, {folder = "parasite_sower_female", count = 1, pos = {-30, 0, 15}}}, curveballs = {}, waitPrevious = false},
      {label = "Infestation", delayMs = 10000, spawns = {{folder = "mycelium_host_male", count = 2, pos = {-22, 0, 10}, packSize = 1}, {folder = "parasite_sower_male", count = 2, pos = {-28, 0, 20}, packSize = 1}, {folder = "gronomi_ardent", count = 1, pos = {-18, 0, 18}}}, curveballs = {"smoke"}, waitPrevious = true},
      {label = "Défenseurs du Cœur", delayMs = 2000, spawns = {{folder = "profhete", count = 2, pos = {-8, 0, -5}, packSize = 1}, {folder = "canopy_prophet_female", count = 1, pos = {0, 0, 0}}, {folder = "canopy_prophet_male", count = 1, pos = {8, 0, 5}}, {folder = "gronomi_infaterie", count = 3, pos = {-5, 0, -8}, packSize = 1}}, curveballs = {}, waitPrevious = true},
      {label = "Renforts des Nids", delayMs = 12000, spawns = {{folder = "mycelium_host_female", count = 2, pos = {-20, 0, -10}, fromDirection = "left", packSize = 2}, {folder = "mycelium_host_male", count = 2, pos = {20, 0, -10}, fromDirection = "right", packSize = 2}}, curveballs = {"reinforcement"}, waitPrevious = true},
      {label = "La Prophétesse", delayMs = 5000, spawns = {{folder = "canopy_prophet_female", count = 1, pos = {0, 0, 5}}, {folder = "profhete_alien", count = 2, pos = {-6, 0, 8}, packSize = 1}, {folder = "venom_stalker", count = 2, pos = {6, 0, 8}, packSize = 1}}, curveballs = {"darkness"}, waitPrevious = true}
    },
    routes = {
      {id = "route_main", kind = "main", label = "Route Principale", waypoints = {{-50, 0, 30}, {-40, 0, 22}, {-25, 0, 15}, {-10, 0, 5}, {0, 0, 0}}, recommendedFor = {"warrior", "warrior_tank"}},
      {id = "route_flank_left", kind = "flank_left", label = "Contournement Ouest (Nid)", waypoints = {{-40, 0, 22}, {-30, 0, 10}, {-25, 0, -5}, {-20, 0, -10}}, recommendedFor = {"ninja"}},
      {id = "route_flank_right", kind = "flank_right", label = "Contournement Est (Nid)", waypoints = {{-40, 0, 22}, {-15, 0, 20}, {10, 0, 15}, {20, 0, -10}}, recommendedFor = {"ninja"}},
      {id = "route_sniper", kind = "sniper_nest", label = "Position Élevée (Lisière)", waypoints = {{-50, 0, 30}, {-45, 0, 25}}, recommendedFor = {"archer", "mage"}},
      {id = "route_retreat", kind = "retreat", label = "Repli Extraction", waypoints = {{0, 0, 0}, {-25, 0, 15}, {-40, 0, 22}, {-55, 0, 35}}, recommendedFor = {"warrior", "archer", "mage", "ninja"}}
    },
    recommendedNpcs = {
      {folder = "mycelium_host_female", pos = {-20, 0, 12}, level = 18, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "mycelium_host_male", pos = {-25, 0, 18}, level = 20, rank = "mob", packSize = 1, respawnSec = 45},
      {folder = "parasite_sower_female", pos = {-28, 0, 15}, level = 16, rank = "mob", packSize = 1, respawnSec = 45},
      {folder = "canopy_prophet_female", pos = {0, 0, 0}, level = 24, rank = "boss", respawnSec = 120, aggroRange = 30, attackRange = 20},
      {folder = "canopy_prophet_male", pos = {8, 0, 5}, level = 22, rank = "mob", respawnSec = 60, aggroRange = 25, attackRange = 15},
      {folder = "profhete", pos = {-8, 0, -5}, level = 20, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "profhete_alien", pos = {10, 0, -5}, level = 20, rank = "mob", packSize = 1, respawnSec = 45},
      {folder = "gronomi_infaterie", pos = {-15, 0, 0}, level = 18, rank = "mob", packSize = 3, respawnSec = 45},
      {folder = "gronomi_ardent", pos = {15, 0, 0}, level = 18, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "venom_stalker", pos = {-5, 0, 15}, level = 20, rank = "mob", packSize = 1, respawnSec = 45},
      {folder = "parasite_sower_male", pos = {-20, 0, -10}, level = 18, rank = "mob", packSize = 2, respawnSec = 60},
      {folder = "mycelium_host_female", pos = {20, 0, -10}, level = 18, rank = "mob", packSize = 2, respawnSec = 60}
    },
  },
    {
    mapId = "orbital", name = "L'Anneau des Duellistes", description = "Suspendu dans le vide spatial, l'Anneau des Duellistes est une arène PvP implantée dans la station orbitale. Une plate-forme centrale circulaire de 30 mètres de diamètre, entourée de quatre plates-formes satellites reliées par des passerelles énergétiques. Des piliers de soutien offrent un cover stratégique, tandis que les baies vitrées laissent voir les étoiles. Le vide spatial est la seule limite — tomber, c'est mourir.",
    arenaType = "pvp", faction = "mezalayis", chunkCount = 8,
    covers = {
      {pos = {1000, 0, -10}, size = {2, 5, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Centre N"},
      {pos = {1000, 0, 10}, size = {2, 5, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Centre S"},
      {pos = {990, 0, 0}, size = {2, 5, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Centre O"},
      {pos = {1010, 0, 0}, size = {2, 5, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Centre E"},
      {pos = {1005, 0, -15}, size = {3, 2, 3}, kind = "hard", state = "dynamic", height = "low", label = "Caisse Fret NE"},
      {pos = {995, 0, -15}, size = {3, 2, 3}, kind = "hard", state = "dynamic", height = "low", label = "Caisse Fret NO"},
      {pos = {1005, 0, 15}, size = {3, 2, 3}, kind = "hard", state = "dynamic", height = "low", label = "Caisse Fret SE"},
      {pos = {995, 0, 15}, size = {3, 2, 3}, kind = "hard", state = "dynamic", height = "low", label = "Caisse Fret SO"},
      {pos = {1000, 0, -35}, size = {2, 4, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Sat Nord"},
      {pos = {1000, 0, 35}, size = {2, 4, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Sat Sud"},
      {pos = {965, 0, 0}, size = {2, 4, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Sat Ouest"},
      {pos = {1035, 0, 0}, size = {2, 4, 2}, kind = "hard", state = "static", height = "high", label = "Pilier Sat Est"},
      {pos = {1000, 0, -22}, size = {8, 3, 0.5}, kind = "hybrid", state = "static", height = "high", label = "Barrière Nord"},
      {pos = {1000, 0, 22}, size = {8, 3, 0.5}, kind = "hybrid", state = "static", height = "high", label = "Barrière Sud"},
      {pos = {1000, 0, 0}, size = {1.5, 1.5, 1.5}, kind = "hard", state = "static", height = "low", label = "Console Ring"}
    },
    triggers = {
      {kind = "entry", center = {1000, 50, 0}, radius = 8, label = "Spawn Orbital", enabled = true, activates = {"arena_main", "safe_spawn"}},
      {kind = "arena", center = {1000, 0, 0}, radius = 25, label = "Anneau Principal", enabled = true},
      {kind = "safe", center = {1000, 50, 0}, radius = 10, label = "Zone Sûre Spawn", enabled = true},
      {kind = "vantage", center = {1000, 50, 0}, radius = 5, label = "Vue sur l'Anneau", enabled = true},
      {kind = "encounter", center = {1000, 0, -35}, radius = 8, label = "Satellite Nord", enabled = true},
      {kind = "encounter", center = {1000, 0, 35}, radius = 8, label = "Satellite Sud", enabled = true},
      {kind = "encounter", center = {965, 0, 0}, radius = 8, label = "Satellite Ouest", enabled = true},
      {kind = "encounter", center = {1035, 0, 0}, radius = 8, label = "Satellite Est", enabled = true},
      {kind = "no_mans_land", center = {1000, 0, 45}, radius = 5, label = "Vide Spatial", enabled = true}
    },
    waves = {
      {label = "Round 1 — Échauffement", delayMs = 3000, spawns = {{folder = "Grunt", count = 2, pos = {995, 0, -5}, packSize = 1}, {folder = "Grunt", count = 2, pos = {1005, 0, 5}, packSize = 1}}, curveballs = {}, waitPrevious = false},
      {label = "Round 2 — Assaut des Satellites", delayMs = 10000, spawns = {{folder = "mercenaire_alien", count = 1, pos = {1000, 0, -35}, fromDirection = "front", packSize = 2}, {folder = "mercenaire_alien", count = 1, pos = {1000, 0, 35}, fromDirection = "rear", packSize = 2}, {folder = "twinblast", count = 1, pos = {965, 0, 0}, fromDirection = "left"}, {folder = "twinblast", count = 1, pos = {1035, 0, 0}, fromDirection = "right"}}, curveballs = {"reinforcement"}, waitPrevious = true},
      {label = "Round 3 — Duel Final", delayMs = 5000, spawns = {{folder = "boss_mob", count = 1, pos = {1000, 0, 0}, packSize = 1}, {folder = "gronomi_infaterie", count = 2, pos = {990, 0, -10}}, {folder = "gronomi_ardent", count = 2, pos = {1010, 0, 10}}}, curveballs = {"quake", "darkness"}, waitPrevious = true}
    },
    routes = {
      {id = "route_main", kind = "main", label = "Descente sur l'Anneau", waypoints = {{1000, 50, 0}, {1000, 25, 0}, {1000, 0, 0}}, recommendedFor = {"warrior", "warrior_tank", "warrior_bruiser"}},
      {id = "route_flank_north", kind = "flank_left", label = "Passerelle Nord", waypoints = {{1000, 0, 0}, {1000, 0, -15}, {1000, 0, -35}}, recommendedFor = {"ninja"}},
      {id = "route_flank_south", kind = "flank_right", label = "Passerelle Sud", waypoints = {{1000, 0, 0}, {1000, 0, 15}, {1000, 0, 35}}, recommendedFor = {"ninja"}},
      {id = "route_sniper_spawn", kind = "sniper_nest", label = "Position Haute Spawn", waypoints = {{1000, 50, 0}, {1000, 25, 0}}, recommendedFor = {"archer", "mage"}},
      {id = "route_flank_west", kind = "flank_left", label = "Passerelle Ouest", waypoints = {{1000, 0, 0}, {985, 0, 5}, {965, 0, 0}}, recommendedFor = {"ninja", "archer"}},
      {id = "route_flank_east", kind = "flank_right", label = "Passerelle Est", waypoints = {{1000, 0, 0}, {1015, 0, -5}, {1035, 0, 0}}, recommendedFor = {"ninja", "archer"}}
    },
    recommendedNpcs = {
      {folder = "Grunt", pos = {995, 0, -10}, level = 20, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "Grunt", pos = {1005, 0, 10}, level = 20, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "mercenaire_alien", pos = {980, 0, -5}, level = 22, rank = "mob", packSize = 1, respawnSec = 45},
      {folder = "mercenaire_alien", pos = {1020, 0, 5}, level = 22, rank = "mob", packSize = 1, respawnSec = 45},
      {folder = "twinblast", pos = {965, 0, 0}, level = 24, rank = "mob", packSize = 1, respawnSec = 60, aggroRange = 35, attackRange = 20},
      {folder = "twinblast", pos = {1035, 0, 0}, level = 24, rank = "mob", packSize = 1, respawnSec = 60, aggroRange = 35, attackRange = 20},
      {folder = "gronomi_infaterie", pos = {1000, 0, -35}, level = 20, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "gronomi_ardent", pos = {1000, 0, 35}, level = 20, rank = "mob", packSize = 2, respawnSec = 45},
      {folder = "boss_mob", pos = {1000, 0, 0}, level = 28, rank = "boss", respawnSec = 120, aggroRange = 40, attackRange = 15},
      {folder = "rampage_brute", pos = {990, 0, 15}, level = 26, rank = "mob", packSize = 1, respawnSec = 90, aggroRange = 25, attackRange = 10}
    },
  },
}

return Arenes
