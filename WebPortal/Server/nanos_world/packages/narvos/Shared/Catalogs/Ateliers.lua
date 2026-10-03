-- ══════════════════════════════════════════════════════════════════════════════
-- Ateliers.lua — le mesh de chaque station de craft.
--
-- FICHIER GÉNÉRÉ par scripts/narvos-ateliers-to-lua.mjs — ne pas éditer à la main.
-- Source des noms : WebPortal/Server/adk/_manifests/crafting-stations.json,
-- section `branchement`. Source de la VÉRITÉ : Assets.toml.
--
-- 4 station(s) sur 4 portent leur vrai mesh ; les autres gardent le cube.
--
-- ── POURQUOI LE REPLI EST UN CUBE, ET POURQUOI C'EST VOULU ────────────────────
-- nanos ne lève RIEN sur une référence morte : un prop nommé par une clé absente
-- n'apparaît pas, et le joueur croit à un trou du monde. Tant que le pack ne
-- déclare pas la vraie station, on pose donc `nanos-world::SM_Cube` — laid,
-- mais visible, et `cuit = false` le dit à qui lit ce fichier.
--
-- Regénérer APRÈS chaque reconstruction du pack :
--   node scripts/narvos-ateliers-to-lua.mjs --apply
-- ══════════════════════════════════════════════════════════════════════════════

local Ateliers = {}

Ateliers.STATIONS = {
    forge = { mesh = "narvos::SM_Furnace_03", attendu = "SM_Furnace_03", cuit = true, label = "Forge", en_plus = "narvos::SM_Anvil", squelettique = "narvos::SK_Bellows", animation = "narvos::AS_Bellows" },
    workbench = { mesh = "narvos::SM_Workbench_Merged", attendu = "SM_Workbench_Merged", cuit = true, label = "Etabli" },
    alchemy = { mesh = "narvos::SM_ChemistryStation_01_Merged", attendu = "SM_ChemistryStation_01_Merged", cuit = true, label = "Alchimie" },
    refinery = { mesh = "narvos::SM_FuelDistiller_01", attendu = "SM_FuelDistiller_01", cuit = true, label = "Raffinerie", squelettique = "narvos::SK_FuelDistiller_08", animation = "narvos::AS_FuelDistiller_08" },
}

--- L etabli d assemblage (Server/Assemblage.lua) : meme regle, meme repli.
Ateliers.ETABLI = {
    mesh = "narvos::SM_WeaponWorkbench_01", attendu = "SM_WeaponWorkbench_01", cuit = true,
}

--- Le mesh de l etabli d assemblage, jamais nil.
---@return string
function Ateliers.MeshEtabli()
    return Ateliers.ETABLI.mesh
end

--- Le mesh à poser pour une station, jamais nil : le cube sert de repli.
---@param station any
---@return string
function Ateliers.Mesh(station)
    local s = Ateliers.STATIONS[tostring(station or "")]
    return (s and s.mesh) or "nanos-world::SM_Cube"
end

--- La station animée, ou nil. Un CharacterSimple + PlayAnimation feront le reste.
---@param station any
---@return table|nil
function Ateliers.Animee(station)
    local s = Ateliers.STATIONS[tostring(station or "")]
    if (s == nil or s.squelettique == nil or s.animation == nil) then return nil end
    return { mesh = s.squelettique, animation = s.animation }
end

--- Combien de stations portent leur vrai mesh. Pour le journal de démarrage :
--- un catalogue qui ment se voit au premier lancement.
---@return integer, integer
function Ateliers.Compte()
    local cuits, total = 0, 0
    for _, s in pairs(Ateliers.STATIONS) do
        total = total + 1
        if (s.cuit) then cuits = cuits + 1 end
    end
    return cuits, total
end

return Ateliers
