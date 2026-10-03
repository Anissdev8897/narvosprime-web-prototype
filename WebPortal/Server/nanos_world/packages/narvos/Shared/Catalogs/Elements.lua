-- Généré depuis elements/elements.ts par scripts/narvos-catalogs-to-lua.mjs
-- Ne pas éditer à la main : régénérer après toute évolution du catalogue TS.

local Elements = {}

Elements.ELEMENTS = {
    fire = {
        id = "fire",
        label = "Feu",
        color = "#ff5722",
        emissive = "#ff8a00",
        particleColor = "#ffb347",
        statusEffect = "burn",
        strongVs = {
            "ice",
            "poison",
            "earth",
        },
        weakVs = {
            "water",
        },
        description = "Brûlure progressive + explosions AoE. Dégâts soutenus.",
    },
    water = {
        id = "water",
        label = "Eau",
        color = "#2196f3",
        emissive = "#42a5f5",
        particleColor = "#80d8ff",
        statusEffect = "soak",
        strongVs = {
            "fire",
            "earth",
        },
        weakVs = {
            "electric",
            "ice",
        },
        description = "Soin allié + dégâts modérés. Mouille les ennemis (combo électrique).",
    },
    ice = {
        id = "ice",
        label = "Glace",
        color = "#80deea",
        emissive = "#b3e5fc",
        particleColor = "#e1f5fe",
        statusEffect = "freeze",
        strongVs = {
            "water",
            "wind",
        },
        weakVs = {
            "fire",
        },
        description = "Ralentissement -30% puis gel total. Contrôle défensif.",
    },
    electric = {
        id = "electric",
        label = "Électrique",
        color = "#ffeb3b",
        emissive = "#fff176",
        particleColor = "#ffff8d",
        statusEffect = "shock",
        strongVs = {
            "water",
            "wind",
        },
        weakVs = {
            "earth",
        },
        description = "Chaînes électriques entre 3 cibles. Burst rapide.",
    },
    poison = {
        id = "poison",
        label = "Poison",
        color = "#8bc34a",
        emissive = "#aed581",
        particleColor = "#ccff90",
        statusEffect = "toxic",
        strongVs = {
            "earth",
            "light",
        },
        weakVs = {
            "void",
        },
        description = "Dégâts progressifs sur 8s. Contamination biologique alien.",
    },
    earth = {
        id = "earth",
        label = "Terre",
        color = "#8d6e63",
        emissive = "#a1887f",
        particleColor = "#bcaaa4",
        statusEffect = "root",
        strongVs = {
            "electric",
            "poison",
        },
        weakVs = {
            "fire",
            "water",
            "wind",
        },
        description = "Immobilisation + dégâts soutenus. Tank défensif.",
    },
    wind = {
        id = "wind",
        label = "Vent",
        color = "#b2dfdb",
        emissive = "#80cbc4",
        particleColor = "#e0f2f1",
        statusEffect = "knockback",
        strongVs = {
            "earth",
            "poison",
        },
        weakVs = {
            "ice",
            "electric",
        },
        description = "Repousse + mobilité. Disperse les nuages toxiques.",
    },
    light = {
        id = "light",
        label = "Lumière",
        color = "#fff9c4",
        emissive = "#ffffff",
        particleColor = "#fffde7",
        statusEffect = "purify",
        strongVs = {
            "dark",
            "void",
        },
        weakVs = {
            "poison",
        },
        description = "Soin + dispel des debuffs. Fort contre l'ombre.",
    },
    dark = {
        id = "dark",
        label = "Ombre",
        color = "#6a1b9a",
        emissive = "#9c27b0",
        particleColor = "#ce93d8",
        statusEffect = "curse",
        strongVs = {
            "light",
        },
        weakVs = {
            "light",
            "void",
        },
        description = "Drain de vie + malédiction. Réduit les soins ennemis.",
    },
    void = {
        id = "void",
        label = "Vide",
        color = "#311b92",
        emissive = "#7c4dff",
        particleColor = "#b388ff",
        statusEffect = "rift",
        strongVs = {
            "dark",
            "poison",
        },
        weakVs = {
            "light",
        },
        description = "Distorsion d'espace + perce-armure. Téléportation.",
    },
}

-- Ordre d'insertion du catalogue TS : à utiliser pour tout tirage indexé.
Elements.ELEMENTS_ORDER = {
    "fire",
    "water",
    "ice",
    "electric",
    "poison",
    "earth",
    "wind",
    "light",
    "dark",
    "void",
}

Elements.ELEMENT_IDS = {
    "fire",
    "water",
    "ice",
    "electric",
    "poison",
    "earth",
    "wind",
    "light",
    "dark",
    "void",
}

return Elements
