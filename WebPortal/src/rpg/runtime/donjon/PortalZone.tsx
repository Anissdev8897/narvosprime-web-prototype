// runtime/donjon/PortalZone.tsx — arche-portail dans la scène : visuel + détection de proximité.
// Le visuel = anneau d'énergie (cyan ouvert / rouge verrouillé) + disque + socle + halo.
// La proximité (distance joueur < RANGE) remonte via onProximity ; l'action (E → travelTo)
// est gérée par RpgGameWorld (key handler), comme l'embarquement vaisseau.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const RANGE = 3.8;

interface Props {
  id: string;
  position: [number, number, number];
  locked: boolean;
  rotation?: [number, number, number];
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  onProximity: (id: string, near: boolean) => void;
}

export function PortalZone({ id, position, locked, rotation = [0, 0, 0], playerPosition, onProximity }: Props) {
  const ring = useRef<THREE.Mesh>(null);
  const nearRef = useRef(false);
  const color = locked ? "#ff4040" : "#36e0ff";

  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.7;
    const p = playerPosition.current;
    const dx = p.x - position[0];
    const dz = p.z - position[2];
    const near = dx * dx + dz * dz < RANGE * RANGE;
    if (near !== nearRef.current) { nearRef.current = near; onProximity(id, near); }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* socle */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.75, 0.3, 20]} />
        <meshStandardMaterial color="#1a1320" roughness={0.9} />
      </mesh>
      {/* anneau d'énergie */}
      <mesh ref={ring} position={[0, 1.7, 0]}>
        <torusGeometry args={[1.35, 0.16, 14, 36]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} roughness={0.4} />
      </mesh>
      {/* disque translucide */}
      <mesh position={[0, 1.7, 0]}>
        <circleGeometry args={[1.3, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1.9, 0]} color={color} intensity={locked ? 5 : 11} distance={10} decay={2} />
    </group>
  );
}
