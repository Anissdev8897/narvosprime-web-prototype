/**
 * Npc3D.tsx - Pillier neon vertical representant un NPC sur la map.
 * Sans animation 3D pour rester leger. Sprite billboard du nom au-dessus.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position: [number, number, number];
  name: string;
  color?: string;
  hasQuest?: boolean;
  scale?: number;
  onClick: () => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

export const Npc3D: React.FC<Props> = ({ 
  position, name, color = '#7df9ff', hasQuest, scale = 1, 
  onClick, onPointerOver, onPointerOut 
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const questRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const grp = groupRef.current; if (!grp) return;
    grp.rotation.y += 0.01;
    if (hasQuest && questRef.current) {
      const t = (performance.now() % 1500) / 1500;
      questRef.current.position.y = 2.5 + 0.15 * Math.sin(t * Math.PI * 2);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={scale}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onPointerOver?.(); }}
      onPointerOut={() => { document.body.style.cursor = 'default'; onPointerOut?.(); }}
    >
      {/* Anneau au sol */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.3, 0.45, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Pilier */}
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.22, 1.4, 4, 8]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Tete */}
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshToonMaterial color="#cccccc" />
      </mesh>
      {/* Quete marker */}
      {hasQuest && (
        <mesh ref={questRef} position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}
    </group>
  );
};
