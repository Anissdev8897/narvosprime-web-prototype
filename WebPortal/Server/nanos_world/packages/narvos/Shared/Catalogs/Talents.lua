-- Généré depuis talents/talentCatalog.ts par scripts/narvos-catalogs-to-lua.mjs
-- Ne pas éditer à la main : régénérer après toute évolution du catalogue TS.

local Talents = {}

Talents.BRANCH_META = {
    damage = {
        label = "Dégâts",
        color = "#ef4444",
        icon = "⚔️",
    },
    survival = {
        label = "Survie",
        color = "#22c55e",
        icon = "🛡️",
    },
    mobility = {
        label = "Mobilité",
        color = "#38bdf8",
        icon = "💨",
    },
    mana = {
        label = "Mana",
        color = "#a855f7",
        icon = "🔮",
    },
}

-- Ordre d'insertion du catalogue TS : à utiliser pour tout tirage indexé.
Talents.BRANCH_META_ORDER = {
    "damage",
    "survival",
    "mobility",
    "mana",
}

Talents.TALENTS = {
    {
        id = "dmg_sharp",
        branch = "damage",
        name = "Frappe aiguisée",
        tier = 1,
        maxRank = 3,
        description = "Augmente les dégâts de tous tes sorts.",
        effect = {
            damagePct = 0.06,
        },
    },
    {
        id = "dmg_precise",
        branch = "damage",
        name = "Précision",
        tier = 2,
        maxRank = 3,
        requires = "dmg_sharp",
        description = "Augmente ton taux de critique.",
        effect = {
            critFlat = 3,
        },
    },
    {
        id = "dmg_overload",
        branch = "damage",
        name = "Surcharge",
        tier = 3,
        maxRank = 2,
        requires = "dmg_precise",
        description = "Dégâts de sorts massivement accrus.",
        effect = {
            damagePct = 0.1,
        },
    },
    {
        id = "sur_vitality",
        branch = "survival",
        name = "Vitalité",
        tier = 1,
        maxRank = 3,
        description = "Augmente tes points de vie maximum.",
        effect = {
            maxHpPct = 0.08,
        },
    },
    {
        id = "sur_carapace",
        branch = "survival",
        name = "Carapace",
        tier = 2,
        maxRank = 3,
        requires = "sur_vitality",
        description = "Augmente ta défense (réduction des dégâts reçus).",
        effect = {
            defenseFlat = 4,
        },
    },
    {
        id = "sur_endurance",
        branch = "survival",
        name = "Endurance",
        tier = 3,
        maxRank = 2,
        requires = "sur_carapace",
        description = "Réserve de PV supplémentaire pour les combats longs.",
        effect = {
            maxHpPct = 0.07,
        },
    },
    {
        id = "mob_celerity",
        branch = "mobility",
        name = "Célérité",
        tier = 1,
        maxRank = 3,
        description = "Augmente ta vitesse de déplacement.",
        effect = {
            moveSpeedPct = 0.05,
        },
    },
    {
        id = "mob_stride",
        branch = "mobility",
        name = "Foulée ample",
        tier = 2,
        maxRank = 2,
        requires = "mob_celerity",
        description = "Vitesse de déplacement encore accrue.",
        effect = {
            moveSpeedPct = 0.06,
        },
    },
    {
        id = "mob_reflex",
        branch = "mobility",
        name = "Réflexes",
        tier = 3,
        maxRank = 2,
        requires = "mob_stride",
        description = "Initiative au combat + un peu de critique.",
        effect = {
            critFlat = 2,
        },
    },
    {
        id = "man_affinity",
        branch = "mana",
        name = "Affinité magique",
        tier = 1,
        maxRank = 3,
        description = "Augmente ta réserve de mana maximum.",
        effect = {
            maxManaPct = 0.08,
        },
    },
    {
        id = "man_economy",
        branch = "mana",
        name = "Économie",
        tier = 2,
        maxRank = 3,
        requires = "man_affinity",
        description = "Réduit le coût en mana de tes sorts.",
        effect = {
            manaCostReductionPct = 0.06,
        },
    },
    {
        id = "man_flow",
        branch = "mana",
        name = "Flux arcanique",
        tier = 3,
        maxRank = 2,
        requires = "man_economy",
        description = "Accélère la régénération de ton mana.",
        effect = {
            manaRegenPct = 0.12,
        },
    },
}

return Talents
