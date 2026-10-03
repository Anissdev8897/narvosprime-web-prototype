-- ══════════════════════════════════════════════════════════════════════════════
-- Patches.lua — dalles de collision qui bouchent les trous de la carte.
--
-- FICHIER GÉNÉRÉ par scripts/narvos-patches-to-lua.mjs — ne pas éditer à la main.
--
-- 17 dalles, relevées par un balayage de 1 525 681 rayons verticaux
-- (un tous les 250 uu), puis confirmées à 50 uu et mesurées contre le diamètre
-- de la capsule du joueur (90 uu). Détail : .hermes/TROUS_HALO_MAP_2026-09-06.md
--
-- ⚠ CE CATALOGUE PORTE DES TRANSFORMS, contrairement à Map_*.lua.
-- Les meshes de la carte ont leurs transforms cuites dans les sommets et se
-- spawnent à Vector(0,0,0) ; ces dalles-ci sont un cube générique réutilisé
-- 17 fois, donc position et échelle doivent voyager avec.
--
-- ⚠ Les 4 points restés « ouverts » après réparation ne sont PAS des trous :
-- ce sont des crevasses verticales entre deux parois (dénivelé 1 953 à 5 961 uu
-- autour du point). Un rayon vertical les manque, un joueur qui marche ne les
-- rencontre pas. Les boucher demandait des cubes de 18 x 18 x 62 m visibles de
-- partout — essayé, mesuré à 94-100 % de surface apparente, retiré.
-- ══════════════════════════════════════════════════════════════════════════════

local Patches = {}

--- Mesh réutilisé par toutes les dalles. Copie du cube moteur rangée sous
--- Narvos/ : un asset de /Engine/ ne serait jamais cuit dans le pack.
Patches.MESH = "narvos::SM_Patch_Sol"

--- Carte visée. Les dalles sont calées sur SA géométrie : les rejouer sur une
--- autre version de la carte n'aurait pas de sens.
Patches.CARTE = "chunks_unreal_v3"

--- Une entrée par trou. Le cube source fait 100 uu de côté : l'échelle est donc
--- la taille voulue divisée par 100.
Patches.LISTE = {
    { nom = "PATCHV3_004", position = { -84000, 77750, 15623.7 }, rotation = { 0, -45.2, -1.87 }, echelle = { 18.7, 18.7, 0.6 }, materiau = "MTL_NarvosTerrain" },
    { nom = "PATCHV3_041", position = { -184750, 106500, 9422.5 }, rotation = { 0, 54.9, -5.39 }, echelle = { 18.7, 18.7, 0.6 }, materiau = "MTL_MWAM_Landscape_IslandExample_-ground_with_grass___ff_unearthed_zone_i__001" },
    { nom = "PATCHV3_042", position = { -186000, 112000, 9444.3 }, rotation = { 0, 101.69, -24.04 }, echelle = { 18.7, 18.7, 0.6 }, materiau = "MTL_MWAM_Landscape_IslandExample_-ground_with_grass___ff_unearthed_zone_i__001" },
    { nom = "PATCHV3_047", position = { -118500, 178500, 10166.9 }, rotation = { 0, 110.49, -12.67 }, echelle = { 18.7, 18.7, 0.6 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_060", position = { -193250, 129250, 9966.2 }, rotation = { 0, 133.3, -7.32 }, echelle = { 18.7, 18.7, 0.6 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_063", position = { -164250, 83000, 9688.3 }, rotation = { 0, 115.97, -23.11 }, echelle = { 18.7, 18.7, 0.6 }, materiau = "MTL_MWAM_Landscape_IslandExample_-ground_with_grass___ff_unearthed_zone_i__001" },
    { nom = "PATCHV3_069", position = { -184250, 104500, 9460.6 }, rotation = { 0, 0, 0 }, echelle = { 8.5, 13.5, 0.6 }, materiau = "MTL_MWAM_Landscape_IslandExample_-ground_with_grass___ff_unearthed_zone_i__001" },
    { nom = "PATCHV3_087", position = { -93000, 106750, 9906.3 }, rotation = { 0, 0, 0 }, echelle = { 8.5, 8.5, 2.5 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_087_C", position = { -92975, 106750, 9960.9 }, rotation = { 0, 0, 0 }, echelle = { 11.5, 20, 1.8 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_088", position = { -163750, 82750, 9609.6 }, rotation = { 0, 0, 0 }, echelle = { 8.5, 8.5, 2.5 }, materiau = "MTL_MWAM_Landscape_IslandExample_-ground_with_grass___ff_unearthed_zone_i__001" },
    { nom = "PATCHV3_088_C", position = { -163175, 82325, 9644.6 }, rotation = { 0, 0, 0 }, echelle = { 8.5, 7.5, 1.8 }, materiau = "MTL_MWAM_Landscape_IslandExample_-ground_with_grass___ff_unearthed_zone_i__001" },
    { nom = "PATCHV3_096", position = { -197125, 132000, 9918.4 }, rotation = { 0, 0, 0 }, echelle = { 11, 8.5, 2.5 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_096_C", position = { -197125, 132100, 10074.6 }, rotation = { 0, 0, 0 }, echelle = { 20, 15, 1.8 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_105", position = { -200000, 133250, 10263.6 }, rotation = { 0, 0, 0 }, echelle = { 8.5, 8.5, 2.5 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_105_C", position = { -200000, 133375, 10252.2 }, rotation = { 0, 0, 0 }, echelle = { 20, 15.5, 1.8 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_109", position = { -184250, 103250, 9624.3 }, rotation = { 0, 0, 0 }, echelle = { 8.5, 8.5, 2.5 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
    { nom = "PATCHV3_109_C", position = { -183950, 103175, 9702.8 }, rotation = { 0, 0, 0 }, echelle = { 10, 18.5, 1.8 }, materiau = "MTL_MWAM_Landscape_MountainRangeExample_-ground_with_grass___ff_unearthed_zone_i_" },
}

return Patches
