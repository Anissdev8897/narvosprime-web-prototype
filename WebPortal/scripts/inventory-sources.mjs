// ══════════════════════════════════════════════════════════════════════════════
// inventory-sources.mjs — Tableau des candidats au découpage (BRIEF §4.1).
//
// MESURE, ne découpe rien : pour chaque GLB candidat, donne le nombre d'os,
// la racine du squelette, la présence d'un skin, les sommets et les matériaux.
// Une source sans squelette, ou dont le poids ne peut pas atteindre 50 % sur
// le mannequin de référence, est écartée AVANT d'engager une découpe.
//
// Écrit `.hermes/INVENTAIRE_SOURCES.md`. Rejouable : relancer après l'ajout
// d'un pack met le tableau à jour.
//
// Usage : node scripts/inventory-sources.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import draco3d from "draco3dgltf";
import { existsSync, writeFileSync } from "node:fs";

// Décodeurs : les GLB déjà passés par les pipelines de compression (pnj_monstre
// = draco + KTX2, _parts = meshopt) sont illisibles sans eux.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });
const R = "public/models/personnages";
const R2 = "public/models/assets_character";

/**
 * Candidats repérés par listing des dossiers (04/08/2026). Les 8 sources déjà
 * découpées (extract-body-parts.mjs → SOURCES) ne sont pas répétées ici.
 * kind: "body" = corps à découper · "part" = vêtement déjà séparé par l'auteur.
 */
const CANDIDATS = [
  // ── La cible désignée par l'utilisateur : corps MakeHuman/MPFB2 ───────────
  { id: "mpfb", kind: "body", file: `${R}/base/SK_BaseBody_Mixamo.glb`, note: "Rig Mixamo 52 os — 0 % de noms communs avec le mannequin Biker. Voie : base séparée (--base=mpfb), pas greffe sur Biker." },

  // ── Mannequins UE du template ThirdPerson ─────────────────────────────────
  { id: "manny", kind: "body", file: `${R}/ThirdPerson/Characters/Mannequins/Meshes/SKM_Manny_Simple.glb` },
  { id: "quinn", kind: "body", file: `${R}/ThirdPerson/Characters/Mannequins/Meshes/SKM_Quinn_Simple.glb` },

  // ── Personnage Valkiria ───────────────────────────────────────────────────
  { id: "valkiria", kind: "body", file: `${R}/Valkiria/Mesh/SK_Valkiria.glb` },

  // ── Pack non_unreal : corps + vêtements DÉJÀ séparés par l'auteur ─────────
  { id: "nuc_character", kind: "body", file: `${R}/non_unreal_character/fbx_all_assets/FBX/SKM_Character.glb` },
  { id: "nuc_jeans", kind: "part", file: `${R}/non_unreal_character/fbx_all_assets/FBX/SKM_Jeans.glb` },
  { id: "nuc_shirt", kind: "part", file: `${R}/non_unreal_character/fbx_all_assets/FBX/SKM_Shirt_RolledUp.glb` },
  { id: "nuc_bulletproof", kind: "part", file: `${R}/non_unreal_character/fbx_all_assets/FBX/SKM_Bulletproof.glb` },
  { id: "nuc_holster", kind: "part", file: `${R}/non_unreal_character/fbx_all_assets/FBX/SKM_Holster_Hard.glb` },

  // ══ LOT B (04/08/2026) — scan des 208 packs de CATALOG.md ═══════════════════
  // Seuls les packs à personnages skinnés sont listés (armes, maps, vfx, audio,
  // nature, bâtiments, véhicules… exclus par construction). Doublons exclus :
  // _ktx2_backup, variants UE4 quand l'UE5 existe, anims Demo/ThirdPerson*.

  // ── ZombieSoldierPack : 7 personnages, pièces DÉJÀ séparées par l'auteur ───
  // (Body + Head + Hat + Jacket + Pants + Shoes + accessoires). Les 7 corps
  // UE5 sont inventoriés ; les pièces d'un seul représentant (ZombieSoldier4)
  // mesurent le rig des vêtements — même famille de pack.
  { id: "z_s1_body",   kind: "body", file: `${R}/ZombieSoldierPack/Characters/SovietZombie1/Mesh/UE5/Parts/SM_ZombieSoldier1_Body_UE5.glb` },
  { id: "z_s2_body",   kind: "body", file: `${R}/ZombieSoldierPack/Characters/SovietZombie2/Base_mesh/UE5/Parts/SM_ZombieSoldier2_Body_UE5.glb` },
  { id: "z_sailer_body", kind: "body", file: `${R}/ZombieSoldierPack/Characters/SovietZombieSailer1/Mesh/UE5/Parts/SM_ZombieSailer1_Jacket_UE5.glb`, note: "Sailer1 n'a PAS de mesh Body — la veste fait office de corps." },
  { id: "z_tank_body", kind: "body", file: `${R}/ZombieSoldierPack/Characters/SovietZombieTankman1/Mesh/UE5/Parts/SM_ZombieSoldierTankman_Body_UE5.glb` },
  { id: "z_zs4_body",  kind: "body", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Body_UE5.glb` },
  { id: "z_officer_body", kind: "body", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldierOfficer/BaseMesh/UE5/Parts/SM_ZombieSoldierOfficer_Body_UE5.glb` },
  { id: "z_winter_body", kind: "body", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldierWinter/Mesh/UE5/Parts/SM_ZombieSoldierWinter_Body_UE5.glb` },
  { id: "z_zs4_head",  kind: "part", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Head_UE5.glb` },
  { id: "z_zs4_hat",   kind: "part", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Hat_UE5.glb` },
  { id: "z_zs4_jacket", kind: "part", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Jacket_UE5.glb` },
  { id: "z_zs4_pants", kind: "part", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Pants_UE5.glb` },
  { id: "z_zs4_shoes", kind: "part", file: `${R}/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Shoes_UE5.glb` },

  // ── SciFi_Trooper_Set : set modulaire H/F (le plus riche du dépôt) ─────────
  { id: "tr_m_body",   kind: "body", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_standalone_multi_mats_with_head.glb` },
  { id: "tr_f_body",   kind: "body", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_standalone_armor_multi_mats_with_head.glb` },
  { id: "tr_pf_body",  kind: "body", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_standalone_armor_multi_mats_with_head.glb` },
  { id: "tr_m_form",   kind: "body", file: `${R2}/SciFi_Trooper_Set/Meshes/BodyForms/Male/SK_Male_Form_Standalone.glb` },
  { id: "tr_f_form",   kind: "body", file: `${R2}/SciFi_Trooper_Set/Meshes/BodyForms/Tall_Female/SK_Female_Form_Standalone.glb` },
  { id: "tr_pf_form",  kind: "body", file: `${R2}/SciFi_Trooper_Set/Meshes/BodyForms/Petite_Female/SK_Petite_Female_Form_Standalone.glb` },
  { id: "tr_m_head_a", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Head_A.glb` },
  { id: "tr_m_head_b", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Head_B.glb` },
  { id: "tr_m_chest",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Chest.glb` },
  { id: "tr_m_upper",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Upper_with_Hands.glb` },
  { id: "tr_m_arms",   kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Arms_with_Hands.glb` },
  { id: "tr_m_hands",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Hands.glb` },
  { id: "tr_m_legs",   kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Legs.glb` },
  { id: "tr_m_lower",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Lower_with_Feet.glb` },
  { id: "tr_m_shoes",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Shoes.glb` },
  { id: "tr_m_shoulders", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Shoulders_A.glb` },
  { id: "tr_m_helmet_a", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Helmet_A.glb` },
  { id: "tr_m_hair",   kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Hair_70s.glb` },
  { id: "tr_m_beard",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Beard_Thin.glb` },
  { id: "tr_f_head_a", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Head_A.glb` },
  { id: "tr_f_upper",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Upper_with_Hands.glb` },
  { id: "tr_f_lower",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Lower_with_Feet.glb` },
  { id: "tr_f_hair",   kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Hair_Short.glb` },
  { id: "tr_f_helmet_a", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Helmet_A.glb` },
  { id: "tr_pf_head_a", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Head_A.glb` },
  { id: "tr_pf_upper", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Upper_with_Hands.glb` },
  { id: "tr_pf_lower", kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Lower_with_Feet.glb` },
  { id: "tr_pf_hair",  kind: "part", file: `${R2}/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Hair_Buns.glb` },

  // ── GameAnimationSample : TwinBlast, mannequins UE4/UEFN, MetaHumans ───────
  { id: "gas_echo_hair", kind: "part", file: `${R}/GameAnimationSample/Characters/Echo/Meshes/SKM_Echo_Hair.glb` },
  { id: "gas_twinblast", kind: "body", file: `${R}/GameAnimationSample/Characters/Paragon/Heroes/TwinBlast/Meshes/SKM_TwinBlast_ActionHero.glb` },
  { id: "gas_ue4_mannequin", kind: "body", file: `${R}/GameAnimationSample/Characters/UE4_Mannequin/Meshes/SKM_UE4_Mannequin.glb` },
  { id: "gas_uefn_mannequin", kind: "body", file: `${R}/GameAnimationSample/Characters/UEFN_Mannequin/Meshes/SKM_UEFN_Mannequin.glb` },
  { id: "gas_mh_f_body", kind: "body", file: `${R}/GameAnimationSample/MetaHumans/Common/Common/f_med_nrw_body_preview.glb` },
  { id: "gas_mh_kellan_body", kind: "body", file: `${R}/GameAnimationSample/MetaHumans/Kellan/Male/Medium/NormalWeight/Body/m_med_nrw_body.glb` },
  { id: "gas_mh_f_mocap", kind: "body", file: `${R}/GameAnimationSample/MetaHumans/Common/Common/Mocap/f_med_ovw_body_mocap.glb` },
  { id: "gas_mh_m_mocap", kind: "body", file: `${R}/GameAnimationSample/MetaHumans/Common/Common/Mocap/m_med_nrw_body_mocap.glb` },
  { id: "gas_mh_kellan_face", kind: "part", file: `${R}/GameAnimationSample/MetaHumans/Kellan/Face/Kellan_FaceMesh.glb` },
  { id: "gas_mh_hoodie", kind: "part", file: `${R}/GameAnimationSample/MetaHumans/Common/Male/Medium/NormalWeight/Tops/Hoodie/Meshes/m_med_nrw_top_hoodie_nrm_High.glb` },
  { id: "gas_mh_cargopants", kind: "part", file: `${R}/GameAnimationSample/MetaHumans/Common/Male/Medium/NormalWeight/Bottoms/Cargopants/m_med_nrw_btm_cargopants_High.glb` },
  { id: "gas_mh_runningshoes", kind: "part", file: `${R}/GameAnimationSample/MetaHumans/Common/Male/Medium/NormalWeight/Shoes/RunningShoes/m_med_nrw_shs_runningshoes_High.glb` },

  // ── CyberpunkSamurai : pièces DÉJÀ séparées par l'auteur ───────────────────
  { id: "cs_head",   kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Head.glb` },
  { id: "cs_torso",  kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Torso.glb` },
  { id: "cs_leg",    kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Leg.glb` },
  { id: "cs_arm",    kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Arm.glb` },
  { id: "cs_hand",   kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Hand.glb` },
  { id: "cs_jacket", kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Jacket.glb` },
  { id: "cs_bag",    kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Bag.glb` },
  { id: "cs_helmet", kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Helmet.glb` },
  { id: "cs_hair",   kind: "part", file: `${R}/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Hair.glb` },

  // ── rampange : 3 skins du même personnage Paragon ──────────────────────────
  { id: "rampage",          kind: "body", file: `${R2}/rampange/Rampage.glb` },
  { id: "rampage_redneck",  kind: "body", file: `${R2}/rampange/Rampage_Redneck.glb` },
  { id: "rampage_elemental", kind: "body", file: `${R2}/rampange/Rampage_Elemental.glb` },

  // ── pnj/ : 17 bipèdes Meshy + RobotGirl + Tex + 3 PNJ « idle » ────────────
  { id: "pnj_soldat_vert", kind: "body", file: "public/models/pnj/soldat_vert/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_grunt", kind: "body", file: "public/models/pnj/Grunt/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_soldat_mercenaire", kind: "body", file: "public/models/pnj/soldat_mercenaire/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_soldat_humain", kind: "body", file: "public/models/pnj/soldat_humain/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_kgnitig", kind: "body", file: "public/models/pnj/kgnitig/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_gronomi_ardent", kind: "body", file: "public/models/pnj/gronomi_ardent/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_grongnoni_majeur", kind: "body", file: "public/models/pnj/grongnoni_majeur/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_gronomi_mineur", kind: "body", file: "public/models/pnj/gronomi_mineur/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_mercenaire_alien", kind: "body", file: "public/models/pnj/mercenaire_alien/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_mercenaire_humain_tank", kind: "body", file: "public/models/pnj/mercenaire_humain_tank/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_gronomi_infaterie", kind: "body", file: "public/models/pnj/gronomi_infaterie/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_profhete", kind: "body", file: "public/models/pnj/profhete/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_gran_cheff", kind: "body", file: "public/models/pnj/gran_cheff/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_soldat_femme", kind: "body", file: "public/models/pnj/soldat_femme/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_general", kind: "body", file: "public/models/pnj/general/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_sou_major", kind: "body", file: "public/models/pnj/sou_major/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_general_mission", kind: "body", file: "public/models/pnj/general_mission/Meshy_AI_biped_Character_output.glb" },
  { id: "pnj_robotgirl", kind: "body", file: "public/models/pnj/RobotGirl/RobotGirl.glb" },
  { id: "pnj_tex", kind: "body", file: "public/models/pnj/Tex/HumanMageRAW/SKM_HumanMage.glb" },
  { id: "pnj_mercenaire_tank", kind: "body", file: "public/models/pnj/mercenaire_tank/mercenaire_tank_idle.glb" },
  { id: "pnj_venom_stalker", kind: "body", file: "public/models/pnj/venom_stalker/venom_stalker_idle.glb" },
  { id: "pnj_profhete_alien", kind: "body", file: "public/models/pnj/profhete_alien/profhete_alien_idle.glb" },

  // ── pnj_monstre/ : bipèdes seulement (quadrupèdes exclus par construction) ─
  { id: "mon_zombi", kind: "body", file: "public/models/pnj_monstre/zombi/zombie.glb" },
  { id: "mon_bandit", kind: "body", file: "public/models/pnj_monstre/bandit/bandit.glb" },
  { id: "mon_blackorn", kind: "body", file: "public/models/pnj_monstre/blackorn/blackorn.glb" },
  { id: "mon_boss_mob", kind: "body", file: "public/models/pnj_monstre/boss_mob/boss_mob.glb" },
  { id: "mon_mob_boss", kind: "body", file: "public/models/pnj_monstre/mob_boss/mob_boss.glb" },
  { id: "mon_golem_glace", kind: "body", file: "public/models/pnj_monstre/golem_glace/golem_glace.glb" },
  { id: "mon_canopy_f", kind: "body", file: "public/models/pnj_monstre/canopy_prophet_female/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_canopy_m", kind: "body", file: "public/models/pnj_monstre/canopy_prophet_male/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_mycelium_m", kind: "body", file: "public/models/pnj_monstre/mycelium_host_male/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_mycelium_f", kind: "body", file: "public/models/pnj_monstre/mycelium_host_female/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_parasite_m", kind: "body", file: "public/models/pnj_monstre/parasite_sower_male/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_parasite_f", kind: "body", file: "public/models/pnj_monstre/parasite_sower_female/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_pressure_m", kind: "body", file: "public/models/pnj_monstre/pressure_manipulator_male/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_pressure_f", kind: "body", file: "public/models/pnj_monstre/pressure_manipulator_female/Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb" },
  { id: "mon_gatonomi", kind: "body", file: "public/models/pnj_monstre/gatonomi/Monster03_AllAnim.glb" },
];

// Os du mannequin Biker (référence canonique) — pour la couverture de noms.
const BIKER = `${R}/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_UE5_meta_body.glb`;

function stats(file) {
  const doc = io.readSync ? null : null; // NodeIO est async — voir boucle
  return null;
}

const bikerDoc = await io.read(BIKER);
const bikerBones = new Set(bikerDoc.getRoot().listSkins()[0]?.listJoints().map((j) => j.getName()) ?? []);

const lignes = [];
for (const c of CANDIDATS) {
  if (!existsSync(c.file)) { lignes.push({ ...c, etat: "❌ ABSENT" }); continue; }
  try {
    const doc = await io.read(c.file);
    const root = doc.getRoot();
    const skin = root.listSkins()[0];
    const joints = skin ? skin.listJoints().map((j) => j.getName()) : [];
    let sommets = 0;
    const mats = new Set();
    for (const m of root.listMeshes())
      for (const p of m.listPrimitives()) {
        sommets += p.getAttribute("POSITION")?.getCount() ?? 0;
        if (p.getMaterial()) mats.add(p.getMaterial().getName());
      }
    const communs = joints.filter((n) => bikerBones.has(n)).length;
    const couvertureNoms = joints.length ? Math.round((100 * communs) / joints.length) : 0;
    lignes.push({
      ...c,
      os: joints.length,
      racine: joints[0] ?? "—",
      skin: !!skin,
      sommets,
      materiaux: [...mats].slice(0, 5),
      couvertureNoms,
      etat: !skin ? "❌ SANS SKIN"
        : c.id === "mpfb" ? "🟡 BASE SÉPARÉE (rig Mixamo)"
        : couvertureNoms >= 50 ? "✅ CANDIDAT" : "🟠 COUVERTURE FAIBLE",
    });
  } catch (e) {
    lignes.push({ ...c, etat: `❌ ERREUR — ${String(e.message).slice(0, 60)}` });
  }
}

const md = [
  "# INVENTAIRE DES SOURCES — candidats au découpage",
  "",
  `Généré par \`scripts/inventory-sources.mjs\` le ${new Date().toISOString().slice(0, 10)}.`,
  "Référence de couverture : mannequin Biker (161 os). La couverture PAR NOMS est",
  "indicative — le critère décisif est le POIDS (audit-part-compat.mjs), mais une",
  "couverture de noms < 50 % annonce presque toujours un refus.",
  "",
  "| id | kind | os | racine | skin | sommets | noms Biker | verdict |",
  "|---|---|---|---|---|---|---|---|",
  ...lignes.map((l) =>
    l.os === undefined
      ? `| ${l.id} | ${l.kind} | — | — | — | — | — | ${l.etat} |`
      : `| ${l.id} | ${l.kind} | ${l.os} | \`${l.racine}\` | ${l.skin ? "oui" : "NON"} | ${l.sommets} | ${l.couvertureNoms} % | ${l.etat} |`),
  "",
  "## Notes",
  "",
  ...lignes.filter((l) => l.note).map((l) => `- **${l.id}** — ${l.note}`),
  `- **nuc_\\*** — vêtements séparés par l'auteur (kind=part) : si leur rig est celui de`,
  `  SKM_Character, ce sont des pièces directes, sans découpe. Leurs matériaux :`,
  ...lignes.filter((l) => l.materiaux?.length).map((l) => `  - ${l.id} : ${l.materiaux.join(", ")}`),
  "",
  "## Sources déjà traitées (extract-body-parts.mjs → SOURCES)",
  "",
  "wraith · murdock · boris · steel · echo · samurai · biker_m · biker_f · mpfb ·",
  "manny · quinn · valkiria · nuc_jeans · nuc_shirt · nuc_bulletproof · nuc_holster",
  "— 79 pièces cataloguées dans `src/data/parts-manifest.json`.",
  "",
  "## Admises par construction (pas besoin de mesure)",
  "",
  "Les vêtements et bodyparts de `BikerBundle/CharacterParts_Biker/` (vestes,",
  "jeans, chemises, bottes, gants, têtes 01/02, barbes, cheveux, bandanas, H+F)",
  "sont skinnés sur le mannequin UE5_meta — le squelette de RÉFÉRENCE lui-même.",
  "Couverture 100 % par construction : ils entrent en lot sans passer ici.",
  "",
].join("\n");

writeFileSync(".hermes/INVENTAIRE_SOURCES.md", md, "utf-8");
console.log(md);
