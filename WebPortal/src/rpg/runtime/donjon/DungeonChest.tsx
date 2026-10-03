// donjon/DungeonChest.tsx — coffre de fin de donjon (apparaît à la mort du boss).
//
// Mesh simple + halo, s'ouvre par PROXIMITÉ (< 2,2 m) : une seule fois (latch), puis
// l'appelant roll les récompenses et clôt le run. Pas de dépendance E/interact → zéro
// câblage d'input supplémentaire.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

interface Props {
  position: [number, number, number];
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  onOpen: () => void;
}

export function DungeonChest({ position, playerPosition, onOpen }: Props) {
  const opened = useRef(false);
  const lidRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    // Flottement du halo (signal visuel "viens me chercher").
    if (lidRef.current) lidRef.current.rotation.y += dt * 0.8;
    if (opened.current) return;
    const p = playerPosition.current;
    const dx = p.x - position[0], dz = p.z - position[2];
    if (dx * dx + dz * dz < 2.2 * 2.2) {
      opened.current = true; // latch : une seule ouverture
      onOpen();
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.1, 0.7, 0.8]} />
        <meshStandardMaterial color="#6b4a1f" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh ref={lidRef} position={[0, 1.25, 0]}>
        <torusGeometry args={[0.45, 0.05, 8, 24]} />
        <meshBasicMaterial color="#ffd24d" transparent opacity={0.85} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} color="#ffd24d" intensity={2.4} distance={7} />
    </group>
  );
}
