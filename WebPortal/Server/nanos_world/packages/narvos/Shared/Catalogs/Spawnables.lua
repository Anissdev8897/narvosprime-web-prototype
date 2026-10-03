-- Genere par scripts/narvos-spawnables-to-lua.mjs — ne pas editer a la main.
--
-- 68 entrees invocables, verifiees presentes dans le pack cuit.
--
-- ⚠ CE FICHIER NE CONTIENT QUE DES ASSETS REELS. Un mesh absent du pack ne
-- leve pas dans nanos : il affiche la capsule de collision, un cylindre blanc.
-- Le generateur croise donc chaque entree avec `Assets.toml` avant de l'ecrire.
-- Au moment de la generation, 25 PNJ de Npc.lua n'avaient pas
-- d'asset et ont ete ECARTES ; ils reviendront apres import de public/models/pnj.

local Spawnables = {}

Spawnables.PACK = "narvos"

--- Roles, dans l'ordre d'affichage du menu.
Spawnables.ROLES = {
    { id = "allie", label = "PNJ allies" },
    { id = "ennemi", label = "PNJ ennemis" },
    { id = "monstre", label = "Monstres" },
    { id = "marchand", label = "Marchands" },
    { id = "quete", label = "PNJ de quete" },
    { id = "neutre", label = "Autres PNJ" },
}

Spawnables.ENTREES = {
    { id = "soldat_humain", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_14", role = "allie", famille = "PNJ", label = "Soldat Humain", source = "npc", class_id = "warrior_heal", faction = "akarlys", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "soldat_femme", asset = "Meshy_AI_biped_Character_output_11", role = "allie", famille = "PNJ", label = "Soldat Femme", source = "npc", class_id = "warrior_bruiser", faction = "akarlys", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "soldat_vert", asset = "Meshy_AI_biped_Character_output_13", role = "allie", famille = "PNJ", label = "Soldat Vert", source = "npc", class_id = "warrior_tank", faction = "akarlys", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "soldat_mercenaire", asset = "Meshy_AI_biped_Character_output_12", role = "allie", famille = "PNJ", label = "Soldat Mercenaire", source = "npc", class_id = "warrior_dps", faction = "mezalayis", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "mercenaire_tank", asset = "mercenaire_tank_idle", role = "allie", famille = "PNJ", label = "Mercenaire Tank", source = "npc", class_id = "warrior_tank", faction = "mezalayis", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 169, texture = "ok" },
    { id = "mercenaire_humain_tank", asset = "Meshy_AI_biped_Character_output_9", role = "allie", famille = "PNJ", label = "Tank Humain", source = "npc", class_id = "warrior_tank", faction = "akarlys", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 169, texture = "ok" },
    { id = "sou_major", asset = "Meshy_AI_biped_Character_output_14", role = "quete", famille = "PNJ", label = "Sous-Major", source = "npc", class_id = "warrior_heal", faction = "akarlys", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "general", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations", role = "quete", famille = "PNJ", label = "Général", source = "npc", class_id = "warrior_tank", faction = "akarlys", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "general_mission", asset = "Meshy_AI_biped_Character_output", role = "quete", famille = "PNJ", label = "Général (Mission)", source = "npc", class_id = "warrior_tank", faction = "akarlys", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "gran_cheff", asset = "Meshy_AI_biped_Character_output_2", role = "marchand", famille = "PNJ", label = "Grand Chef", source = "npc", class_id = "warrior_bruiser", faction = "mezalayis", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "kgnitig", asset = "Meshy_AI_biped_Character_output_8", role = "marchand", famille = "PNJ", label = "Kgnitig", source = "npc", class_id = "warrior_bruiser", faction = "mezalayis", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "grunt", asset = "Meshy_AI_biped_Character_output_7", role = "ennemi", famille = "PNJ", label = "Tosus", source = "npc", class_id = "warrior_dps", faction = "mezalayis", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 153, texture = "ok" },
    { id = "mercenaire_alien", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_10", role = "ennemi", famille = "PNJ", label = "Mercenaire Alien", source = "npc", class_id = "warrior_dps", faction = "zayan", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "gronomi_mineur", asset = "Meshy_AI_biped_Character_output_6", role = "ennemi", famille = "PNJ", label = "Gronomi Mineur", source = "npc", class_id = "warrior_bruiser", faction = "zayan", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "gronomi_ardent", asset = "Meshy_AI_biped_Character_output_4", role = "ennemi", famille = "PNJ", label = "Gronomi Ardent", source = "npc", class_id = "warrior_dps", faction = "zayan", simple = true, echelle = 104.3769, echelle_animee = 1.0438, taille_cm = 150, texture = "ok" },
    { id = "gronomi_infaterie", asset = "Meshy_AI_biped_Character_output_5", role = "ennemi", famille = "PNJ", label = "Gronomi Infanterie", source = "npc", class_id = "warrior_bruiser", faction = "zayan", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "grongnoni_majeur", asset = "Meshy_AI_biped_Character_output_3", role = "ennemi", famille = "PNJ", label = "Grongnoni Majeur", source = "npc", class_id = "warrior_dps", faction = "zayan", simple = true, echelle = 103.3129, echelle_animee = 1.0331, taille_cm = 150, texture = "ok" },
    { id = "profhete", asset = "Meshy_AI_biped_Character_output_10", role = "ennemi", famille = "PNJ", label = "Prophète", source = "npc", class_id = "warrior_heal", faction = "zayan", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "profhete_alien", asset = "profhete_alien_idle", role = "ennemi", famille = "PNJ", label = "Prophète Alien", source = "npc", class_id = "warrior_dps", faction = "zayan", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "venom_stalker", asset = "venom_stalker_idle", role = "ennemi", famille = "PNJ", label = "Venom Stalker", source = "npc", class_id = "warrior_bruiser", faction = "zayan", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "aquarys_crab", asset = "Meshy_AI_quadruped_model_Animation_Walking_withSkin", role = "monstre", famille = "Creatures", label = "Crabe Aquarys", source = "npc", class_id = "warrior_tank", simple = true, echelle = 40000, echelle_animee = 507.1508, taille_cm = 160, texture = "ok" },
    { id = "canopy_prophet_female", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_18", role = "monstre", famille = "Creatures", label = "Prophétesse Canopée", source = "npc", class_id = "warrior_heal", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 175, texture = "ok" },
    { id = "canopy_prophet_male", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_19", role = "monstre", famille = "Creatures", label = "Prophète Canopée", source = "npc", class_id = "warrior_tank", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "mycelium_host_female", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_20", role = "monstre", famille = "Creatures", label = "Hôte Mycélium (F)", source = "npc", class_id = "warrior_bruiser", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "mycelium_host_male", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_21", role = "monstre", famille = "Creatures", label = "Hôte Mycélium (H)", source = "npc", class_id = "warrior_tank", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 163, texture = "ok" },
    { id = "parasite_sower_female", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_22", role = "monstre", famille = "Creatures", label = "Semeuse Parasite", source = "npc", class_id = "warrior_dps", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "parasite_sower_male", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_23", role = "monstre", famille = "Creatures", label = "Semeur Parasite", source = "npc", class_id = "warrior_bruiser", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "pressure_manipulator_female", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_24", role = "monstre", famille = "Creatures", label = "Manip. Pression (F)", source = "npc", class_id = "warrior_bruiser", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "pressure_manipulator_male", asset = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations_25", role = "monstre", famille = "Creatures", label = "Manip. Pression (H)", source = "npc", class_id = "warrior_tank", simple = true, echelle = 100, echelle_animee = 1, taille_cm = 170, texture = "ok" },
    { id = "gatonomi", asset = "Monster03_AllAnim", role = "monstre", famille = "Creatures", label = "Gatonomi", source = "npc", class_id = "warrior_dps", simple = true, taille_cm = 199, texture = "ok" },
    { id = "gralynis_boss", asset = "Monster04_AllAnim", role = "monstre", famille = "Creatures", label = "Gralynis", source = "npc", class_id = "warrior_dps", simple = true, taille_cm = 200, texture = "ok" },
    { id = "blackorn", asset = "blackorn", role = "monstre", famille = "Creatures", label = "Blackorn", source = "npc", class_id = "warrior_tank", simple = true, echelle = 100, taille_cm = 93, texture = "ok" },
    { id = "lizard", asset = "lizard", role = "monstre", famille = "Creatures", label = "Lézard Géant", source = "npc", class_id = "warrior_bruiser", simple = true, taille_cm = 103, texture = "ok" },
    { id = "mob_boss", asset = "mob_boss", role = "monstre", famille = "Creatures", label = "Juggernaut Sanglant", source = "npc", class_id = "warrior_dps", simple = true, echelle = 100, taille_cm = 154, texture = "ok" },
    { id = "modulaire_defender_mannequin_f", asset = "SKM_Manny_3", role = "allie", famille = "Modulaires", label = "Mannequin modulaire UE4 (F)", source = "modular", texture = "ok" },
    { id = "modulaire_narvos_operateur_m", asset = "SK_CyberpunkSamurai_WithoutHelmet", role = "allie", famille = "Modulaires", label = "Opérateur NARVOS (M)", source = "modular", taille_cm = 187, texture = "ok" },
    { id = "modulaire_narvos_valkiria_f", asset = "SK_Valkiria", role = "allie", famille = "Modulaires", label = "Valkiria NARVOS (F)", source = "modular", taille_cm = 197, texture = "ok" },
    { id = "modulaire_sk_female_form_standalone", asset = "SK_Female_Form_Standalone", role = "allie", famille = "Modulaires", label = "Trooper — Female (F)", source = "modular", taille_cm = 180, texture = "ok" },
    { id = "modulaire_sk_male_form_standalone", asset = "SK_Male_Form_Standalone", role = "allie", famille = "Modulaires", label = "Trooper — Male (M)", source = "modular", taille_cm = 182, texture = "ok" },
    { id = "modulaire_sk_petite_female_form_standalone", asset = "SK_Petite_Female_Form_Standalone", role = "allie", famille = "Modulaires", label = "Trooper — Petite Female (F)", source = "modular", taille_cm = 173, texture = "ok" },
    { id = "sk_cyberpunksamurai_withhelmet", asset = "SK_CyberpunkSamurai_WithHelmet", role = "neutre", famille = "Cyber", label = "Samourai cyber (casque)", source = "pack", taille_cm = 187, texture = "ok" },
    { id = "sk_f_trooper_standalone_armor_multi_mats_with_head", asset = "SK_F_Trooper_standalone_armor_multi_mats_with_head", role = "allie", famille = "Troopers", label = "Trooper femme (tete nue)", source = "pack", taille_cm = 180, texture = "ok" },
    { id = "sk_f_trooper_standalone_armor_single_mat_with_head_and_helmet", asset = "SK_F_Trooper_standalone_armor_single_mat_with_head_and_helmet", role = "allie", famille = "Troopers", label = "Trooper femme (casque)", source = "pack", taille_cm = 181, texture = "ok" },
    { id = "sk_m_trooper_standalone_multi_mats_with_head", asset = "SK_M_Trooper_standalone_multi_mats_with_head", role = "allie", famille = "Troopers", label = "Trooper homme (tete nue)", source = "pack", taille_cm = 182, texture = "ok" },
    { id = "sk_m_trooper_standalone_single_mat_with_head_and_helmet", asset = "SK_M_Trooper_standalone_single_mat_with_head_and_helmet", role = "allie", famille = "Troopers", label = "Trooper homme (casque)", source = "pack", taille_cm = 184, texture = "ok" },
    { id = "sk_pf_trooper_standalone_armor_multi_mats_with_head", asset = "SK_PF_Trooper_standalone_armor_multi_mats_with_head", role = "allie", famille = "Troopers", label = "Trooper femme menue (tete nue)", source = "pack", taille_cm = 173, texture = "ok" },
    { id = "sk_pf_trooper_standalone_armor_single_mat_with_head_and_helmet", asset = "SK_PF_Trooper_standalone_armor_single_mat_with_head_and_helmet", role = "allie", famille = "Troopers", label = "Trooper femme menue (casque)", source = "pack", taille_cm = 174, texture = "ok" },
    { id = "infecte_sovietzombie2", asset = "SM_ZombieSoldier2_UE4", role = "monstre", famille = "Infectes", label = "Infecte sovietzombie2", source = "pack", texture = "ok" },
    { id = "infecte_zombiesoldier4", asset = "SM_ZombieSoldier4_FullBody_UE4", role = "monstre", famille = "Infectes", label = "Infecte zombiesoldier4", source = "pack", texture = "ok" },
    { id = "infecte_zombiesoldierofficer", asset = "SM_ZombieSoldierOfficer1", role = "monstre", famille = "Infectes", label = "Infecte zombiesoldierofficer", source = "pack", texture = "ok" },
    { id = "infecte_sovietzombietankman1", asset = "SM_ZombieSoldierTankman_UE4", role = "monstre", famille = "Infectes", label = "Infecte sovietzombietankman1", source = "pack", texture = "ok" },
    { id = "infecte_zombiesoldierwinter", asset = "SM_ZombieSoldierWinter_UE4", role = "monstre", famille = "Infectes", label = "Infecte zombiesoldierwinter", source = "pack", texture = "ok" },
    { id = "infecte_sovietzombie1", asset = "SM_ZombieSoldier_UE4", role = "monstre", famille = "Infectes", label = "Infecte sovietzombie1", source = "pack", texture = "ok" },
    { id = "sk_hero", asset = "SK_Hero", role = "allie", famille = "Defender", label = "Héros", source = "pack", texture = "ok" },
    { id = "sk_l_male", asset = "SK_L_Male", role = "allie", famille = "Defender", label = "Soldat d'entraînement (L Male)", source = "pack", texture = "ok" },
    { id = "sk_m_male", asset = "SK_M_Male", role = "allie", famille = "Defender", label = "Soldat d'entraînement (M Male)", source = "pack", texture = "ok" },
    { id = "sk_m_male2", asset = "SK_M_Male2", role = "allie", famille = "Defender", label = "Soldat d'entraînement (M Male2)", source = "pack", texture = "ok" },
    { id = "sk_m_male3", asset = "SK_M_Male3", role = "allie", famille = "Defender", label = "Soldat d'entraînement (M Male3)", source = "pack", texture = "ok" },
    { id = "sk_murdock", asset = "SK_Murdock", role = "ennemi", famille = "Defender", label = "Murdock", source = "pack", texture = "ok" },
    { id = "sk_murdockexecutionerv2", asset = "SK_MurdockExecutionerV2", role = "ennemi", famille = "Defender", label = "Murdock l'exécuteur", source = "pack", texture = "ok", translucide = true },
    { id = "sk_murdockwasteland", asset = "SK_MurdockWasteland", role = "ennemi", famille = "Defender", label = "Murdock des terres brûlées", source = "pack", texture = "ok" },
    { id = "sk_s_male", asset = "SK_S_Male", role = "allie", famille = "Defender", label = "Soldat d'entraînement (S Male)", source = "pack", texture = "ok" },
    { id = "sk_shadowops", asset = "SK_ShadowOps", role = "ennemi", famille = "Defender", label = "Opérateur de l'ombre", source = "pack", texture = "ok" },
    { id = "sk_trooper", asset = "SK_Trooper", role = "allie", famille = "Defender", label = "Trooper", source = "pack", texture = "ok" },
    { id = "sk_wraithlunarops", asset = "SK_WraithLunarOps", role = "ennemi", famille = "Defender", label = "Wraith lunaire", source = "pack", texture = "ok" },
    { id = "civil_sk_meta_female_base", asset = "SK_Meta_Female_Base", role = "neutre", famille = "MetaCustom", label = "Civile Corps femme MetaCustom", source = "metacustom", simple = true, tenue = "metacustom", texture = "ok" },
    { id = "civil_sk_metap", asset = "SK_MetaP", role = "neutre", famille = "MetaCustom", label = "Civile Corps femme MetaCustom (P)", source = "metacustom", simple = true, tenue = "metacustom", texture = "ok" },
    { id = "civil_sk_metap1", asset = "SK_MetaP1", role = "neutre", famille = "MetaCustom", label = "Civile Corps femme MetaCustom (P1)", source = "metacustom", simple = true, tenue = "metacustom", texture = "ok" },
}

local par_id = {}
for _, e in ipairs(Spawnables.ENTREES) do par_id[e.id] = e end

---@param id any
---@return table|nil
function Spawnables.Trouver(id)
    if (type(id) ~= "string") then return nil end
    return par_id[id]
end

--- Chemin complet pour `Character`/`CharacterSimple`/`StaticMesh`.
---@param id string
---@return string|nil
function Spawnables.Asset(id)
    local e = Spawnables.Trouver(id)
    if (not e) then return nil end
    return Spawnables.PACK .. "::" .. e.asset
end

--- Entrees d'un role.
---@param role string
---@return table
function Spawnables.ParRole(role)
    local sortie = {}
    for _, e in ipairs(Spawnables.ENTREES) do
        if (e.role == role) then sortie[#sortie + 1] = e end
    end
    return sortie
end

--- Recherche par sous-chaine, insensible a la casse.
---@param texte string
---@param maximum? integer
---@return table
function Spawnables.Chercher(texte, maximum)
    local sortie = {}
    if (type(texte) ~= "string" or texte == "") then return sortie end
    local recherche = texte:lower()
    local n = maximum or 60
    for _, e in ipairs(Spawnables.ENTREES) do
        if (e.label:lower():find(recherche, 1, true) or e.id:lower():find(recherche, 1, true)) then
            sortie[#sortie + 1] = e
            if (#sortie >= n) then break end
        end
    end
    return sortie
end

--- Un PNJ hostile doit-il attaquer ? Le menu de spawn le lit pour proposer
--- une case a cocher, et Server/Spawner.lua pour armer l'IA.
---@param id string
---@return boolean
function Spawnables.EstHostile(id)
    local e = Spawnables.Trouver(id)
    return e ~= nil and (e.role == "ennemi" or e.role == "monstre")
end

return Spawnables
