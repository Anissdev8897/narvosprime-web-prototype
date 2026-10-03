-- Généré depuis npc/npcLeveling.ts par scripts/narvos-catalogs-to-lua.mjs
-- Ne pas éditer à la main : régénérer après toute évolution du catalogue TS.

local NiveauxPnj = {}

NiveauxPnj.DMG_GROWTH_PER_LEVEL = 0.1

NiveauxPnj.HP_GROWTH_PER_LEVEL = 0.12

NiveauxPnj.SERVER_CONFIG = {
    name = "Héroïque",
    xpRate = 2,
    enemyStatMult = 1,
}

NiveauxPnj.XP_PER_KILL_K = 13

NiveauxPnj.ZONE_LEVEL_RANGES = {
    forge = {
        1,
        20,
    },
    orbital = {
        10,
        30,
    },
    tower = {
        30,
        50,
    },
}

-- Ordre d'insertion du catalogue TS : à utiliser pour tout tirage indexé.
NiveauxPnj.ZONE_LEVEL_RANGES_ORDER = {
    "forge",
    "orbital",
    "tower",
}

return NiveauxPnj
