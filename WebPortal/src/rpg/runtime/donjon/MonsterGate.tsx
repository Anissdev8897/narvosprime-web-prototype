// runtime/donjon/MonsterGate.tsx — mur d'énergie VIOLET scellant le couloir du boss.
//
// Monté tant que la salle n'est pas nettoyée → ajoute son mesh au collisionWorld
// (bloque le joueur). Démonté à l'ouverture → retire le collider (passage libre).
// Position en coordonnées JEU (Y up) : couloir nord menant à l'Antre du chef.
// ⚠ Si le mur apparaît dans le mauvais couloir, inverser le signe de Z dans GATE_POS.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { collisionWorld } from "../CollisionWorld";

const GATE_POS: [number, number, number] = [0, 2.6, -22];
const GATE_SIZE: [number, number, number] = [5.5, 5.2, 0.6];

export function MonsterGate() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    collisionWorld.add(m);                 // bloque le passage tant que monté
    return () => collisionWorld.remove(m); // ouverture → passage libre
  }, []);

  useFrame((state) => {
    if (mat.current) {
      const t = state.clock.elapsedTime;
      mat.current.opacity = 0.4 + 0.18 * Math.sin(t * 2.2);
      mat.current.emissiveIntensity = 1.8 + 1.0 * Math.sin(t * 3.3);
    }
  });

  return (
    <mesh ref={mesh} position={GATE_POS}>
      <boxGeometry args={GATE_SIZE} />
      <meshStandardMaterial
        ref={mat}
        color="#7a18d0"
        emissive="#c040ff"
        emissiveIntensity={2}
        transparent
        opacity={0.45}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
