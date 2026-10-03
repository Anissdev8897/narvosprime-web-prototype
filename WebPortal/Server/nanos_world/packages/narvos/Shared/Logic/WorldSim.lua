-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/WorldSim.lua — simulation d'univers vivant (port PUR de worldSim.ts).
--
-- SOURCE : WebPortal/src/rpg/world/worldSim.ts. Déterministe (seed, epoch) via
-- mulberry32 → rejouable + rattrapage hors-ligne. `Simuler` renvoie le NOUVEL état
-- + les événements neufs (AUCUN effet de bord). Portage des ops binaires 32 bits.
-- ═══════════════════════════════════════════════════════════════════════════════

local WorldSim = {}

WorldSim.FACTIONS = { "akarlys", "mezalayis", "zayan" }

-- Régions : 3 fiefs + 2 neutres contestés (REGION_OWNER / REGION_LABEL).
local REGION_OWNER = { aquarys = "akarlys", desertica = "mezalayis", fungaria = "zayan", hub = "akarlys", espace = "zayan" }
local REGION_LABEL = { aquarys = "Aquarys-4", desertica = "Désertica", fungaria = "Fungaria", hub = "Station Hub", espace = "Vide Spatial" }
local REGION_IDS = { "aquarys", "desertica", "fungaria", "hub", "espace" }

-- ── mulberry32 (RNG déterministe, émulation 32 bits signée façon Math.imul). ──
local function s32(x) x = x & 0xFFFFFFFF; if (x >= 0x80000000) then x = x - 0x100000000 end return x end
local function imul(a, b) return s32((s32(a) * s32(b)) % 0x100000000) end
local function ushr(x, n) return (x & 0xFFFFFFFF) >> n end
local function mulberry32(seed)
    local state = s32(seed)
    return function()
        state = s32(state + 0x6D2B79F5)
        local a = state
        local t = imul(s32(a ~ ushr(a, 15)), s32(1 | a))
        t = s32(s32(t + imul(s32(t ~ ushr(t, 7)), s32(61 | t))) ~ t)
        return ((t ~ ushr(t, 14)) & 0xFFFFFFFF) / 4294967296.0
    end
end

local function clamp(v, lo, hi) return math.max(lo, math.min(hi, v)) end

function WorldSim.Etat(seed)
    seed = seed or 1
    local regions, factions = {}, {}
    for _, id in ipairs(REGION_IDS) do regions[id] = { controller = REGION_OWNER[id], contest = 0, price = 1 } end
    for _, f in ipairs(WorldSim.FACTIONS) do factions[f] = { power = 50 } end
    return { epoch = 0, seed = seed, factions = factions, regions = regions, events = {} }
end

-- Faction ennemie la plus puissante (challenger).
local function TopChallenger(s, controller)
    local best, bestPow = controller, -1
    for _, f in ipairs(WorldSim.FACTIONS) do
        if (f ~= controller and s.factions[f].power > bestPow) then bestPow = s.factions[f].power; best = f end
    end
    return best
end

-- Un tick. PUR : renvoie nouvel état + événements neufs.
function WorldSim.Simuler(prev)
    local rng = mulberry32((prev.seed ~ (prev.epoch * 2654435761)) & 0xFFFFFFFF)
    local epoch = prev.epoch + 1
    local newEvents = {}
    local function uid(p) return string.format("%s_%d_%d", p, epoch, math.floor(rng() * 1e6)) end

    -- 1. Puissance factions : marche aléatoire + bonus par région contrôlée.
    local factions = {}
    local owned = { akarlys = 0, mezalayis = 0, zayan = 0 }
    for _, id in ipairs(REGION_IDS) do owned[prev.regions[id].controller] = owned[prev.regions[id].controller] + 1 end
    for _, f in ipairs(WorldSim.FACTIONS) do
        factions[f] = { power = clamp(prev.factions[f].power + (rng() - 0.5) * 6 + owned[f] * 0.4, 5, 100) }
    end

    -- 2. Régions : contestation + bascule + économie.
    local regions = {}
    for _, id in ipairs(REGION_IDS) do
        local reg = prev.regions[id]
        local challenger = TopChallenger(prev, reg.controller)
        local delta = (factions[challenger].power - factions[reg.controller].power) / 100
        local contest = clamp(reg.contest + delta * 0.18 + (rng() - 0.5) * 0.08, 0, 1.2)
        local controller = reg.controller
        local price = reg.price
        if (contest >= 1) then
            controller = challenger; contest = 0; price = clamp(price * 0.85, 0.5, 1.6)
            newEvents[#newEvents + 1] = { id = uid("conq"), kind = "conquete", region = id, faction = challenger, startEpoch = epoch, ttl = 6, text = string.upper(challenger) .. " s'empare de " .. (REGION_LABEL[id] or id) }
        end
        price = clamp(price + (1 - price) * 0.05 + (rng() - 0.5) * (0.04 + contest * 0.06), 0.5, 1.6)
        regions[id] = { controller = controller, contest = contest, price = price }
    end

    -- 3. Événements aléatoires + décrément des TTL.
    local events = {}
    for _, e in ipairs(prev.events) do if (e.ttl > 1) then events[#events + 1] = { id = e.id, kind = e.kind, region = e.region, faction = e.faction, text = e.text, startEpoch = e.startEpoch, ttl = e.ttl - 1 } end end
    if (rng() < 0.18) then
        local id = REGION_IDS[math.floor(rng() * #REGION_IDS) + 1]
        local roll = rng()
        if (roll < 0.4) then
            regions[id].price = clamp(regions[id].price * 1.3, 0.5, 1.6)
            newEvents[#newEvents + 1] = { id = uid("ess"), kind = "essor", region = id, startEpoch = epoch, ttl = 8, text = "Essor économique à " .. (REGION_LABEL[id] or id) }
        elseif (roll < 0.75) then
            regions[id].price = clamp(regions[id].price * 0.7, 0.5, 1.6)
            newEvents[#newEvents + 1] = { id = uid("fam"), kind = "famine", region = id, startEpoch = epoch, ttl = 8, text = "Pénurie à " .. (REGION_LABEL[id] or id) }
        else
            regions[id].contest = clamp(regions[id].contest + 0.25, 0, 1.2)
            newEvents[#newEvents + 1] = { id = uid("raid"), kind = "raid", region = id, startEpoch = epoch, ttl = 5, text = "Raid sur " .. (REGION_LABEL[id] or id) }
        end
    end
    for _, e in ipairs(newEvents) do events[#events + 1] = e end

    return { state = { epoch = epoch, seed = prev.seed, factions = factions, regions = regions, events = events }, newEvents = newEvents }
end

-- Rejoue N ticks (rattrapage hors-ligne).
function WorldSim.Avancer(etat, ticks)
    local cur = etat
    local all = {}
    for _ = 1, ticks do
        local r = WorldSim.Simuler(cur)
        cur = r.state
        for _, e in ipairs(r.newEvents) do all[#all + 1] = e end
    end
    return { state = cur, newEvents = all }
end

return WorldSim