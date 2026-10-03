-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Equipement3D.lua — les équipements, ATTACHÉS au corps 3D.
--
-- Câblage : Narvos.Equipement3D = Package.Require("Logic/Equipement3D.lua")
--
-- ── POURQUOI CE MODULE ────────────────────────────────────────────────────────
-- L'inventaire sait QUEL objet est équipé dans QUEL emplacement, mais rien ne
-- l'attachait au personnage : l'écran annonçait « TORSE : Armure Cybernétique »
-- pendant que le modèle 3D restait en sous-vêtements. Les armes, elles, se
-- tiennent déjà (PickUp natif, Roue/Melee) — ce module couvre le RESTE.
--
-- ── LE MODÈLE EST ICI, L'EXÉCUTION AILLEURS ───────────────────────────────────
-- `Attaches` est PUR : équipement + catalogue → la liste de ce qu'il faut
-- attacher (identifiant d'attache, mesh, socket du squelette). L'exécutant
-- (Server/Index.lua) appelle `AddStaticMeshAttached`/`RemoveStaticMeshAttached`
-- du moteur — mêmes primitives que la garde-robe (Builder.Habiller), mêmes
-- sockets du squelette UE (`head`, `spine_03`, `pelvis`, `foot_*`, `neck_01`,
-- `index_01_*` — doc officielle, section Skeleton Bone Names).
--
-- ── LES MESHS DE REPLI ────────────────────────────────────────────────────────
-- Les items de la fusion C (combat_helmet, cyber_armor…) n'ont pas de champ
-- `mesh` : ce sont des données du web. Comme `Melee.MESH_SANS_CATALOGUE`, la
-- table ci-dessous leur donne le mesh CUIT du pack (vérifié dans Assets.toml),
-- sans toucher au catalogue généré.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosEquipement3D
local Equipement3D = {}

---@param slot string
---@return string|nil  le socket du squelette où attacher ce slot.
Equipement3D.SOCKET_PAR_SLOT = {
    helmet    = "head",
    armor     = "spine_03",
    legs      = "pelvis",
    shoes     = "foot_r",
    necklace  = "neck_01",
    ring1     = "index_01_l",
    ring2     = "index_01_r",
    accessory = "neck_01",
    belt      = "pelvis",
    cloak     = "spine_03",
}

---@param item_id string
---@return string|nil  le mesh cuit à défaut de champ `mesh` sur l'item.
Equipement3D.MESH_SANS_CATALOGUE = {
    combat_helmet     = "narvos::SM_ArmorHelmet",
    cyber_armor       = "narvos::SM_ArmorChest",
    combat_boots      = "narvos::SM_ArmorShoes",
    anneau_fer        = "narvos::SM_Ring_Silver",
    bague_givre       = "narvos::SM_Ring_Golden",
    pendentif_acier   = "narvos::SM_Necklace_Silver",
    power_ring        = "narvos::SM_Ring_Golden",
    ward_ring         = "narvos::SM_Ring_Silver",
    talisman_magique  = "narvos::SM_Necklace_Golden",
    void_amulet       = "narvos::SM_Necklace_Silver",
    -- couronne_eternelle / diademe_lunaire : aucun mesh de couronne cuit —
    -- pas d'attache, l'item reste un bonus de stats invisible (honnête).
}

---@param def table  la définition de l'item équipé.
---@param item_id string
---@return string|nil  le mesh à attacher, ou nil (rien à poser).
function Equipement3D.MeshDe(def, item_id)
    if (type(def) == "table" and type(def.mesh) == "string" and def.mesh ~= "") then
        return def.mesh
    end
    return Equipement3D.MESH_SANS_CATALOGUE[item_id]
end

--- Les attachements à poser pour un équipement donné.
--- `GetItemDef(item_id)` : résolveur injecté (Inventory.GetItemDef).
--- Les slots weapon/offhand sont IGNORÉS : les armes se tiennent par PickUp
--- (Roue/Melee), pas par un mesh attaché.
---@param equipment table  { [slot] = { itemId, ... } }
---@param get_item_def function
---@return table  liste de { id = "equip_<slot>", mesh, socket, slot }
function Equipement3D.Attaches(equipment, get_item_def)
    local sortie = {}
    if (type(equipment) ~= "table") then return sortie end

    for slot, socket in pairs(Equipement3D.SOCKET_PAR_SLOT) do
        local inst = equipment[slot]
        if (inst and inst.itemId) then
            local def = get_item_def and get_item_def(inst.itemId)
            local mesh = Equipement3D.MeshDe(def, inst.itemId)
            if (mesh) then
                sortie[#sortie + 1] = { id = "equip_" .. slot, mesh = mesh, socket = socket, slot = slot }
            end
        end
    end
    return sortie
end

return Equipement3D
