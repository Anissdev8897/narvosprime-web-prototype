// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/HairOnBody.tsx — Une coiffure posée sur le mannequin nu.
//
// PREMIER VRAI PARTAGE DE SQUELETTE du projet. La pratique documentée par Epic
// et par three est la même : plusieurs `SkinnedMesh` doivent partager UNE SEULE
// instance de `Skeleton`, avec les mêmes noms d'os. C'est ce que le portage
// 53 → 89 os a rendu possible — avant, la coiffure et le corps ne partageaient
// que 52 os sur 89.
//
// `rebindSkinnedMesh` fait le gros œuvre : appariement des noms, traduction des
// indices, mise à zéro puis renormalisation des influences non résolues, et le
// bind en `AttachedBindMode`. Il REFUSE en dessous de 50 % de couverture PAR
// POIDS — c'est lui qui tranche la compatibilité, pas le catalogue. Une
// coiffure dont les os d'avant-bras Biker ne trouvent pas de correspondance
// passe donc quand même : ces os ne portent aucun poids sur des cheveux.
//
// ⚠ LE MODE DE BIND EST `Attached`, ET C'EST UN CORRECTIF, PAS UN DÉFAUT.
// En `Detached`, `bindMatrixInverse` est figé et n'annule plus la `matrixWorld`
// du mesh : la transform du `<Stage>` de drei était alors appliquée deux fois à
// la coiffure et une seule au corps, qui est resté attaché — d'où la chevelure
// à hauteur de hanche. Verrouillé par `hairPlacement.test.ts`, qui monte la
// scène sous un ancêtre TRANSFORMÉ ; à l'identité le défaut est invisible.
//
// ⚠ LIMITE CONNUE, ET ELLE SE VOIT. La coiffure suit l'OS `head`. Or les morphs
// déplacent la PEAU sans déplacer les os — un crâne rétréci laissera la
// chevelure là où elle était. Corriger cela demande de recalculer les positions
// d'os depuis les joint cubes MPFB après chaque passe de morphs (l'étape 5 du
// portage, jamais faite). Tant qu'elle manque, éviter les extrêmes de `head`.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { collectSkinnedMeshes, rebindSkinnedMesh } from "./rebindSkinnedMesh";

export interface HairOnBodyProps {
  /** Chemin du GLB de coiffure (cf. `hairCatalog`). */
  path: string;
  /** Squelette du mannequin — PARTAGÉ, pas copié. */
  skeleton: THREE.Skeleton;
  /** Teinte appliquée à la chevelure. */
  color?: string;
  /** Prévenu quand la pièce est refusée, avec la raison mesurée. */
  onIncompatible?: (raison: string) => void;
}

export function HairOnBody({ path, skeleton, color = "#2b1d16", onIncompatible }: HairOnBodyProps) {
  const { scene } = useGLTF(path);
  const [refus, setRefus] = useState<string | null>(null);

  const monte = useMemo(() => {
    // Cloner AVANT tout : `useGLTF` met la scène en cache et plusieurs aperçus
    // peuvent la partager. Rebinder l'original corromprait le cache.
    const racine = SkeletonUtils.clone(scene) as THREE.Object3D;
    const meshes = collectSkinnedMeshes(racine);
    if (meshes.length === 0) return { racine, refus: "aucun mesh skinné" };

    const echecs: string[] = [];
    for (const m of meshes) {
      const r = rebindSkinnedMesh(m, skeleton);
      if (!r.ok) echecs.push(r.reason ?? "refus sans raison");
      // Matériau neuf par exemplaire : `SkeletonUtils.clone` NE clone PAS les
      // matériaux, et deux aperçus partageraient sinon leur couleur.
      m.material = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
      m.castShadow = true;
      m.frustumCulled = false;   // la tête sort souvent du volume calculé au bind
    }
    // Tous refusés = la pièce ne va pas à ce corps. Un seul refus sur plusieurs
    // meshes reste exploitable : c'est souvent un accessoire cousu à part.
    return { racine, refus: echecs.length === meshes.length ? echecs[0] : null };
  }, [scene, skeleton]);

  useEffect(() => {
    setRefus(monte.refus);
    if (monte.refus) onIncompatible?.(monte.refus);
    // `onIncompatible` hors dépendances : c'est une notification, pas une entrée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monte]);

  useEffect(() => {
    monte.racine.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      if (mat?.isMaterial) mat.color.set(color);
    });
  }, [monte, color]);

  useEffect(() => () => {
    monte.racine.traverse((o) => {
      const m = o as THREE.Mesh;
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
  }, [monte]);

  // Une pièce refusée n'est pas rendue : l'afficher quand même produirait le
  // maillage en éventail qu'on cherche justement à ne plus voir.
  if (refus) return null;
  return <primitive object={monte.racine} />;
}
