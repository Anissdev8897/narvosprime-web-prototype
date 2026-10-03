// ══════════════════════════════════════════════════════════════════════════════
// extract-body-parts.mjs — Découpe les personnages en pièces échangeables.
//
// Usage :
//   node scripts/extract-body-parts.mjs            # dry-run : analyse, n'écrit rien
//   node scripts/extract-body-parts.mjs --write    # produit les GLB + le manifest
//
// Sortie : public/models/personnages/_parts/<perso>/<region>.glb
//          src/data/parts-manifest.json
//
// ── DEUX CHEMINS (cf. scripts/lib/body-regions.mjs) ──────────────────────────
//
// A. MODÈLE DÉJÀ SEGMENTÉ (Murdock, Boris, Steel, Wraith)
//    Les primitives portent des matériaux nommés (`M_Murdock_Head`). On garde
//    les primitives de la région voulue et on supprime les autres. La découpe
//    est celle de l'auteur : aucune couture, aucune approximation.
//
// B. MODÈLE MONOLITHIQUE (Echo : un seul `WorldGridMaterial`)
//    On classe chaque SOMMET par son os dominant — celui dont le poids de
//    skinning est le plus fort — puis chaque TRIANGLE par les régions de ses
//    trois sommets.
//
//    On produit un INDEX différent par région. Les triangles à cheval sur deux
//    régions sont écrits dans les DEUX index — la couture est ainsi recouverte
//    des deux côtés, au lieu de laisser un trou.
//
// ── PUIS COMPACTION (les deux chemins) ───────────────────────────────────────
//
// Réécrire l'index ne suffit pas : la pièce garderait les sommets du corps
// ENTIER. Mesuré, ça donnait 1,9 Go pour 39 pièces — un torse d'Echo à 429 Mo,
// dont 421 Mo de morph targets (181 cibles × 101 565 sommets, dont 17 % servent).
// `compactPrimitive` ne conserve que les sommets référencés, et applique la MÊME
// permutation aux attributs et à chaque cible morph. Voir
// `scripts/lib/compact-vertices.mjs`.
//
// ⚠ Le squelette COMPLET est conservé dans chaque pièce. C'est ce qui permet à
// `rebindSkinnedMesh` de la relier au corps d'accueil, et au retarget
// d'animation existant de fonctionner sans modification.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMeshQuantization } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { regionFromMaterial, regionFromBone, isPreSegmented, FALLBACK_REGION } from "./lib/body-regions.mjs";
import { compactionPlan, gatherElements, remapIndices } from "./lib/compact-vertices.mjs";
import { isNullDelta, combineAliveMasks, filterByMask } from "./lib/morph-prune.mjs";
import { quantizeNormalized } from "./lib/quantize-morph.mjs";

const WRITE = process.argv.includes("--write");
const OUT_DIR = "public/models/personnages/_parts";
const MANIFEST = "src/data/parts-manifest.json";
const R = "public/models";

/**
 * `--only=id1,id2` — ne re-découper QUE ces sources.
 *
 * Re-cibler une seule source (ex. `mpfb` après un changement de rig) ne doit
 * pas coûter le recalcul des 100+ autres packs. Le manifest existant est
 * FUSIONNÉ plutôt que réécrit : sans ça, un passage filtré effacerait du
 * catalogue toutes les sources non traitées, et le créateur se viderait.
 */
const ONLY = (() => {
  const a = process.argv.find((x) => x.startsWith("--only="));
  return a ? new Set(a.slice(7).split(",").map((s) => s.trim()).filter(Boolean)) : null;
})();

/**
 * Personnages à découper — les héros jouables.
 *
 * Liste volontairement COURTE : `public/models/` fait 244 Go pour 31 000
 * fichiers, on ne passe pas tout dans un découpeur. Ajouter un personnage =
 * ajouter une ligne ici.
 */
const SOURCES = [
  { id: "wraith",   label: "Wraith",            file: `${R}/assets_character/wraith/Wraith.glb` },
  { id: "murdock",  label: "Murdock",           file: `${R}/assets_character/murdock/Murdock.glb` },
  { id: "boris",    label: "Boris",             file: `${R}/personnages/boris/Boris.glb` },
  { id: "steel",    label: "Steel",             file: `${R}/personnages/ParagonSteel/Characters/Heroes/Steel/Meshes/Steel.glb` },
  { id: "echo",     label: "Echo",              file: `${R}/personnages/GameAnimationSample/Characters/Echo/Meshes/SKM_Echo.glb` },
  { id: "samurai",  label: "Samouraï cyber",    file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_WithoutHelmet.glb` },

  // ── CORPS DE BASE — la découpe de RÉFÉRENCE (03/08/2026) ───────────────────
  //
  // Les six sources ci-dessus sont des héros : leurs pièces portent des os
  // d'accessoires (`backpack`, `hip_pack_a`, `back_jet_flap_l`) absents du
  // mannequin nu, ce qui fait chuter la couverture de poids sous 50 % et les
  // fait refuser — mesuré en jeu, c'est le bon comportement.
  //
  // Ces deux-ci SONT le mannequin. Leurs découpes sont donc greffables par
  // construction : même squelette, mêmes os, aucun accessoire. C'est ce qui
  // remplira les carrousels d'anatomie (buste, bras, mains, jambes, pieds)
  // pour les DEUX genres — le catalogue féminin n'avait jusqu'ici que `f_body`
  // et `f_hair`.
  { id: "biker_m",  label: "Mannequin Biker (H)", file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_UE5_meta_body.glb` },
  { id: "biker_f",  label: "Mannequin Biker (F)", file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/Bodyparts/SK_fe_UE5_meta_body_muscular_IK.glb` },

  // ── LOT PILOTE (04/08/2026), RE-CIBLÉ LE 10/08/2026 ───────────────────────
  //
  // mpfb : corps MakeHuman. Découpé désormais depuis `_body/base_skinned.glb`,
  // produit par `mpfb-rig-from-source.mjs` avec le rig **game_engine** (53 os,
  // noms Unreal) et les poids d'auteur de MPFB.
  //
  // ⚠ CE COMMENTAIRE DISAIT L'INVERSE, ET C'ÉTAIT VRAI DE L'ANCIENNE SOURCE :
  // `base/SK_BaseBody_Mixamo.glb` portait un rig Mixamo à 0 % de noms communs
  // avec le mannequin Biker, d'où des pièces cantonnées à leur propre base et
  // l'affichage « INCOMPATIBLE » dans le créateur. Mesuré le 10/08 par
  // `scripts/audit-anim-bones.mjs` : nos 668 GLB d'animation pilotent 186 os
  // aux noms UNREAL, et le rig Mixamo n'en partage AUCUN. La nouvelle source
  // partage donc sa convention avec Biker, manny et quinn — et avec les clips.
  //
  // `forceBone` : ses deux matériaux (skin = corps entier, Eyes = yeux)
  // classeraient le corps COMPLET en « torso » et les yeux en « head » — la
  // vraie découpe anatomique vient des os.
  { id: "mpfb",     label: "Corps MPFB2 (UE)", file: `${R}/personnages/_body/base_skinned.glb`, forceBone: true },
  // manny / quinn : mannequins UE du template ThirdPerson, 89 os, racine `root`,
  // 100 % de noms communs avec le Biker (inventaire du 04/08).
  { id: "manny",    label: "Manny (UE)",           file: `${R}/personnages/ThirdPerson/Characters/Mannequins/Meshes/SKM_Manny_Simple.glb` },
  { id: "quinn",    label: "Quinn (UE)",           file: `${R}/personnages/ThirdPerson/Characters/Mannequins/Meshes/SKM_Quinn_Simple.glb` },

  // ── LOT A (04/08/2026) ─────────────────────────────────────────────────────
  // valkiria : 81 os, 85 % de noms Biker (inventaire). Son unique matériau
  // `M_Valkiria_T1` ne matche aucune règle → découpe par os, pas de forceBone.
  { id: "valkiria", label: "Valkiria",             file: `${R}/personnages/Valkiria/Mesh/SK_Valkiria.glb` },
  // nuc_* : vêtements DÉJÀ séparés par l'auteur (4 à 19 os, 100 % de noms
  // Biker). Pas de découpe : `asIs` copie le GLB dans _parts et le catalogue
  // dans la région déclarée. Le corps (275 os, 38 %) reste écarté.
  { id: "nuc_jeans",       label: "Jean tactique",      file: `${R}/personnages/non_unreal_character/fbx_all_assets/FBX/SKM_Jeans.glb`,          asIs: "legs" },
  { id: "nuc_shirt",       label: "Chemise retroussée", file: `${R}/personnages/non_unreal_character/fbx_all_assets/FBX/SKM_Shirt_RolledUp.glb`, asIs: "torso" },
  { id: "nuc_bulletproof", label: "Gilet pare-balles",  file: `${R}/personnages/non_unreal_character/fbx_all_assets/FBX/SKM_Bulletproof.glb`,    asIs: "torso" },
  { id: "nuc_holster",     label: "Holster rigide",     file: `${R}/personnages/non_unreal_character/fbx_all_assets/FBX/SKM_Holster_Hard.glb`,   asIs: "accessory" },

  // ── LOT B1 (04/08/2026) — ZombieSoldier4, 161 os, 100 % de noms Biker ──────
  // Inventaire : le pack est DÉJÀ segmenté par l'auteur (Body, Head, Hat,
  // Jacket, Pants, Shoes). Le corps (matériau unique) se découpe par os ; les
  // cinq autres sont des pièces d'auteur copiées telles quelles (`asIs`).
  // Les 6 autres corps du pack sont le MÊME mesh (16 102 sommets, seule la
  // texture change) — un seul corps découpé, doublons documentés au rapport.
  // `forceBone` sur le corps : son matériau `Mat_ZombieSoldier4_Body` matche la
  // règle « Body → torso » et classerait le corps ENTIER en torse (mesuré en
  // dry-run : torso « auteur dense » + aucune tête). La découpe anatomique
  // vient des os, comme pour mpfb.
  { id: "zs4_body",   label: "Zombie soldat 4 (corps)", file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Body_UE5.glb`, forceBone: true },
  { id: "zs4_head",   label: "Zombie soldat 4 (tête)",  file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Head_UE5.glb`,  asIs: "head" },
  { id: "zs4_hat",    label: "Casque zombie 4",         file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Hat_UE5.glb`,   asIs: "accessory" },
  { id: "zs4_jacket", label: "Veste zombie 4",          file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Jacket_UE5.glb`, asIs: "torso" },
  { id: "zs4_pants",  label: "Pantalon zombie 4",       file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Pants_UE5.glb`,  asIs: "legs" },
  { id: "zs4_shoes",  label: "Bottes zombie 4",         file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldier4/Mesh/UE5/Parts/SM_ZombieSoldier4_Shoes_UE5.glb`,  asIs: "feet" },

  // ── LOTS B2-B3 (05/08/2026) — les 6 autres zombies, 100 % de noms Biker ────
  // Têtes + chapeaux des 6 variantes, tenues complètes de l'Officier et de
  // l'Hivernal (styles distincts). NON retenus, réactivables en une ligne :
  // les 6 corps (même mesh 16 102 sommets que zs4, seule la texture change),
  // les tenues s1/s2/marin/tankiste (doublons de style militaire), et les
  // accessoires (holsters, ceintures, carnets, pelles, sacs, œil du marin).
  { id: "zs1_head",   label: "Zombie soviétique 1 (tête)",  file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombie1/Mesh/UE5/Parts/SM_ZombieSoldier1_Head_UE5.glb`, asIs: "head" },
  { id: "zs1_hat",    label: "Chapeau zombie soviétique 1", file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombie1/Mesh/UE5/Parts/SM_ZombieSoldier1_Hat_UE5.glb`,  asIs: "accessory" },
  { id: "zs2_head",   label: "Zombie soviétique 2 (tête)",  file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombie2/Base_mesh/UE5/Parts/SM_ZombieSoldier2_Head_UE5.glb`, asIs: "head" },
  { id: "zs2_hat",    label: "Chapeau zombie soviétique 2", file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombie2/Base_mesh/UE5/Parts/SM_ZombieSoldier2_Hat_UE5.glb`,  asIs: "accessory" },
  { id: "zsail_head", label: "Zombie marin (tête)",         file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombieSailer1/Mesh/UE5/Parts/SM_ZombieSailer1_Head_UE5.glb`, asIs: "head" },
  { id: "zsail_hat",  label: "Chapeau zombie marin",        file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombieSailer1/Mesh/UE5/Parts/SM_ZombieSailer1_Hat_UE5.glb`,  asIs: "accessory" },
  { id: "ztank_head", label: "Zombie tankiste (tête)",      file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombieTankman1/Mesh/UE5/Parts/SM_ZombieSoldierTankman_Head_UE5.glb`, asIs: "head" },
  { id: "ztank_hat",  label: "Casque zombie tankiste",      file: `${R}/personnages/ZombieSoldierPack/Characters/SovietZombieTankman1/Mesh/UE5/Parts/SM_ZombieSoldierTankman_Hat_UE5.glb`,  asIs: "accessory" },
  { id: "zoff_head",  label: "Zombie officier (tête)",      file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierOfficer/BaseMesh/UE5/Parts/SM_ZombieSoldierOfficer_UE5_Head.glb`,   asIs: "head" },
  { id: "zoff_hat",   label: "Casquette zombie officier",   file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierOfficer/BaseMesh/UE5/Parts/SM_ZombieSoldierOfficer_UE5_Hat.glb`,    asIs: "accessory" },
  { id: "zoff_jacket", label: "Veste zombie officier",      file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierOfficer/BaseMesh/UE5/Parts/SM_ZombieSoldierOfficer_UE5_Jacket.glb`, asIs: "torso" },
  { id: "zoff_pants", label: "Pantalon zombie officier",    file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierOfficer/BaseMesh/UE5/Parts/SM_ZombieSoldierOfficer_UE5_Leg.glb`,    asIs: "legs" },
  { id: "zoff_shoes", label: "Chaussures zombie officier",  file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierOfficer/BaseMesh/UE5/Parts/SM_ZombieSoldierOfficer_UE5_Shoes.glb`,  asIs: "feet" },
  { id: "zwin_head",  label: "Zombie hivernal (tête)",      file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierWinter/Mesh/UE5/Parts/SM_ZombieSoldierWinter_Head_UE5.glb`,   asIs: "head" },
  { id: "zwin_hat",   label: "Chapeau zombie hivernal",     file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierWinter/Mesh/UE5/Parts/SM_ZombieSoldierWinter_Hat_UE5.glb`,    asIs: "accessory" },
  { id: "zwin_jacket", label: "Veste zombie hivernal",      file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierWinter/Mesh/UE5/Parts/SM_ZombieSoldierWinter_Jacket_UE5.glb`, asIs: "torso" },
  { id: "zwin_pants", label: "Pantalon zombie hivernal",    file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierWinter/Mesh/UE5/Parts/SM_ZombieSoldierWinter_Pants_UE5.glb`,  asIs: "legs" },
  { id: "zwin_shoes", label: "Bottes zombie hivernal",      file: `${R}/personnages/ZombieSoldierPack/Characters/ZombieSoldierWinter/Mesh/UE5/Parts/SM_ZombieSoldierWinter_Shoes_UE5.glb`,  asIs: "feet" },

  // ── LOTS B4-B6 (05/08/2026) — SciFi_Trooper_Set, 68 os, 99-100 % Biker ─────
  // Set modulaire H / F grande / F petite. Les corps « standalone » et les
  // « forms » (silhouettes nues) se découpent par os ; têtes, plastrons,
  // jambières, bottes et épaulières sont des pièces d'auteur (`asIs`).
  // ⚠ Mesuré à l'inventaire : matériau unique `WorldGridMaterial` = export
  // SANS textures (grille UE). Les pièces servent de formes ; la re-texture
  // est un chantier séparé. Casques/cheveux/barbe REFUSÉS : rig accessoire
  // 2 os (`Root_Head`) sans aucun nom commun — à traiter plus tard comme
  // attache rigide à l'os `head`, pas comme pièce skinnée.
  { id: "tr_m_body",  label: "Trooper H (corps armuré)",    file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_standalone_multi_mats_with_head.glb`, forceBone: true },
  { id: "tr_f_body",  label: "Trooper F (corps armuré)",    file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_standalone_armor_multi_mats_with_head.glb`, forceBone: true },
  { id: "tr_pf_body", label: "Trooper F petite (corps armuré)", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_standalone_armor_multi_mats_with_head.glb`, forceBone: true },
  { id: "tr_m_form",  label: "Silhouette trooper H",        file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/BodyForms/Male/SK_Male_Form_Standalone.glb`, forceBone: true },
  { id: "tr_f_form",  label: "Silhouette trooper F",        file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/BodyForms/Tall_Female/SK_Female_Form_Standalone.glb`, forceBone: true },
  { id: "tr_pf_form", label: "Silhouette trooper F petite", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/BodyForms/Petite_Female/SK_Petite_Female_Form_Standalone.glb`, forceBone: true },
  { id: "tr_m_head_a", label: "Visage trooper H A",         file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Head_A.glb`, asIs: "head" },
  { id: "tr_m_head_b", label: "Visage trooper H B",         file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Head_B.glb`, asIs: "head" },
  { id: "tr_m_chest", label: "Plastron trooper H",          file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Chest.glb`, asIs: "torso" },
  { id: "tr_m_shoulders", label: "Épaulières trooper H",    file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Shoulders_A.glb`, asIs: "accessory" },
  { id: "tr_m_legs",  label: "Jambières trooper H",         file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Legs.glb`, asIs: "legs" },
  { id: "tr_m_shoes", label: "Bottes trooper H",            file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Shoes.glb`, asIs: "feet" },
  { id: "tr_m_hands", label: "Gants trooper H",             file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male/SK_M_Trooper_Hands.glb`, asIs: "hands" },
  { id: "tr_m_chest_thin", label: "Plastron léger trooper H", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male_Thinner_Armor/SK_M_Trooper_Chest_thin.glb`, asIs: "torso" },
  { id: "tr_m_legs_thin", label: "Jambières légères trooper H", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male_Thinner_Armor/SK_M_Trooper_Legs_thin.glb`, asIs: "legs" },
  { id: "tr_m_shoes_thin", label: "Bottes légères trooper H", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Male_Thinner_Armor/SK_M_Trooper_Shoes_thin.glb`, asIs: "feet" },
  { id: "tr_f_head_a", label: "Visage trooper F A",         file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Head_A.glb`, asIs: "head" },
  { id: "tr_f_head_b", label: "Visage trooper F B",         file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Head_B.glb`, asIs: "head" },
  { id: "tr_f_shoulders", label: "Épaulières trooper F",    file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Tall_Female/SK_F_Trooper_Shoulders_A.glb`, asIs: "accessory" },
  { id: "tr_pf_head_a", label: "Visage trooper F petite A", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Head_A.glb`, asIs: "head" },
  { id: "tr_pf_head_b", label: "Visage trooper F petite B", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Head_B.glb`, asIs: "head" },
  { id: "tr_pf_shoulders", label: "Épaulières trooper F petite", file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Shoulders_A.glb`, asIs: "accessory" },
  { id: "tr_pf_legs", label: "Jambières trooper F petite",  file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Lower_legs_only.glb`, asIs: "legs" },
  { id: "tr_pf_shoes", label: "Bottes trooper F petite",    file: `${R}/assets_character/SciFi_Trooper_Set/Meshes/Trooper_Set/Petite_Female/SK_PF_Trooper_Lower_shoes_only.glb`, asIs: "feet" },

  // ── LOT B7 (05/08/2026) — CyberpunkSamurai, pièces d'auteur, 100 % ─────────
  // Le corps `samurai` (WithoutHelmet) est déjà découpé en calculé ; le pack
  // livre AUSSI ses pièces séparées — meilleure qualité de couture. Les deux
  // coexistent dans les carrousels comme variantes (choix assumé).
  { id: "cs_head",   label: "Tête samouraï cyber",       file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Head.glb`,   asIs: "head" },
  { id: "cs_hair",   label: "Cheveux samouraï cyber",    file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Hair.glb`,   asIs: "hair" },
  { id: "cs_helmet", label: "Casque samouraï cyber",     file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Helmet.glb`, asIs: "accessory" },
  { id: "cs_torso",  label: "Torse samouraï cyber",      file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Torso.glb`,  asIs: "torso" },
  { id: "cs_jacket", label: "Veste samouraï cyber",      file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Jacket.glb`, asIs: "torso" },
  { id: "cs_arm",    label: "Bras samouraï cyber",       file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Arm.glb`,    asIs: "arms" },
  { id: "cs_hand",   label: "Mains samouraï cyber",      file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Hand.glb`,   asIs: "hands" },
  { id: "cs_leg",    label: "Jambes samouraï cyber",     file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Leg.glb`,    asIs: "legs" },
  { id: "cs_bag",    label: "Sac samouraï cyber",        file: `${R}/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_Bag.glb`,    asIs: "accessory" },

  // ── LOTS B8-B10 (05/08/2026) — BikerBundle, squelette = RÉFÉRENCE ──────────
  // Admis par construction (100 %, mesuré à l'inventaire : ces meshes SONT le
  // mannequin UE5_meta). Vestes/ensembles multi-régions = découpe par os ;
  // pièces mono-région = `asIs`. La barbe va en `hair` (carrousel pilosité),
  // bandanas et lunettes en `accessory`. Variantes _b/_c/_d des vestes =
  // mêmes meshes, autres textures — non retenues, réactivables en une ligne.
  { id: "bk_m_head01", label: "Visage biker H 01",        file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_meta_body_head_01.glb`, asIs: "head" },
  { id: "bk_m_head02", label: "Visage biker H 02",        file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_meta_body_head_02.glb`, asIs: "head" },
  { id: "bk_m_hair",  label: "Cheveux biker H",           file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_meta_tal_nrw_hair_used.glb`, asIs: "hair" },
  { id: "bk_m_hair_wild", label: "Cheveux sauvages biker H", file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_meta_tal_nrw_hair_wild.glb`, asIs: "hair" },
  { id: "bk_m_beard", label: "Barbe biker H",             file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_meta_tal_nrw_beard_full.glb`, asIs: "hair" },
  { id: "bk_m_arms",  label: "Bras biker H",              file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_meta_body_arms.glb`, asIs: "arms" },
  { id: "bk_m_hands", label: "Mains biker H",             file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_meta_body_hands.glb`, asIs: "hands" },
  { id: "bk_m_jacket", label: "Blouson cuir biker H",     file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_m_tal_nrw_jacket_leather_01_a.glb`, forceBone: true, onlyRegions: ["torso", "arms"] },
  { id: "bk_m_jeans_vest", label: "Jean + veste biker H", file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_m_tal_nrw_jeans_vest_used.glb`, forceBone: true, onlyRegions: ["torso", "legs"] },
  { id: "bk_m_shirt_vest", label: "Chemise + gilet biker H", file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_ma_meta_tal_nrw_shirt_vest.glb`, forceBone: true, onlyRegions: ["torso", "arms"] },
  { id: "bk_m_vest_long", label: "Gilet long biker H",    file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_m_tal_nrw_vest_longshirt.glb`, forceBone: true, onlyRegions: ["torso", "arms"] },
  { id: "bk_m_pants", label: "Jean biker H",              file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_ma_meta_tal_nrw_pants_jeans.glb`, asIs: "legs" },
  { id: "bk_m_tanktop", label: "Débardeur biker H",       file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_ma_meta_tal_nrw_tanktop_short.glb`, asIs: "torso" },
  { id: "bk_m_boots", label: "Bottes biker H",            file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_ma_meta_tal_nrw_shoe_boots_half.glb`, asIs: "feet" },
  { id: "bk_m_shoes", label: "Chaussures biker H",        file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_ma_meta_tal_nrw_shoe_short.glb`, asIs: "feet" },
  { id: "bk_m_gloves", label: "Gants biker H",            file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/SK_ma_meta_tal_nrw_glove_biker.glb`, asIs: "hands" },
  { id: "bk_m_bandana", label: "Bandana biker H",         file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Accessories/SK_ma_tal_nrw_hat_bandana_full.glb`, asIs: "accessory" },
  { id: "bk_m_glasses", label: "Lunettes biker H",        file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Accessories/SK_ma_meta_tal_nrw_glass_02.glb`, asIs: "accessory" },
  { id: "bk_f_leather", label: "Blouson cuir biker F",    file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_meta_tal_nrw_leatherjack_01_a.glb`, forceBone: true, onlyRegions: ["torso", "arms"] },
  { id: "bk_f_shirt_vest", label: "Chemise + gilet biker F", file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_meta_tal_nrw_shirt_vest_a.glb`, forceBone: true, onlyRegions: ["torso", "arms"] },
  { id: "bk_f_shirt_half", label: "Chemise courte biker F", file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_meta_tal_nrw_shirt_half.glb`, asIs: "torso" },
  { id: "bk_f_pants", label: "Jean biker F",              file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_meta_tal_nrw_pants_jeans.glb`, asIs: "legs" },
  { id: "bk_f_tanktop", label: "Débardeur biker F",       file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_meta_tal_nrw_chest_tanktop.glb`, asIs: "torso" },
  { id: "bk_f_boots", label: "Bottes biker F",            file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_meta_tal_nrw_boot_01_a.glb`, asIs: "feet" },
  { id: "bk_f_boots_casual", label: "Bottines biker F",   file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_meta_tal_nrw_boot_casual.glb`, asIs: "feet" },
  { id: "bk_f_hair",  label: "Cheveux biker F",           file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/SK_fe_tal_hair_02.glb`, asIs: "hair" },
  { id: "bk_f_bandana", label: "Bandana biker F",         file: `${R}/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Female/Accessories/SK_fe_tal_nrw_hat_bandana.glb`, asIs: "accessory" },

  // ── LOT B11 (05/08/2026) — mannequins UE4 / UEFN / mocap MetaHuman ─────────
  // Inventaire : UE4 100 %, UEFN 99 %, mocap H 71 % de noms Biker. Matériau
  // `WorldGridMaterial` (export sans texture) — les pièces servent de formes.
  { id: "ue4_mannequin", label: "Mannequin UE4",          file: `${R}/personnages/GameAnimationSample/Characters/UE4_Mannequin/Meshes/SKM_UE4_Mannequin.glb`, forceBone: true },
  { id: "uefn_mannequin", label: "Mannequin UEFN",        file: `${R}/personnages/GameAnimationSample/Characters/UEFN_Mannequin/Meshes/SKM_UEFN_Mannequin.glb`, forceBone: true },
  { id: "mh_mocap_m", label: "Corps mocap MetaHuman H",   file: `${R}/personnages/GameAnimationSample/MetaHumans/Common/Common/Mocap/m_med_nrw_body_mocap.glb`, forceBone: true },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const mo = (b) => (b / 1024 / 1024).toFixed(1);

// ── Chemin B : classement des sommets puis des triangles ─────────────────────

/** Région de chaque sommet d'une primitive, d'après son os dominant. */
function vertexRegions(prim, jointNames) {
  const J = prim.getAttribute("JOINTS_0");
  const W = prim.getAttribute("WEIGHTS_0");
  if (!J || !W) return null;

  const n = J.getCount();
  const out = new Array(n);
  const je = [0, 0, 0, 0], we = [0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    J.getElement(v, je);
    W.getElement(v, we);
    let best = -1, bestW = 0;
    for (let k = 0; k < 4; k++) if (we[k] > bestW) { bestW = we[k]; best = je[k]; }
    out[v] = (best >= 0 ? regionFromBone(jointNames[best]) : null) ?? FALLBACK_REGION;
  }
  return out;
}

/**
 * Index par région. Un triangle est écrit dans CHAQUE région présente parmi ses
 * trois sommets — les frontières sont donc couvertes des deux côtés.
 */
function indicesByRegion(prim, vRegions) {
  const idx = prim.getIndices();
  const arr = idx ? idx.getArray() : null;
  const count = arr ? arr.length : prim.getAttribute("POSITION").getCount();
  const at = (i) => (arr ? arr[i] : i);

  const buckets = new Map();
  for (let t = 0; t + 2 < count; t += 3) {
    const a = at(t), b = at(t + 1), c = at(t + 2);
    const regions = new Set([vRegions[a], vRegions[b], vRegions[c]]);
    for (const r of regions) {
      let list = buckets.get(r);
      if (!list) buckets.set(r, (list = []));
      list.push(a, b, c);
    }
  }
  return buckets;
}

// ── Compaction : ne garder que les sommets référencés ────────────────────────

/** Recopie un accesseur en n'y gardant que les sommets de `used`. */
function cloneCompacted(doc, accessor, used, buffer) {
  return doc
    .createAccessor()
    .setType(accessor.getType())
    .setArray(gatherElements(accessor.getArray(), accessor.getElementSize(), used))
    .setNormalized(accessor.getNormalized())
    .setBuffer(buffer);
}

/**
 * Compacte une primitive en place. Retourne le nombre de sommets supprimés.
 *
 * S'applique aux DEUX chemins de découpe : une primitive issue de la découpe
 * d'auteur peut très bien partager son buffer de sommets avec ses voisines —
 * mesuré sur `murdock/head`, qui n'utilisait que 50 % des sommets déclarés.
 *
 * Les accesseurs de sortie sont NEUFS, jamais partagés : deux pièces différentes
 * n'ont plus aucun buffer en commun, ce qui est exactement ce qu'on veut pour
 * des fichiers autonomes.
 */
function compactPrimitive(doc, prim, buffer) {
  const idx = prim.getIndices();
  const pos = prim.getAttribute("POSITION");
  if (!idx || !pos) return 0;

  const before = pos.getCount();
  const oldIndices = idx.getArray();
  const { remap, used, count } = compactionPlan(oldIndices, before);
  if (count === before) return 0; // déjà dense — ne rien réécrire

  for (const sem of prim.listSemantics())
    prim.setAttribute(sem, cloneCompacted(doc, prim.getAttribute(sem), used, buffer));

  // Les cibles morph portent l'essentiel du poids : les oublier ici ne
  // ferait pas que rater le gain, ça DÉSALIGNERAIT les deltas des sommets.
  for (const target of prim.listTargets())
    for (const sem of target.listSemantics())
      target.setAttribute(sem, cloneCompacted(doc, target.getAttribute(sem), used, buffer));

  prim.setIndices(doc.createAccessor().setArray(remapIndices(oldIndices, remap)).setBuffer(buffer));
  return before - count;
}

// ── Suppression des morph targets devenues nulles ────────────────────────────

/**
 * Supprime d'un mesh les cibles morph qu'aucune de ses primitives ne fait
 * bouger. Retourne le nombre de cibles supprimées.
 *
 * Suppression à REBOURS : retirer la cible 3 décale toutes les suivantes, donc
 * parcourir par index croissant sauterait une cible sur deux.
 */
function pruneNullTargets(mesh) {
  const prims = mesh.listPrimitives();
  const total = prims.reduce((n, p) => Math.max(n, p.listTargets().length), 0);
  if (total === 0) return 0;

  const masks = prims.map((p) =>
    p.listTargets().map((t) => !isNullDelta(t.listSemantics().map((s) => t.getAttribute(s).getArray()))),
  );
  const alive = combineAliveMasks(masks);
  const removed = alive.filter((a) => !a).length;
  if (removed === 0) return 0;

  for (let i = total - 1; i >= 0; i--) {
    if (alive[i]) continue;
    for (const p of prims) {
      const t = p.listTargets()[i];
      if (t) p.removeTarget(t);
    }
  }

  // Poids et noms sont indexés par cible : les laisser tels quels décalerait
  // silencieusement chaque cible restante sur la valeur de sa voisine.
  const weights = mesh.getWeights();
  if (weights?.length === total) mesh.setWeights(filterByMask(weights, alive));

  const extras = mesh.getExtras();
  if (Array.isArray(extras?.targetNames) && extras.targetNames.length === total)
    mesh.setExtras({ ...extras, targetNames: filterByMask(extras.targetNames, alive) });

  return removed;
}

/**
 * Passe les deltas morph restants en int16 normalisé (moitié du poids).
 *
 * Ne touche QUE les cibles : la géométrie de base et les transforms de nœuds
 * restent intactes, ce qui est indispensable sur des meshes skinnés (cf.
 * `scripts/lib/quantize-morph.mjs`).
 *
 * @returns {{targets: number, clipped: number}} cibles traitées, valeurs écrêtées
 */
function quantizeTargets(doc) {
  const buffer = doc.getRoot().listBuffers()[0];
  let targets = 0, clipped = 0;

  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives())
      for (const t of p.listTargets()) {
        let touched = false;
        for (const sem of t.listSemantics()) {
          const a = t.getAttribute(sem);
          // Déjà quantifié (ré-exécution du script) : ne pas re-quantifier un
          // Int16, ce qui l'écraserait à zéro en le traitant comme des flottants.
          if (!(a.getArray() instanceof Float32Array)) continue;
          const { array, clipped: n } = quantizeNormalized(a.getArray());
          clipped += n;
          touched = true;
          t.setAttribute(sem, doc.createAccessor()
            .setType(a.getType())
            .setArray(array)
            .setNormalized(true)
            .setBuffer(buffer));
        }
        if (touched) targets++;
      }

  // Sans l'extension déclarée, un POSITION en SHORT normalisé est hors spec.
  if (targets > 0) doc.createExtension(KHRMeshQuantization).setRequired(true);
  return { targets, clipped };
}

// ── Traitement d'un personnage ───────────────────────────────────────────────

async function extract(src) {
  if (!existsSync(src.file)) return { id: src.id, error: "fichier absent" };

  // ── Pièce d'AUTEUR (asIs) : déjà séparée, aucune découpe ──────────────────
  // Le GLB est copié tel quel dans _parts/<id>/<region>.glb et catalogué dans
  // la région déclarée par la source. KTX2 et vignettes suivent comme pour
  // les pièces découpées. `method: "author"` distingue ces pièces au manifest.
  if (src.asIs) {
    const doc = await io.read(src.file);
    const skin = doc.getRoot().listSkins()[0];
    const rel = `${OUT_DIR}/${src.id}/${src.asIs}.glb`;
    if (WRITE) {
      mkdirSync(path.dirname(rel), { recursive: true });
      await io.write(rel, doc);
    }
    return {
      id: src.id, label: src.label, preSeg: true, matNames: [],
      parts: [{
        region: src.asIs, method: "author",
        path: "/" + rel.replace(/^public\//, ""),
        prims: doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0),
        dropped: 0, morphsCut: 0, quantized: 0, clipped: 0,
        bones: skin ? skin.listJoints().length : 0,
        bytes: WRITE && existsSync(rel) ? statSync(rel).size : 0,
      }],
    };
  }

  const probe = await io.read(src.file);
  const matNames = probe.getRoot().listMaterials().map((m) => m.getName());
  const preSeg = !src.forceBone && isPreSegmented(matNames);

  // ── PLAN DE DÉCOUPE : une méthode PAR RÉGION, pas par modèle ───────────────
  //
  // Mesuré au premier passage : la découpe d'auteur est plus GROSSIÈRE que
  // l'anatomie du rig. Wraith ne déclare que `Upperbody`/`Lowerbody` — donc
  // aucune tête, alors que c'est justement la pièce qu'on veut échanger. À
  // l'inverse Echo, sans aucun matériau nommé, donne six régions par les os,
  // dont `hands` et `feet` que personne d'autre ne fournit.
  //
  // On garde donc la découpe d'auteur PARTOUT où elle existe (elle est sans
  // couture, elle suit les intentions de modélisation), et on COMPLÈTE par l'os
  // dominant les régions qu'elle ne couvre pas. Les deux chemins cohabitent
  // dans un même personnage.
  const matRegions = new Set();
  // `forceBone` : la segmentation matériau est ignorée (ex: mpfb, dont le
  // matériau « Body » couvre le corps ENTIER — la découpe d'auteur y serait
  // plus grossière que l'anatomie du rig, à l'inverse des héros).
  if (!src.forceBone)
    for (const m of probe.getRoot().listMeshes())
      for (const p of m.listPrimitives()) {
        const r = regionFromMaterial(p.getMaterial()?.getName());
        if (r) matRegions.add(r);
      }

  const boneRegions = new Set();
  const probeJoints = (probe.getRoot().listSkins()[0]?.listJoints() ?? []).map((j) => j.getName());
  for (const m of probe.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const vr = vertexRegions(p, probeJoints);
      if (vr) for (const r of vr) boneRegions.add(r);
    }

  /** region → "material" | "bone" */
  const plan = new Map();
  for (const r of matRegions) plan.set(r, "material");
  for (const r of boneRegions) if (!plan.has(r)) plan.set(r, "bone");
  const regions = [...plan.keys()].filter(
    // `onlyRegions` : ne garder que les régions réellement couvertes par le
    // vêtement. Les packs « combined » incluent le corps NU sous la veste —
    // sans ce filtre, un blouson produit une « tête » et des « jambes » de
    // peau qui doublonnent l'anatomie de base dans les carrousels.
    (r) => !src.onlyRegions || src.onlyRegions.includes(r),
  );

  const produced = [];
  for (const region of regions) {
    const doc = await io.read(src.file);                 // relecture : isole chaque sortie
    const jointNames = (doc.getRoot().listSkins()[0]?.listJoints() ?? []).map((j) => j.getName());

    for (const mesh of doc.getRoot().listMeshes()) {
      for (const p of [...mesh.listPrimitives()]) {
        if (plan.get(region) === "material") {
          if (regionFromMaterial(p.getMaterial()?.getName()) !== region) mesh.removePrimitive(p);
          continue;
        }
        // Chemin par os — on re-découpe TOUTES les primitives, y compris celles
        // qui portent un matériau nommé.
        //
        // C'est indispensable et sans risque de doublon : si cette région est au
        // plan en méthode « os », c'est précisément que les matériaux ne la
        // fournissent PAS. La tête de Wraith vit à l'intérieur de
        // `M_Wraith_Upperbody` — l'exclure parce que sa primitive a un nom
        // reviendrait à ne jamais pouvoir l'extraire.
        const vr = vertexRegions(p, jointNames);
        if (!vr) { mesh.removePrimitive(p); continue; }
        const keep = indicesByRegion(p, vr).get(region);
        if (!keep || keep.length === 0) { mesh.removePrimitive(p); continue; }
        const acc = doc.createAccessor()
          .setArray(new Uint32Array(keep))
          .setBuffer(doc.getRoot().listBuffers()[0]);
        p.setIndices(acc);
      }
    }

    // Compaction APRÈS la découpe : elle a besoin de l'index définitif pour
    // savoir quels sommets sont encore référencés.
    const buffer = doc.getRoot().listBuffers()[0];
    let dropped = 0;
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) dropped += compactPrimitive(doc, p, buffer);

    // Puis les cibles morph orphelines. APRÈS la compaction : c'est elle qui
    // rend nulles les cibles dont les sommets viennent de disparaître.
    //
    // Sûr uniquement parce qu'aucune animation ne pilote `weights` — vérifié sur
    // les 39 pièces produites. Si un futur personnage en apporte une, il faudra
    // réécrire ses samplers avant de supprimer quoi que ce soit.
    let morphsCut = 0;
    const animatedWeights = doc.getRoot().listAnimations()
      .some((a) => a.listChannels().some((c) => c.getTargetPath() === "weights"));
    if (animatedWeights) {
      console.warn(`   ⚠ ${src.id}/${region} : animation sur weights — cibles morph conservées`);
    } else {
      for (const mesh of doc.getRoot().listMeshes()) morphsCut += pruneNullTargets(mesh);
    }

    // Les cibles survivantes passent en int16 normalisé — moitié du poids.
    const quant = quantizeTargets(doc);

    // `keepLeaves` : sans lui, `prune` supprime les nœuds vides — or ce sont
    // exactement les os du squelette non couverts par cette pièce, et les
    // retirer casserait la correspondance avec le corps d'accueil.
    await doc.transform(prune({ keepLeaves: true, keepAttributes: false }));

    const skin = doc.getRoot().listSkins()[0];
    let prims = 0;
    for (const m of doc.getRoot().listMeshes()) prims += m.listPrimitives().length;
    if (prims === 0) continue;   // rien à écrire pour cette région

    const rel = `${OUT_DIR}/${src.id}/${region}.glb`;
    if (WRITE) {
      mkdirSync(path.dirname(rel), { recursive: true });
      await io.write(rel, doc);
    }
    produced.push({
      region,
      method: plan.get(region),
      path: "/" + rel.replace(/^public\//, ""),
      prims,
      dropped,
      morphsCut,
      quantized: quant.targets,
      clipped: quant.clipped,
      bones: skin ? skin.listJoints().length : 0,
      bytes: WRITE && existsSync(rel) ? statSync(rel).size : 0,
    });
  }

  return { id: src.id, label: src.label, preSeg, matNames, parts: produced, partial: !!src.onlyRegions };
}

// ── Exécution ────────────────────────────────────────────────────────────────

const results = [];
const aTraiter = ONLY ? SOURCES.filter((s) => ONLY.has(s.id)) : SOURCES;
if (ONLY) {
  const inconnus = [...ONLY].filter((id) => !SOURCES.some((s) => s.id === id));
  if (inconnus.length) {
    console.error(`❌ --only : source(s) inconnue(s) : ${inconnus.join(", ")}`);
    process.exit(1);
  }
  console.log(`▶ --only : ${aTraiter.length} source(s) sur ${SOURCES.length} — ` +
    `le manifest sera FUSIONNÉ, pas réécrit.\n`);
}
for (const src of aTraiter) {
  const r = await extract(src);
  results.push(r);
  if (r.error) { console.log(`\n${r.label ?? r.id} — ⚠ ${r.error}`); continue; }
  console.log(`\n${r.label}`);
  for (const p of r.parts) {
    const size = p.bytes ? `${mo(p.bytes).padStart(7)} Mo` : "        —";
    const cut = [
      p.dropped ? `−${p.dropped} som.` : "dense",
      p.morphsCut ? `−${p.morphsCut} morph` : "",
      p.quantized ? `${p.quantized} q16${p.clipped ? ` (${p.clipped} écrêtés)` : ""}` : "",
    ].filter(Boolean).join("  ");
    console.log(`   ${p.region.padEnd(10)} ${(p.method === "bone" ? "os    " : "auteur").padEnd(7)} ${String(p.prims).padStart(3)} prim  ${String(p.bones).padStart(3)} os  ${size}  ${cut}`);
  }
  if (r.parts.length === 0) console.log("   ⚠ aucune pièce produite");
}

// Manifest : ce que le catalogue runtime consommera.
const manifest = results
  .filter((r) => !r.error)
  .map((r) => ({
    id: r.id,
    label: r.label,
    method: r.preSeg ? "material" : "dominant-bone",
    // Découpe volontairement partielle (onlyRegions) : un vêtement n'est
    // catalogué que là où il couvre le corps — ce n'est PAS un corps.
    ...(r.partial ? { partial: true } : {}),
    parts: r.parts.map((p) => ({ region: p.region, path: p.path, bones: p.bones, method: p.method })),
  }));

const total = results.reduce((n, r) => n + (r.parts?.length ?? 0), 0);
console.log(`\n── ${total} pièces sur ${manifest.length} personnages ──`);

if (WRITE) {
  mkdirSync(path.dirname(MANIFEST), { recursive: true });

  // FUSION en mode `--only`. Écrire `manifest` tel quel effacerait du catalogue
  // toutes les sources non traitées — le créateur perdrait 100 packs sur 103,
  // sans erreur : `heroParts` ne fait que TRADUIRE ce fichier.
  let aEcrire = manifest;
  if (ONLY && existsSync(MANIFEST)) {
    const ancien = JSON.parse(readFileSync(MANIFEST, "utf8"));
    const neufs = new Map(manifest.map((e) => [e.id, e]));
    aEcrire = ancien.map((e) => neufs.get(e.id) ?? e);
    for (const [id, e] of neufs) if (!ancien.some((a) => a.id === id)) aEcrire.push(e);
    console.log(`↻ manifest fusionné : ${manifest.length} entrée(s) remplacée(s) ` +
      `sur ${aEcrire.length} conservées.`);
  }

  writeFileSync(MANIFEST, JSON.stringify(aEcrire, null, 2), "utf8");
  console.log(`✅ ${MANIFEST} écrit.\n`);
} else {
  console.log(`Dry-run. Relancer avec --write pour produire les GLB et le manifest.\n`);
}
