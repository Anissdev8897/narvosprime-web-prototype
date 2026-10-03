// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/bindFit.ts — Ajuster une pièce aux proportions du corps.
//
// LE PROBLÈME
// `boneRemap` fait suivre la pièce au bon squelette, mais ne change RIEN à sa
// géométrie. Une tête modelée sur un rig de 1,10 fois la taille du mannequin
// reste trop grande : elle suit correctement, elle flotte au-dessus du cou.
// Écarts mesurés le 02/08/2026 (rapport bassin→tête face au mannequin Biker) :
//
//   boris 0,618 · steel 0,696 · murdock 0,981 · samurai 0,980 · wraith 1,099 · echo 1,136
//
// LA SOLUTION : REPOSITIONNER LA POSE DE BIND
// Pour chaque os source `i` apparié à l'os cible `j`, on compose
//
//     ajustement_i = poseMondeBind(cible_j) × inverseBind(source_i)
//
// La partie droite envoie un sommet de l'espace du modèle source vers l'espace
// LOCAL de son os ; la gauche le ramène dans l'espace du modèle cible, à la
// place qu'occupe l'os d'accueil. Chaque sommet est ensuite déplacé par le
// mélange pondéré des ajustements de ses quatre influences — exactement la
// combinaison qu'utilisera le skinning ensuite, donc sans discontinuité aux
// frontières.
//
// C'est un ajustement NON UNIFORME : des jambes plus longues et un torse plus
// court sont corrigés séparément, ce qu'une simple mise à l'échelle globale ne
// sait pas faire.
//
// ⚠ ORDRE OBLIGATOIRE : `applyFit` lit `skinIndex` dans la numérotation SOURCE.
// Il doit tourner AVANT `applyRemapToSkinIndex`, qui réécrit ces indices vers
// la numérotation cible. Inversé, chaque sommet serait déplacé par l'ajustement
// d'un os arbitraire.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { BoneRemap } from "./boneRemap";

const INFLUENCES = 4;

/**
 * Matrice d'ajustement par os SOURCE. Identité pour un os non apparié : ses
 * sommets ne bougent pas, et leur poids sera de toute façon neutralisé par
 * `zeroUnmatchedWeights`.
 */
export function computeFitMatrices(
  source: THREE.Skeleton,
  target: THREE.Skeleton,
  remap: BoneRemap,
): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  // La pose monde de bind est l'inverse de l'« inverse bind » — on la calcule
  // une fois par os cible plutôt qu'une fois par os source apparié.
  const targetBind: (THREE.Matrix4 | null)[] = target.boneInverses.map((inv) =>
    inv ? inv.clone().invert() : null,
  );

  for (let i = 0; i < source.bones.length; i++) {
    const j = i < remap.length ? remap[i] : -1;
    const srcInv = source.boneInverses[i];
    const tgt = j >= 0 ? targetBind[j] : null;
    out.push(tgt && srcInv ? tgt.clone().multiply(srcInv) : new THREE.Matrix4());
  }
  return out;
}

/**
 * Déplacement maximal induit par un jeu d'ajustements, en unités monde.
 *
 * Sert de diagnostic à l'UI : « cette pièce sera fortement retaillée ». Un
 * ajustement nul (toutes matrices identité) signale au contraire deux rigs déjà
 * alignés — c'est le cas des pièces d'un même pack.
 */
export function maxFitDisplacement(mats: THREE.Matrix4[]): number {
  const v = new THREE.Vector3();
  let max = 0;
  for (const m of mats) {
    v.setFromMatrixPosition(m);
    max = Math.max(max, v.length());
  }
  return max;
}

/**
 * Déplace positions et normales d'une géométrie vers la pose de bind cible.
 *
 * Mute la géométrie EN PLACE — l'appelant doit lui passer un clone, jamais
 * l'original issu du cache de `useGLTF`.
 *
 * @returns nombre de sommets effectivement déplacés
 */
/** k-ième composante (0..3) d'un attribut à 4 canaux, entrelacé ou non. */
function composante(
  a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  v: number,
  k: number,
): number {
  return k === 0 ? a.getX(v) : k === 1 ? a.getY(v) : k === 2 ? a.getZ(v) : a.getW(v);
}

export function applyFit(geometry: THREE.BufferGeometry, mats: THREE.Matrix4[]): number {
  const posAttr = geometry.getAttribute("position");
  const idxAttr = geometry.getAttribute("skinIndex");
  const wAttr = geometry.getAttribute("skinWeight");
  if (!posAttr || !idxAttr || !wAttr) return 0;

  const nrmAttr = geometry.getAttribute("normal");

  // ⚠ NI LECTURE NI ÉCRITURE VIA `.array` ────────────────────────────────────
  //
  // Sur une géométrie ENTRELACÉE, `.array` est le tampon PARTAGÉ : positions,
  // normales, UV, joints et poids y sont imbriqués. Indexer `pos[v * 3]` y lit
  // donc n'importe quoi, et y ÉCRIRE disperse les sommets dans les attributs
  // voisins — le maillage part en éclats noirs, symptôme observé en jeu.
  //
  // Les accesseurs `getX/setX…` connaissent `offset` et `stride`. Ils sont
  // justes dans les deux cas, et c'est le seul accès admis ici.
  const count = posAttr.count;
  const src = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const accN = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let moved = 0;

  for (let v = 0; v < count; v++) {
    src.set(posAttr.getX(v), posAttr.getY(v), posAttr.getZ(v));
    acc.set(0, 0, 0);
    accN.set(0, 0, 0);
    let sum = 0;

    for (let k = 0; k < INFLUENCES; k++) {
      const weight = composante(wAttr, v, k);
      if (weight <= 0) continue;
      const bone = composante(idxAttr, v, k);
      const m = mats[bone];
      if (!m) continue;

      // Mélange des RÉSULTATS et non des matrices : moyenner des matrices de
      // rotation produit une matrice non orthogonale qui écrase la géométrie
      // sur les zones à plusieurs influences (épaules, hanches).
      tmp.copy(src).applyMatrix4(m);
      acc.addScaledVector(tmp, weight);

      if (nrmAttr) {
        tmp.set(nrmAttr.getX(v), nrmAttr.getY(v), nrmAttr.getZ(v)).transformDirection(m);
        accN.addScaledVector(tmp, weight);
      }
      sum += weight;
    }

    // Sommet sans influence exploitable : on le laisse où il est plutôt que de
    // le renvoyer à l'origine, ce qui produirait une pointe vers le centre.
    if (sum <= 0) continue;

    acc.divideScalar(sum);
    if (acc.distanceToSquared(src) > 1e-12) moved++;
    posAttr.setXYZ(v, acc.x, acc.y, acc.z);

    if (nrmAttr && accN.lengthSq() > 1e-12) {
      accN.normalize();
      nrmAttr.setXYZ(v, accN.x, accN.y, accN.z);
    }
  }

  posAttr.needsUpdate = true;
  if (nrmAttr) nrmAttr.needsUpdate = true;
  return moved;
}
