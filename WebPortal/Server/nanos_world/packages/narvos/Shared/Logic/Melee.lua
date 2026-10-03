-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Melee.lua — les armes de CORPS À CORPS des objets du sac : famille,
-- mesh, prise, animations, fenêtre de coup, sons. Règles PURES (aucune API nanos).
--
-- Câblage : `Narvos.Melee = Package.Require("Logic/Melee.lua")` dans Shared/Index.lua,
-- APRÈS l'intégration des objets Hyper et InventorySystemPro (il itère ITEM_DB),
-- puis `Narvos.Melee.Integrer(Narvos.Items.ITEM_DB, Narvos.Roue)`.
-- Exécutant : narvos-map-proto/Server/Combat.lua (`CombatServeur.Equiper`).
--
-- ── POURQUOI (2026-09-15) ─────────────────────────────────────────────────────
-- Demande de Hanibes : « ajoute et vérifie les armes de corps à corps avec leurs
-- animations adaptées : épées, bâtons, autres armes de mêlée ». Mesuré avant
-- (enquête .hermes, agent mêlée) :
--   · seuls SIX outils du pack de base se tenaient en main (Combat.ARMES) ;
--   · les 7 lames NARVOS faisaient apparaître une BATTE (Roue.ARME_PAR_ITEM) ;
--   · les 22 armes de mêlée Hyper et les 3 d'ISP — épées, dagues, lances, bâton —
--     « s'équipaient » sans rien mettre en main ;
--   · une seule animation (attaque d'ARBALÈTE, ACB_Attack) pour toute arme.
-- Ce module donne à CHAQUE objet de mêlée du catalogue son vrai mesh et les gestes
-- de sa famille.
--
-- ── LES ANIMATIONS : LES MONTAGES DE MÊLÉE DU PACK DE BASE ────────────────────
-- `nanos-world::AM_Mannequin_Melee_*` (DefaultAssetPack.toml:1333-1337) : faits
-- pour la classe `Melee`, sur SKEL_Mannequin, SANS root motion (le personnage ne
-- dérive pas pendant le coup), sons de souffle intégrés. Fenêtres de coup
-- OFFICIELLES pour Slash (0,3 ; 0,5) et Stab (0,3 ; 0,3) — package default-weapons
-- (Crowbar, BaseballBat, Knife). Les clips NARVOS à root motion (ClubFront,
-- PrimaryAttack_*_Slow) sont écartés tant qu'on n'a pas mesuré leur dérive.
--
-- ⚠ À RÉGLER À L'ŒIL : `attache` (position/rotation de prise) et `echelle`. Les
-- meshes n'ont pas tous le même pivot ni le même axe (lance et bâton Epic couchés
-- selon X, pivot au centre) ; les valeurs ci-dessous sont celles de départ de
-- l'enquête, marquées NON VÉRIFIÉES là-bas.
-- ═══════════════════════════════════════════════════════════════════════════════

local Melee = {}

local SLASH = "nanos-world::AM_Mannequin_Melee_Slash_Attack"
local SLASH_LARGE = "nanos-world::AM_Mannequin_Melee_Slash_Outward_Attack"
local STAB = "nanos-world::AM_Mannequin_Melee_Stab_Attack"
local BAYONET = "nanos-world::AM_Mannequin_Melee_Bayonet_Stab_Attack"
local TORCHE = "nanos-world::AM_Mannequin_Torch_Attack"

--- Sons (DefaultAssetPack.toml:1022, 1141-1145).
Melee.SON_SOUFFLE = "nanos-world::A_Whoosh"
--- Chair : le son du Crowbar et de la batte officiels (default-weapons).
Melee.SON_CHAIR = "nanos-world::A_Punch_Cue"
Melee.SON_METAL = "nanos-world::A_MetalHeavy_Impact_MS"
Melee.SON_BOIS = "nanos-world::A_WoodHeavy_Impact_MS"

--- Familles. `prise` = nom d'une valeur de l'énumération `HandlingMode` (lue par
--- l'exécutant). `fenetre` = { début, durée } en secondes après l'appui (unité de
--- `SetDamageSettings`, « times » dans Melee.json). `recharge` en secondes, `portee`
--- en cm (allonge de `Logic/Combat.lua`), `degats` = socle avant puissance.
Melee.FAMILLES = {
    epee = {
        label = "Épée", prise = "SingleHandedMelee",
        animations = { SLASH, STAB, SLASH_LARGE }, fenetre = { 0.3, 0.5 }, recharge = 1.0,
        portee = 170, degats = 30, son = Melee.SON_METAL,
        attache = { x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0 }, echelle = 1.0,
    },
    epee_lourde = {
        label = "Épée à deux mains", prise = "DoubleHandedMelee",
        animations = { SLASH_LARGE, SLASH }, fenetre = { 0.45, 0.55 }, recharge = 1.4,
        portee = 200, degats = 42, son = Melee.SON_METAL,
        attache = { x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0 }, echelle = 1.0,
    },
    dague = {
        label = "Dague", prise = "SingleHandedMelee",
        animations = { STAB, SLASH }, fenetre = { 0.3, 0.3 }, recharge = 0.8,
        portee = 120, degats = 20, son = Melee.SON_METAL,
        attache = { x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0 }, echelle = 1.0,
    },
    hache = {
        label = "Hache", prise = "SingleHandedMelee",
        animations = { SLASH, SLASH_LARGE }, fenetre = { 0.3, 0.5 }, recharge = 1.2,
        portee = 160, degats = 34, son = Melee.SON_METAL,
        attache = { x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0 }, echelle = 1.0,
    },
    contondant = {
        label = "Arme contondante", prise = "SingleHandedMelee",
        animations = { SLASH }, fenetre = { 0.3, 0.5 }, recharge = 1.0,
        portee = 170, degats = 26, son = Melee.SON_METAL,
        attache = { x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0 }, echelle = 1.0,
    },
    lance = {
        label = "Lance", prise = "DoubleHandedMelee",
        animations = { BAYONET, STAB }, fenetre = { 0.3, 0.3 }, recharge = 1.2,
        portee = 240, degats = 30, son = Melee.SON_BOIS,
        attache = { x = 0, y = 0, z = 0, pitch = 90, yaw = 0, roll = 0 }, echelle = 0.8,
    },
    baton = {
        label = "Bâton", prise = "DoubleHandedMelee",
        animations = { SLASH_LARGE, BAYONET }, fenetre = { 0.4, 0.5 }, recharge = 1.3,
        portee = 200, degats = 26, son = Melee.SON_BOIS,
        attache = { x = 0, y = 0, z = 0, pitch = 90, yaw = 0, roll = 0 }, echelle = 0.8,
    },
    torche = {
        label = "Torche", prise = "Torch",
        animations = { TORCHE }, fenetre = { 0.5, 0.25 }, recharge = 1.5,
        portee = 150, degats = 14, son = Melee.SON_BOIS,
        attache = { x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0 }, echelle = 1.0,
    },
}
--- Ordre stable des familles (itération des tests, de l'interface).
Melee.ORDRE = { "epee", "epee_lourde", "dague", "hache", "contondant", "lance", "baton", "torche" }

--- Règles de classement, dans l'ORDRE : la première qui reconnaît le nom l'emporte
--- (« longsword » avant « sword », « magic_staff » écarté avant « staff »). On lit
--- l'identifiant, la source du pack et le nom du mesh, en minuscules.
Melee.REGLES = {
    { motif = "magic_staff", famille = false },          -- bâton de magie : pas de la mêlée (Hyper « Magic »)
    { motif = "throwing", famille = false },             -- couteau de lancer : objet lancé
    { motif = "shield", famille = false },               -- bouclier : pas de logique de main gauche
    { motif = "bouclier", famille = false },
    { motif = "egide", famille = false },
    { motif = "pickaxe", famille = "hache" },
    { motif = "longsword", famille = "epee_lourde" },
    { motif = "heavy_sword", famille = "epee_lourde" },
    { motif = "sword_heavy", famille = "epee_lourde" },
    { motif = "legend_blade", famille = "epee_lourde" },
    { motif = "blade_legend", famille = "epee_lourde" },
    { motif = "dagger", famille = "dague" },
    { motif = "dague", famille = "dague" },
    { motif = "knife", famille = "dague" },
    { motif = "couteau", famille = "dague" },
    { motif = "katana", famille = "epee" },
    { motif = "saber", famille = "epee" },
    { motif = "sword", famille = "epee" },
    { motif = "blade", famille = "epee" },
    { motif = "epee", famille = "epee" },
    { motif = "lame_", famille = "epee" },            -- « lame_ » : « flame » n'est pas une lame
    { motif = "spear", famille = "lance" },
    { motif = "lance", famille = "lance" },
    { motif = "staff", famille = "baton" },
    { motif = "baton", famille = "baton" },
    { motif = "hatchet", famille = "hache" },
    { motif = "hache", famille = "hache" },
    { motif = "axe", famille = "hache" },
    { motif = "hammer", famille = "contondant" },
    { motif = "marteau", famille = "contondant" },
    { motif = "crowbar", famille = "contondant" },
    { motif = "pipe", famille = "contondant" },
    { motif = "club", famille = "contondant" },
    { motif = "bat", famille = "contondant" },
    { motif = "torch", famille = "torche" },
}

--- Mesh des objets NARVOS qui n'en portent pas (catalogue généré du web). Clés
--- vérifiées dans Assets.toml le 2026-09-15 ; choisies par forme, pas par nom.
Melee.MESH_SANS_CATALOGUE = {
    arch_sword = "narvos::SM_Sword_Steel",
    epee_acier = "narvos::SM_Sword_Iron",
    plasma_blade = "narvos::SM_Sword_Light_Legend",
    lame_magique = "narvos::SM_Sword_Light_Epic",
    void_saber = "narvos::SM_Katana",
    lame_adamantite = "narvos::SM_HeroBlade",
    dague_fer = "narvos::SM_Dagger_Iron",
    hache_raffinee = "narvos::SM_Hatchet_Steel",
}

--- Meshes à ne JAMAIS tenir : collision absente, ou 569 522 triangles.
Melee.MESH_INTERDITS = {
    ["narvos::SM_Pipe_5"] = true,
    ["narvos::SM_Weapon_Baseball_01"] = true,
}

--- Réglages propres à un mesh (prise ou échelle différente de sa famille).
Melee.PAR_MESH = {
    ["narvos::SM_Blade_Legend"] = { echelle = 0.6, attache = { x = 0, y = 0, z = 0, pitch = 90, yaw = 0, roll = 0 } },
    ["narvos::SM_HeroBlade"] = { echelle = 0.85 },
}

local function Minuscule(v)
    return (type(v) == "string") and v:lower() or ""
end

--- Famille d'un objet, ou nil s'il n'est pas une arme de mêlée tenable.
---@param item_id any
---@param def table|nil  entrée d'ITEM_DB
---@return string|nil
function Melee.FamilleDe(item_id, def)
    if (type(def) ~= "table") then return nil end
    if (def.type ~= "weapon" and def.type ~= "tool") then return nil end
    local mesh = def.mesh or Melee.MESH_SANS_CATALOGUE[item_id]
    local nom = Minuscule(item_id) .. " " .. Minuscule(def.source) .. " " .. Minuscule(mesh)
    for _, r in ipairs(Melee.REGLES) do
        if (nom:find(r.motif, 1, true)) then
            return r.famille or nil
        end
    end
    return nil
end

--- Mesh tenable d'un objet de mêlée, ou nil (absent, interdit, squelettique).
---@param item_id any
---@param def table|nil
---@return string|nil
function Melee.MeshDe(item_id, def)
    local mesh = (type(def) == "table" and type(def.mesh) == "string" and def.mesh ~= "") and def.mesh
        or Melee.MESH_SANS_CATALOGUE[item_id]
    if (type(mesh) ~= "string" or mesh == "") then return nil end
    if (Melee.MESH_INTERDITS[mesh]) then return nil end
    -- `Melee(...)` attend un StaticMeshPath (Melee.json) : un SK_ ne se tient pas.
    local nom = mesh:match("::(.+)$") or mesh
    if (nom:match("^SKM?_")) then return nil end
    return mesh
end

--- Réglages complets d'un objet de mêlée, ou nil. Tables NEUVES : l'appelant peut
--- les garder sans risque de modifier la famille.
---@param item_id any
---@param def table|nil
---@return table|nil
function Melee.Reglages(item_id, def)
    local famille_id = Melee.FamilleDe(item_id, def)
    local mesh = famille_id and Melee.MeshDe(item_id, def)
    if (not famille_id or not mesh) then return nil end
    local f = Melee.FAMILLES[famille_id]
    local propre = Melee.PAR_MESH[mesh] or {}
    local a = propre.attache or f.attache
    local bonus = 0
    if (type(def.stats) == "table") then bonus = tonumber(def.stats.attackPower) or 0 end
    local animations = {}
    for i, anim in ipairs(f.animations) do animations[i] = anim end
    return {
        id = item_id,
        label = def.label or item_id,
        famille = famille_id,
        mesh = mesh,
        prise = f.prise,
        animations = animations,
        fenetre_debut = f.fenetre[1],
        fenetre_duree = f.fenetre[2],
        cadence = f.recharge,
        allonge = f.portee,
        degats = f.degats + math.max(0, bonus),
        son_impact = f.son,
        son_souffle = Melee.SON_SOUFFLE,
        echelle = propre.echelle or f.echelle,
        attache = { x = a.x, y = a.y, z = a.z, pitch = a.pitch, yaw = a.yaw, roll = a.roll },
    }
end

--- Branche chaque objet de mêlée tenable du catalogue sur la roue et l'équipement :
--- `Roue.ARME_PAR_ITEM[id] = { genre = "melee", arme_id = id, famille }`. Itère
--- ITEM_DB (jamais une liste recopiée). N'écrase JAMAIS une arme à feu ; remplace
--- les anciennes correspondances vers les six outils (« une épée = une batte »).
---@param item_db table
---@param roue table
---@return integer branches, table par_famille
function Melee.Integrer(item_db, roue)
    local par_famille = {}
    if (type(item_db) ~= "table" or type(roue) ~= "table" or type(roue.ARME_PAR_ITEM) ~= "table") then
        return 0, par_famille
    end
    local ids = {}
    for id in pairs(item_db) do ids[#ids + 1] = id end
    table.sort(ids)
    local branches = 0
    for _, id in ipairs(ids) do
        local actuelle = roue.ARME_PAR_ITEM[id]
        if (not (actuelle and actuelle.genre == "feu")) then
            local r = Melee.Reglages(id, item_db[id])
            if (r) then
                roue.ARME_PAR_ITEM[id] = { genre = "melee", arme_id = id, famille = r.famille }
                branches = branches + 1
                par_famille[r.famille] = (par_famille[r.famille] or 0) + 1
            end
        end
    end
    return branches, par_famille
end

return Melee
