// props/PlacedPropMesh.tsx — composant R3F qui charge et affiche un prop GLB placé.
// Clone la scène pour permettre plusieurs instances du même modèle sans conflit.
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";
import { qualityVariant } from "../loaders/assetQuality";
import { mapLoaderExtend } from "../loaders/sharedLoaders";
import { collisionWorld } from "../runtime/CollisionWorld";

interface Props {
  /** Chemin vers le fichier GLB (relatif à public/). */
  path: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/**
 * Charge un GLB via drei et l'affiche à la transform donnée.
 * Utilise qualityVariant() pour respecter le réglage qualité.
 * Le clone deep évite les conflits quand le même prop est placé plusieurs fois.
 */
export function PlacedPropMesh({ path, position, rotation, scale }: Props) {
  // mapLoaderExtend attache Draco ET KTX2. Draco était déjà couvert (drei crée
  // son propre DRACOLoader), mais KTX2 ne l'était pas — ce qui interdisait toute
  // compression des textures de props. Or c'est exactement ce dont ils ont
  // besoin : mesuré, une seule caisse embarque 12 textures 4096² (~1 Go de
  // VRAM), et la saturation provoque la perte de contexte WebGL qui déclenche
  // l'invite « recharger le jeu ».
  const { scene } = useGLTF(qualityVariant(path), true, true, mapLoaderExtend);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  // ── Collision ────────────────────────────────────────────────────────────
  // Les props placés n'étaient PAS solides : ce composant les affichait sans
  // jamais les déclarer au collisionWorld. Le joueur traversait donc tout ce
  // qui venait du PropPlacer — murs, caisses, structures — alors que le décor
  // de la Forge (ForgeBuiltMap) était bien enregistré.
  //
  // `updateMatrixWorld(true)` AVANT l'enregistrement est obligatoire : le BVH
  // lit la transform MONDE. Sans ça, l'arbre de collision serait construit sur
  // la position d'origine du GLB, pas sur celle du prop placé — le mur bloquerait
  // à l'endroit où il n'est pas.
  useEffect(() => {
    cloned.position.set(position[0], position[1], position[2]);
    cloned.rotation.set(rotation[0], rotation[1], rotation[2]);
    cloned.scale.set(scale[0], scale[1], scale[2]);
    cloned.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      // `noCollide` laisse au concepteur le moyen de poser un décor traversable
      // (végétation, effets) sans le rendre bloquant.
      if (m.isMesh && !m.userData?.noCollide) meshes.push(m);
    });
    for (const m of meshes) collisionWorld.add(m);

    // Retrait au démontage : un prop supprimé dans l'éditeur laisserait sinon un
    // mur invisible derrière lui.
    return () => { for (const m of meshes) collisionWorld.remove(m); };
  }, [cloned, position, rotation, scale]);

  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
}
