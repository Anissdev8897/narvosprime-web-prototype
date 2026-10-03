// runtime/donjon/PortalPlacementGizmo.tsx — placement d'un portail au clic (monté si placementActive).
// Mirror de NpcPlacementGizmo : raycast sol via collisionWorld.raycastPoint → anneau violet de preview ;
// clic gauche → portalStore.add avec la config courante de l'éditeur Donjon.
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { collisionWorld } from "../CollisionWorld";
import { portalAdminStore } from "./portalAdminStore";
import { portalStore } from "./portalStore";

export function PortalPlacementGizmo({ mapId }: { mapId: string }) {
  const { camera, gl } = useThree();
  const ringRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const toGround = (e: PointerEvent): THREE.Vector3 | null => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
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
      const c = portalAdminStore.get();
      portalStore.add(mapId, {
        pos: [p.x, 0, p.z], target: c.target, unlockQuest: c.unlockQuest, lockMode: c.lockMode, label: "Portail",
      });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    return () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerdown", onDown); };
  }, [camera, gl, mapId]);
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[1.0, 1.5, 32]} />
      <meshBasicMaterial color="#a06bff" transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}
