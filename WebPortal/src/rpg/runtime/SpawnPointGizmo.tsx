// runtime/SpawnPointGizmo.tsx — éditeur du POINT DE SPAWN joueur (admin).
//
// En jeu, la souris est en POINTER-LOCK (visée FPS) → un gizmo à poignées (TransformControls)
// est insaisissable. On utilise donc le même modèle que les autres placements in-game
// (NPC/portail/récolte) : RAYCAST sous le crosshair → CLIC GAUCHE déplace le point de spawn.
// Un marqueur (pylône) montre la position courante ; un anneau suit le curseur/crosshair.
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { collisionWorld } from "./CollisionWorld";
import { spawnPointStore, useSpawnVersion } from "./spawnPointStore";
import { mapSpawn } from "./mapConfig";

export function SpawnPointGizmo({ mapId }: { mapId: string }) {
  useSpawnVersion(); // re-render quand le point change → le pylône se replace
  const { camera, gl } = useThree();
  const ringRef = useRef<THREE.Mesh>(null);
  const pos = mapSpawn(mapId); // point courant (custom store > statique)

  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    // En pointer-lock, clientX/Y restent ~centre → ray = crosshair. Hors lock, suit la souris.
    const toGround = (e: PointerEvent): THREE.Vector3 | null => {
      const r = el.getBoundingClientRect();
      if (document.pointerLockElement === el) ndc.set(0, 0);
      else ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return collisionWorld.raycastPoint(ray.ray.origin, ray.ray.direction);
    };
    const onMove = (e: PointerEvent) => {
      const p = toGround(e);
      if (p && ringRef.current) { ringRef.current.position.set(p.x, p.y + 0.03, p.z); ringRef.current.visible = true; }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const p = toGround(e); if (!p) return;
      spawnPointStore.set(mapId, [Math.round(p.x * 100) / 100, Math.round((p.y + 0.5) * 100) / 100, Math.round(p.z * 100) / 100]);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    return () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerdown", onDown); };
  }, [camera, gl, mapId]);

  return (
    <>
      {/* Anneau de visée (sous le crosshair). */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.6, 0.9, 32]} />
        <meshBasicMaterial color="#a3e635" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* Marqueur du point de spawn ACTUEL (pylône + halo). */}
      <group position={pos}>
        <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.12, 0.12, 2.4, 8]} /><meshBasicMaterial color="#a3e635" /></mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.8, 1.0, 24]} /><meshBasicMaterial color="#a3e635" transparent opacity={0.8} depthWrite={false} /></mesh>
        <mesh position={[0, 2.6, 0]}><coneGeometry args={[0.4, 0.6, 8]} /><meshBasicMaterial color="#a3e635" /></mesh>
        <Html distanceFactor={10} position={[0, 3.4, 0]}>
          <div style={{ background: "rgba(10,20,5,0.85)", color: "#a3e635", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap", border: "1px solid #a3e63555" }}>
            🚩 SPAWN — clic pour déplacer
          </div>
        </Html>
      </group>
    </>
  );
}
