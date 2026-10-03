-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/Reputations.lua — données réputation (port de reputationCatalog.ts)
--
-- SOURCE : WebPortal/src/rpg/reputation/reputationCatalog.ts (`REPUTATION_TIERS`,
-- `nextTier`, `merchantDiscount`, `REP_GAINS`). Trié par minRep croissant.
-- ═══════════════════════════════════════════════════════════════════════════════

local Reputations = {}

-- 3 factions jouées (FactionId TS : akarlys | mezalayis | zayan).
Reputations.FACTIONS = { "akarlys", "mezalayis", "zayan" }

-- Paliers : minRep croissant ; hostile = -inf (repli).
Reputations.TIERS = {
    { id = "hostile",    label = "Hostile",   min_rep = -math.huge, color = "#dc2626", recompenses = { "PNJ hostiles à vue", "Prix marchands ×3" } },
    { id = "unfriendly", label = "Inamical",  min_rep = -3000,      color = "#f97316", recompenses = { "PNJ méfiants", "Prix marchands ×1.5" } },
    { id = "neutral",    label = "Neutre",    min_rep = 0,          color = "#a3a3a3", recompenses = { "Accès de base aux marchands" } },
    { id = "friendly",   label = "Amical",    min_rep = 3000,       color = "#22c55e", recompenses = { "Réduction marchand 10%", "Quêtes faction débloquées" } },
    { id = "honored",    label = "Honoré",    min_rep = 9000,       color = "#3b82f6", recompenses = { "Réduction marchand 20%", "Équipement faction" } },
    { id = "revered",    label = "Révéré",    min_rep = 21000,      color = "#8b5cf6", recompenses = { "Réduction marchand 30%", "Monture faction" } },
    { id = "exalted",    label = "Exalté",    min_rep = 42000,      color = "#f59e0b", recompenses = { "Titre spécial", "Apparence exclusive", "Réduction 40%" } },
}

-- Gains par type d'action (REP_GAINS TS).
Reputations.GAINS = {
    KILL_ENEMY      = 25,
    QUEST_COMPLETE  = 150,
    MERCHANT_TRADE  = 10,
    SHIP_DESTROYED  = 50,
    KILL_ALLY_PENALTY = 200,
}

return Reputations