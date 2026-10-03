// ══════════════════════════════════════════════════════════════════════════════
// runtime/debug/CollisionDebugOverlay.tsx — Visualisation de la capsule joueur
//
// Affiche en wireframe la capsule de collision du joueur (radius/height live)
// + un vecteur "forward" pour vérifier l'orientation. Couleurs :
//   • Vert  : perso au sol (grounded)
//   • Jaune : perso en l'air (jump/fall)
//
// Ne fait rien si le toggle debugCollisions est OFF. À placer DANS le <Canvas>.
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLAYER_CONFIG as C } from "../movement/playerConfig";
import type { PlayerState } from "../movement/playerState";
import { useDebugCollisions } from "./useDebugCollisions";

interface CollisionDebugOverlayProps {
  playerPosition: MutableRefObject<THREE.Vector3>;
  state: MutableRefObject<PlayerState>;
}

export function CollisionDebugOverlay({ playerPosition, state }: CollisionDebugOverlayProps) {
  const enabled = useDebugCollisions();
  const groupRef = useRef<THREE.Group>(null);
  const capsuleRef = useRef<THREE.Mesh>(null);

  // Réutilise un material wireframe (matériau partagé entre frames)
  const wireMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x46d160,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
  }), []);

  // Géométrie capsule de référence (1m × 0.35m), redimensionnée à chaque frame
  // pour suivre le scale live du perso (sans recréer la geometry).
  const capsuleGeo = useMemo(() => {
    return new THREE.CapsuleGeometry(1, 1, 4, 12);
  }, []);

  useFrame(() => {
    if (!enabled) return;
    const g = groupRef.current;
    const cap = capsuleRef.current;
    if (!g || !cap) return;

    const p = playerPosition.current;
    const h = C.height;
    const r = C.radius;

    // CapsuleGeometry est centrée sur Y=0 (haut/bas symétrique).
    // On le remonte de h/2 pour que sa BASE soit au sol (= position du perso).
    g.position.set(p.x, p.y + h / 2, p.z);
    // Le radius est appliqué via scale uniforme (X/Z), la hauteur via scale Y.
    // CapsuleGeometry(1, 1, ...) a un rayon de 1 et une "hauteur de cylindre" de 1
    // (donc hauteur totale = 1 + 2 * 1 = 3). On scale pour obtenir h × r.
    cap.scale.set(r, (h - 2 * r) / 2, r);

    // Couleur : vert si au sol, jaune si en l'air
    const mat = cap.material as THREE.MeshBasicMaterial;
    mat.color.setHex(state.current.grounded ? 0x46d160 : 0xfbbf24);
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef}>
      <mesh ref={capsuleRef} geometry={capsuleGeo} material={wireMat} renderOrder={999} />
    </group>
  );
}
