// ══════════════════════════════════════════════════════════════════════════════
// weapons/weaponAnimClips.ts — Clips d'animation d'arme, par famille et par action.
//
// GÉNÉRÉ par scripts/generate-weapon-anim-clips.mjs — ne pas éditer à la main.
//
// POURQUOI CE FICHIER EXISTE :
// Les packs d'armes exportent leurs animations en GLB, dans les mêmes dossiers
// que les meshes et sous des noms contenant le nom de l'arme
// (`Anim_Mann_DBS_Gun_Raise`, `AS_HS_WP03_Revolver_Fire`). Le classifieur les
// prenait donc pour des armes équipables : elles finissaient en BOUTIQUE, où
// elles n'affichaient qu'une paire de bras de mannequin.
//
// La règle `clip` de weaponClassifier les écarte désormais du socket de main.
// Ce registre les récupère pour ce à quoi elles servent vraiment : alimenter
// le viewmodel FPS en tir, rechargement, dégainé et lancer.
// ══════════════════════════════════════════════════════════════════════════════

/** Familles d'armes pour lesquelles un jeu de clips existe. */
export type WeaponAnimFamily = "grenade" | "revolver" | "shotgun_double" | "shotgun_pompe" | "shotgun_semi";

/** Actions couvertes. `fire` et `reload` sont celles que le combat déclenche. */
export type WeaponAnimAction = "draw" | "fire" | "holster" | "idle" | "inspect" | "locomotion" | "pin" | "reload" | "throw";

export const WEAPON_ANIM_CLIPS: Record<WeaponAnimFamily, Partial<Record<WeaponAnimAction, string[]>>> = {
  grenade: {
    idle: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/Anim_Mann_Grenade_Idle_loop.glb",
    ],
    throw: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/Anim_Mann_Grenade_Throw.glb",
    ],
  },
  revolver: {
    fire: [
      "/models/armes/HS_WeaponPack_03/Meshes/Revolver/Animations/AS_HS_WP03_Revolver_Fire.glb",
      "/models/armes/HS_WeaponPack_03/Meshes/Revolver/Animations/AS_HS_WP03_Revolver_ReadyToFire.glb",
      "/models/armes/revolver/AS_HS_WP03_Revolver_Fire.glb",
    ],
    reload: [
      "/models/armes/HS_WeaponPack_03/Meshes/Revolver/Animations/AS_HS_WP03_Revolver_Reload.glb",
    ],
  },
  shotgun_double: {
    draw: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Gun_Raise.glb",
    ],
    fire: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_ADSFire.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_HipFire.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_HipFire_stronger.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_ADSFire_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_ADSFire_Start.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_HipFire_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_HipFire_Start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/DBShotgun/Anim_DBS_GunShot.glb",
    ],
    holster: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Gun_Lower.glb",
    ],
    idle: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/DBS/Anim_Mann_DBS_StunG_Idle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/DBS/DBS_WeaponBlock_Idle_Anim/Anim_Mann_DBS_WeaponBlock_Idle_v1.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/DBS/DBS_WeaponBlock_Idle_Anim/Anim_Mann_DBS_WeaponBlock_Idle_v2.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/DBS/DBS_WeaponBlock_Idle_Anim/Anim_Mann_DBS_WeaponBlock_Idle_v3.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Idle_ADS.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Idle_HP.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_Jump_Loop.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/DBShotgun/Anim_DBS_Idle.glb",
    ],
    inspect: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Inspection.glb",
    ],
    locomotion: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Running.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Sprinting.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Walk_ADS.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_Walk_HP.glb",
    ],
    pin: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/DBS/Anim_Mann_DBS_StunG_Pin.glb",
    ],
    reload: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_FullReloading.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/Anim_Mann_DBS_TacReloading.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_FullReloading_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_FullReloading_Proceed.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_FullReloading_Start.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_TacReloading_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_TacReloading_Proceed.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/DBShotgun/dbs_Mann_animCuts/Anim_Mann_DBS_TacReloading_Start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/DBShotgun/Anim_DBS_FullReloading.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/DBShotgun/Anim_DBS_TacReloading.glb",
    ],
    throw: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/DBS/Anim_Mann_DBS_StunG_StartToThrow.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/DBS/Anim_Mann_DBS_StunG_Throw.glb",
    ],
  },
  shotgun_pompe: {
    draw: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_GunRaise.glb",
    ],
    fire: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_ADSFire.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_HipFire.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_ADSFire_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_ADSFire_Start.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_HipFire_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_HipFire_Start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_GunShot.glb",
    ],
    holster: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_Lower.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_toHolster.glb",
    ],
    idle: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/PAS/Anim_Mann_PAS_StunGrenade_Idle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/PAS/PAS_WeaponBlock_Idle_Anim/Anim_Mann_PAS_WeaponBlock_Idle_v1.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/PAS/PAS_WeaponBlock_Idle_Anim/Anim_Mann_PAS_WeaponBlock_Idle_v2.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/PAS/PAS_WeaponBlock_Idle_Anim/Anim_Mann_PAS_WeaponBlock_Idle_v3.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_ADS_Idle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_Idle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_Jump_Loop.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_Idle.glb",
    ],
    inspect: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_Inspection.glb",
    ],
    locomotion: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_ADS_Walking.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_Running.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_Sprinting.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_Sprinting_v2.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/Anim_Mann_PAS_Walking.glb",
    ],
    pin: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/PAS/Anim_Mann_PAS_StunGrenade_PullOutThePin.glb",
    ],
    reload: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_FullReloading_start.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_Reloading_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_Reloading_Loop.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_SideReloading_01.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_SideReloading_02.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_SideReloading_03.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_SideReloading_04.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_SideReloading_05.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/PAShotgun/PAS_Mann_animCuts/Anim_Mann_PAS_TacReloading_start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_FullReloading_start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_Reloading_Loop.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_SideReloading_01.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_SideReloading_02.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_SideReloading_03.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_SideReloading_04.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_SideReloading_05.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/PAShotgun/Anim_PAS_TacReloading_start.glb",
    ],
    throw: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/PAS/Anim_Mann_PAS_StunGrenade_StartOfThrow.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/PAS/Anim_Mann_PAS_StunGrenade_Throw.glb",
    ],
  },
  shotgun_semi: {
    draw: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_GunRaise.glb",
    ],
    fire: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_ADSFire.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_HipFire.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_ADSFire_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_ADSFire_Start.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_HipFire_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_HipFire_Start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/Anim_SAS_GunShot.glb",
    ],
    holster: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_GunLower.glb",
    ],
    idle: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/SAS/Anim_Mann_SAS_StunGrenade_Idle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/SAS/SAS_WeaponBlock_Idle_Anim/Anim_Mann_SAS_WeaponBlock_Idle_v1.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/SAS/SAS_WeaponBlock_Idle_Anim/Anim_Mann_SAS_WeaponBlock_Idle_v2.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/SAS/SAS_WeaponBlock_Idle_Anim/Anim_Mann_SAS_WeaponBlock_Idle_v3.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_ADSPose_Idle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_HipPose_Idle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_Jumping_Loop.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/Anim_SAS_Idle.glb",
    ],
    inspect: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_Inspection.glb",
    ],
    locomotion: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_ADSPose_Walk.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_HipPose_Walk.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_Running.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_Sprinting_V1.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_Sprinting_V2.glb",
    ],
    pin: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/SAS/Anim_Mann_SAS_StunGrenade_PullOutThePin.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_Jumping.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_Jumping_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_Jumping_Start.glb",
    ],
    reload: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_FullReloading_Start.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_TacReloading.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/Anim_Mann_SAS_TacReloading_V2.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_TacReload_PostWiggle.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_TacReloading_End.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_TacReloading_Loop.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_TacReloading_Loop_V2.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_TacReloading_Start.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/SAShotgun/SAS_Mann_animCuts/Anim_Mann_SAS_TacReloading_StartSimple.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/Anim_SAS_FullReloading_Start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/Anim_SAS_TacReloading.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/Anim_SAS_TacReloading_V2.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/SAS_AnimCuts/Anim_SAS_TacReloading_End.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/SAS_AnimCuts/Anim_SAS_TacReloading_Loop_V2.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/SAS_AnimCuts/Anim_SAS_TacReloading_Loop_fxd.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/SAS_AnimCuts/Anim_SAS_TacReloading_Start.glb",
      "/models/armes/CG_ShotgunPack/Weapons/Animations/SAShotgun/SAS_AnimCuts/Anim_SAS_TacReloading_StartSimple.glb",
    ],
    throw: [
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/SAS/Anim_Mann_SAS_StunGrenade_StartOfThrow.glb",
      "/models/armes/CG_ShotgunPack/FPS_Arms/Animations/BONUS/SAS/Anim_Mann_SAS_StunGrenade_Throw.glb",
    ],
  },
};

/** Familles reconnues dans un nom de fichier d'arme. Ordre : le plus spécifique d'abord. */
const FAMILLE_RE: { re: RegExp; famille: WeaponAnimFamily }[] = [
  // [_-] et non \b : l'underscore EST un caractère de mot, donc `\bDBS\b` ne
  // matche JAMAIS dans `Anim_Mann_DBS_Gun`. Erreur commise, corrigée ici.
  { re: /[_-]DBS[_-]/i, famille: "shotgun_double" },
  { re: /[_-]PAS[_-]/i, famille: "shotgun_pompe" },
  { re: /[_-]SAS[_-]/i, famille: "shotgun_semi" },
  { re: /revolver/i,    famille: "revolver" },
  { re: /grenade/i,     famille: "grenade" },
];

/** Famille d'animation d'une arme, d'après son chemin. `null` si aucun jeu de clips. */
export function weaponAnimFamily(pathOrName: string): WeaponAnimFamily | null {
  const nom = pathOrName.replace(/\\/g, "/").split("/").pop() ?? pathOrName;
  return FAMILLE_RE.find(({ re }) => re.test(nom))?.famille ?? null;
}

/** Clips d'une action pour une arme. Tableau vide si l'arme n'a pas ce jeu. */
export function clipsFor(pathOrName: string, action: WeaponAnimAction): string[] {
  const f = weaponAnimFamily(pathOrName);
  return f ? (WEAPON_ANIM_CLIPS[f][action] ?? []) : [];
}
