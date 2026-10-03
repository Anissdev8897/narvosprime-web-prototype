// professions/HarvestProximityTicker.tsx — UN SEUL useFrame pilote la proximité de TOUS
// les nœuds de récolte (au lieu d'un useFrame par nœud). Edge-trigger via handle.setNear.
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { harvestRegistry } from "./harvestRegistry";

const PROXIMITY = 3.4;            // m — même rayon que HarvestNode (PROXIMITY)
const PROX2 = PROXIMITY * PROXIMITY;

export function HarvestProximityTicker({ playerPosition }: { playerPosition: React.MutableRefObject<THREE.Vector3> }) {
  useFrame(() => {
    const p = playerPosition.current;
    harvestRegistry.forEach((h) => {
      const np = h.getPosition();
      const dx = p.x - np.x, dz = p.z - np.z;
      h.setNear(h.available() && dx * dx + dz * dz < PROX2);
    });
  });
  return null;
}
