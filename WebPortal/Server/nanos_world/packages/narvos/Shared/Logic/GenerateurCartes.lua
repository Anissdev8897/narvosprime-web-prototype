-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/GenerateurCartes.lua — générateur de cartes procédural (pur, seedé).
--
-- SOURCE : WebPortal/src/rpg/mapgen/mapGenerator.ts (`generateMap`,
-- `validateGeneration`, `biomeOf`). Génère le PEUPLEMENT d'une map (biomes en
-- anneaux, monstres par distance + meutes, ressources, points d'intérêt).
-- Déterministe (seed). RNG = mulberry32 bit-parfait (éprouvé sur worldSim).
-- ═══════════════════════════════════════════════════════════════════════════════

local Generateur = {}

-- ── mulberry32 bit-parfait (identique à worldSim) ─────────────────────────────
local function s32(x) x = x & 0xFFFFFFFF; if (x >= 0x80000000) then x = x - 0x100000000 end return x end
local function imul(a, b) return s32((s32(a) * s32(b)) % 0x100000000) end
local function ushr(x, n) return (x & 0xFFFFFFFF) >> n end
local function mulberry32(seed)
    local state = s32(seed)
    return function()
        state = s32(state + 0x6D2B79F5)
        local t = imul(s32(state ~ ushr(state, 15)), s32(1 | state))
        t = s32(s32(t + imul(s32(t ~ ushr(t, 7)), s32(61 | t))) ~ t)
        return ((t ~ ushr(t, 14)) & 0xFFFFFFFF) / 4294967296.0
    end
end

local NOMS_BIOMES = { "Lisière (sûre)", "Étendue sauvage", "Zone profonde" }
local LABELS_POI = { "Ruines anciennes", "Balise de détresse", "Autel du Vide", "Camp abandonné", "Cache de contrebande", "Épave de vaisseau" }
local PROFESSIONS = { "bucheron", "mineur", "recolteur" }
local ESPACEMENT_MONSTRE = 6
local ESPACEMENT_RESSOURCE = 4
local MAX_MONSTRE = 80
local MAX_RESSOURCE = 60

local function hypot(a, b) return math.sqrt(a * a + b * b) end

local function DistanceMaxDuHub(cfg)
    local b, hub = cfg.bounds, cfg.hub
    return math.max(
        hypot(b.minX - hub.x, b.minZ - hub.z), hypot(b.maxX - hub.x, b.minZ - hub.z),
        hypot(b.minX - hub.x, b.maxZ - hub.z), hypot(b.maxX - hub.x, b.maxZ - hub.z)
    )
end

-- Biome 0..2 d'un point selon sa distance au hub.
function Generateur.Biome(p, cfg)
    local d = hypot(p.x - cfg.hub.x, p.z - cfg.hub.z)
    local span = math.max(1, DistanceMaxDuHub(cfg) - cfg.safeRadius)
    local t = math.max(0, (d - cfg.safeRadius) / span)
    return math.min(2, math.floor(t * 3))
end

-- Échantillonnage par rejet : dans les bornes, hors zone sûre, espacé des existants.
local function Echantillon(rng, cfg, place, mini)
    local b = cfg.bounds
    for _ = 1, 40 do
        local p = { x = b.minX + rng() * (b.maxX - b.minX), z = b.minZ + rng() * (b.maxZ - b.minZ) }
        if (hypot(p.x - cfg.hub.x, p.z - cfg.hub.z) >= cfg.safeRadius) then
            local ok = true
            for _, q in ipairs(place) do if (hypot(p.x - q.x, p.z - q.z) < mini) then ok = false; break end end
            if (ok) then return p end
        end
    end
    return nil
end

function Generateur.Generer(cfg)
    local rng = mulberry32(cfg.seed)
    local span = math.max(1, DistanceMaxDuHub(cfg) - cfg.safeRadius)
    local biomes = {}
    for i = 1, 3 do
        biomes[i] = { name = NOMS_BIOMES[i], r0 = cfg.safeRadius + span * (i - 1) / 3, r1 = cfg.safeRadius + span * i / 3 }
    end

    -- Monstres.
    local monstres, mPts = {}, {}
    local nM = math.min(cfg.monsterPoints, MAX_MONSTRE)
    for _ = 1, nM do
        local p = Echantillon(rng, cfg, mPts, ESPACEMENT_MONSTRE)
        if (not p) then break end
        mPts[#mPts + 1] = p
        local d = hypot(p.x - cfg.hub.x, p.z - cfg.hub.z)
        local t = math.min(1, math.max(0, (d - cfg.safeRadius) / span))
        local level = math.floor(cfg.levelRange[1] + t * (cfg.levelRange[2] - cfg.levelRange[1]) + 0.5)  -- Math.round
        local b = Generateur.Biome(p, cfg)
        local taille = 1 + math.floor(rng() * math.min(cfg.maxPack, 1 + b * 2))
        local folder = cfg.enemyFolders[math.floor(rng() * #cfg.enemyFolders) + 1] or "bandit"
        monstres[#monstres + 1] = { x = p.x, z = p.z, folder = folder, level = level, packSize = math.min(5, taille), respawnSec = 45, biome = b }
    end

    -- Ressources.
    local ressources, rPts = {}, {}
    local nR = math.min(cfg.resources, MAX_RESSOURCE)
    for _ = 1, nR do
        local p = Echantillon(rng, cfg, rPts, ESPACEMENT_RESSOURCE)
        if (not p) then break end
        rPts[#rPts + 1] = p
        ressources[#ressources + 1] = { x = p.x, z = p.z, profession = PROFESSIONS[math.floor(rng() * #PROFESSIONS) + 1], biome = Generateur.Biome(p, cfg) }
    end

    -- Points d'intérêt.
    local pois, pPts = {}, {}
    for i = 1, cfg.pois do
        local p = Echantillon(rng, cfg, pPts, 25)
        if (not p) then break end
        pPts[#pPts + 1] = p
        pois[#pois + 1] = { x = p.x, z = p.z, label = LABELS_POI[((i - 1 + math.floor(rng() * #LABELS_POI)) % #LABELS_POI) + 1], biome = Generateur.Biome(p, cfg) }
    end

    return { seed = cfg.seed, biomes = biomes, monsters = monstres, resources = ressources, pois = pois }
end

-- Validation automatique (avant application).
function Generateur.Valider(r, cfg)
    local erreurs, avertissements = {}, {}
    local b = cfg.bounds
    for i, m in ipairs(r.monsters) do
        if (m.x < b.minX or m.x > b.maxX or m.z < b.minZ or m.z > b.maxZ) then erreurs[#erreurs + 1] = string.format("Monstre hors bornes (%.0f,%.0f)", m.x, m.z) end
        if (hypot(m.x - cfg.hub.x, m.z - cfg.hub.z) < cfg.safeRadius) then erreurs[#erreurs + 1] = string.format("Monstre dans la zone sûre (%.0f,%.0f)", m.x, m.z) end
        if (m.packSize < 1 or m.packSize > 5) then erreurs[#erreurs + 1] = "Meute invalide ×" .. m.packSize end
        if (m.level < 1 or m.level > 50) then erreurs[#erreurs + 1] = "Niveau invalide " .. m.level end
    end
    for i = 1, #r.monsters do
        for j = i + 1, #r.monsters do
            if (hypot(r.monsters[i].x - r.monsters[j].x, r.monsters[i].z - r.monsters[j].z) < ESPACEMENT_MONSTRE - 0.01) then erreurs[#erreurs + 1] = string.format("Spawns trop proches (#%d/#%d)", i - 1, j - 1) end
        end
    end
    for _, res in ipairs(r.resources) do
        if (res.x < b.minX or res.x > b.maxX or res.z < b.minZ or res.z > b.maxZ) then erreurs[#erreurs + 1] = "Ressource hors bornes" end
    end
    if (#r.monsters > MAX_MONSTRE) then erreurs[#erreurs + 1] = "Densité monstres > " .. MAX_MONSTRE end
    if (#r.resources > MAX_RESSOURCE) then erreurs[#erreurs + 1] = "Densité ressources > " .. MAX_RESSOURCE end
    if (#r.monsters < cfg.monsterPoints) then avertissements[#avertissements + 1] = string.format("Densité demandée non atteinte (%d/%d)", #r.monsters, cfg.monsterPoints) end
    if (#r.resources < cfg.resources) then avertissements[#avertissements + 1] = string.format("Ressources placées %d/%d", #r.resources, cfg.resources) end

    return { ok = (#erreurs == 0), errors = erreurs, warnings = avertissements }
end

return Generateur