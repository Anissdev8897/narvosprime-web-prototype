// ══════════════════════════════════════════════════════════════════════════════
// characters/builtinWeaponMask.ts — Masque l'arme FUSIONNÉE d'un avatar.
//
// LE PROBLÈME, MESURÉ :
// Les avatars Paragon sortent avec leur arme intégrée au modèle. Wraith porte
// 18 614 triangles de canon, Murdock 17 044 triangles d'armes. Résultat en jeu :
// deux armes visibles dès qu'on en équipe une, et une main figée sur une
// préhension que les animations ne peuvent plus contredire.
//
// CE QUI REND LA CHOSE RÉPARABLE :
// L'arme n'est PAS noyée dans le maillage du corps. Chaque avatar n'a qu'un
// nœud de mesh, mais ce mesh a plusieurs PRIMITIVES, chacune avec son propre
// matériau :
//
//     Wraith  : Lowerbody · Upperbody · Backpack · Gun
//     Murdock : Body · Head · Arms · Legs · Weapons · (yeux, visière…)
//
// Et glTF → Three.js transforme un mesh à N primitives en un `Group` de N
// `Mesh` enfants. L'arme intégrée est donc un objet à part entière dans la
// scène, qu'on peut masquer sans toucher à la géométrie.
//
// C'est pour ça qu'on NE SUPPRIME PAS ces avatars du choix de personnage : le
// défaut est réparable au runtime, en une propriété.
// ══════════════════════════════════════════════════════════════════════════════

import type * as THREE from "three";

/**
 * Matériaux d'armes intégrées, tels qu'ils sortent d'Unreal.
 *
 * Volontairement ANCRÉ sur la convention Paragon `M_<Perso>_<Partie>_<Perso>` :
 * on exige un séparateur avant. Le séparateur après peut être `_` (token
 * isolé comme `_Gun_`) ou une majuscule CamelCase (`_WeaponExecutioner_`).
 *
 * ÉCRIT SANS LE FLAG `/i` pour que `[A-Z]` reste sensible à la casse et ne
 * déclenche pas sur `_Gunmetal_` (m minuscule après le mot-clé).
 *
 * Ne s'applique qu'au sous-arbre de l'avatar : l'arme réellement équipée est un
 * objet séparé, attaché à un os, et ne passe jamais par ici.
 */
const ARME_INTEGREE_RE =
  /_([Gg][Uu][Nn]|[Ww][Ee][Aa][Pp][Oo][Nn][Ss]?|[Rr][Ii][Ff][Ll][Ee]|[Pp][Ii][Ss][Tt][Oo][Ll]|[Bb][Ll][Aa][Dd][Ee]|[Ss][Ww][Oo][Rr][Dd])(?:_|[A-Z])/;

export function isBuiltinWeaponMaterial(name: string | undefined): boolean {
  return !!name && ARME_INTEGREE_RE.test(name);
}

/**
 * Affiche ou masque l'arme intégrée d'un avatar.
 *
 * @returns le nombre de meshes touchés — 0 signale un motif qui n'attrape rien,
 *          ce qui est exactement ce qu'on veut voir en console plutôt que de
 *          supposer que ça a marché.
 */
export function setBuiltinWeaponVisible(root: THREE.Object3D, visible: boolean): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Un mesh issu d'une primitive glTF n'a QU'UN matériau. Si plusieurs
    // apparaissent, c'est un mesh fusionné en aval : on ne le masque que si
    // TOUS ses matériaux sont des armes, sinon on cacherait du corps avec.
    if (mats.length === 0) return;
    if (!mats.every((m) => m && isBuiltinWeaponMaterial(m.name))) return;
    mesh.visible = visible;
    n++;
  });
  return n;
}
