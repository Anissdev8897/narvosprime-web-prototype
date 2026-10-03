-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Catalogs/ArchetypesJoueur.lua — archétypes JOUEUR (port de archetypeCatalog.ts).
--
-- SOURCE : WebPortal/src/rpg/archetypes/archetypeCatalog.ts. 100% DATA. Indépendant
-- des 10 classes élémentaires (réservées aux PNJ). Chaque archétype = une arme +
-- un kit de sorts signature. Ne PAS confondre avec `Catalogs/Archetypes.lua`
-- (les 10 archétypes de COMPÉTENCES — different système, lot 8).
-- ═══════════════════════════════════════════════════════════════════════════════

local ArchetypesJoueur = {}

ArchetypesJoueur.ARCHETYPES = {
    mage = {
        id = "mage", label = "Mage", weaponType = "staff", color = "#a64dff",
        description = "Maître des bâtons et de la magie. Frappe à distance et déchaîne des zones dévastatrices.",
        spells = {
            { id = "mage_meteore", label = "Météore", description = "Cercle esquivable — dégâts de zone massifs (~15% PV).", effect = "aoe_dodge", isUltimate = true, pctPlayerHp = 0.15, baseCooldown = 60, radius = 5 },
            { id = "mage_trait1", label = "Trait Arcanique", description = "Projectile magique à distance.", effect = "ranged", isUltimate = false, pctPlayerHp = 0.06, baseCooldown = 2.5 },
            { id = "mage_trait2", label = "Éclat du Vide", description = "Second projectile à distance, perce-armure.", effect = "ranged", isUltimate = false, pctPlayerHp = 0.05, baseCooldown = 2 },
        },
    },
    archer = {
        id = "archer", label = "Archer", weaponType = "bow", color = "#5cb85c",
        description = "Maître des arcs. Tir chargé dévastateur et pluie de flèches en zone.",
        spells = {
            { id = "archer_charge", label = "Tir Chargé", description = "Clic = petits dégâts · maintien = dégâts bien plus élevés.", effect = "charged", isUltimate = false, pctPlayerHp = 0.08, baseCooldown = 1 },
            { id = "archer_pluie", label = "Pluie de Flèches", description = "Cercle esquivable — gros dégâts de zone (~15% PV).", effect = "aoe_dodge", isUltimate = true, pctPlayerHp = 0.15, baseCooldown = 60, radius = 5 },
        },
    },
    guerrier = {
        id = "guerrier", label = "Guerrier", weaponType = "sword_1h", color = "#d9763c",
        description = "Maître de toutes les armes de mêlée. Frappe sismique et furtivité défensive.",
        spells = {
            { id = "guerrier_frappe", label = "Frappe Dévastatrice", description = "AoE autour du joueur : dégâts (~20% PV) + ennemis immobilisés.", effect = "root_aoe", isUltimate = true, pctPlayerHp = 0.20, baseCooldown = 60, duration = 3, radius = 4 },
            { id = "guerrier_invisible", label = "Voile d'Ombre", description = "Invisibilité 10 s — les ennemis perdent ta trace.", effect = "invisibility", isUltimate = true, baseCooldown = 60, duration = 10 },
        },
    },
    guerrier_spatial = {
        id = "guerrier_spatial", label = "Guerrier Spatial", weaponType = "gun", color = "#3fc7ff",
        description = "Maître des armes à feu de toutes les époques. Tir incendiaire et téléportation tactique.",
        spells = {
            { id = "spatial_tir_brulant", label = "Tir Brûlant", description = "Projectile qui enflamme la cible — brûlure (~25% PV sur la durée).", effect = "burn_shot", isUltimate = true, pctPlayerHp = 0.25, baseCooldown = 60, duration = 4 },
            { id = "spatial_teleport", label = "Saut Quantique", description = "Téléportation instantanée vers une autre zone.", effect = "teleport", isUltimate = true, baseCooldown = 60 },
        },
    },
    ninja = {
        id = "ninja", label = "Ninja", weaponType = "dagger", color = "#7c4dff",
        description = "Assassin de l'ombre : dagues rapides, frappes critiques et esquive furtive.",
        spells = {
            { id = "ninja_assaut", label = "Assaut de l'Ombre", description = "Frappe furtive rapprochée à fort potentiel critique.", effect = "stealth_strike", isUltimate = false, pctPlayerHp = 0.10, baseCooldown = 2 },
            { id = "ninja_eclipse", label = "Éclipse", description = "Brève invisibilité (5 s) pour repositionner ou fuir.", effect = "invisibility", isUltimate = false, baseCooldown = 30, duration = 5 },
        },
    },
}

ArchetypesJoueur.IDS = { "mage", "archer", "guerrier", "guerrier_spatial", "ninja" }

function ArchetypesJoueur.Obtenir(id) return ArchetypesJoueur.ARCHETYPES[id] end
function ArchetypesJoueur.Sorts(id)
    local a = ArchetypesJoueur.ARCHETYPES[id]
    return a and a.spells or {}
end

return ArchetypesJoueur