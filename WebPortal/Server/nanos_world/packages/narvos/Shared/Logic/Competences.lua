-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Competences.lua — générateur de compétences (port PUR de
-- skills/skillGenerator.ts).
--
-- SOURCE : `generateSkillsForClass` + `getAllSkills` + `getSkill`. Combine :
--   classe (élément, attackPower) × archétype (mult, cooldown) → compétence.
-- id = `<classe>_<archetype>` ; vfx = `<element>_<archetype>`.
-- Consomme `Catalogs/Classes.lua` + `Catalogs/Archetypes.lua`.
-- ═══════════════════════════════════════════════════════════════════════════════

local Competences = {}
local Classes, Archetypes, Elements = nil, nil, nil

function Competences.Configurer(catClasses, catArchetypes, catElements)
    Classes, Archetypes, Elements = catClasses, catArchetypes, catElements
end

local function arrondi(n)
    -- Math.round JS : demi-tour vers +inf.
    if n >= 0 then return math.floor(n + 0.5) else return math.ceil(n - 0.5) end
end

--- Génère les sorts d'une classe (un par archétype).
function Competences.PourClasse(classId)
    if not Classes then return {} end
    local cls = Classes.CLASSES[classId]
    if not cls then return {} end
    local elementLabel = (Elements and Elements.ELEMENTS[cls.element] and Elements.ELEMENTS[cls.element].label) or cls.element
    local attackPower = cls.baseStats and cls.baseStats.attackPower or (cls.attack_power or 0)
    local resultat = {}
    for _, archId in ipairs(Archetypes.IDS) do
        local arch = Archetypes.ARCHETYPES[archId]
        local label
        if arch.archetype == "ultimate" then
            label = arch.nom_suffixe .. " " .. elementLabel   -- "Apocalypse Feu"
        else
            label = arch.nom_suffixe .. " de " .. elementLabel -- "Frappe de Feu"
        end
        resultat[#resultat + 1] = {
            id = classId .. "_" .. archId,
            class_id = classId,
            archetype = archId,
            element = cls.element,
            label = label,
            damage = arrondi(attackPower * arch.degats_mult),
            heal = arrondi(arch.soin_mult * 10),
            mana_cost = arch.mana_cost,
            cooldown = arch.cooldown,
            animation = arch.animation,
            vfx = cls.element .. "_" .. archId,
            description = arch.desc_template:gsub("{element}", string.lower(elementLabel)),
        }
    end
    return resultat
end

--- Catalogue complet (toutes classes × archétypes). Parité getAllSkills.
local cache = nil
function Competences.Tout()
    if cache then return cache end
    local all = {}
    local classIds = (Classes.CLASS_IDS or Classes.IDS or {})
    for _, cid in ipairs(classIds) do
        for _, s in ipairs(Competences.PourClasse(cid)) do all[#all + 1] = s end
    end
    cache = all
    return all
end

--- Récupère un sort précis par id. Parité getSkill.
function Competences.Obtenir(skillId)
    for _, s in ipairs(Competences.Tout()) do
        if s.id == skillId then return s end
    end
    return nil
end

--- Stats du catalogue. Parité getSkillCatalogStats.
function Competences.Stats()
    local classIds = (Classes.CLASS_IDS or Classes.IDS or {})
    return { total = #Competences.Tout(), par_classe = #Archetypes.IDS, classes = #classIds }
end

return Competences