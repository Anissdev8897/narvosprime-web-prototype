// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/rebindSkinnedMesh.ts — Lie une pièce au squelette du corps.
//
// Couche Three.js par-dessus boneRemap (logique pure). Trois étapes :
//   1. traduire les skinIndex vers l'ordre d'os du squelette CIBLE
//   2. neutraliser + renormaliser les poids sans équivalent
//   3. `bind()` sur le squelette partagé
//
// APRÈS ÇA, TOUTES LES PIÈCES SUIVENT LE MÊME SQUELETTE : une seule animation
// pilote le corps, la veste, le jean et les bottes simultanément. C'est le
// mécanisme des créateurs de personnages modulaires.
//
// ⚠ NE PAS confondre avec le retargeting d'ANIMATION (animation/mixamoRetarget).
// Ici on adapte une GÉOMÉTRIE à un squelette ; là-bas on adapte des PISTES à un
// squelette. Les deux utilisent le même hub d'emplacements humanoïdes.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { buildBoneRemap, applyRemapToSkinIndex, zeroUnmatchedWeights, weightedCoverage } from "./boneRemap";
import { computeFitMatrices, applyFit, maxFitDisplacement } from "./bindFit";

export interface RebindResult {
  ok: boolean;
  /** Part du POIDS de skinning qui atterrit sur un os apparié (0..1). */
  coverage: number;
  /** Taux d'os appariés par NOM — diagnostic seulement, ne décide de rien. */
  nameCoverage: number;
  /** Influences rabattues faute d'équivalent (poids mis à 0). */
  droppedInfluences: number;
  /** Os de la pièce sans correspondance — utile au diagnostic d'un pack. */
  unmatched: string[];
  /** Déplacement maximal appliqué pour ajuster la pièce (unités monde). */
  fitDisplacement: number;
  reason?: string;
}

/**
 * Seuil sous lequel on REFUSE de lier : en dessous, la pièce appartient
 * visiblement à un autre squelette et l'assemblage produirait un maillage
 * déchiré. Mieux vaut ne rien afficher qu'afficher un monstre.
 *
 * ⚠ Appliqué au poids apparié, PAS au nombre d'os appariés — cf.
 * `weightedCoverage`. Sur le critère par noms, 26 des 39 pièces découpées
 * étaient refusées, dont `wraith/torso` qui suit pourtant à 100 %. Sur le
 * critère par poids : 8 refus, tous des têtes à rig facial.
 */
export const MIN_COVERAGE = 0.5;

/**
 * Re-lie `mesh` sur `targetSkeleton`, en place.
 *
 * La géométrie est CLONÉE avant modification : les GLB passent par le cache de
 * drei/useGLTF et sont partagés entre instances — muter l'original corromprait
 * toutes les autres utilisations de la même pièce.
 */
export function rebindSkinnedMesh(
  mesh: THREE.SkinnedMesh,
  targetSkeleton: THREE.Skeleton,
): RebindResult {
  const srcSkeleton = mesh.skeleton;
  const vide = { nameCoverage: 0, droppedInfluences: 0, unmatched: [], fitDisplacement: 0 };
  if (!srcSkeleton || srcSkeleton.bones.length === 0) {
    return { ok: false, coverage: 0, ...vide, reason: "pièce sans squelette" };
  }

  const srcNames = srcSkeleton.bones.map((b) => b.name);
  const tgtNames = targetSkeleton.bones.map((b) => b.name);
  const { remap, unmatched, coverage: nameCoverage } = buildBoneRemap(srcNames, tgtNames);

  const geom = mesh.geometry.clone();
  // ⚠ NE JAMAIS LIRE `.array` D'UN ATTRIBUT DE GÉOMÉTRIE ICI ─────────────────
  //
  // Sur une géométrie ENTRELACÉE, `getAttribute("skinIndex")` rend un
  // `InterleavedBufferAttribute` dont `.array` est le TAMPON PARTAGÉ entier —
  // positions, normales, UV, joints et poids mélangés. On lisait donc des
  // valeurs arbitraires : la plupart dépassent le nombre d'os, n'étaient pas
  // comptées, et la couverture s'effondrait.
  //
  // Symptôme mesuré : `samurai_hair` refusé à 17 % de poids alors que le même
  // fichier donne 100 % hors ligne (`scripts/check-weight-coverage.mjs`), avec
  // 100 % de noms appariés — deux chiffres qui ne peuvent pas coexister.
  //
  // Les accesseurs `getX..getW` connaissent `offset` et `stride` : ils lisent
  // juste, entrelacé ou non.
  const aplatir = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number[] => {
    const out: number[] = new Array(a.count * 4);
    for (let i = 0; i < a.count; i++) {
      out[i * 4] = a.getX(i);
      out[i * 4 + 1] = a.getY(i);
      out[i * 4 + 2] = a.getZ(i);
      out[i * 4 + 3] = a.getW(i);
    }
    return out;
  };

  const idxAttr = geom.getAttribute("skinIndex");
  const wAttr = geom.getAttribute("skinWeight");
  if (!idxAttr || !wAttr) {
    return {
      ok: false, coverage: 0, ...vide, nameCoverage, unmatched,
      reason: "geometry sans skinIndex/skinWeight",
    };
  }

  // Le verdict se prend sur le POIDS apparié, pas sur le nombre d'os appariés :
  // un twist non apparié qui ne porte rien ne doit pas condamner la pièce.
  const coverage = weightedCoverage(aplatir(idxAttr), aplatir(wAttr), remap);
  if (coverage < MIN_COVERAGE) {
    // ── POURQUOI LE SQUELETTE D'ACCUEIL EST NOMMÉ DANS LE REFUS ───────────────
    //
    // `audit-part-compat.mjs` mesure les MÊMES paires hors ligne et sort des
    // chiffres très différents (wraith/head : 100 % à l'audit, 23 % ici). Or
    // l'audit apparie par NOM EXACT tandis qu'ici `buildBoneRemap` ajoute les
    // slots humanoïdes et le repli par ancêtre : le runtime est le PLUS
    // permissif des deux, il ne peut donc pas rendre moins.
    //
    // Un matcher plus généreux qui rend moins ne s'explique pas par le matcher.
    // Reste une hypothèse : les deux ne comparent pas au même squelette. Sans
    // son identité dans le message, le refus est indiscutable — on lit un
    // pourcentage sans savoir contre QUOI il a été calculé.
    const racine = targetSkeleton.bones[0]?.name ?? "?";
    return {
      ok: false, coverage, ...vide, nameCoverage, unmatched,
      reason:
        `${(coverage * 100).toFixed(0)}% du poids apparié < ${MIN_COVERAGE * 100}% — squelettes incompatibles ` +
        `[accueil: "${racine}" ${tgtNames.length} os · pièce: ${srcNames.length} os · noms appariés ${(nameCoverage * 100).toFixed(0)}%]`,
    };
  }

  // AJUSTEMENT — avant toute réécriture d'indices : `applyFit` lit `skinIndex`
  // dans la numérotation SOURCE. Après `applyRemapToSkinIndex`, chaque sommet
  // serait déplacé par la matrice d'un os arbitraire.
  const fitMats = computeFitMatrices(srcSkeleton, targetSkeleton, remap);
  applyFit(geom, fitMats);
  const fitDisplacement = maxFitDisplacement(fitMats);

  // On garde une copie des indices D'ORIGINE : zeroUnmatchedWeights doit savoir
  // quelles influences étaient non résolues, ce que la traduction efface.
  //
  // Même écueil qu'au calcul de couverture, en PIRE : ces deux passes ÉCRIVENT.
  // Sur une géométrie entrelacée, `.array` désigne le tampon partagé — écrire
  // dedans aux offsets d'un attribut à 4 composantes écraserait positions,
  // normales et UV. On travaille donc sur des copies plates, puis on réinjecte
  // par `setXYZW`, qui connaît `offset` et `stride`.
  const originalIndex = aplatir(idxAttr);
  const idxPlat = Float32Array.from(originalIndex);
  const wPlat = Float32Array.from(aplatir(wAttr));

  const dropped = applyRemapToSkinIndex(idxPlat, remap, 0);
  zeroUnmatchedWeights(originalIndex, wPlat, remap);

  for (let i = 0; i < idxAttr.count; i++) {
    idxAttr.setXYZW(i, idxPlat[i * 4], idxPlat[i * 4 + 1], idxPlat[i * 4 + 2], idxPlat[i * 4 + 3]);
    wAttr.setXYZW(i, wPlat[i * 4], wPlat[i * 4 + 1], wPlat[i * 4 + 2], wPlat[i * 4 + 3]);
  }
  idxAttr.needsUpdate = true;
  wAttr.needsUpdate = true;

  mesh.geometry = geom;

  // ── PARTAGE DE SQUELETTE : AttachedBindMode + bindMatrix IDENTITÉ ─────────
  //
  // La pièce partage l'espace monde du squelette d'accueil : elle est montée
  // dans la MÊME scène que lui, en frère ou en enfant. C'est le critère qui
  // départage les deux modes de three — pas le fait de partager une instance
  // de `Skeleton`.
  //
  // ⚠ CE FUT `DetachedBindMode`, ET C'ÉTAIT LE BUG « cheveux à la hanche ».
  //
  // `SkinnedMesh.updateMatrixWorld` ne traite pas les deux modes pareil :
  //
  //   AttachedBindMode : bindMatrixInverse = inverse(matrixWorld)  ← chaque frame
  //   DetachedBindMode : bindMatrixInverse = inverse(bindMatrix)   ← figé
  //
  // Le rendu calcule `matrixWorld × bindMatrixInverse × Σ(os) × bindMatrix × v`.
  // En mode ATTACHÉ, `matrixWorld` et son inverse s'annulent : le résultat ne
  // dépend QUE des os, donc la pièce est immunisée contre la transform de ses
  // ancêtres — exactement comme le corps, qui est resté attaché et qui, lui,
  // s'affichait juste. En mode DÉTACHÉ avec une bindMatrix identité, plus rien
  // n'annule `matrixWorld` : la transform de l'ancêtre est appliquée DEUX fois
  // à la pièce et une seule au corps.
  //
  // Or les deux montages en ont un : `ForgePersonnages` passe par le `<Stage>`
  // de drei (qui recentre et met à l'échelle), `ModularCharacter` par un
  // `<group scale={[scale * girth, scale, scale * girth]}>`. Mesuré sous
  // translate −0,83 puis scale 1,2 : chevelure à 0,354 m au lieu de 0,987 m,
  // soit 63 cm trop bas, et rétrécie par la seconde mise à l'échelle.
  //
  // À l'identité le défaut est INVISIBLE — d'où `hairPlacement.test.ts`, qui
  // impose un ancêtre transformé.
  //
  // La bindMatrix reste l'IDENTITÉ : les sommets de la pièce sont dans son
  // espace de bind, et `boneInverses` (ceux du squelette d'accueil) attend
  // précisément cet espace. C'est aussi ce que prescrit glTF — la transform du
  // nœud d'un mesh skinné doit être ignorée, ce que le mode attaché fait ici.
  mesh.bindMode = THREE.AttachedBindMode;
  mesh.bind(targetSkeleton, new THREE.Matrix4());

  return { ok: true, coverage, nameCoverage, droppedInfluences: dropped, unmatched, fitDisplacement };
}

/**
 * Extrait les SkinnedMesh d'une scène GLB chargée (une pièce peut en contenir
 * plusieurs : corps + accessoire cousu dans le même fichier).
 */
export function collectSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) out.push(m);
  });
  return out;
}

/**
 * Compare deux poses de bind. Sert de GARDE-FOU avant d'assembler des pièces
 * venues de packs différents : un écart significatif signifie des proportions
 * différentes, donc une déformation garantie si on les mélange.
 *
 * Retourne l'écart maximal (unités monde) sur les os communs.
 */
export function bindPoseDelta(a: THREE.Skeleton, b: THREE.Skeleton): number {
  const posOf = (sk: THREE.Skeleton) => {
    const m = new Map<string, THREE.Vector3>();
    for (let i = 0; i < sk.bones.length; i++) {
      const inv = sk.boneInverses[i];
      if (!inv) continue;
      const p = new THREE.Vector3().setFromMatrixPosition(inv);
      m.set(sk.bones[i].name, p);
    }
    return m;
  };
  const pa = posOf(a), pb = posOf(b);
  let max = 0;
  for (const [name, va] of pa) {
    const vb = pb.get(name);
    if (!vb) continue;
    max = Math.max(max, va.distanceTo(vb));
  }
  return max;
}
