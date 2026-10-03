// runtime/combat/ArrowRenderer.tsx — rendu + tick des flèches du joueur.
//
// Monté UNE fois dans la scène RPG. Chaque frame : avance le pool (arrowPool.update) puis
// pose les matrices des flèches actives sur un InstancedMesh (cylindre fin orienté selon
// la vitesse). Pas d'allocation par frame, pas de re-render React.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { arrowPool } from "./arrowSystem";

const MAX = 96; // flèches simultanées affichées

export function ArrowRenderer() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const vdir = useMemo(() => new THREE.Vector3(), []);
  const hidden = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame((_, dt) => {
    arrowPool.update(dt);
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    arrowPool.forEachActive((a) => {
      if (n >= MAX) return;
      dummy.position.copy(a.pos);
      // Oriente le cylindre (axe Y) le long de la vitesse → la flèche pointe où elle va.
      vdir.copy(a.vel).normalize();
      quat.setFromUnitVectors(up, vdir);
      dummy.quaternion.copy(quat);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      n++;
    });
    for (let i = n; i < MAX; i++) {        // slots restants → invisibles
      dummy.scale.copy(hidden);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false} castShadow>
      {/* cylindre fin ~0,9 m, axe Y → orienté sur la vitesse */}
      <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
      <meshStandardMaterial color="#d8b35a" emissive="#7a4e14" emissiveIntensity={0.5} metalness={0.3} roughness={0.6} />
    </instancedMesh>
  );
}
