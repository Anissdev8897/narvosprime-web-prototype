-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Talents.lua — agrégation des talents + économie de points
-- (port PUR de talents/talentEffects.ts).
--
-- SOURCE : WebPortal/src/rpg/talents/talentEffects.ts. Somme les effets de tous
-- les rangs investis en un unique TalentBonus (multiplié au plus près de l'usage).
-- Consomme `Catalogs/Talents.lua` (injecté). Immuable : Investir/Rembourser
-- retournent un NOUVEL état. Même schéma que le TS.
-- ═══════════════════════════════════════════════════════════════════════════════

local Talents = {}
local Cat = nil   -- catalogue injecté

Talents.NIVEAUX_PAR_POINT = 5

function Talents.Configurer(catalogue) Cat = catalogue end

function Talents.BonusVide()
    return { damageMult = 1, critFlat = 0, maxHpMult = 1, defenseFlat = 0, maxManaMult = 1, manaCostMult = 1, manaRegenMult = 1, moveSpeedMult = 1 }
end

local function Trouver(id)
    if not Cat then return nil end
    for _, n in ipairs(Cat.TALENTS) do if (n.id == id) then return n end end
    return nil
end

-- Somme les effets de tous les rangs investis → TalentBonus.
function Talents.Agreger(talents)
    local b = Talents.BonusVide()
    if (not talents) then return b end
    local dmg, hp, mana, costRed, regen, move = 0, 0, 0, 0, 0, 0
    for id, rank in pairs(talents) do
        local node = Trouver(id)
        if (node and rank and rank > 0) then
            local e = node.effect
            if (e.damagePct) then dmg = dmg + e.damagePct * rank end
            if (e.critFlat) then b.critFlat = b.critFlat + e.critFlat * rank end
            if (e.maxHpPct) then hp = hp + e.maxHpPct * rank end
            if (e.defenseFlat) then b.defenseFlat = b.defenseFlat + e.defenseFlat * rank end
            if (e.maxManaPct) then mana = mana + e.maxManaPct * rank end
            if (e.manaCostReductionPct) then costRed = costRed + e.manaCostReductionPct * rank end
            if (e.manaRegenPct) then regen = regen + e.manaRegenPct * rank end
            if (e.moveSpeedPct) then move = move + e.moveSpeedPct * rank end
        end
    end
    b.damageMult = 1 + dmg
    b.maxHpMult = 1 + hp
    b.maxManaMult = 1 + mana
    b.manaCostMult = math.max(0.4, 1 - costRed)   -- plancher : pas de gratuité totale
    b.manaRegenMult = 1 + regen
    b.moveSpeedMult = 1 + move
    return b
end

-- Économie : 1 point tous les NIVEAUX_PAR_POINT niveaux.
function Talents.PointsGagnes(level) return math.floor(level / Talents.NIVEAUX_PAR_POINT) end
function Talents.PointsDepenses(talents)
    if (not talents) then return 0 end
    local s = 0
    for _, v in pairs(talents) do s = s + math.max(0, v or 0) end
    return s
end
function Talents.PointsDisponibles(stats) return Talents.PointsGagnes(stats.niveau or stats.level or 0) - Talents.PointsDepenses(stats.talents) end

-- Le nœud est-il déverrouillé ? (prérequis ≥ 1 rang).
function Talents.Deverrouille(stats, node)
    if (not node.requires) then return true end
    return ((stats.talents and stats.talents[node.requires]) or 0) >= 1
end

-- Mutations pures.
function Talents.Investir(stats, id)
    local node = Trouver(id)
    if (not node or Talents.PointsDisponibles(stats) <= 0) then return stats end
    local cur = (stats.talents and stats.talents[id]) or 0
    if (cur >= node.maxRank or not Talents.Deverrouille(stats, node)) then return stats end
    local t = {}
    if (stats.talents) then for k, v in pairs(stats.talents) do t[k] = v end end
    t[id] = cur + 1
    return { niveau = stats.niveau or stats.level, talents = t }
end

function Talents.Rembourser(stats, id)
    local cur = (stats.talents and stats.talents[id]) or 0
    if (cur <= 0) then return stats end
    local next = cur - 1
    if (next == 0 and Cat) then
        for _, n in ipairs(Cat.TALENTS) do
            if (n.requires == id and stats.talents[n.id] and stats.talents[n.id] > 0) then return stats end
        end
    end
    local t = {}
    if (stats.talents) then for k, v in pairs(stats.talents) do t[k] = v end end
    t[id] = next
    return { niveau = stats.niveau or stats.level, talents = t }
end

function Talents.RetirerTous(stats) return { niveau = stats.niveau or stats.level, talents = {} } end

return Talents