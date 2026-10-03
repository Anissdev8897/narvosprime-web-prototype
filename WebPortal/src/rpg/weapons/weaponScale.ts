// weapons/weaponScale.ts — "WeaponScaleSystem" : dimensionnement AUTO des armes.
//
// Les fichiers d'arme (FBX/GLB) ont des échelles sources incohérentes (cm, m…) → un
// scale fixe (0.01) donne des armes géantes ou minuscules. On mesure la bounding-box
// de l'arme et on la ramène à une TAILLE CIBLE en mètres selon son TYPE. Le socket
// d'attache annule déjà l'échelle du rig → ces tailles sont en mètres « monde »,
// donc cohérentes pour tout personnage. Réglage manuel (admin 🔧) prioritaire.

import * as THREE from "three";
import type { WeaponType } from "./weaponClassifier";

/** Plus grande dimension cible (m) par type d'arme — relatif à un perso ~1,8 m. */
export const WEAPON_TARGET_SIZE: Record<WeaponType, number> = {
  sword_1h: 0.95,
  sword_2h: 1.25,
  dagger:   0.40,
  axe:      0.95,
  blunt:    1.00,
  spear:    2.00,
  bow:      1.40,
  staff:    1.60,
  gun:      0.45,
  shield:   0.70,
  ammo:     0.30,
  throwable:0.30,
  // Un clip d'animation n'a pas de taille utile : il n'est jamais monté sur
  // un socket. La valeur n'est là que pour satisfaire l'exhaustivité du type.
  clip:     0.00,
  ignore:   0.60,
};

/**
 * Échelle pour que la plus grande dimension de l'arme corresponde à la taille cible
 * de son type. `obj` = arme clonée NON encore mise à l'échelle (mesure native).
 */
export function autoWeaponScale(obj: THREE.Object3D, type: WeaponType): number {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const target = WEAPON_TARGET_SIZE[type] ?? 0.6;
  return target / maxDim;
}
