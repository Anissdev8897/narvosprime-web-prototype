-- ── CATALOGUE DES QUÊTES ─ porté de `src/rpg/quests/questCatalog.ts` ──────────
-- ⚠ Main-written cette fois (pas encore dans `narvos-catalogs-to-lua.mjs`) ; à
-- convertir en généré si on étend le catalogue. Source de vérité = questCatalog.ts.
-- Types d'objectifs : kill / reach / collect / talk / survive / escort / use / craft.
local Quetes = {}

local QUESTS = {
    {
        id = "forge_first_blood", title = "Premier sang",
        description = "La Forge grouille d'hostiles. Fais tes preuves en éliminant une première vague.",
        mapId = "forge", factionId = "akarlys",
        objectives = { { kind = "kill", label = "Éliminer des ennemis", target = 5 } },
        reward = { xp = 120, credits = 60 },
    },
    {
        id = "forge_collecte_essences", title = "Essences de la Forge",
        description = "Les cristaux de la Forge renferment une énergie brute. Collecte des fragments de vie et des cristaux d'énergie pour alimenter les relais akarlys.",
        mapId = "forge", factionId = "akarlys", requires = "forge_first_blood",
        objectives = {
            { kind = "collect", label = "Collecter des Fragments de Vie", target = 8, itemId = "fragment_vie" },
            { kind = "collect", label = "Collecter des Cristaux d'Énergie", target = 5, itemId = "cristal_energie" },
        },
        reward = { xp = 160, credits = 90, items = { "potion_soin_majeure" } },
    },
    {
        id = "forge_frontline", title = "Ligne de front",
        description = "Avance jusqu'à la zone de combat avancée, au cœur des positions ennemies.",
        mapId = "forge", factionId = "akarlys", requires = "forge_first_blood",
        objectives = { { kind = "reach", label = "Atteindre la ligne de front", target = 1, mapId = "forge", zone = { x = 0, z = -50, radius = 14 } } },
        reward = { xp = 100, credits = 40 },
    },
    {
        id = "forge_purge", title = "Purge de la Forge",
        description = "Nettoie la zone en profondeur. Le commandement récompensera ton efficacité.",
        mapId = "forge", factionId = "akarlys", requires = "forge_frontline",
        objectives = { { kind = "kill", label = "Éliminer des ennemis", target = 12 } },
        reward = { xp = 320, credits = 180, items = { "potion_soin_majeure" } },
    },
    {
        id = "tower_hold", title = "Tenir la Tour",
        description = "Les assaillants convergent vers la Tour. Repousse-les avant qu'ils ne percent.",
        mapId = "tower", factionId = "akarlys",
        objectives = { { kind = "kill", label = "Repousser les assaillants", target = 10 } },
        reward = { xp = 280, credits = 130 },
    },
    {
        id = "tower_summit", title = "Jusqu'au sommet",
        description = "Progresse jusqu'au poste avancé en surplomb de la Tour.",
        mapId = "tower", factionId = "akarlys", requires = "tower_hold",
        objectives = { { kind = "reach", label = "Atteindre le poste avancé", target = 1, mapId = "tower", zone = { x = 52, z = -80, radius = 16 } } },
        reward = { xp = 140, credits = 70, items = { "potion_mana_majeure" } },
    },
    {
        id = "orbital_patrouille", title = "Patrouille Spatiale",
        description = "L'orbital grouille de vaisseaux hostiles. Nettoie le secteur pour sécuriser la station.",
        mapId = "orbital", factionId = "akarlys",
        objectives = { { kind = "kill", label = "Détruire des vaisseaux ennemis", target = 6, enemyFolder = "space_ship" } },
        reward = { xp = 350, credits = 200, items = { "repair_kit" } },
    },
    {
        id = "orbital_escadrille", title = "L'Escadrille Fantôme",
        description = "Une escadrille entière de chasseurs ennemis a été repérée aux abords de la station. Abats-les avant qu'ils ne lancent un assaut.",
        mapId = "orbital", factionId = "akarlys", requires = "orbital_patrouille",
        objectives = { { kind = "kill", label = "Éliminer l'escadrille spatiale", target = 12, enemyFolder = "space_ship" } },
        reward = { xp = 700, credits = 450, items = { "potion_soin_supreme", "key_corvette" } },
    },
    {
        id = "acces_donjon_furiste", title = "L'Appel du Donjon Furiste",
        description = "Un portail instable pulse d'une énergie bestiale. Accepte cette quête pour en débloquer l'accès, puis franchis le portail pour pénétrer dans le donjon.",
        objectives = { { kind = "kill", label = "Prouver ta valeur (éliminer des ennemis)", target = 3 } },
        reward = { xp = 200, credits = 120 },
    },
}

Quetes.QUETES = QUESTS
Quetes.ORDRE = {}
for i, q in ipairs(QUESTS) do Quetes.ORDRE[i] = q.id end

local PAR_ID = {}
for _, q in ipairs(QUESTS) do PAR_ID[q.id] = q end

--- Quête par id. nil si inconnue.
function Quetes.Quete(id)
    if (id == nil) then return nil end
    return PAR_ID[id]
end

--- Quêtes proposables pour une carte (mapId match ou quête globale).
function Quetes.DeCarte(map_id)
    local out = {}
    for _, q in ipairs(QUESTS) do
        if (q.mapId == nil or q.mapId == map_id) then out[#out + 1] = q end
    end
    return out
end

return Quetes
