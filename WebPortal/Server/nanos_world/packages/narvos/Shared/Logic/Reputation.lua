-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Reputation.lua — logique réputation (port PUR de reputationStore.ts).
--
-- SOURCE : currentTier (rep → tier, itère en reverse), nextTier, merchantDiscount,
-- + gain/lose/set sur un état immuable. Consomme `Catalogs/Reputations.lua`.
-- ═══════════════════════════════════════════════════════════════════════════════

local Reputation = {}
local Cat = nil   -- catalogue injecté

function Reputation.Configurer(catalog) Cat = catalog end

-- Palier courant d'une valeur de réputation (parité currentTier : itère en reverse).
function Reputation.Tier(rep)
    if not Cat then return "neutral" end
    local tiers = Cat.TIERS
    for i = #tiers, 1, -1 do
        if rep >= tiers[i].min_rep then return tiers[i].id end
    end
    return tiers[1].id
end

-- `currentTier` exposé tel quel (parité nominale).
Reputation.currentTier = Reputation.Tier

-- Tier suivant (null si déjà exalted). Parité nextTier.
function Reputation.Suivant(tierId)
    if not Cat then return nil end
    for i, t in ipairs(Cat.TIERS) do
        if t.id == tierId then
            if i >= #Cat.TIERS then return nil end
            return Cat.TIERS[i + 1]
        end
    end
    return nil
end

-- Multiplicateur de prix marchand (parité merchantDiscount). 1.0 par défaut.
function Reputation.ReductionMarchand(tierId)
    if not Cat then return 1.0 end
    local table = { hostile = 3.0, unfriendly = 1.5, neutral = 1.0, friendly = 0.9, honored = 0.8, revered = 0.7, exalted = 0.6 }
    return table[tierId] or 1.0
end

-- ── État : 3 factions, valeurs entières (négatif = hostile, positif = allié).
local function EtatVide()
    local e = {}
    for _, f in ipairs(Cat.FACTIONS) do e[f] = 0 end
    return e
end

--- Crée un état dont seule `faction` est modifiée (parité gain/lose/set, immuable).
function Reputation.Ajouter(etat, faction, montant)
    local e = {}
    for _, f in ipairs(Cat.FACTIONS) do e[f] = etat[f] or 0 end
    e[faction] = e[faction] + montant
    return e
end
function Reputation.Retirer(etat, faction, montant)
    return Reputation.Ajouter(etat, faction, -montant)
end
function Reputation.Definir(etat, faction, valeur)
    local e = {}
    for _, f in ipairs(Cat.FACTIONS) do e[f] = etat[f] or 0 end
    e[faction] = valeur
    return e
end
-- Variantes nominales (écho du store TS).
function Reputation.gain(etat, faction, montant) return Reputation.Ajouter(etat, faction, montant) end
function Reputation.lose(etat, faction, montant) return Reputation.Retirer(etat, faction, montant) end
function Reputation.set(etat, faction, valeur) return Reputation.Definir(etat, faction, valeur) end

--- Tier d'une faction dans un état. Parité tierOf.
function Reputation.TierFaction(etat, faction)
    return Reputation.Tier(etat[faction] or 0)
end

function Reputation.EtatVide() return EtatVide() end

return Reputation