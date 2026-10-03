// ══════════════════════════════════════════════════════════════════════════════
// runtime/vehicles/ExplosionVfx.tsx — VFX d'explosion (sphère expansive + glow)
//
// Visuel simple mais punchy : 2 sphères qui grossissent et s'effacent en 1.2s.
//   • Boule intérieure : couleur du véhicule (jaune-blanc cœur)
//   • Boule extérieure : orange flame (anneau)
// Démontée automatiquement via timeout.
// ══════════════════════════════════════════════════════════════════════════════

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  position: [number, number, number];
  color: string;
  /** Durée totale (s). Démontage automatique géré par le parent. */
  duration?: number;
}

const TOTAL = 1.2;

export function ExplosionVfx({ position, color, duration = TOTAL }: Props) {
  const tRef = useRef(0);
  const inner = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame((_, dt) => {
    tRef.current += dt;
    const u = Math.min(1, tRef.current / duration); // 0 → 1

    // Profil d'expansion : grossit vite au début, ralentit + fade en fin
    const radius = 1 + Math.pow(u, 0.5) * 8;  // ease-out cubic
    const opacity = Math.max(0, 1 - u * u);   // ease-in quadratique

    if (inner.current) {
      inner.current.scale.setScalar(radius * 0.45);
      (inner.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
    if (outer.current) {
      outer.current.scale.setScalar(radius);
      (outer.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5;
    }
    if (light.current) {
      light.current.intensity = (1 - u) * 8;
      light.current.distance = radius * 3;
    }
  });

  return (
    <group position={position}>
      {/* Coeur de l'explosion — couleur véhicule */}
      <mesh ref={inner} renderOrder={500}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Anneau extérieur — flame orange */}
      <mesh ref={outer} renderOrder={499}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#ff7a3c"
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Light pulse au moment du boom */}
      <pointLight ref={light} color="#ffaa44" intensity={8} distance={30} decay={2} />
    </group>
  );
}
