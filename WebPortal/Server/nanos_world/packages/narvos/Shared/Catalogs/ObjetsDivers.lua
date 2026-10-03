-- ══════════════════════════════════════════════════════════════════════════════
-- ObjetsDivers.lua — les meshes du talkie-walkie, du smartphone, du clavier a code
-- et de la porte que ce clavier commande.
--
-- FICHIER GENERE par scripts/narvos-objets-divers-to-lua.mjs depuis Assets.toml.
-- Ne pas editer a la main : regenerer apres chaque construction du pack.
--
-- Les cles sont choisies par CHEMIN, jamais par nom : une cle suffixee est un
-- rang, qu'un pack triant plus tot decale sans qu'aucun controle d'existence ne
-- le voie.
--
-- 3 objet(s) sur 3 avec leur mesh cuit.
-- Un objet absent reste utilisable : seul le geste visuel manque.
-- ══════════════════════════════════════════════════════════════════════════════

local ObjetsDivers = {}

--- Mesh de chaque objet de sac, par identifiant d'objet (Items.ITEM_DB).
ObjetsDivers.MESHES = {
    talkie_walkie = "narvos::sci-fi_walkie-talkie",   -- en main pendant une emission radio
    smartphone = "narvos::modern_generic_smartphone",   -- en main quand on consulte le telephone
    digicode = "narvos::cc0_-_keypad_door_lock",   -- clavier pose a cote de la porte
}

--- Les pieces de la porte a code.
ObjetsDivers.PORTE = {
    cadre = "narvos::SM_2m_door_frame",
    battant = "narvos::SM_2m_door_leaf",
}

--- Le mesh d'un objet, ou nil s'il n'est pas cuit.
---@param id any
---@return string|nil
function ObjetsDivers.Mesh(id)
    if (type(id) ~= "string") then return nil end
    return ObjetsDivers.MESHES[id]
end

return ObjetsDivers
