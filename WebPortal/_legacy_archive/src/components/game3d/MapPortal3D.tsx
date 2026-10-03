/**
 * MapPortal3D.tsx - Teleporteurs visibles entre maps NARVOS PRIME.
 *
 * Affiche un anneau lumineux pulsant a une cellule donnee. Click = trigger
 * la transition vers une autre map (callback du parent).
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position: [number, number, number];
  color?: string;
  label?: string;
  scale?: number;
  onActivate: () => void;
}

export const MapPortal3D: React.FC<Props> = ({ position, color = '#7df9ff', label, scale = 1, onActivate }) => {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, dt) => {
    const grp = groupRef.current; if (!grp) return;
    grp.rotation.y += dt * 0.8;
    const t = (performance.now() % 2000) / 2000;
    const s = scale * (1 + 0.1 * Math.sin(t * Math.PI * 2));
    grp.scale.setScalar(s);
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onActivate(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Anneau plat au sol */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.6, 0.85, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Pilier vertical lumineux */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
      {/* Globe en haut */}
      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  );
};
