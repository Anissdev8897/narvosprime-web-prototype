-- ═══════════════════════════════════════════════════════════════════════════════
-- Factions.lua — les trois factions de NARVOS et leurs douze classes.
--
-- ── D'OÙ VIENT CHAQUE CHOSE ────────────────────────────────────────────────────
-- Rien ici n'est inventé. Tout est repris du dépôt :
--   · `src/types.ts`               enum Faction (HUMAN/ALIEN/MERCENARY) et
--                                  enum PlayerClass, 12 entrées groupées par
--                                  faction en commentaire.
--   · `src/rpg/ui/hud/hudConstants.ts`  AKARLYS_COLORS, ZAYAN_COLORS,
--                                  MEZALAYIS_COLORS — les teintes déjà employées
--                                  par le HUD en jeu.
--
-- Écrit à la main plutôt que généré : ce fichier est une TABLE DE
-- CORRESPONDANCE que j'établis, pas une transposition mécanique. Un générateur
-- donnerait l'illusion que la correspondance ci-dessous vient des données.
--
-- ── ⚠ CE QUI EST PROVISOIRE ───────────────────────────────────────────────────
-- Les 12 classes de `PlayerClass` sont un enum SANS description, SANS stats, et
-- utilisé nulle part ailleurs dans le dépôt. Le catalogue de jeu vivant
-- (`Catalogs/Classes.lua`) n'en contient que 4, génériques : `warrior_bruiser`,
-- `warrior_dps`, `warrior_tank`, `warrior_heal`.
--
-- Chaque classe de lore pointe donc vers l'une de ces 4 par `class_id`, choisi
-- d'après ce que son NOM annonce (un « Juggernaut » tanke, un « Pyro » brûle).
-- C'est le serveur qui valide, et il ne connaît que les 4 : sans cette
-- correspondance, choisir une classe de lore ferait échouer la création.
--
-- Deux classes de lore partagent donc aujourd'hui les mêmes statistiques. Le jour
-- où chacune aura les siennes, SEULE la colonne `class_id` disparaît — les noms,
-- les factions et les couleurs, eux, sont définitifs.
--
-- `description` est vide exprès : le lore n'existe pas encore sous forme de
-- texte dans le dépôt. Écrire de la prose ici l'inventerait. Le champ est en
-- place pour l'accueillir sans toucher à la structure.
-- ═══════════════════════════════════════════════════════════════════════════════

local Factions = {}

--- Ordre d'affichage. En Lua `pairs` n'a aucun ordre garanti : sans cette
--- séquence, les trois factions changeraient de place entre deux rendus.
Factions.ORDRE = { "AKARLYS", "ZAYAN", "MEZALAYIS" }

Factions.FACTIONS = {
    AKARLYS = {
        id = "AKARLYS",
        enum = "HUMAN",
        label = "AKARLYS",
        sous_titre = "Humains",
        -- hudConstants.ts : AKARLYS_COLORS
        accent = "#3b82f6",
        accent_clair = "#60a5fa",
        lueur = "rgba(59, 130, 246, 0.5)",
        description = "",
    },
    ZAYAN = {
        id = "ZAYAN",
        enum = "ALIEN",
        label = "ZAYAN",
        sous_titre = "Aliens",
        -- hudConstants.ts : ZAYAN_COLORS
        accent = "#a855f7",
        accent_clair = "#c084fc",
        lueur = "rgba(168, 85, 247, 0.5)",
        description = "",
    },
    MEZALAYIS = {
        id = "MEZALAYIS",
        enum = "MERCENARY",
        label = "MEZALAYIS",
        sous_titre = "Mercenaires",
        -- hudConstants.ts : MEZALAYIS_COLORS
        accent = "#eab308",
        accent_clair = "#fbbf24",
        lueur = "rgba(234, 179, 8, 0.5)",
        description = "",
    },
}

--- Les 12 classes de `PlayerClass`, dans l'ordre du fichier source.
--- `class_id` : voir l'avertissement en tête de fichier.
Factions.CLASSES_ORDRE = {
    "PRESSURE_MANIPULATOR", "BIO_SCOUT", "CURRENT_BREAKER", "AQUARYS_SHADOW",
    "PARASITE_SOWER", "CANOPY_PROPHET", "MYCELIUM_HOST", "VENOM_STALKER",
    "PYRO_ALCHEMIST", "FLUX_SCAVENGER", "DESERT_MIRAGE", "DUST_JUGGERNAUT",
}

Factions.CLASSES = {
    -- ── AKARLYS ───────────────────────────────────────────────────────────────
    PRESSURE_MANIPULATOR = {
        faction = "AKARLYS", label = "Manipulateur de Pression",
        class_id = "warrior_tank", description = "",
    },
    BIO_SCOUT = {
        faction = "AKARLYS", label = "Bio-Éclaireur",
        class_id = "warrior_bruiser", description = "",
    },
    CURRENT_BREAKER = {
        -- « Current » → électrique : c'est l'élément de warrior_bruiser.
        faction = "AKARLYS", label = "Brise-Courant",
        class_id = "warrior_bruiser", description = "",
    },
    AQUARYS_SHADOW = {
        faction = "AKARLYS", label = "Ombre d'Aquarys",
        class_id = "warrior_dps", description = "",
    },

    -- ── ZAYAN ─────────────────────────────────────────────────────────────────
    PARASITE_SOWER = {
        faction = "ZAYAN", label = "Semeur de Parasites",
        class_id = "warrior_heal", description = "",
    },
    CANOPY_PROPHET = {
        faction = "ZAYAN", label = "Prophète de la Canopée",
        class_id = "warrior_heal", description = "",
    },
    MYCELIUM_HOST = {
        faction = "ZAYAN", label = "Hôte Mycélien",
        class_id = "warrior_tank", description = "",
    },
    VENOM_STALKER = {
        faction = "ZAYAN", label = "Traqueur Venimeux",
        class_id = "warrior_dps", description = "",
    },

    -- ── MEZALAYIS ─────────────────────────────────────────────────────────────
    PYRO_ALCHEMIST = {
        -- « Pyro » → feu : c'est l'élément de warrior_dps.
        faction = "MEZALAYIS", label = "Alchimiste Pyro",
        class_id = "warrior_dps", description = "",
    },
    FLUX_SCAVENGER = {
        faction = "MEZALAYIS", label = "Charognard de Flux",
        class_id = "warrior_bruiser", description = "",
    },
    DESERT_MIRAGE = {
        faction = "MEZALAYIS", label = "Mirage du Désert",
        class_id = "warrior_dps", description = "",
    },
    DUST_JUGGERNAUT = {
        faction = "MEZALAYIS", label = "Juggernaut de Poussière",
        class_id = "warrior_tank", description = "",
    },
}

--- Classes d'une faction, dans l'ordre du catalogue.
---@param faction_id string
---@return table[]
function Factions.ParFaction(faction_id)
    local sortie = {}
    for _, id in ipairs(Factions.CLASSES_ORDRE) do
        local c = Factions.CLASSES[id]
        if (c and c.faction == faction_id) then
            sortie[#sortie + 1] = {
                id = id, label = c.label, class_id = c.class_id,
                description = c.description, faction = c.faction,
            }
        end
    end
    return sortie
end

--- Le `class_id` de jeu correspondant à une classe de lore.
--- Rend nil sur un identifiant inconnu : l'appelant décide quoi faire, plutôt
--- que de recevoir une classe par défaut qu'il n'a pas demandée.
---@param lore_id string
---@return string|nil
function Factions.ClasseDeJeu(lore_id)
    local c = Factions.CLASSES[lore_id]
    return c and c.class_id or nil
end

--- Tout ce qu'il faut à l'écran de création, en une table.
---@return table
function Factions.Options()
    local sortie = {}
    for i, id in ipairs(Factions.ORDRE) do
        local f = Factions.FACTIONS[id]
        sortie[i] = {
            id = f.id, label = f.label, sous_titre = f.sous_titre,
            accent = f.accent, accent_clair = f.accent_clair, lueur = f.lueur,
            description = f.description,
            classes = Factions.ParFaction(id),
        }
    end
    return sortie
end

return Factions
