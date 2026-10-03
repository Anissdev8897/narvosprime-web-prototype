// weapons/shotgunFpsRegistry.ts — registre d'animations FPS par arme.
//
// Mappe chaque arme à son jeu d'animations ARME (mouvement de la culasse, du
// barillet…) et BRAS FPS. Les deux rigs partagent le même skeleton UE5.
//
// Utilisé par FpsWeaponViewmodel via `externalIdleGlb` / `externalFireGlb`
// quand l'arme n'embarque pas ses propres animations dans le GLB.
//
// LE NOM DU FICHIER EST HISTORIQUE : le registre a commencé avec les seuls
// fusils de CG_ShotgunPack, il couvre maintenant aussi le revolver. Renommer
// le fichier casserait `getShotgunFps`, appelé depuis RpgGameWorld — le
// bénéfice ne vaut pas la migration.
//
// TOUS les chemins sont vérifiés présents sur le disque par le test associé.
// Ce n'est pas décoratif : le fallback SPA de Vite renvoie du `text/html` en
// 200 pour un fichier absent, donc un chemin faux ne lève RIEN — l'animation
// ne joue simplement jamais, sans le moindre message.

const CG = "/models/armes/CG_ShotgunPack";
const W  = `${CG}/Weapons/Animations`;
const A  = `${CG}/FPS_Arms/Animations`;
const REV = "/models/armes/HS_WeaponPack_03/Meshes/Revolver";

export interface ShotgunFpsAnimSet {
  idleHip: string;
  idleAds?: string;
  hipFire: string;
  adsFire?: string;
  reload: string;
  run?: string;
  sprint?: string;
  jump?: string;
  inspect?: string;
  melee?: string;
  raise?: string;
  lower?: string;
}

export interface ShotgunFpsEntry {
  weaponPath: string;
  label: string;
  weapon: ShotgunFpsAnimSet;
  arms: ShotgunFpsAnimSet;
}

export const SHOTGUN_FPS_REGISTRY: ShotgunFpsEntry[] = [
  {
    weaponPath: `${CG}/Weapons/Meshes/SK_DBShotgun.glb`,
    label: "Double Barrel Shotgun",
    weapon: {
      idleHip:  `${W}/DBShotgun/Anim_DBS_Idle.glb`,
      hipFire:  `${W}/DBShotgun/Anim_DBS_GunShot.glb`,
      reload:   `${W}/DBShotgun/Anim_DBS_TacReloading.glb`,
      inspect:  `${W}/DBShotgun/Anim_DBS_OperativeCheck.glb`,
    },
    arms: {
      idleHip:  `${A}/DBShotgun/Anim_Mann_DBS_Idle_HP.glb`,
      idleAds:  `${A}/DBShotgun/Anim_Mann_DBS_Idle_ADS.glb`,
      hipFire:  `${A}/DBShotgun/Anim_Mann_DBS_HipFire.glb`,
      adsFire:  `${A}/DBShotgun/Anim_Mann_DBS_ADSFire.glb`,
      reload:   `${A}/DBShotgun/Anim_Mann_DBS_TacReloading.glb`,
      run:      `${A}/DBShotgun/Anim_Mann_DBS_Running.glb`,
      sprint:   `${A}/DBShotgun/Anim_Mann_DBS_Sprinting.glb`,
      jump:     `${A}/DBShotgun/Anim_Mann_DBS_Jump.glb`,
      inspect:  `${A}/DBShotgun/Anim_Mann_DBS_Inspection.glb`,
      melee:    `${A}/DBShotgun/Anim_Mann_DBS_CloseCombat.glb`,
      raise:    `${A}/DBShotgun/Anim_Mann_DBS_Gun_Raise.glb`,
      lower:    `${A}/DBShotgun/Anim_Mann_DBS_Gun_Lower.glb`,
    },
  },
  {
    weaponPath: `${CG}/Weapons/Meshes/SK_PAShotgun.glb`,
    label: "Pump Action Shotgun",
    weapon: {
      idleHip:  `${W}/PAShotgun/Anim_PAS_Idle.glb`,
      hipFire:  `${W}/PAShotgun/Anim_PAS_GunShot.glb`,
      reload:   `${W}/PAShotgun/Anim_PAS_TacReloading_start.glb`,
      inspect:  `${W}/PAShotgun/Anim_PAS_OperativeGunCheck.glb`,
    },
    arms: {
      idleHip:  `${A}/PAShotgun/Anim_Mann_PAS_Idle.glb`,
      idleAds:  `${A}/PAShotgun/Anim_Mann_PAS_ADS_Idle.glb`,
      hipFire:  `${A}/PAShotgun/Anim_Mann_PAS_HipFire.glb`,
      adsFire:  `${A}/PAShotgun/Anim_Mann_PAS_ADSFire.glb`,
      reload:   `${A}/PAShotgun/Anim_Mann_PAS_LoadinOneCartridgeIntoChamber.glb`,
      run:      `${A}/PAShotgun/Anim_Mann_PAS_Running.glb`,
      sprint:   `${A}/PAShotgun/Anim_Mann_PAS_Sprinting.glb`,
      jump:     `${A}/PAShotgun/Anim_Mann_PAS_Jump.glb`,
      inspect:  `${A}/PAShotgun/Anim_Mann_PAS_Inspection.glb`,
      melee:    `${A}/PAShotgun/Anim_Mann_PAS_CCombat.glb`,
      raise:    `${A}/PAShotgun/Anim_Mann_PAS_GunRaise.glb`,
      lower:    `${A}/PAShotgun/Anim_Mann_PAS_Lower.glb`,
    },
  },
  {
    weaponPath: `${CG}/Weapons/Meshes/SK_SAShotgun.glb`,
    label: "Semi-Auto Shotgun",
    weapon: {
      idleHip:  `${W}/SAShotgun/Anim_SAS_Idle.glb`,
      hipFire:  `${W}/SAShotgun/Anim_SAS_GunShot.glb`,
      reload:   `${W}/SAShotgun/Anim_SAS_TacReloading.glb`,
      inspect:  `${W}/SAShotgun/Anim_SAS_OperativeGunCheck.glb`,
    },
    arms: {
      idleHip:  `${A}/SAShotgun/Anim_Mann_SAS_HipPose_Idle.glb`,
      idleAds:  `${A}/SAShotgun/Anim_Mann_SAS_ADSPose_Idle.glb`,
      hipFire:  `${A}/SAShotgun/Anim_Mann_SAS_HipFire.glb`,
      adsFire:  `${A}/SAShotgun/Anim_Mann_SAS_ADSFire.glb`,
      reload:   `${A}/SAShotgun/Anim_Mann_SAS_TacReloading.glb`,
      run:      `${A}/SAShotgun/Anim_Mann_SAS_Running.glb`,
      sprint:   `${A}/SAShotgun/Anim_Mann_SAS_Sprinting_V1.glb`,
      jump:     `${A}/SAShotgun/Anim_Mann_SAS_Jumping.glb`,
      inspect:  `${A}/SAShotgun/Anim_Mann_SAS_Inspection.glb`,
      melee:    `${A}/SAShotgun/Anim_Mann_SAS_CCombat.glb`,
      raise:    `${A}/SAShotgun/Anim_Mann_SAS_GunRaise.glb`,
      lower:    `${A}/SAShotgun/Anim_Mann_SAS_GunLower.glb`,
    },
  },

  // ── Revolver (HS_WeaponPack_03) ───────────────────────────────────────────
  // DIFFÉRENCE avec les fusils : ce pack ne livre PAS d'animations de bras.
  // `arms` reprend donc les clips de l'ARME. Le viewmodel affichera le
  // revolver animé sans mouvement de bras propre — c'est mieux qu'un revolver
  // figé, et honnête sur ce qui existe.
  //
  // Deux entrées : le pack fournit deux variantes de mesh (X et Y), toutes
  // deux déjà déclarées dans weaponCatalog. Elles partagent leurs animations.
  ...["X", "Y"].map((v) => ({
    weaponPath: `${REV}/SK_HS_WP03_Revolver_${v}_0.glb`,
    label: `Revolver ${v}`,
    weapon: {
      idleHip: `${REV}/Animations/AS_HS_WP03_Revolver_ReadyToFire.glb`,
      hipFire: `${REV}/Animations/AS_HS_WP03_Revolver_Fire.glb`,
      reload:  `${REV}/Animations/AS_HS_WP03_Revolver_Reload.glb`,
    },
    arms: {
      idleHip: `${REV}/Animations/AS_HS_WP03_Revolver_ReadyToFire.glb`,
      hipFire: `${REV}/Animations/AS_HS_WP03_Revolver_Fire.glb`,
      reload:  `${REV}/Animations/AS_HS_WP03_Revolver_Reload.glb`,
    },
  })),
];

export const FPS_ARMS_MESH = `${CG}/Demo/Character/Mesh/SK_Mannequin_Arms.glb`;

export function getShotgunFps(weaponPath: string): ShotgunFpsEntry | undefined {
  return SHOTGUN_FPS_REGISTRY.find((e) => e.weaponPath === weaponPath);
}

/** Même chose, sous un nom qui ne ment plus sur le contenu du registre. */
export const getWeaponFps = getShotgunFps;
