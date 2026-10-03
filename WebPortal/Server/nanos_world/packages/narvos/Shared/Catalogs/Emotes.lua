-- ══════════════════════════════════════════════════════════════════════════════
-- Emotes.lua — animations contextuelles (non liées au déplacement).
--
-- ⚠ FICHIER GÉNÉRÉ par scripts/narvos-emotes-to-lua.mjs — ne pas éditer à la
-- main. Il est reconstruit depuis le manifeste d'import, ce qui garantit
-- qu'aucune entrée ne référence une animation absente du pack cuit.
--
-- 166 animations, 7 catégories.
--
-- Ne contient PAS la locomotion ni le combat : ceux-là appartiennent au système
-- de déplacement. Voir Logic/Animations.lua pour les variantes de locomotion.
--
-- ⚠ NI DANSE NI CIGARETTE. Recherche exhaustive sur les 10 073 GLB du dépôt le
-- 2026-09-03 : ces animations n'existent sur aucun des 208 packs. Le catalogue
-- les accueillera sans changement de structure le jour où un pack en fournit.
-- ══════════════════════════════════════════════════════════════════════════════

local Emotes = {}

--- Catégories, dans l'ordre d'affichage du menu.
--- Une SÉQUENCE et non une table : `pairs` n'a aucun ordre garanti en Lua, et
--- les onglets du menu changeraient de place entre deux ouvertures.
Emotes.CATEGORIES = {
    { id = "assis", label = "Assis", nombre = 20 },
    { id = "appui", label = "Appui", nombre = 19 },
    { id = "debout", label = "Debout", nombre = 3 },
    { id = "telephone", label = "Téléphone", nombre = 10 },
    { id = "signaux", label = "Signaux", nombre = 70 },
    { id = "genou", label = "À genou", nombre = 12 },
    { id = "travail", label = "Travail", nombre = 32 },
}

--- Toutes les animations, indexées par identifiant.
Emotes.ANIMATIONS = {
    anim_ip_customer_idle = { asset = "narvos::ANIM_IP_customer_idle_Anim", categorie = "travail", boucle = true, label = "customer idle" },
    anim_ip_discuss = { asset = "narvos::ANIM_IP_discuss_Anim", categorie = "travail", boucle = false, label = "discuss" },
    anim_ip_discuss_accept = { asset = "narvos::ANIM_IP_discuss_accept_Anim", categorie = "travail", boucle = false, label = "discuss accept" },
    anim_ip_discuss_denied = { asset = "narvos::ANIM_IP_discuss_denied_Anim", categorie = "travail", boucle = false, label = "discuss denied" },
    anim_ip_get_tool_l = { asset = "narvos::ANIM_IP_get_tool_L_Anim", categorie = "travail", boucle = false, label = "get tool L" },
    anim_ip_get_tool_r = { asset = "narvos::ANIM_IP_get_tool_R_Anim", categorie = "travail", boucle = false, label = "get tool R" },
    anim_ip_get_tools = { asset = "narvos::ANIM_IP_get_tools_Anim", categorie = "travail", boucle = false, label = "get tools" },
    anim_ip_hit_loop = { asset = "narvos::ANIM_IP_hit_loop_Anim", categorie = "travail", boucle = true, label = "hit loop" },
    anim_ip_polish_break_01 = { asset = "narvos::ANIM_IP_polish_break_01_Anim", categorie = "travail", boucle = false, label = "polish break 01" },
    anim_ip_polish_break_02 = { asset = "narvos::ANIM_IP_polish_break_02_Anim", categorie = "travail", boucle = false, label = "polish break 02" },
    anim_ip_put_away_tool_l = { asset = "narvos::ANIM_IP_put_away_tool_L_Anim", categorie = "travail", boucle = false, label = "put away tool L" },
    anim_ip_put_away_tool_r = { asset = "narvos::ANIM_IP_put_away_tool_R_Anim", categorie = "travail", boucle = false, label = "put away tool R" },
    anim_ip_put_away_tools = { asset = "narvos::ANIM_IP_put_away_tools_Anim", categorie = "travail", boucle = false, label = "put away tools" },
    anim_ip_sit_hit = { asset = "narvos::ANIM_IP_sit_hit_Anim", categorie = "travail", boucle = false, label = "sit hit" },
    anim_ip_sit_idle_01 = { asset = "narvos::ANIM_IP_sit_idle_01_Anim", categorie = "travail", boucle = false, label = "sit idle 01" },
    anim_ip_sit_inspect = { asset = "narvos::ANIM_IP_sit_inspect_Anim", categorie = "travail", boucle = false, label = "sit inspect" },
    anim_ip_standing_idle_01 = { asset = "narvos::ANIM_IP_standing_idle_01_Anim", categorie = "travail", boucle = false, label = "standing idle 01" },
    anim_ip_standing_inspect = { asset = "narvos::ANIM_IP_standing_inspect_Anim", categorie = "travail", boucle = false, label = "standing inspect" },
    anim_ip_standing_polish_loop = { asset = "narvos::ANIM_IP_standing_polish_loop_Anim", categorie = "travail", boucle = true, label = "standing polish loop" },
    anim_ip_three_hit_loop = { asset = "narvos::ANIM_IP_three_hit_loop_Anim", categorie = "travail", boucle = true, label = "three hit loop" },
    anim_rm_customer_inspect = { asset = "narvos::ANIM_RM_customer_inspect_Anim", categorie = "travail", boucle = false, label = "ANIM RM customer inspect" },
    anim_rm_get_sword = { asset = "narvos::ANIM_RM_get_sword_Anim", categorie = "travail", boucle = false, label = "ANIM RM get sword" },
    anim_rm_sharp = { asset = "narvos::ANIM_RM_sharp_Anim", categorie = "travail", boucle = false, label = "ANIM RM sharp" },
    anim_rm_sharp_end = { asset = "narvos::ANIM_RM_sharp_end_Anim", categorie = "travail", boucle = false, label = "ANIM RM sharp end" },
    anim_rm_sharp_loop = { asset = "narvos::ANIM_RM_sharp_loop_Anim", categorie = "travail", boucle = true, label = "ANIM RM sharp loop" },
    anim_rm_sharp_start = { asset = "narvos::ANIM_RM_sharp_start_Anim", categorie = "travail", boucle = false, label = "ANIM RM sharp start" },
    anim_rm_standing_idle_02 = { asset = "narvos::ANIM_RM_standing_idle_02_Anim", categorie = "travail", boucle = false, label = "ANIM RM standing idle 02" },
    anim_rm_standing_idle_03 = { asset = "narvos::ANIM_RM_standing_idle_03_Anim", categorie = "travail", boucle = false, label = "ANIM RM standing idle 03" },
    anim_rm_standing_polish_end = { asset = "narvos::ANIM_RM_standing_polish_end_Anim", categorie = "travail", boucle = false, label = "ANIM RM standing polish end" },
    anim_rm_standing_polish_start = { asset = "narvos::ANIM_RM_standing_polish_start_Anim", categorie = "travail", boucle = false, label = "ANIM RM standing polish start" },
    anim_rm_standing_put_in_water = { asset = "narvos::ANIM_RM_standing_put_in_water_Anim", categorie = "travail", boucle = false, label = "ANIM RM standing put in water" },
    anim_rm_testing_sword = { asset = "narvos::ANIM_RM_testing_sword_Anim", categorie = "travail", boucle = false, label = "ANIM RM testing sword" },
    as_sit_normal01_action01 = { asset = "narvos::AS_Sit_Normal01_Action01_Anim", categorie = "assis", boucle = false, label = "Sit Normal01 Action01" },
    as_sit_normal01_action02 = { asset = "narvos::AS_Sit_Normal01_Action02_Anim", categorie = "assis", boucle = false, label = "Sit Normal01 Action02" },
    as_sit_normal01_action03 = { asset = "narvos::AS_Sit_Normal01_Action03_Anim", categorie = "assis", boucle = false, label = "Sit Normal01 Action03" },
    as_sit_normal01_action04 = { asset = "narvos::AS_Sit_Normal01_Action04_Anim", categorie = "assis", boucle = false, label = "Sit Normal01 Action04" },
    as_sit_normal01_loop01 = { asset = "narvos::AS_Sit_Normal01_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Normal01 Loop01" },
    as_sit_normal01_loop02 = { asset = "narvos::AS_Sit_Normal01_Loop02_Anim", categorie = "assis", boucle = true, label = "Sit Normal01 Loop02" },
    as_sit_normal03_loop01 = { asset = "narvos::AS_Sit_Normal03_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Normal03 Loop01" },
    as_sit_normal04_loop01 = { asset = "narvos::AS_Sit_Normal04_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Normal04 Loop01" },
    as_sit_normal05_loop01 = { asset = "narvos::AS_Sit_Normal05_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Normal05 Loop01" },
    as_sit_normal06_loop01 = { asset = "narvos::AS_Sit_Normal06_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Normal06 Loop01" },
    as_sit_phone01_action01 = { asset = "narvos::AS_Sit_Phone01_Action01_Anim", categorie = "telephone", boucle = false, label = "Sit Phone01 Action01" },
    as_sit_phone01_action02 = { asset = "narvos::AS_Sit_Phone01_Action02_Anim", categorie = "telephone", boucle = false, label = "Sit Phone01 Action02" },
    as_sit_phone01_loop01 = { asset = "narvos::AS_Sit_Phone01_Loop01_Anim", categorie = "telephone", boucle = true, label = "Sit Phone01 Loop01" },
    as_sit_phone02_action01 = { asset = "narvos::AS_Sit_Phone02_Action01_Anim", categorie = "telephone", boucle = false, label = "Sit Phone02 Action01" },
    as_sit_phone02_action02 = { asset = "narvos::AS_Sit_Phone02_Action02_Anim", categorie = "telephone", boucle = false, label = "Sit Phone02 Action02" },
    as_sit_phone02_loop01 = { asset = "narvos::AS_Sit_Phone02_Loop01_Anim", categorie = "telephone", boucle = true, label = "Sit Phone02 Loop01" },
    as_sit_phone03_loop01 = { asset = "narvos::AS_Sit_Phone03_Loop01_Anim", categorie = "telephone", boucle = true, label = "Sit Phone03 Loop01" },
    as_sit_phone04_loop01 = { asset = "narvos::AS_Sit_Phone04_Loop01_Anim", categorie = "telephone", boucle = true, label = "Sit Phone04 Loop01" },
    as_sit_phone05_loop01 = { asset = "narvos::AS_Sit_Phone05_Loop01_Anim", categorie = "telephone", boucle = true, label = "Sit Phone05 Loop01" },
    as_sit_phone06_loop01 = { asset = "narvos::AS_Sit_Phone06_Loop01_Anim", categorie = "telephone", boucle = true, label = "Sit Phone06 Loop01" },
    as_sit_sleep01_action01 = { asset = "narvos::AS_Sit_Sleep01_Action01_Anim", categorie = "assis", boucle = false, label = "Sit Sleep01 Action01" },
    as_sit_sleep01_action02 = { asset = "narvos::AS_Sit_Sleep01_Action02_Anim", categorie = "assis", boucle = false, label = "Sit Sleep01 Action02" },
    as_sit_sleep01_loop01 = { asset = "narvos::AS_Sit_Sleep01_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Sleep01 Loop01" },
    as_sit_sleep02_action01 = { asset = "narvos::AS_Sit_Sleep02_Action01_Anim", categorie = "assis", boucle = false, label = "Sit Sleep02 Action01" },
    as_sit_sleep02_action02 = { asset = "narvos::AS_Sit_Sleep02_Action02_Anim", categorie = "assis", boucle = false, label = "Sit Sleep02 Action02" },
    as_sit_sleep02_loop01 = { asset = "narvos::AS_Sit_Sleep02_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Sleep02 Loop01" },
    as_sit_sleep03_loop01 = { asset = "narvos::AS_Sit_Sleep03_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Sleep03 Loop01" },
    as_sit_sleep04_loop01 = { asset = "narvos::AS_Sit_Sleep04_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Sleep04 Loop01" },
    as_sit_sleep05_loop01 = { asset = "narvos::AS_Sit_Sleep05_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Sleep05 Loop01" },
    as_sit_sleep06_loop01 = { asset = "narvos::AS_Sit_Sleep06_Loop01_Anim", categorie = "assis", boucle = true, label = "Sit Sleep06 Loop01" },
    as_standlean_normal01_action01 = { asset = "narvos::AS_StandLean_Normal01_Action01_Anim", categorie = "appui", boucle = false, label = "StandLean Normal01 Action01" },
    as_standlean_normal01_action02 = { asset = "narvos::AS_StandLean_Normal01_Action02_Anim", categorie = "appui", boucle = false, label = "StandLean Normal01 Action02" },
    as_standlean_normal01_loop01 = { asset = "narvos::AS_StandLean_Normal01_Loop01_Anim", categorie = "appui", boucle = true, label = "StandLean Normal01 Loop01" },
    as_standlean_normal02_action01 = { asset = "narvos::AS_StandLean_Normal02_Action01_Anim", categorie = "appui", boucle = false, label = "StandLean Normal02 Action01" },
    as_standlean_normal02_action02 = { asset = "narvos::AS_StandLean_Normal02_Action02_Anim", categorie = "appui", boucle = false, label = "StandLean Normal02 Action02" },
    as_standlean_normal02_loop01 = { asset = "narvos::AS_StandLean_Normal02_Loop01_Anim", categorie = "appui", boucle = true, label = "StandLean Normal02 Loop01" },
    as_standlean_normal03_loop01 = { asset = "narvos::AS_StandLean_Normal03_Loop01_Anim", categorie = "appui", boucle = true, label = "StandLean Normal03 Loop01" },
    as_standpole_normal01_action01 = { asset = "narvos::AS_StandPole_Normal01_Action01_Anim", categorie = "appui", boucle = false, label = "StandPole Normal01 Action01" },
    as_standpole_normal01_action02 = { asset = "narvos::AS_StandPole_Normal01_Action02_Anim", categorie = "appui", boucle = false, label = "StandPole Normal01 Action02" },
    as_standpole_normal01_loop01 = { asset = "narvos::AS_StandPole_Normal01_Loop01_Anim", categorie = "appui", boucle = true, label = "StandPole Normal01 Loop01" },
    as_standpole_normal02_action01 = { asset = "narvos::AS_StandPole_Normal02_Action01_Anim", categorie = "appui", boucle = false, label = "StandPole Normal02 Action01" },
    as_standpole_normal02_action02 = { asset = "narvos::AS_StandPole_Normal02_Action02_Anim", categorie = "appui", boucle = false, label = "StandPole Normal02 Action02" },
    as_standpole_normal02_loop01 = { asset = "narvos::AS_StandPole_Normal02_Loop01_Anim", categorie = "appui", boucle = true, label = "StandPole Normal02 Loop01" },
    as_standstrap_normal01_action01 = { asset = "narvos::AS_StandStrap_Normal01_Action01_Anim", categorie = "appui", boucle = false, label = "StandStrap Normal01 Action01" },
    as_standstrap_normal01_action02 = { asset = "narvos::AS_StandStrap_Normal01_Action02_Anim", categorie = "appui", boucle = false, label = "StandStrap Normal01 Action02" },
    as_standstrap_normal01_loop01 = { asset = "narvos::AS_StandStrap_Normal01_Loop01_Anim", categorie = "appui", boucle = true, label = "StandStrap Normal01 Loop01" },
    as_standstrap_normal02_action01 = { asset = "narvos::AS_StandStrap_Normal02_Action01_Anim", categorie = "appui", boucle = false, label = "StandStrap Normal02 Action01" },
    as_standstrap_normal02_action02 = { asset = "narvos::AS_StandStrap_Normal02_Action02_Anim", categorie = "appui", boucle = false, label = "StandStrap Normal02 Action02" },
    as_standstrap_normal02_loop01 = { asset = "narvos::AS_StandStrap_Normal02_Loop01_Anim", categorie = "appui", boucle = true, label = "StandStrap Normal02 Loop01" },
    as_standupright_normal01_loop01 = { asset = "narvos::AS_StandUpright_Normal01_Loop01_Anim", categorie = "debout", boucle = true, label = "StandUpright Normal01 Loop01" },
    as_standupright_normal02_loop01 = { asset = "narvos::AS_StandUpright_Normal02_Loop01_Anim", categorie = "debout", boucle = true, label = "StandUpright Normal02 Loop01" },
    as_standupright_normal03_loop01 = { asset = "narvos::AS_StandUpright_Normal03_Loop01_Anim", categorie = "debout", boucle = true, label = "StandUpright Normal03 Loop01" },
    loot_floorpickup_kneel_harvestitem = { asset = "narvos::Loot_FloorPickUp_Kneel_HarvestItem_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel HarvestItem" },
    loot_floorpickup_kneel_lefthand = { asset = "narvos::Loot_FloorPickUp_Kneel_LeftHand_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel LeftHand" },
    loot_floorpickup_kneel_lefthand_inspect_enter = { asset = "narvos::Loot_FloorPickUp_Kneel_LeftHand_Inspect_Enter_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel LeftHand Inspect Enter" },
    loot_floorpickup_kneel_lefthand_inspect_exit = { asset = "narvos::Loot_FloorPickUp_Kneel_LeftHand_Inspect_Exit_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel LeftHand Inspect Exit" },
    loot_floorpickup_kneel_lefthand_inspect_keep = { asset = "narvos::Loot_FloorPickUp_Kneel_LeftHand_Inspect_Keep_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel LeftHand Inspect Keep" },
    loot_floorpickup_kneel_lefthand_inspect_loop = { asset = "narvos::Loot_FloorPickUp_Kneel_LeftHand_Inspect_Loop_Anim", categorie = "genou", boucle = true, label = "FloorPickUp Kneel LeftHand Inspect Loop" },
    loot_floorpickup_kneel_righthand = { asset = "narvos::Loot_FloorPickUp_Kneel_RightHand_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel RightHand" },
    loot_floorpickup_kneel_righthand_inspect_enter = { asset = "narvos::Loot_FloorPickUp_Kneel_RightHand_Inspect_Enter_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel RightHand Inspect Enter" },
    loot_floorpickup_kneel_righthand_inspect_exit = { asset = "narvos::Loot_FloorPickUp_Kneel_RightHand_Inspect_Exit_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel RightHand Inspect Exit" },
    loot_floorpickup_kneel_righthand_inspect_keep = { asset = "narvos::Loot_FloorPickUp_Kneel_RightHand_Inspect_Keep_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel RightHand Inspect Keep" },
    loot_floorpickup_kneel_righthand_inspect_loop = { asset = "narvos::Loot_FloorPickUp_Kneel_RightHand_Inspect_Loop_Anim", categorie = "genou", boucle = true, label = "FloorPickUp Kneel RightHand Inspect Loop" },
    loot_floorpickup_kneel_smallbox = { asset = "narvos::Loot_FloorPickUp_Kneel_SmallBox_Anim", categorie = "genou", boucle = false, label = "FloorPickUp Kneel SmallBox" },
    pistol_handsignal_ceasefire = { asset = "narvos::Pistol_HandSignal_CeaseFire_Anim", categorie = "signaux", boucle = false, label = "HandSignal CeaseFire" },
    pistol_handsignal_choppa = { asset = "narvos::Pistol_HandSignal_Choppa_Anim", categorie = "signaux", boucle = false, label = "HandSignal Choppa" },
    pistol_handsignal_closein = { asset = "narvos::Pistol_HandSignal_CloseIn_Anim", categorie = "signaux", boucle = false, label = "HandSignal CloseIn" },
    pistol_handsignal_dangerous = { asset = "narvos::Pistol_HandSignal_Dangerous_Anim", categorie = "signaux", boucle = false, label = "HandSignal Dangerous" },
    pistol_handsignal_doubletime = { asset = "narvos::Pistol_HandSignal_DoubleTime_Anim", categorie = "signaux", boucle = false, label = "HandSignal DoubleTime" },
    pistol_handsignal_enemycontact = { asset = "narvos::Pistol_HandSignal_EnemyContact_Anim", categorie = "signaux", boucle = false, label = "HandSignal EnemyContact" },
    pistol_handsignal_file = { asset = "narvos::Pistol_HandSignal_File_Anim", categorie = "signaux", boucle = false, label = "HandSignal File" },
    pistol_handsignal_forward = { asset = "narvos::Pistol_HandSignal_Forward_Anim", categorie = "signaux", boucle = false, label = "HandSignal Forward" },
    pistol_handsignal_freeze = { asset = "narvos::Pistol_HandSignal_Freeze_Anim", categorie = "signaux", boucle = false, label = "HandSignal Freeze" },
    pistol_handsignal_getdown = { asset = "narvos::Pistol_HandSignal_GetDown_Anim", categorie = "signaux", boucle = false, label = "HandSignal GetDown" },
    pistol_handsignal_getup = { asset = "narvos::Pistol_HandSignal_GetUp_Anim", categorie = "signaux", boucle = false, label = "HandSignal GetUp" },
    pistol_handsignal_godown = { asset = "narvos::Pistol_HandSignal_GoDown_Anim", categorie = "signaux", boucle = false, label = "HandSignal GoDown" },
    pistol_handsignal_goup = { asset = "narvos::Pistol_HandSignal_GoUp_Anim", categorie = "signaux", boucle = false, label = "HandSignal GoUp" },
    pistol_handsignal_halt = { asset = "narvos::Pistol_HandSignal_Halt_Anim", categorie = "signaux", boucle = false, label = "HandSignal Halt" },
    pistol_handsignal_headcount = { asset = "narvos::Pistol_HandSignal_HeadCount_Anim", categorie = "signaux", boucle = false, label = "HandSignal HeadCount" },
    pistol_handsignal_heartalking = { asset = "narvos::Pistol_HandSignal_HearTalking_Anim", categorie = "signaux", boucle = false, label = "HandSignal HearTalking" },
    pistol_handsignal_hostage = { asset = "narvos::Pistol_HandSignal_Hostage_Anim", categorie = "signaux", boucle = false, label = "HandSignal Hostage" },
    pistol_handsignal_ied = { asset = "narvos::Pistol_HandSignal_IED_Anim", categorie = "signaux", boucle = false, label = "HandSignal IED" },
    pistol_handsignal_lightson = { asset = "narvos::Pistol_HandSignal_LightsOn_Anim", categorie = "signaux", boucle = false, label = "HandSignal LightsOn" },
    pistol_handsignal_line = { asset = "narvos::Pistol_HandSignal_Line_Anim", categorie = "signaux", boucle = false, label = "HandSignal Line" },
    pistol_handsignal_listen = { asset = "narvos::Pistol_HandSignal_Listen_Anim", categorie = "signaux", boucle = false, label = "HandSignal Listen" },
    pistol_handsignal_me = { asset = "narvos::Pistol_HandSignal_Me_Anim", categorie = "signaux", boucle = false, label = "HandSignal Me" },
    pistol_handsignal_pointleft = { asset = "narvos::Pistol_HandSignal_PointLeft_Anim", categorie = "signaux", boucle = false, label = "HandSignal PointLeft" },
    pistol_handsignal_pointright = { asset = "narvos::Pistol_HandSignal_PointRight_Anim", categorie = "signaux", boucle = false, label = "HandSignal PointRight" },
    pistol_handsignal_pointup = { asset = "narvos::Pistol_HandSignal_PointUp_Anim", categorie = "signaux", boucle = false, label = "HandSignal PointUp" },
    pistol_handsignal_quiet = { asset = "narvos::Pistol_HandSignal_Quiet_Anim", categorie = "signaux", boucle = false, label = "HandSignal Quiet" },
    pistol_handsignal_radio = { asset = "narvos::Pistol_HandSignal_Radio_Anim", categorie = "signaux", boucle = false, label = "HandSignal Radio" },
    pistol_handsignal_rallypoint = { asset = "narvos::Pistol_HandSignal_RallyPoint_Anim", categorie = "signaux", boucle = false, label = "HandSignal RallyPoint" },
    pistol_handsignal_sniperlocation = { asset = "narvos::Pistol_HandSignal_SniperLocation_Anim", categorie = "signaux", boucle = false, label = "HandSignal SniperLocation" },
    pistol_handsignal_spreadout = { asset = "narvos::Pistol_HandSignal_SpreadOut_Anim", categorie = "signaux", boucle = false, label = "HandSignal SpreadOut" },
    pistol_handsignal_stop = { asset = "narvos::Pistol_HandSignal_Stop_Anim", categorie = "signaux", boucle = false, label = "HandSignal Stop" },
    pistol_handsignal_turncorner = { asset = "narvos::Pistol_HandSignal_TurnCorner_Anim", categorie = "signaux", boucle = false, label = "HandSignal TurnCorner" },
    pistol_handsignal_understood = { asset = "narvos::Pistol_HandSignal_Understood_Anim", categorie = "signaux", boucle = false, label = "HandSignal Understood" },
    pistol_handsignal_wedge = { asset = "narvos::Pistol_HandSignal_Wedge_Anim", categorie = "signaux", boucle = false, label = "HandSignal Wedge" },
    pistol_handsignal_you = { asset = "narvos::Pistol_HandSignal_You_Anim", categorie = "signaux", boucle = false, label = "HandSignal You" },
    rifle_handsignal_ceasefire = { asset = "narvos::Rifle_HandSignal_CeaseFire_Anim", categorie = "signaux", boucle = false, label = "HandSignal CeaseFire" },
    rifle_handsignal_choppa = { asset = "narvos::Rifle_HandSignal_Choppa_Anim", categorie = "signaux", boucle = false, label = "HandSignal Choppa" },
    rifle_handsignal_closein = { asset = "narvos::Rifle_HandSignal_CloseIn_Anim", categorie = "signaux", boucle = false, label = "HandSignal CloseIn" },
    rifle_handsignal_dangerous = { asset = "narvos::Rifle_HandSignal_Dangerous_Anim", categorie = "signaux", boucle = false, label = "HandSignal Dangerous" },
    rifle_handsignal_doubletime = { asset = "narvos::Rifle_HandSignal_DoubleTime_Anim", categorie = "signaux", boucle = false, label = "HandSignal DoubleTime" },
    rifle_handsignal_enemycontact = { asset = "narvos::Rifle_HandSignal_EnemyContact_Anim", categorie = "signaux", boucle = false, label = "HandSignal EnemyContact" },
    rifle_handsignal_file = { asset = "narvos::Rifle_HandSignal_File_Anim", categorie = "signaux", boucle = false, label = "HandSignal File" },
    rifle_handsignal_forward = { asset = "narvos::Rifle_HandSignal_Forward_Anim", categorie = "signaux", boucle = false, label = "HandSignal Forward" },
    rifle_handsignal_freeze = { asset = "narvos::Rifle_HandSignal_Freeze_Anim", categorie = "signaux", boucle = false, label = "HandSignal Freeze" },
    rifle_handsignal_getdown = { asset = "narvos::Rifle_HandSignal_GetDown_Anim", categorie = "signaux", boucle = false, label = "HandSignal GetDown" },
    rifle_handsignal_getup = { asset = "narvos::Rifle_HandSignal_GetUp_Anim", categorie = "signaux", boucle = false, label = "HandSignal GetUp" },
    rifle_handsignal_godown = { asset = "narvos::Rifle_HandSignal_GoDown_Anim", categorie = "signaux", boucle = false, label = "HandSignal GoDown" },
    rifle_handsignal_goup = { asset = "narvos::Rifle_HandSignal_GoUp_Anim", categorie = "signaux", boucle = false, label = "HandSignal GoUp" },
    rifle_handsignal_halt = { asset = "narvos::Rifle_HandSignal_Halt_Anim", categorie = "signaux", boucle = false, label = "HandSignal Halt" },
    rifle_handsignal_headcount = { asset = "narvos::Rifle_HandSignal_HeadCount_Anim", categorie = "signaux", boucle = false, label = "HandSignal HeadCount" },
    rifle_handsignal_heartalking = { asset = "narvos::Rifle_HandSignal_HearTalking_Anim", categorie = "signaux", boucle = false, label = "HandSignal HearTalking" },
    rifle_handsignal_hostage = { asset = "narvos::Rifle_HandSignal_Hostage_Anim", categorie = "signaux", boucle = false, label = "HandSignal Hostage" },
    rifle_handsignal_ied = { asset = "narvos::Rifle_HandSignal_IED_Anim", categorie = "signaux", boucle = false, label = "HandSignal IED" },
    rifle_handsignal_lightson = { asset = "narvos::Rifle_HandSignal_LightsOn_Anim", categorie = "signaux", boucle = false, label = "HandSignal LightsOn" },
    rifle_handsignal_line = { asset = "narvos::Rifle_HandSignal_Line_Anim", categorie = "signaux", boucle = false, label = "HandSignal Line" },
    rifle_handsignal_listen = { asset = "narvos::Rifle_HandSignal_Listen_Anim", categorie = "signaux", boucle = false, label = "HandSignal Listen" },
    rifle_handsignal_me = { asset = "narvos::Rifle_HandSignal_Me_Anim", categorie = "signaux", boucle = false, label = "HandSignal Me" },
    rifle_handsignal_pointleft = { asset = "narvos::Rifle_HandSignal_PointLeft_Anim", categorie = "signaux", boucle = false, label = "HandSignal PointLeft" },
    rifle_handsignal_pointright = { asset = "narvos::Rifle_HandSignal_PointRight_Anim", categorie = "signaux", boucle = false, label = "HandSignal PointRight" },
    rifle_handsignal_pointup = { asset = "narvos::Rifle_HandSignal_PointUp_Anim", categorie = "signaux", boucle = false, label = "HandSignal PointUp" },
    rifle_handsignal_quiet = { asset = "narvos::Rifle_HandSignal_Quiet_Anim", categorie = "signaux", boucle = false, label = "HandSignal Quiet" },
    rifle_handsignal_radio = { asset = "narvos::Rifle_HandSignal_Radio_Anim", categorie = "signaux", boucle = false, label = "HandSignal Radio" },
    rifle_handsignal_rallypoint = { asset = "narvos::Rifle_HandSignal_RallyPoint_Anim", categorie = "signaux", boucle = false, label = "HandSignal RallyPoint" },
    rifle_handsignal_sniperlocation = { asset = "narvos::Rifle_HandSignal_SniperLocation_Anim", categorie = "signaux", boucle = false, label = "HandSignal SniperLocation" },
    rifle_handsignal_spreadout = { asset = "narvos::Rifle_HandSignal_SpreadOut_Anim", categorie = "signaux", boucle = false, label = "HandSignal SpreadOut" },
    rifle_handsignal_stop = { asset = "narvos::Rifle_HandSignal_Stop_Anim", categorie = "signaux", boucle = false, label = "HandSignal Stop" },
    rifle_handsignal_turncorner = { asset = "narvos::Rifle_HandSignal_TurnCorner_Anim", categorie = "signaux", boucle = false, label = "HandSignal TurnCorner" },
    rifle_handsignal_understood = { asset = "narvos::Rifle_HandSignal_Understood_Anim", categorie = "signaux", boucle = false, label = "HandSignal Understood" },
    rifle_handsignal_wedge = { asset = "narvos::Rifle_HandSignal_Wedge_Anim", categorie = "signaux", boucle = false, label = "HandSignal Wedge" },
    rifle_handsignal_you = { asset = "narvos::Rifle_HandSignal_You_Anim", categorie = "signaux", boucle = false, label = "HandSignal You" },
}

--- Animations d'une catégorie, ordre stable.
---@param categorie string
---@return table[]
function Emotes.ParCategorie(categorie)
    local ids = {}
    for id, a in pairs(Emotes.ANIMATIONS) do
        if (a.categorie == categorie) then ids[#ids + 1] = id end
    end
    table.sort(ids)

    local sortie = {}
    for i = 1, #ids do
        local a = Emotes.ANIMATIONS[ids[i]]
        sortie[i] = { id = ids[i], asset = a.asset, label = a.label, boucle = a.boucle }
    end
    return sortie
end

--- Une animation par son identifiant, ou nil.
--- Rend nil plutôt qu'un défaut : l'appelant décide, et une emote inconnue
--- venant du client ne doit surtout pas en jouer une autre.
---@param id string
---@return table|nil
function Emotes.Trouver(id)
    if (type(id) ~= "string") then return nil end
    return Emotes.ANIMATIONS[id]
end

--- Tout ce qu'il faut au menu, en une table.
---@return table
function Emotes.Options()
    local sortie = {}
    for i, c in ipairs(Emotes.CATEGORIES) do
        sortie[i] = {
            id = c.id, label = c.label, nombre = c.nombre,
            animations = Emotes.ParCategorie(c.id),
        }
    end
    return sortie
end

return Emotes
