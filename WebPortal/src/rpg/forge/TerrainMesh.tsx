// forge/TerrainMesh.tsx — rend un TERRAIN heightmap (éditable dans l'éditeur, collisionné en jeu).
//
// Construit une BufferGeometry grille à partir de `terrain.heights`. En mode éditable, le
// glissement du pinceau (raise/lower/smooth) modifie une copie LOCALE (réactif) puis
// committe au relâchement. En jeu, le mesh est enregistré dans collisionWorld (marchable).
import { useEffect, useMemo, useRef, useState } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { applyBrush, type TerrainData, type BrushMode } from "./terrainData";
import { collisionWorld } from "../runtime/CollisionWorld";

// Grille PLATE (size/seg) — créée UNE fois ; les hauteurs sont muté en place ensuite.
function buildGrid(size: number, seg: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2); // plan horizontal (Y up)
  return g;
}
// Écrit les hauteurs dans l'attribut position (Y) + recalcule les normales. AUCUNE alloc GPU.
function applyHeights(g: THREE.BufferGeometry, seg: number, heights: number[]): void {
  const n = seg + 1;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < n * n; k++) pos.setY(k, heights[k] ?? 0);
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

interface Props {
  terrain: TerrainData;
  editable?: boolean;
  brushMode?: BrushMode;
  brushSize?: number;
  brushStrength?: number;
  collision?: boolean;
  onCommit?: (heights: number[]) => void;
}

export function TerrainMesh({ terrain, editable, brushMode = "raise", brushSize = 8, brushStrength = 0.5, collision, onCommit }: Props) {
  // Copie locale des hauteurs pendant l'édition (réactif sans spammer le store).
  const [local, setLocal] = useState<number[]>(terrain.heights);
  useEffect(() => { setLocal(terrain.heights); }, [terrain.heights]);

  // UNE SEULE géométrie (recréée UNIQUEMENT si size/seg change) → AUCUN churn VRAM pendant
  // la sculpture (l'ancien code reconstruisait une BufferGeometry à CHAQUE pixel → Context Lost).
  const geom = useMemo(() => buildGrid(terrain.size, terrain.seg), [terrain.size, terrain.seg]);
  const meshRef = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);

  // Met à jour les hauteurs EN PLACE (mutation d'attribut, zéro alloc GPU).
  useEffect(() => { applyHeights(geom, terrain.seg, local); }, [geom, terrain.seg, local]);

  // Dispose la géométrie au remplacement (size/seg) + au démontage.
  useEffect(() => () => {
    (geom as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
    geom.dispose();
  }, [geom]);

  // Collision (en jeu) : (ré)indexe le mesh quand la géométrie change.
  useEffect(() => {
    if (!collision || !meshRef.current) return;
    const m = meshRef.current;
    m.updateMatrixWorld(true);
    collisionWorld.add(m);
  }, [collision, geom]);

  const off = terrain.offset ?? [0, 0, 0];
  const paintAt = (e: ThreeEvent<PointerEvent>) => {
    if (!editable) return;
    // Le point d'impact est en MONDE → repasse en repère local du terrain (anti-décalage si déplacé).
    const lx = e.point.x - off[0], lz = e.point.z - off[2];
    setLocal((h) => applyBrush({ ...terrain, heights: h }, lx, lz, brushMode, brushSize, brushStrength * 0.4));
  };

  return (
    <mesh
      ref={meshRef}
      geometry={geom}
      position={off}
      receiveShadow
      castShadow
      onPointerDown={editable ? (e) => { e.stopPropagation(); dragging.current = true; paintAt(e); } : undefined}
      onPointerMove={editable ? (e) => { if (dragging.current) { e.stopPropagation(); paintAt(e); } } : undefined}
      onPointerUp={editable ? () => { dragging.current = false; onCommit?.(local); } : undefined}
      onPointerLeave={editable ? () => { if (dragging.current) { dragging.current = false; onCommit?.(local); } } : undefined}
    >
      <meshStandardMaterial color={terrain.color} roughness={0.95} metalness={0} flatShading={false} />
    </mesh>
  );
}
